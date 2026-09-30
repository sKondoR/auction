"use client";

import { ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "@/shared/lib";

export function LotGallery({ photos, title }: { photos: { id: number; url: string; thumbUrl: string }[]; title: string }) {
  const [i, setI] = useState(0);
  if (photos.length === 0) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-lg bg-well text-faint">
        <ImageIcon className="size-16" strokeWidth={1.25} aria-hidden />
      </div>
    );
  }
  const current = photos[i]!;
  const go = (d: number) => setI((x) => (x + d + photos.length) % photos.length);
  return (
    <div className="flex flex-col gap-3">
      <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg bg-well">
        <a href={current.url} target="_blank" rel="noreferrer" className="h-full w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={current.url} alt={title} className="h-full w-full object-contain" />
        </a>
        {photos.length > 1 && (
          <>
            <button onClick={() => go(-1)} className="absolute left-3 grid size-11 cursor-pointer place-items-center rounded-full bg-surface text-foreground shadow-lift hover:bg-sage-mist" aria-label="Предыдущее фото">
              <ChevronLeft className="size-5" strokeWidth={1.5} />
            </button>
            <button onClick={() => go(1)} className="absolute right-3 grid size-11 cursor-pointer place-items-center rounded-full bg-surface text-foreground shadow-lift hover:bg-sage-mist" aria-label="Следующее фото">
              <ChevronRight className="size-5" strokeWidth={1.5} />
            </button>
            <span className="tabular absolute bottom-3 right-3 rounded-full bg-surface px-3 py-1 text-sm font-medium text-foreground">
              {i + 1} / {photos.length}
            </span>
          </>
        )}
      </div>
      {photos.length > 1 && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {photos.map((p, idx) => (
            <button
              key={p.id}
              onClick={() => setI(idx)}
              aria-label={`Фото ${idx + 1}`}
              aria-current={idx === i || undefined}
              className={cn("size-16 shrink-0 cursor-pointer overflow-hidden rounded-md border-2 bg-well", idx === i ? "border-primary" : "border-transparent opacity-70 hover:opacity-100")}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.thumbUrl} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
