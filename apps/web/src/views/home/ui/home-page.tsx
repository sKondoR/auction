import { getSettings, lots } from "@auction/db";
import { ENGLISH_MAX_DAYS, ENGLISH_MIN_DAYS, FIXED_MAX_DAYS, MAX_PHOTOS, formatRub } from "@auction/domain";
import { type LotCard, lotCards, openNow } from "@auction/services";
import { and, asc, desc, eq } from "drizzle-orm";
import { Hourglass, Lock, Percent, Smartphone, Star, Tag, TrendingUp, Zap } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { type CategoryCover, POPULAR_CARDS, POPULAR_CELLS } from "@/entities/category";
import { type CategoryNode, getCategoryTree } from "@/entities/category/server";
import { topDealsOfWeek } from "@/entities/deal/server";
import { LotRow } from "@/entities/lot";
import { getDb } from "@/shared/api";
import { cn, plural } from "@/shared/lib";
import { ButtonLink } from "@/shared/ui";
import { Finder, type FinderCell, type FinderSection } from "@/widgets/finder";
import { CountdownRings } from "./countdown-rings";
import { FeeCalculator } from "./fee-calculator";
import { TopDeals } from "./top-deals";

/* ---------- мелкие части ---------- */

function RowHead({ title, href, more = "Смотреть все" }: { title: string; href: string; more?: string }) {
  return (
    <div className="mb-8 grid grid-cols-[1fr_auto] items-end gap-4 lg:grid-cols-[1fr_auto_1fr]">
      <h2 className="section-title lg:col-start-2 lg:text-center">{title}</h2>
      <Link href={href} className="mb-1.5 justify-self-end font-medium text-primary underline decoration-1 underline-offset-[3px] hover:decoration-2 lg:col-start-3">
        {more}
      </Link>
    </div>
  );
}

function Band({ children, className, after, ...props }: { children: ReactNode; className?: string; after?: "tint"; "aria-labelledby"?: string }) {
  return (
    <section className={cn(after === "tint" ? "pt-16" : "pt-16 lg:pt-24", className)} {...props}>
      {children}
    </section>
  );
}

/* ---------- S: полоса доверия ---------- */

const TRUST = [
  [Tag, "Лот — бесплатно", `Размещение ничего не стоит, до ${MAX_PHOTOS} фото`],
  [Percent, "1% только с продажи", "Счётом раз в месяц, без предоплаты"],
  [Star, "Отзывы после сделки", "Обе стороны оценивают друг друга"],
  [Hourglass, "Продление торгов", "Ставка в последние 5 минут добавляет 5 минут"],
  [Smartphone, "Вход по телефону", "Код по SMS, без паролей"],
] as const;

function TrustStrip() {
  return (
    <section aria-label="Условия площадки" className="pt-12">
      <ul className="no-scrollbar -mx-4 flex snap-x snap-mandatory overflow-x-auto bg-well px-0 py-6 sm:mx-0 sm:rounded-xl lg:grid lg:grid-cols-5 lg:px-2 lg:py-7">
        {TRUST.map(([Icon, title, text], i) => (
          <li
            key={title}
            className={cn(
              "flex w-[72%] shrink-0 snap-start flex-col items-center gap-2 px-5 text-center sm:w-[46%] lg:w-auto",
              i > 0 && "border-l border-border-strong",
            )}
          >
            <span className="mb-1 grid size-12 place-items-center rounded-full border border-border-strong bg-surface text-primary">
              <Icon className="size-[26px]" strokeWidth={1.5} />
            </span>
            <span className="label-caps">{title}</span>
            <p className="text-sm text-muted-foreground">{text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ---------- C: популярные категории ---------- */

type PopularCard = { id: number; name: string; section: string | null; cover: CategoryCover };

function PopularCategories({ items }: { items: PopularCard[] }) {
  return (
    <Band>
      <RowHead title="Популярные категории" href="/search" more="Все категории" />
      <ul className="grid grid-cols-2 gap-x-4 gap-y-7 md:grid-cols-3 md:gap-x-6 md:gap-y-10 lg:grid-cols-4">
        {items.map((c, i) => (
          <li key={c.id} className={cn(i >= 6 && "md:max-lg:hidden")}>
            <Link href={`/search?category=${c.id}`} className="group block rounded-lg text-foreground">
              <span className="relative block aspect-[4/3] overflow-hidden rounded-lg bg-well transition-[box-shadow,transform] duration-[350ms] ease-soft group-hover:-translate-y-1 group-hover:shadow-layer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={c.cover.src}
                  alt=""
                  loading="lazy"
                  className={cn(
                    "size-full transition-transform duration-700 ease-soft group-hover:scale-[1.04]",
                    c.cover.contain ? "object-contain px-[12%] py-[9%]" : "object-cover",
                  )}
                />
              </span>
              <span className="mt-3 block font-serif text-[1.0625rem] font-bold leading-tight text-balance sm:mt-4 sm:text-xl">{c.name}</span>
              <span className="mt-1 block text-sm text-muted-foreground">{c.section ?? "Раздел"}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Band>
  );
}

/** Узлы дерева по slug: сам узел и его раздел (корень). */
function indexTree(tree: CategoryNode[]) {
  const map = new Map<string, { node: CategoryNode; section: CategoryNode }>();
  const walk = (nodes: CategoryNode[], section: CategoryNode | null) => {
    for (const n of nodes) {
      map.set(n.slug, { node: n, section: section ?? n });
      walk(n.children, section ?? n);
    }
  };
  walk(tree, null);
  return map;
}

/** «с 3 по 9 октября» или «с 28 сентября по 4 октября». */
function weekPeriod(now: Date) {
  const from = new Date(now.getTime() - 6 * 86_400_000);
  const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("ru-RU", { ...opts, timeZone: "Europe/Moscow" }).format(d);
  const sameMonth = fmt(from, { month: "numeric" }) === fmt(now, { month: "numeric" });
  return `Самые дорогие продажи с ${fmt(from, sameMonth ? { day: "numeric" } : { day: "numeric", month: "long" })} по ${fmt(now, { day: "numeric", month: "long" })}`;
}

/* ---------- T: как продать вещь ---------- */

const STEPS = [
  ["Войдите по телефону", "Код придёт в SMS. Подтверждённый номер нужен для продажи и ставок."],
  ["Сфотографируйте вещь", `До ${MAX_PHOTOS} фото на любом фоне. Мы сожмём их и сделаем превью.`],
  ["Выберите формат", `Фиксированная цена до ${FIXED_MAX_DAYS} дней или аукцион от ${ENGLISH_MIN_DAYS} до ${ENGLISH_MAX_DAYS} дня.`],
  ["Отвечайте на вопросы", "Переписка с покупателями — в кабинете. Контакты в описании скрываются."],
  ["Передайте лот и оставьте отзыв", "После сделки обе стороны оценивают друг друга."],
];

function SellBand({ calc }: { calc: ReactNode }) {
  return (
    <section id="sell" aria-labelledby="sell-h" className="bleed mt-16 bg-p-butter py-16 lg:mt-24">
      <div className="wrap grid gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-4 pt-2 lg:col-span-4">
          <h2 id="sell-h" className="section-title">
            Как продать вещь
          </h2>
          <p className="max-w-[36ch]">
            Расчёты идут напрямую между вами и покупателем. Площадка не держит деньги и не вычитает комиссию из оплаты: раз в месяц присылает счёт на 1% от проданного.
          </p>
          <p className="max-w-[36ch] text-sm">
            Не хотите ждать торгов? <Link href="/buyout/new" className="font-medium text-primary underline underline-offset-[3px]">Предложите вещь администрации</Link> — оценщик ответит в кабинете.
          </p>
          <div>
            <ButtonLink href="/lots/new">Выставить лот</ButtonLink>
          </div>
        </div>
        <ol className="rounded-xl bg-surface px-5 py-3 sm:px-8 sm:py-6 md:col-span-1 lg:col-span-4">
          {STEPS.map(([title, text], i) => (
            <li key={title} className="grid grid-cols-[36px_1fr] gap-3 border-b border-border py-3.5 last:border-0">
              <span className="grid size-[30px] place-items-center rounded-full border border-primary text-sm font-semibold text-primary">{i + 1}</span>
              <div>
                <b className="block font-semibold">{title}</b>
                <span className="text-[0.9375rem] text-muted-foreground">{text}</span>
              </div>
            </li>
          ))}
        </ol>
        <div className="lg:col-span-4">{calc}</div>
      </div>
    </section>
  );
}

/* ---------- D: последние пять минут ---------- */

function LastMinutes({ lot, steps }: { lot: LotCard | undefined; steps: { from: number; step: number }[] }) {
  const priceRow = lot ? steps.reduce((idx, s, k) => (lot.price >= s.from ? k : idx), 0) : -1;
  return (
    <section id="rules" aria-labelledby="rules-h" className="on-dark cloth bleed mt-16 py-16 lg:mt-24 lg:py-20">
      <div className="wrap grid items-start gap-12 lg:grid-cols-12 lg:gap-6">
        <div className="flex flex-col gap-6 lg:col-span-6">
          <h2 id="rules-h" className="headline">
            Последние пять минут
          </h2>
          <p className="max-w-[46ch] text-white/82">
            Снайперская ставка в последнюю секунду здесь не работает. Каждая ставка в последние 5 минут продлевает торги на 5 минут от момента ставки, и у остальных есть время ответить.
          </p>
          {lot && (
            <>
              <Link href={`/lots/${lot.id}`} className="grid grid-cols-[88px_1fr] items-center gap-5 rounded-lg border border-white/18 p-5 hover:border-white/40 sm:grid-cols-[120px_1fr]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {lot.thumbUrl ? <img src={lot.thumbUrl} alt="" className="size-[88px] rounded-md bg-well object-cover sm:size-[120px]" /> : <span className="size-[88px] rounded-md bg-white/10 sm:size-[120px]" />}
                <div>
                  <p className="line-clamp-2 text-[0.9375rem] font-medium leading-snug">{lot.title}</p>
                  <p className="tabular mt-1 text-[1.75rem] font-semibold leading-tight sm:text-4xl">{formatRub(lot.price)}</p>
                  <p className="tabular mt-0.5 text-sm text-white/74">
                    {lot.bidCount} {plural(lot.bidCount, "ставка", "ставки", "ставок")}
                  </p>
                </div>
              </Link>
              <CountdownRings endsAt={lot.endsAt.toISOString()} />
              <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                <ButtonLink href={`/lots/${lot.id}`} variant="light">
                  Перейти к торгам
                </ButtonLink>
                <small className="inline-flex items-center gap-1.5 text-sm text-white/82">
                  <Lock className="size-4" strokeWidth={1.5} /> Ставку нельзя отозвать
                </small>
              </div>
            </>
          )}
        </div>
        <div className="flex flex-col gap-7 lg:col-span-5 lg:col-start-8">
          <table className="tabular w-full border-collapse">
            <caption className="mb-3 text-left font-serif text-[1.375rem] font-bold leading-tight">Шаг ставки зависит от цены</caption>
            <thead>
              <tr className="border-b border-white/16 text-left text-xs font-semibold uppercase tracking-[0.08em] text-white/74">
                <th scope="col" className="py-2.5 font-semibold">Текущая цена</th>
                <th scope="col" className="py-2.5 text-right font-semibold">Шаг</th>
              </tr>
            </thead>
            <tbody>
              {steps.map((s, k) => {
                const next = steps[k + 1];
                const range = next ? (k === 0 ? `до ${formatRub(next.from)}` : `${formatRub(s.from)} – ${formatRub(next.from)}`) : `от ${formatRub(s.from)}`;
                const cur = k === priceRow;
                return (
                  <tr key={s.from} className={cn("border-b border-white/16", cur ? "font-semibold text-white" : "text-white/82")}>
                    <td className="relative py-2.5">
                      {cur && <span aria-label="текущая цена примера" className="absolute -left-4 top-1/2 -mt-[3px] size-1.5 rounded-full bg-brass" />}
                      {range}
                    </td>
                    <td className="py-2.5 text-right">{formatRub(s.step)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <ul className="grid gap-[18px]">
            {(
              [
                [TrendingUp, "Автоставка", "Укажите максимум, и система будет поднимать вашу ставку на один шаг, пока не дойдёт до него."],
                [Zap, "Блиц-цена", "Если продавец её указал, лот можно забрать сразу, пока ставки ниже блиц-цены."],
                [Lock, "Ставка — это обязательство", "Отозвать её нельзя. Перед ставкой мы покажем сумму и шаг ещё раз."],
              ] as const
            ).map(([Icon, title, text]) => (
              <li key={title} className="grid grid-cols-[28px_1fr] gap-3">
                <Icon className="mt-0.5 size-6 text-brass" strokeWidth={1.5} />
                <div>
                  <b className="block font-semibold">{title}</b>
                  <span className="text-[0.9375rem] text-white/74">{text}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ---------- P: поиск ---------- */

function SearchBand({ sections }: { sections: { id: number; name: string }[] }) {
  return (
    <section aria-labelledby="find-h" className="bleed -mb-16 bg-sage-mist py-[72px]">
      <div className="wrap grid items-center gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-3 lg:col-span-5">
          <h2 id="find-h" className="section-title">
            Ищете что-то <em className="italic">определённое</em>?
          </h2>
          <p className="max-w-[44ch] text-muted-foreground">
            Найдите лоты и сохраните поиск в выдаче — сообщим, когда появится подходящий.
          </p>
        </div>
        <form action="/search" role="search" className="flex flex-col gap-3 lg:col-span-6 lg:col-start-7">
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="flex h-12 flex-1 items-center gap-2.5 rounded-md border border-border bg-surface px-4 transition-[border-color,box-shadow] hover:border-border-strong focus-within:border-primary focus-within:shadow-[0_0_0_3px_var(--color-sage-mist)]">
              <span className="sr-only">Что ищете</span>
              <svg aria-hidden viewBox="0 0 24 24" className="size-5 shrink-0 fill-none stroke-muted-foreground stroke-[1.5]">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" strokeLinecap="round" />
              </svg>
              <input name="q" type="search" placeholder="Например, значок «Отличник соцсоревнования»" className="w-full bg-transparent outline-none placeholder:text-faint" />
            </label>
            <button type="submit" className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-md bg-action px-6 font-semibold text-white transition-colors hover:bg-action-hover">
              Найти
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {sections.map((d) => (
              <Link
                key={d.id}
                href={`/search?category=${d.id}`}
                className="inline-flex h-9 items-center rounded-full border border-border bg-surface px-4 text-sm font-medium hover:border-border-strong"
              >
                {d.name}
              </Link>
            ))}
          </div>
        </form>
      </div>
    </section>
  );
}

/* ---------- страница ---------- */

export async function HomePage() {
  const db = getDb();
  const [endingSoon, newest, fixed, tree, settings, deals] = await Promise.all([
    lotCards(db, and(openNow(), eq(lots.format, "english")), [asc(lots.endsAt)], 10),
    lotCards(db, openNow(), [desc(lots.createdAt)], 10),
    lotCards(db, and(openNow(), eq(lots.format, "fixed")), [desc(lots.createdAt)], 4),
    getCategoryTree(),
    getSettings(db),
    topDealsOfWeek(),
  ]);

  const bySlug = indexTree(tree);
  const sections: FinderSection[] = tree.map((s) => ({
    id: s.id,
    slug: s.slug,
    name: s.name,
    children: s.children.map((c) => ({ id: c.id, slug: c.slug, name: c.name })),
  }));
  const cells: FinderCell[] = POPULAR_CELLS.flatMap(([slug, cover]) => {
    const hit = bySlug.get(slug);
    return hit ? [{ id: hit.node.id, slug, name: hit.node.name, sectionId: hit.section.id, cover }] : [];
  });
  const popular: PopularCard[] = POPULAR_CARDS.flatMap(([slug, cover]) => {
    const hit = bySlug.get(slug);
    return hit ? [{ id: hit.node.id, name: hit.node.name, section: hit.node === hit.section ? null : hit.section.name, cover }] : [];
  }).slice(0, 8);

  // Лоты не повторяются между рядами: «Новые» не берут то, что уже есть в «Скоро закончатся» и «По фиксированной цене».
  const shown = new Set([...endingSoon.slice(0, 5), ...fixed].map((l) => l.id));
  const newestRow = newest.filter((l) => !shown.has(l.id));

  return (
    <>
      <Finder sections={sections} cells={cells} />
      {popular.length > 0 && <PopularCategories items={popular} />}
      {deals.length > 0 && (
        <Band aria-labelledby="deals-h">
          <TopDeals deals={deals} period={weekPeriod(new Date())} />
        </Band>
      )}
      <TrustStrip />
      {endingSoon.length > 0 && (
        <Band>
          <RowHead title="Скоро закончатся" href="/search?format=english&sort=ending" />
          <LotRow lots={endingSoon} />
        </Band>
      )}
      {newestRow.length > 0 && (
        <Band>
          <RowHead title="Новые лоты" href="/search?sort=newest" />
          <LotRow lots={newestRow} />
        </Band>
      )}
      <SellBand calc={<FeeCalculator bidSteps={settings.bidSteps} commissionBps={settings.commissionBps} minInvoice={settings.minInvoiceAmount} />} />
      {fixed.length > 0 && (
        <Band after="tint">
          <RowHead title="По фиксированной цене" href="/search?format=fixed" />
          <LotRow lots={fixed} columns={4} />
        </Band>
      )}
      <LastMinutes lot={endingSoon[0]} steps={settings.bidSteps.map((s) => ({ from: s.from, step: s.step }))} />
      <SearchBand sections={sections} />
    </>
  );
}
