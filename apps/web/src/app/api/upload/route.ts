import { MAX_UPLOAD_BYTES, publicUrl, registerPhoto, storeImage } from "@auction/services";
import { NextResponse } from "next/server";
import { getDb, getViewer } from "@/shared/api";

export const runtime = "nodejs";

/** Загрузка фото: сжатие и превью (sharp) → S3; возвращает id для прикрепления к лоту. */
export async function POST(req: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Войдите, чтобы загружать фото" }, { status: 401 });
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Нет файла" }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "Файл больше 15 МБ" }, { status: 413 });
  try {
    const img = await storeImage(Buffer.from(await file.arrayBuffer()), `lots/${viewer.id}`);
    const id = await registerPhoto(getDb(), viewer.id, img);
    return NextResponse.json({ id, key: img.key, thumbKey: img.thumbKey, thumbUrl: publicUrl(img.thumbKey) });
  } catch (e) {
    console.error("[upload]", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Не удалось обработать изображение" }, { status: 400 });
  }
}
