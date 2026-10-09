"use client";

import type { LotFormat } from "@auction/domain";
import type { TopDeal } from "@/entities/deal/server";
import { ImageIcon, type LucideIcon, Tag, TrendingDown, TrendingUp, Video, Zap } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { cn, formatRub, plural } from "@/shared/lib";

const FORMATS: { key: LotFormat; tab: string; badge: string; tone: string }[] = [
  { key: "english", tab: "Английский аукцион", badge: "Английский", tone: "bg-p-powder" },
  { key: "dutch", tab: "Голландский аукцион", badge: "Голландский", tone: "bg-p-butter" },
  { key: "live", tab: "Живой аукцион", badge: "Живой", tone: "bg-p-blush" },
  { key: "fixed", tab: "Фиксированная цена", badge: "Фикс. цена", tone: "bg-p-sage" },
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

const dayMonth = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", timeZone: "Europe/Moscow" });

function DealCard({ d, rank, delay }: { d: TopDeal; rank: number; delay: number | null }) {
  const f = FORMATS.find((x) => x.key === d.format)!;
  const [Icon, text] = how(d);
  return (
    <li
      style={delay === null ? undefined : { animationDelay: `${delay}ms` }}
      className={cn(
        "group relative grid grid-cols-[104px_minmax(0,1fr)] gap-4 rounded-lg border border-border bg-surface py-3 pl-3 pr-3.5 shadow-rest transition-[box-shadow,border-color,transform] duration-300 ease-soft hover:-translate-y-0.5 hover:border-transparent hover:shadow-lift sm:grid-cols-[176px_minmax(0,1fr)] sm:gap-6 sm:py-4 sm:pl-4 sm:pr-5",
        delay !== null && "motion-safe:animate-rise",
      )}
    >
      <div className="relative aspect-square self-start rounded-lg bg-well">
        {d.thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={d.thumbUrl} alt="" loading="lazy" className="size-full rounded-lg object-cover" />
        ) : (
          <span className="grid size-full place-items-center text-faint">
            <ImageIcon className="size-8" strokeWidth={1.25} aria-hidden />
          </span>
        )}
        <span
          className={cn(
            "absolute -bottom-2 -left-2 grid size-[34px] place-items-center rounded-full font-serif text-base font-bold leading-none [font-variant-numeric:lining-nums] sm:-bottom-2.5 sm:-left-2.5 sm:size-[42px] sm:text-lg",
            rank <= 3
              ? cn(MEDALS[rank - 1], "shadow-[inset_0_0_0_1px_rgba(0,0,0,0.18),inset_0_0_0_4px_rgba(255,255,255,0.28),0_4px_10px_-3px_rgba(27,31,28,0.45)]")
              : "border border-border-strong bg-surface text-foreground",
          )}
        >
          <span className="sr-only">Место </span>
          {rank}
        </span>
      </div>
      <div className="flex min-w-0 flex-col">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <span className={cn("inline-flex items-center rounded-xs px-2 py-1 text-[0.6875rem] font-semibold uppercase leading-tight tracking-[0.08em] text-foreground", f.tone)}>
            {f.badge}
          </span>
          <time dateTime={new Date(d.createdAt).toISOString()} className="tabular whitespace-nowrap text-[0.8125rem] text-muted-foreground">
            завершён {dayMonth.format(new Date(d.createdAt))}
          </time>
        </div>
        <h3 className="mt-2.5 line-clamp-2 font-sans text-[0.9375rem] font-medium leading-[1.35]">{d.title}</h3>
        <p className="tabular mt-1.5 text-xl font-semibold leading-tight sm:text-2xl">{formatRub(d.totalPrice)}</p>
        <p className="tabular mt-1 flex items-start gap-1.5 text-sm leading-snug text-muted-foreground">
          <Icon className="mt-px size-4 shrink-0 text-foreground" strokeWidth={1.5} aria-hidden />
          <span>{text}</span>
        </p>
        <div className="mt-auto flex min-w-0 items-center gap-2 pt-3.5 text-sm">
          <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full bg-sage-mist text-xs font-semibold text-primary">
            {d.sellerName.slice(0, 2).toUpperCase()}
          </span>
          <span className="truncate font-medium">{d.sellerName}</span>
          {d.sellerScore > 0 && (
            <span className="tabular shrink-0 rounded-xs bg-action px-[7px] py-[3px] text-xs font-semibold leading-tight text-white">
              <span className="sr-only">рейтинг </span>
              {d.sellerScore.toLocaleString("ru-RU")}
            </span>
          )}
        </div>
      </div>
      <Link href={`/lots/${d.lotId}`} aria-label={`Открыть лот: ${d.title}`} className="absolute inset-0 z-[1] rounded-lg" />
    </li>
  );
}

/**
 * Топ сделок недели: до 6 самых дорогих продаж, фильтр по формату торгов.
 * Места 1–3 — «монеты»: золото, серебро, бронза. Номера мест считаются внутри формата.
 */
export function TopDeals({ deals, period }: { deals: TopDeal[]; period: string }) {
  const [format, setFormat] = useState<LotFormat | "all">("all");
  const [swap, setSwap] = useState(0);
  const present = FORMATS.filter((f) => deals.some((d) => d.format === f.key));
  const rows = deals.filter((d) => format === "all" || d.format === format).slice(0, 6);
  const tabs: [LotFormat | "all", string][] = [["all", "Все форматы"], ...present.map((f) => [f.key, f.tab] as [LotFormat, string])];

  return (
    <>
      <div className="mb-8 flex flex-col items-stretch gap-5 sm:items-center">
        <div className="grid w-full grid-cols-[1fr_auto] items-end gap-4 lg:grid-cols-[1fr_auto_1fr]">
          <h2 id="deals-h" className="section-title lg:col-start-2 lg:text-center">
            Топ сделок недели
          </h2>
        </div>
        <p className="-mt-3.5 text-sm text-muted-foreground sm:-mt-3">{period}</p>
        {present.length > 1 && (
          <div
            role="group"
            aria-label="Формат торгов"
            className="no-scrollbar bleed flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0"
          >
            {tabs.map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={format === key}
                onClick={() => {
                  if (format === key) return;
                  setFormat(key);
                  setSwap((s) => s + 1);
                }}
                className="h-9 shrink-0 cursor-pointer rounded-full border border-border bg-surface px-4 text-sm font-medium leading-none transition-colors hover:border-border-strong aria-pressed:border-action aria-pressed:bg-action aria-pressed:text-white"
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
      <ol key={swap} className="grid gap-x-6 gap-y-5 lg:grid-cols-2">
        {rows.map((d, k) => (
          <DealCard key={d.id} d={d} rank={k + 1} delay={swap ? k * 45 : null} />
        ))}
      </ol>
    </>
  );
}
