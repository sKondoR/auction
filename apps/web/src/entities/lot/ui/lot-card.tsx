import type { LotCard as LotCardData } from "@auction/services";
import { lotPhase } from "@auction/domain";
import { ImageIcon } from "lucide-react";
import Link from "next/link";
import { formatRub, plural } from "@/shared/lib";
import { Countdown } from "./countdown";
import { FormatBadge } from "./lot-badges";

export function LotCard({ lot }: { lot: LotCardData }) {
  const phase = lotPhase(lot, new Date());
  return (
    <Link
      href={`/lots/${lot.id}`}
      className="group flex flex-col overflow-hidden rounded-lg border bg-surface transition-shadow hover:shadow-[0_6px_24px_-12px_rgba(60,30,10,0.35)]"
    >
      <div className="relative aspect-square bg-muted">
        {lot.thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={lot.thumbUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground/50">
            <ImageIcon className="h-10 w-10" strokeWidth={1.2} />
          </div>
        )}
        <div className="absolute left-2 top-2 flex gap-1">
          <FormatBadge format={lot.format} />
          {lot.promoted && <span className="rounded-sm bg-accent px-1.5 py-0.5 text-xs text-white">Продвигается</span>}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="line-clamp-2 text-sm leading-snug group-hover:text-primary">{lot.title}</p>
        <div className="mt-auto pt-2">
          <p className="tabular text-lg font-semibold">{formatRub(lot.price)}</p>
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {lot.format === "english"
                ? lot.bidCount > 0
                  ? `${lot.bidCount} ${plural(lot.bidCount, "ставка", "ставки", "ставок")}`
                  : "Нет ставок"
                : lot.quantity > 1
                  ? `${lot.quantity - lot.quantitySold} шт.`
                  : lot.city}
            </span>
            {phase === "open" ? <Countdown endsAt={lot.endsAt} /> : <span>{phase === "upcoming" ? "скоро" : "завершён"}</span>}
          </div>
        </div>
      </div>
    </Link>
  );
}

export function LotGrid({ lots }: { lots: LotCardData[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {lots.map((l) => (
        <LotCard key={l.id} lot={l} />
      ))}
    </div>
  );
}
