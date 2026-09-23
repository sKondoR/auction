"use client";

import { ArrowLeft, ArrowRight, ImagePlus, Loader2, X } from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "../lib";

export interface UploadedPhoto {
  id: number;
  thumbUrl: string;
  key: string;
  thumbKey: string;
}

/**
 * Загрузка фото: сжатие и превью делает сервер (/api/upload). Порядок задаётся
 * стрелками; первое фото — обложка.
 */
export function PhotoUploader({
  initial = [],
  max = 20,
  name = "photoIds",
  onChange,
}: {
  initial?: UploadedPhoto[];
  max?: number;
  name?: string;
  onChange?: (photos: UploadedPhoto[]) => void;
}) {
  const [photos, setPhotos] = useState<UploadedPhoto[]>(initial);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const update = (next: UploadedPhoto[]) => {
    setPhotos(next);
    onChange?.(next);
  };

  async function upload(files: FileList) {
    setError(null);
    const list = Array.from(files).slice(0, max - photos.length);
    setUploading(list.length);
    const added: UploadedPhoto[] = [];
    for (const file of list) {
      const body = new FormData();
      body.append("file", file);
      try {
        const res = await fetch("/api/upload", { method: "POST", body });
        const data = (await res.json()) as UploadedPhoto & { error?: string };
        if (!res.ok) throw new Error(data.error ?? "Ошибка загрузки");
        added.push(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ошибка загрузки");
      }
      setUploading((n) => n - 1);
    }
    update([...photos, ...added]);
  }

  const move = (i: number, d: -1 | 1) => {
    const next = [...photos];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j]!, next[i]!];
    update(next);
  };

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name={name} value={photos.map((p) => p.id).join(",")} />
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {photos.map((p, i) => (
          <div key={p.id} className={cn("group relative aspect-square overflow-hidden rounded-md border bg-muted", i === 0 && "ring-2 ring-accent")}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.thumbUrl} alt="" className="h-full w-full object-cover" />
            {i === 0 && <span className="absolute left-1 top-1 rounded-sm bg-accent px-1 text-[10px] text-white">обложка</span>}
            <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/50 p-1 opacity-0 transition-opacity group-hover:opacity-100">
              <button type="button" onClick={() => move(i, -1)} className="text-white" aria-label="Левее">
                <ArrowLeft className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => update(photos.filter((x) => x.id !== p.id))} className="text-white" aria-label="Удалить">
                <X className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => move(i, 1)} className="text-white" aria-label="Правее">
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
        {Array.from({ length: uploading }).map((_, i) => (
          <div key={`u${i}`} className="flex aspect-square items-center justify-center rounded-md border bg-muted">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ))}
        {photos.length + uploading < max && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-md border border-dashed bg-surface text-xs text-muted-foreground hover:border-accent hover:text-foreground"
          >
            <ImagePlus className="h-6 w-6" />
            Добавить
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) void upload(e.target.files);
          e.target.value = "";
        }}
      />
      <p className="text-xs text-muted-foreground">
        До {max} фото, JPEG/PNG/WebP/HEIC до 15 МБ. Фото автоматически сжимаются. {photos.length}/{max}
      </p>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
