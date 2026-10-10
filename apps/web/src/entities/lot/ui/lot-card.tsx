import type { LotCard as LotCardData } from "@auction/services";
import { lotPhase } from "@auction/domain";
import { ImageIcon } from "lucide-react";
import Link from "next/link";
import { cn, formatRub, plural } from "@/shared/lib";
import { Countdown } from "./countdown";
import { FormatBadge } from "./lot-badges";

/**
 * Карточка лота (DESIGN.md → Cards): без собственного фона и рамки, фото 1:1 на фотоколодце,
 * название в две строки, цена табличными цифрами, мета со ставками и временем.
 */
export function LotCard({ lot }: { lot: LotCardData }) {
  const phase = lotPhase(lot, new Date());
  const isAuction = lot.format === "english" || lot.format === "dutch" || lot.format === "live";
  const bids = lot.bidCount > 0 ? `${lot.bidCount} ${plural(lot.bidCount, "ставка", "ставки", "ставок")}` : "Нет ставок";
  return (
    <Link href={`/lots/${lot.id}`} className="group block rounded-lg focus-visible:outline-offset-4">
      <div className="relative aspect-square overflow-hidden rounded-lg bg-well transition-[transform,box-shadow] duration-300 ease-soft group-hover:-translate-y-0.75 group-hover:shadow-lift">
        {lot.thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={lot.thumbUrl}
            alt=""
            className="size-full object-cover transition-transform duration-500 ease-soft group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-faint">
            <ImageIcon className="size-10" strokeWidth={1.25} aria-hidden />
          </div>
        )}
        <div className="absolute left-2.5 top-2.5 flex flex-wrap gap-1">
          <FormatBadge format={lot.format} />
          {lot.promoted && (
            <span className="rounded-xs bg-brass-soft px-2 py-1 text-[0.6875rem] font-semibold uppercase leading-none tracking-[0.08em] text-[#6f521a]">
              Продвигается
            </span>
          )}
        </div>
      </div>
      <h3 className="mt-3 line-clamp-2 min-h-[2.7em] font-sans text-[0.9375rem] font-medium leading-[1.35] text-foreground">{lot.title}</h3>
      <p className="tabular mt-2 text-lg font-semibold leading-tight">{formatRub(lot.price)}</p>
      <div className="tabular mt-1 flex flex-wrap items-center gap-x-1.5 text-sm leading-snug text-muted-foreground">
        {isAuction ? (
          <span>{bids}</span>
        ) : (
          <span>{lot.quantity > 1 ? `${lot.quantity - lot.quantitySold} шт. · ${lot.city}` : lot.city}</span>
        )}
        <span aria-hidden>·</span>
        {phase === "open" ? <Countdown endsAt={lot.endsAt} /> : <span>{phase === "upcoming" ? "скоро начнутся" : "завершён"}</span>}
      </div>
    </Link>
  );
}

/** Сетка выдачи: 2 → 3 → 4 → 5 колонок. */
export function LotGrid({ lots, className }: { lots: LotCardData[]; className?: string }) {
  return (
    <ul className={cn("grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4 xl:grid-cols-5", className)}>
      {lots.map((l) => (
        <li key={l.id}>
          <LotCard lot={l} />
        </li>
      ))}
    </ul>
  );
}

/** Ряд-карусель витрины: сетка на десктопе, горизонтальный скролл со «снапом» ниже 1024px. */
export function LotRow({ lots, columns = 5 }: { lots: LotCardData[]; columns?: 4 | 5 }) {
  return (
    <ul
      className={cn(
        "bleed flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 scroll-px-4 sm:px-5 lg:mx-0 lg:grid lg:gap-6 lg:overflow-visible lg:px-0 lg:pb-0",
        columns === 5 ? "lg:grid-cols-4 xl:grid-cols-5" : "lg:grid-cols-4",
      )}
    >
      {lots.slice(0, columns).map((l, i) => (
        <li key={l.id} className={cn("w-[64%] shrink-0 snap-start sm:w-[38%] lg:w-auto", i === 4 && "lg:hidden xl:block")}>
          <LotCard lot={l} />
        </li>
      ))}
    </ul>
  );
}
