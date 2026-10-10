import { ENABLED_FORMATS, type LotFormat } from "@auction/domain";
import type { TopDeal } from "@/entities/deal/server";
import { ImageIcon, type LucideIcon, Tag, TrendingDown, TrendingUp, Video, Zap } from "lucide-react";
import Link from "next/link";
import { cn, formatRub, plural } from "@/shared/lib";

/** Дорожки слева направо. Пастель — та же, что у бейджей формата (DESIGN.md). */
const LANES: { key: LotFormat; label: string; Icon: LucideIcon; tone: string; rule: string }[] = [
  { key: "english", label: "Английский", Icon: TrendingUp, tone: "bg-p-powder", rule: "border-p-powder-deep" },
  { key: "dutch", label: "Голландский", Icon: TrendingDown, tone: "bg-p-butter", rule: "border-p-butter-deep" },
  { key: "live", label: "Живой", Icon: Video, tone: "bg-p-blush", rule: "border-p-blush-deep" },
  { key: "fixed", label: "Фикс. цена", Icon: Tag, tone: "bg-p-sage", rule: "border-p-sage-deep" },
];

const MEDALS = [
  "bg-[radial-gradient(circle_at_34%_28%,#fbe38c,var(--color-gold)_52%,var(--color-gold-deep))] text-[#3b2a05]",
  "bg-[radial-gradient(circle_at_34%_28%,#ffffff,#cdd2db_55%,#8f96a3)] text-[#252a36]",
  "bg-[radial-gradient(circle_at_34%_28%,#f2c9a0,#c98a55_55%,#8a5530)] text-[#2e1a0a]",
];

const bidsText = (n: number) => `${n} ${plural(n, "ставка", "ставки", "ставок")}`;

/** Как прошла сделка — своя строка для каждого формата (термины из CONTEXT.md). */
function how(d: TopDeal): [LucideIcon, string] {
  const start = `Старт ${formatRub(d.startPrice)}`;
  switch (d.format) {
    case "fixed":
      return [Tag, d.source === "offer" ? "Продавец принял предложение цены" : "Продан по цене продавца"];
    case "dutch":
      return [TrendingDown, d.totalPrice < d.startPrice ? `${start} · купили после снижения цены` : `${start} · купили по стартовой цене`];
    case "live":
      return [Video, `${start} · ${bidsText(d.bidCount)}`];
    default:
      if (d.source === "blitz") return [Zap, d.bidCount ? `Куплен по блиц-цене после ${bidsText(d.bidCount)}` : "Куплен по блиц-цене"];
      return [TrendingUp, `${start} · ${bidsText(d.bidCount)}${d.extended ? ", торги продлевались" : ""}`];
  }
}

function DealTile({ d, rank }: { d: TopDeal; rank: number }) {
  const lead = rank === 1;
  const [Icon, text] = how(d);
  return (
    <li className={cn("group relative flex min-w-0 flex-col", lead && "col-span-2")}>
      <span
        className={cn(
          "relative block overflow-hidden rounded-lg bg-surface transition-[box-shadow,transform] duration-[350ms] ease-soft group-hover:-translate-y-1 group-hover:shadow-layer",
          lead ? "aspect-[4/3]" : "aspect-square",
        )}
      >
        {d.thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={d.thumbUrl} alt="" loading="lazy" className="size-full object-cover transition-transform duration-700 ease-soft group-hover:scale-[1.04]" />
        ) : (
          <span className="grid size-full place-items-center text-faint">
            <ImageIcon className="size-8" strokeWidth={1.25} aria-hidden />
          </span>
        )}
        <span
          className={cn(
            "absolute left-2 top-2 grid place-items-center rounded-full font-serif font-bold leading-none [font-variant-numeric:lining-nums]",
            "shadow-[inset_0_0_0_1px_rgba(0,0,0,0.18),inset_0_0_0_3px_rgba(255,255,255,0.28),0_3px_8px_-3px_rgba(27,31,28,0.45)]",
            lead ? "size-9 text-base" : "size-7 text-sm",
            MEDALS[rank - 1],
          )}
        >
          <span className="sr-only">Место </span>
          {rank}
        </span>
      </span>
      <p className={cn("tabular mt-2.5 font-semibold leading-tight", lead ? "text-xl" : "text-base")}>{formatRub(d.totalPrice)}</p>
      <h4 className={cn("mt-1 line-clamp-2 leading-snug", lead ? "text-sm font-medium" : "text-[0.8125rem] text-muted-foreground")}>{d.title}</h4>
      {lead && (
        <p className="tabular mt-1.5 flex items-start gap-1.5 text-[0.8125rem] leading-snug text-muted-foreground">
          <Icon className="mt-px size-3.5 shrink-0 text-foreground" strokeWidth={1.5} aria-hidden />
          <span>{text}</span>
        </p>
      )}
      <Link href={`/lots/${d.lotId}`} aria-label={`Открыть лот: ${d.title}`} className="absolute inset-0 z-[1] rounded-lg" />
    </li>
  );
}

/**
 * Топ сделок недели — четыре дорожки, по одной на формат торгов: в каждой до трёх самых дорогих сделок,
 * первая крупно, две под ней. Места 1–3 — «монеты»: золото, серебро, бронза. На узких экранах дорожки листаются вбок.
 */
export function TopDeals({ lanes, period }: { lanes: Record<LotFormat, TopDeal[]>; period: string }) {
  return (
    <>
      <div className="mb-8 flex flex-col items-center gap-1.5 text-center">
        <h2 id="deals-h" className="section-title">
          Топ сделок недели
        </h2>
        <p className="text-sm text-muted-foreground">{period}</p>
      </div>
      <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 sm:-mx-5 sm:scroll-px-5 sm:px-5 lg:mx-0 lg:grid lg:grid-cols-4 lg:gap-5 lg:overflow-visible lg:px-0">
        {LANES.map(({ key, label, Icon, tone, rule }) => {
          const list = lanes[key];
          return (
            <section key={key} aria-label={label} className={cn("flex w-[280px] shrink-0 snap-start flex-col rounded-lg px-3 pb-4 sm:w-[300px] lg:w-auto", tone)}>
              <h3 className={cn("label-caps flex items-center gap-2 border-b py-3.5 text-foreground", rule)}>
                <Icon className="size-4 shrink-0" strokeWidth={1.5} aria-hidden />
                {label}
              </h3>
              {list.length > 0 ? (
                <ol className="mt-3.5 grid grid-cols-2 gap-x-3 gap-y-5">
                  {list.map((d, k) => (
                    <DealTile key={d.id} d={d} rank={k + 1} />
                  ))}
                </ol>
              ) : (
                <p className="m-auto px-2 py-10 text-center text-sm text-muted-foreground">
                  {ENABLED_FORMATS.includes(key) ? "За неделю сделок не было" : "Формат скоро появится"}
                </p>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
