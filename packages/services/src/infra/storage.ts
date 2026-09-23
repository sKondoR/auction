import { randomUUID } from "node:crypto";
import { DeleteObjectsCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import sharp from "sharp";

/** S3-совместимое хранилище: MinIO локально, Yandex Object Storage в облаке. */
let client: S3Client | null = null;

function s3(): S3Client {
  client ??= new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? "ru-central1",
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY ?? "",
      secretAccessKey: process.env.S3_SECRET_KEY ?? "",
    },
  });
  return client;
}

const bucket = () => process.env.S3_BUCKET ?? "auction";

export function publicUrl(key: string): string {
  const base = process.env.S3_PUBLIC_URL ?? `${process.env.S3_ENDPOINT}/${bucket()}`;
  return `${base}/${key}`;
}

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const FULL_SIZE = 1600;
const THUMB_SIZE = 400;

export interface StoredImage {
  key: string;
  thumbKey: string;
  width: number;
  height: number;
}

/** Сжатие фото: полноразмерное (до 1600px) и превью (400px), формат WebP. */
export async function storeImage(input: Buffer, prefix: string): Promise<StoredImage> {
  if (input.byteLength > MAX_UPLOAD_BYTES) throw new Error("Файл больше 15 МБ");
  const base = sharp(input, { failOn: "error" }).rotate();
  const meta = await base.metadata();
  if (!meta.format || !["jpeg", "png", "webp", "heif", "avif", "gif", "tiff"].includes(meta.format)) {
    throw new Error("Неподдерживаемый формат изображения");
  }
  const full = await base
    .clone()
    .resize(FULL_SIZE, FULL_SIZE, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });
  const thumb = await base
    .clone()
    .resize(THUMB_SIZE, THUMB_SIZE, { fit: "cover" })
    .webp({ quality: 75 })
    .toBuffer();

  const id = randomUUID();
  const key = `${prefix}/${id}.webp`;
  const thumbKey = `${prefix}/${id}_thumb.webp`;
  await Promise.all([
    s3().send(
      new PutObjectCommand({ Bucket: bucket(), Key: key, Body: full.data, ContentType: "image/webp", CacheControl: "public, max-age=31536000, immutable" }),
    ),
    s3().send(
      new PutObjectCommand({ Bucket: bucket(), Key: thumbKey, Body: thumb, ContentType: "image/webp", CacheControl: "public, max-age=31536000, immutable" }),
    ),
  ]);
  return { key, thumbKey, width: full.info.width, height: full.info.height };
}

export async function deleteObjects(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  await s3().send(
    new DeleteObjectsCommand({ Bucket: bucket(), Delete: { Objects: keys.map((Key) => ({ Key })) } }),
  );
}
