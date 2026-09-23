"use client";

import { ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "@/shared/lib";

export function LotGallery({ photos, title }: { photos: { id: number; url: string; thumbUrl: string }[]; title: string }) {
  const [i, setI] = useState(0);
  if (photos.length === 0) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-lg border bg-muted text-muted-foreground/60">
        <ImageIcon className="h-16 w-16" strokeWidth={1} />
      </div>
    );
  }
  const current = photos[i]!;
  const go = (d: number) => setI((x) => (x + d + photos.length) % photos.length);
  return (
    <div className="flex flex-col gap-2">
      <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg border bg-[#1f1a17]">
        <a href={current.url} target="_blank" rel="noreferrer" className="h-full w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={current.url} alt={title} className="h-full w-full object-contain" />
        </a>
        {photos.length > 1 && (
          <>
            <button onClick={() => go(-1)} className="absolute left-2 rounded-full bg-black/40 p-2 text-white hover:bg-black/60" aria-label="Предыдущее фото">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button onClick={() => go(1)} className="absolute right-2 rounded-full bg-black/40 p-2 text-white hover:bg-black/60" aria-label="Следующее фото">
              <ChevronRight className="h-5 w-5" />
            </button>
            <span className="absolute bottom-2 right-2 rounded bg-black/50 px-2 py-0.5 text-xs text-white">
              {i + 1} / {photos.length}
            </span>
          </>
        )}
      </div>
      {photos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {photos.map((p, idx) => (
            <button
              key={p.id}
              onClick={() => setI(idx)}
              className={cn("h-16 w-16 shrink-0 overflow-hidden rounded-md border-2", idx === i ? "border-accent" : "border-transparent opacity-70")}
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
