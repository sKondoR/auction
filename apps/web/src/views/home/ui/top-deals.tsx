import { ENABLED_FORMATS, type LotFormat } from "@auction/domain";
import type { LotCard } from "@auction/services";
import type { TopDeal } from "@/entities/deal/server";
import { Gavel, ImageIcon, type LucideIcon, Tag, TrendingDown, TrendingUp, Video, Zap } from "lucide-react";
import Link from "next/link";
import { cn, formatRub, plural } from "@/shared/lib";

/** Дорожки слева направо. Стоят вплотную, фон чередуется: пудра — масло. */
const LANES: { key: LotFormat; label: string; Icon: LucideIcon; tone: string; rule: string }[] = [
  { key: "english", label: "Английский", Icon: TrendingUp, tone: "bg-p-powder", rule: "border-p-powder-deep" },
  { key: "dutch", label: "Голландский", Icon: TrendingDown, tone: "bg-p-butter", rule: "border-p-butter-deep" },
  { key: "live", label: "Живой", Icon: Video, tone: "bg-p-powder", rule: "border-p-powder-deep" },
  { key: "fixed", label: "Фикс. цена", Icon: Tag, tone: "bg-p-butter", rule: "border-p-butter-deep" },
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

/** Предстоящие торги: сколько ставок или что лот продаётся по цене продавца. */
function upcomingHow(l: LotCard): [LucideIcon, string] {
  if (l.format === "fixed") return [Tag, l.quantity - l.quantitySold > 1 ? `Цена продавца · ${l.quantity - l.quantitySold} шт.` : "Цена продавца"];
  return [Gavel, l.bidCount ? bidsText(l.bidCount) : "Ставок пока нет"];
}

const dayMonth = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", timeZone: "Europe/Moscow" });

type Tile = { id: number; lotId: number; title: string; thumbUrl: string | null; price: number; how: [LucideIcon, string]; date: Date; dateText: string };

const dealTile = (d: TopDeal): Tile => ({
  id: d.id,
  lotId: d.lotId,
  title: d.title,
  thumbUrl: d.thumbUrl,
  price: d.totalPrice,
  how: how(d),
  date: new Date(d.createdAt),
  dateText: `завершён ${dayMonth.format(new Date(d.createdAt))}`,
});

const upcomingTile = (l: LotCard): Tile => ({
  id: l.id,
  lotId: l.id,
  title: l.title,
  thumbUrl: l.thumbUrl,
  price: l.price,
  how: upcomingHow(l),
  date: new Date(l.endsAt),
  dateText: `до ${dayMonth.format(new Date(l.endsAt))}`,
});

/** `rank` — место среди сделок; у предстоящих торгов мест нет. */
function DealTile({ t, lead, rank }: { t: Tile; lead: boolean; rank?: number }) {
  const [Icon, text] = t.how;
  return (
    <li className={cn("group relative flex min-w-0 flex-col", lead && "col-span-2")}>
      <span
        className={cn(
          "relative block overflow-hidden rounded-lg bg-surface transition-[box-shadow,transform] duration-[350ms] ease-soft group-hover:-translate-y-1 group-hover:shadow-layer",
          lead ? "aspect-[4/3]" : "aspect-square",
        )}
      >
        {t.thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={t.thumbUrl} alt="" loading="lazy" className="size-full object-cover transition-transform duration-700 ease-soft group-hover:scale-[1.04]" />
        ) : (
          <span className="grid size-full place-items-center text-faint">
            <ImageIcon className="size-8" strokeWidth={1.25} aria-hidden />
          </span>
        )}
        {rank !== undefined && (
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
        )}
      </span>
      <div className="mt-2.5 flex flex-wrap items-baseline justify-between gap-x-2">
        <p className={cn("font-serif font-normal leading-none [font-variant-numeric:lining-nums]", lead ? "text-[1.625rem]" : "text-xl")}>{formatRub(t.price)}</p>
        <time dateTime={t.date.toISOString()} className="tabular whitespace-nowrap text-xs text-muted-foreground">
          {t.dateText}
        </time>
      </div>
      <h4 className={cn("mt-1 line-clamp-2 leading-snug", lead ? "text-sm font-medium" : "text-[0.8125rem] text-muted-foreground")}>{t.title}</h4>
      {lead && (
        <p className="tabular mt-1.5 flex items-start gap-1.5 text-[0.8125rem] leading-snug text-muted-foreground">
          <Icon className="mt-px size-3.5 shrink-0 text-foreground" strokeWidth={1.5} aria-hidden />
          <span>{text}</span>
        </p>
      )}
      <Link href={`/lots/${t.lotId}`} aria-label={`Открыть лот: ${t.title}`} className="absolute inset-0 z-[1] rounded-lg" />
    </li>
  );
}

/** Дорожка формата: сделки недели или, если их нет, предстоящие торги. */
export type DealLane = { kind: "deals"; items: TopDeal[] } | { kind: "upcoming"; items: LotCard[] };

/**
 * Топ сделок недели — четыре дорожки, по одной на формат торгов: в каждой до трёх самых дорогих сделок,
 * первая крупно, две под ней. Места 1–3 — «монеты»: золото, серебро, бронза. Если сделок в формате за неделю нет,
 * дорожка показывает предстоящие торги с датой окончания. На узких экранах дорожки листаются вбок.
 */
export function TopDeals({ lanes, period }: { lanes: Record<LotFormat, DealLane>; period: string }) {
  return (
    <>
      <div className="mb-8 flex flex-col items-center gap-1.5 text-center">
        <h2 id="deals-h" className="section-title">
          Топ сделок недели
        </h2>
        <p className="text-sm text-muted-foreground">{period}</p>
      </div>
      <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 overflow-x-auto px-4 sm:-mx-5 sm:scroll-px-5 sm:px-5 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0">
        {LANES.map(({ key, label, Icon, tone, rule }) => {
          const lane = lanes[key];
          const tiles = lane.kind === "deals" ? lane.items.map(dealTile) : lane.items.map(upcomingTile);
          return (
            <section key={key} aria-label={label} className={cn("flex w-[280px] shrink-0 snap-start flex-col px-4 pb-5 first:rounded-l-lg last:rounded-r-lg sm:w-[300px] lg:w-auto", tone)}>
              <h3 className={cn("label-caps flex items-center gap-2 border-b py-3.5 font-sans text-foreground", rule)}>
                <Icon className="size-4 shrink-0" strokeWidth={1.5} aria-hidden />
                {label}
                {lane.kind === "upcoming" && tiles.length > 0 && (
                  <span className="ml-auto text-xs font-medium normal-case tracking-normal text-muted-foreground">{key === "fixed" ? "в продаже" : "идут торги"}</span>
                )}
              </h3>
              {tiles.length > 0 ? (
                <ol className="mt-3.5 grid grid-cols-2 gap-x-3 gap-y-5">
                  {tiles.map((t, k) => (
                    <DealTile key={t.id} t={t} lead={k === 0} rank={lane.kind === "deals" ? k + 1 : undefined} />
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
