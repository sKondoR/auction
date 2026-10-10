import { ENABLED_FORMATS, type LotFormat, remaining } from "@auction/domain";
import type { LotCard } from "@auction/services";
import type { TopDeal } from "@/entities/deal/server";
import { Gavel, ImageIcon, type LucideIcon, Tag, TrendingDown, TrendingUp, Video, Zap } from "lucide-react";
import Link from "next/link";
import { cn, formatRub, plural } from "@/shared/lib";

/** Дорожки слева направо. Стоят вплотную, фон чередуется: пудра — масло. */
const LANES: { key: LotFormat; label: string; Icon: LucideIcon }[] = [
  { key: "english", label: "Английский", Icon: TrendingUp },
  { key: "dutch", label: "Голландский", Icon: TrendingDown },
  { key: "live", label: "Живой", Icon: Video },
  { key: "fixed", label: "Фикс. цена", Icon: Tag },
];
/** Фон дорожки — по чётности. */
const LANE_TONES = ["bg-p-powder", "bg-p-butter"] as const;

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
  if (l.format === "fixed") return [Tag, remaining(l) > 1 ? `Цена продавца · ${remaining(l)} шт.` : "Цена продавца"];
  return [Gavel, l.bidCount ? bidsText(l.bidCount) : "Ставок пока нет"];
}

const dayMonth = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", timeZone: "Europe/Moscow" });

type Tile = { id: number; lotId: number; title: string; thumbUrl: string | null; price: number; how: [LucideIcon, string]; date: Date; datePrefix: string };

const dealTile = (d: TopDeal): Tile => ({
  id: d.id,
  lotId: d.lotId,
  title: d.title,
  thumbUrl: d.thumbUrl,
  price: d.totalPrice,
  how: how(d),
  date: new Date(d.createdAt),
  datePrefix: "завершён",
});

const upcomingTile = (l: LotCard): Tile => ({
  id: l.id,
  lotId: l.id,
  title: l.title,
  thumbUrl: l.thumbUrl,
  price: l.price,
  how: upcomingHow(l),
  date: new Date(l.endsAt),
  datePrefix: "до",
});

/** `rank` — место среди сделок; у предстоящих торгов мест нет. */
function DealTile({ t, lead, rank }: { t: Tile; lead: boolean; rank?: number }) {
  const [Icon, text] = t.how;
  return (
    <li className={cn("group relative flex min-w-0 flex-col", lead && "col-span-2")}>
      <span
        className={cn(
          "relative block rounded-lg bg-surface",
          lead ? "aspect-4/3" : "aspect-square",
        )}
      >
        {/* Обрезка — только у фото: кружок места на четверть выходит за угол. */}
        <span className="absolute inset-0 overflow-hidden rounded-lg">
          {t.thumbUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={t.thumbUrl} alt="" loading="lazy" className="size-full object-cover transition-transform duration-700 ease-soft group-hover:scale-[1.1]" />
          ) : (
            <span className="grid size-full place-items-center text-faint">
              <ImageIcon className="size-8" strokeWidth={1.25} aria-hidden />
            </span>
          )}
        </span>
        {rank !== undefined && (
          <span
            className={cn(
              "pointer-events-none absolute left-0 top-0 z-2 grid translate-x-[-18%] translate-y-[-18%] place-items-center rounded-full font-sans font-semibold leading-none tabular-nums",
              rank === 1 ? "bg-accent text-primary" : "bg-primary text-primary-foreground",
              "shadow-[0_0_0_2px_rgba(255,255,255,0.9),0_2px_6px_-2px_rgba(0,0,0,0.4)]",
              lead ? "size-8 text-sm" : "size-6 text-xs",
            )}
          >
            <span className="sr-only">Место </span>
            {rank}
          </span>
        )}
        <span
          className={cn(
            "absolute inset-x-0 bottom-0 flex flex-col rounded-b-lg bg-linear-to-t from-black/75 via-black/40 to-transparent font-sans text-white",
            lead ? "gap-1 px-3 pb-2.5 pt-10" : "gap-0.5 px-2 pb-2 pt-8",
          )}
        >
          <time dateTime={t.date.toISOString()} className={cn("tabular-nums uppercase tracking-wide text-white/75", lead ? "text-[0.6875rem]" : "text-[0.625rem]")}>
            {t.datePrefix} {dayMonth.format(t.date)}
          </time>
          <span className={cn("font-semibold leading-none tabular-nums", lead ? "text-2xl" : "text-base")}>{formatRub(t.price)}</span>
        </span>
      </span>
      {/* Высота названия и строки «как прошла» зарезервирована на две строки, чтобы нижний ряд плиток стоял ровно во всех дорожках. */}
      <h4 className={cn("mt-2 line-clamp-2 min-h-[2lh] font-sans leading-snug text-foreground", lead ? "text-[0.9375rem] font-semibold" : "text-[0.8125rem] font-medium")}>{t.title}</h4>
      {lead && (
        <p className="tabular mt-1 flex min-h-[2lh] items-start gap-1.5 text-[0.8125rem] leading-snug text-muted-foreground">
          <Icon className="mt-px size-3.5 shrink-0 text-foreground" strokeWidth={1.5} aria-hidden />
          <span className="line-clamp-2">{text}</span>
        </p>
      )}
      <Link href={`/lots/${t.lotId}`} aria-label={`Открыть лот: ${t.title}`} className="absolute inset-0 z-1 rounded-lg" />
    </li>
  );
}

/** Дорожка формата: сделки недели или, если их нет, предстоящие торги. */
export type DealLane = { kind: "deals"; items: TopDeal[] } | { kind: "upcoming"; items: LotCard[] };

/**
 * Топ сделок недели — четыре дорожки, по одной на формат торгов: в каждой до трёх самых дорогих сделок,
 * первая крупно, две под ней. Место — кружок: первое жёлтое, остальные тёмно-синие; цена и дата лежат на фото. Если сделок в формате за неделю нет,
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
        {LANES.map(({ key, label, Icon }, i) => {
          const tone = LANE_TONES[i % 2];
          const lane = lanes[key];
          const tiles = lane.kind === "deals" ? lane.items.map(dealTile) : lane.items.map(upcomingTile);
          return (
            <section key={key} aria-label={label} className={cn("flex w-70 shrink-0 snap-start flex-col px-4 pb-5 first:rounded-l-lg last:rounded-r-lg sm:w-75 lg:w-auto", tone)}>
              <h3 className="flex items-center gap-2 pb-1.5 pt-5 font-sans text-[1.375rem] font-semibold leading-tight text-foreground">
                <Icon className="size-6 shrink-0" strokeWidth={1.75} aria-hidden />
                {label}
                {lane.kind === "upcoming" && tiles.length > 0 && (
                  <span className="ml-auto text-xs font-medium text-muted-foreground">{key === "fixed" ? "в продаже" : "идут торги"}</span>
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
