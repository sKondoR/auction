import { getSettings, lots } from "@auction/db";
import { ENGLISH_MAX_DAYS, ENGLISH_MIN_DAYS, FIXED_MAX_DAYS, MAX_PHOTOS, formatRub } from "@auction/domain";
import { type LotCard, createPgLotSearch, lotCards, openNow } from "@auction/services";
import { and, asc, desc, eq } from "drizzle-orm";
import { ArrowRight, Hourglass, Lock, Percent, Smartphone, Star, Tag, TrendingUp, Zap } from "lucide-react";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { CategoryArt, PASTEL_CLASSES, categoryPastel } from "@/entities/category";
import { getCategoryTree } from "@/entities/category/server";
import { Countdown, LotRow } from "@/entities/lot";
import { getDb } from "@/shared/api";
import { cn, plural } from "@/shared/lib";
import { ButtonLink } from "@/shared/ui";
import { CountdownRings } from "./countdown-rings";
import { FeeCalculator } from "./fee-calculator";

/* ---------- мелкие части ---------- */

function RowHead({ title, href }: { title: string; href: string }) {
  return (
    <div className="mb-8 grid grid-cols-[1fr_auto] items-end gap-4 lg:grid-cols-[1fr_auto_1fr]">
      <h2 className="section-title lg:col-start-2 lg:text-center">{title}</h2>
      <Link href={href} className="mb-1.5 justify-self-end font-medium text-primary underline decoration-1 underline-offset-[3px] hover:decoration-2 lg:col-start-3">
        Смотреть все
      </Link>
    </div>
  );
}

function Band({ children, className, after }: { children: ReactNode; className?: string; after?: "tint" }) {
  return <section className={cn(after === "tint" ? "pt-16" : "pt-16 lg:pt-24", className)}>{children}</section>;
}

/* ---------- H: сургучное поле ---------- */

const FRAMES = [
  { r: "-3.5deg", pos: "lg:left-0 lg:top-[4%] lg:w-[38%]" },
  { r: "2.5deg", pos: "lg:left-[41%] lg:top-0 lg:w-[28%] lg:z-[3]" },
  { r: "-2deg", pos: "lg:left-[31%] lg:top-[47%] lg:w-[29%]" },
  { r: "4deg", pos: "lg:left-[66%] lg:top-[30%] lg:w-[31%]" },
];

/** Раскладки коллажа для 1 и 2 фото: паспарту крупнее и по центру поля. */
const FEW_FRAMES: Record<number, typeof FRAMES> = {
  1: [{ r: "-3deg", pos: "lg:left-[16%] lg:top-[4%] lg:w-[56%]" }],
  2: [
    { r: "-3.5deg", pos: "lg:left-[2%] lg:top-[6%] lg:w-[46%]" },
    { r: "3deg", pos: "lg:left-[50%] lg:top-[22%] lg:w-[42%]" },
  ],
};

function Hero({ collage, nearest }: { collage: LotCard[]; nearest: LotCard | undefined }) {
  return (
    <section aria-labelledby="hero-h" className="on-dark bleed -mt-8 overflow-hidden bg-wax text-white">
      <div className={cn("wrap grid items-center gap-7 pb-14 pt-7 lg:min-h-[600px] lg:grid-cols-12 lg:gap-6 lg:pb-16 lg:pt-14", !collage.length && "lg:min-h-[480px]")}>
        {collage.length > 0 && (
          <div className={cn("order-2 grid gap-x-4 gap-y-14 px-0 pb-10 sm:gap-x-7 sm:px-2 lg:relative lg:order-1 lg:col-span-7 lg:block lg:h-[520px] lg:p-0", collage.length === 1 ? "grid-cols-1 px-[12%] sm:px-[22%]" : "grid-cols-2")}>
            {collage.map((lot, i) => {
              const f = (FEW_FRAMES[collage.length] ?? FRAMES)[i]!;
              return (
                <Link
                  key={lot.id}
                  href={`/lots/${lot.id}`}
                  style={{ "--r": f.r, animationDelay: `${i * 110 + 80}ms` } as CSSProperties}
                  className={cn(
                    "group relative block rounded-xs [transform:rotate(var(--r))] bg-white p-1.5 shadow-wax motion-safe:animate-lay lg:absolute",
                    f.pos,
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={lot.thumbUrl!} alt={lot.title} className="aspect-square w-full bg-well object-cover" />
                  <span
                    style={{ animationDelay: `${i * 110 + 420}ms` } as CSSProperties}
                    className={cn(
                      "absolute -bottom-8 left-2 right-2 origin-[14px_50%] rounded-xs [transform:rotate(calc(var(--r)*-1.2))] bg-white py-2 pl-6 pr-2.5 text-foreground shadow-wax-tag motion-safe:animate-swing sm:left-3.5 sm:right-auto sm:min-w-44 sm:max-w-60 sm:py-2.5 sm:pr-3",
                      "before:absolute before:left-2.5 before:top-1/2 before:-mt-1 before:size-[7px] before:rounded-full before:border-[1.5px] before:border-border-strong",
                    )}
                  >
                    <span className="block truncate text-[0.8125rem] font-medium text-muted-foreground">{lot.title}</span>
                    <span className="mt-0.5 flex flex-col gap-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
                      <span className="tabular text-base font-semibold sm:text-lg">{formatRub(lot.price)}</span>
                      <Countdown endsAt={lot.endsAt} className="text-[0.8125rem] text-muted-foreground" />
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        )}

        <div className={cn("order-1 flex flex-col gap-5 lg:order-2 lg:gap-6", collage.length ? "lg:col-span-5" : "lg:col-span-8")}>
          <h1 id="hero-h" className="display">
            Идут <em className="italic">торги</em>
          </h1>
          <p className="max-w-[40ch] text-base leading-normal sm:text-lg lg:max-w-[30ch]">
            Монеты, боны, марки, фарфор и вещи из домашних шкафов. Выставить лот бесплатно, площадка берёт 1% только с продажи.
          </p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
            <ButtonLink href="/search?format=english&sort=ending" variant="field">
              Смотреть торги
            </ButtonLink>
            <Link href="/lots/new" className="inline-flex min-h-11 items-center gap-1.5 font-medium underline decoration-1 underline-offset-4 hover:decoration-2">
              Выставить свой лот <ArrowRight className="size-5" strokeWidth={1.5} />
            </Link>
          </div>
          {nearest && (
            <p className="hidden items-start gap-2.5 border-t border-white/35 pt-5 text-[0.9375rem] leading-snug sm:flex">
              <span aria-hidden className="mt-[7px] size-2 shrink-0 rounded-full bg-white motion-safe:animate-pulse-dot" />
              <span>
                Ближе всего к концу — «{nearest.title}»: {formatRub(nearest.price)},{" "}
                {nearest.bidCount} {plural(nearest.bidCount, "ставка", "ставки", "ставок")}. Ставка в последние 5 минут продлит торги.
              </span>
            </p>
          )}
        </div>
      </div>
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

/* ---------- C: отделы лавки ---------- */

type Dept = { id: number; slug: string; name: string; sub: string; photo: string | null };

function Departments({ items }: { items: Dept[] }) {
  return (
    <Band>
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <h2 className="section-title">Отделы лавки</h2>
        <p className="max-w-[56ch] text-muted-foreground">В каждом отделе свои фильтры: у монет это год, номинал, металл и сохранность.</p>
      </div>
      <ul className="grid grid-cols-2 gap-x-[22px] gap-y-5 pb-3 pr-3 sm:grid-cols-3 sm:gap-x-7 sm:gap-y-6 lg:grid-cols-4">
        {items.map((c, i) => {
          const p = PASTEL_CLASSES[categoryPastel(c.slug)];
          return (
            <li key={c.id} className={cn("group/tile relative isolate", i === items.length - 1 && items.length % 2 === 1 && "col-span-2 sm:col-span-1")}>
              <span aria-hidden className={cn("absolute inset-0 -z-10 translate-x-3 translate-y-3 rounded-xl transition-transform duration-300 ease-soft group-hover/tile:translate-x-3.5 group-hover/tile:translate-y-3.5", p.deep)} />
              <Link
                href={`/search?category=${c.id}`}
                className={cn(
                  "group/link flex h-full min-h-[250px] flex-col overflow-hidden rounded-xl p-[18px] text-foreground shadow-layer transition-transform duration-300 ease-soft group-hover/tile:-translate-x-[3px] group-hover/tile:-translate-y-[3px] sm:min-h-[300px] sm:p-6",
                  p.bg,
                )}
              >
                <span className="font-serif text-[1.1875rem] font-bold leading-tight sm:text-[1.375rem]">{c.name}</span>
                {c.sub && <span className="mt-1.5 line-clamp-2 text-sm">{c.sub}</span>}
                <span className="relative mt-auto block h-[60%] min-h-[150px] overflow-hidden rounded-lg">
                  {c.photo && (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={c.photo}
                        alt=""
                        loading="lazy"
                        className="absolute inset-0 size-full scale-[1.06] object-cover opacity-0 transition-[opacity,transform] duration-500 ease-soft [clip-path:inset(0_0_0_50%)] max-sm:scale-100 max-sm:opacity-100 sm:[clip-path:none] group-hover/link:scale-100 group-hover/link:opacity-100 group-focus-visible/link:scale-100 group-focus-visible/link:opacity-100"
                      />
                      <span className="absolute inset-0 bg-night/28 opacity-0 transition-opacity duration-500 [clip-path:inset(0_0_0_50%)] max-sm:opacity-100 sm:[clip-path:none] group-hover/link:opacity-100 group-focus-visible/link:opacity-100" />
                    </>
                  )}
                  <CategoryArt
                    slug={c.slug}
                    className={cn(
                      "relative size-full text-foreground transition-colors duration-500",
                      c.photo && "group-hover/link:text-white group-focus-visible/link:text-white",
                    )}
                  />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Band>
  );
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
    <section id="rules" aria-labelledby="rules-h" className="on-dark bleed mt-16 bg-primary py-16 text-white lg:mt-24 lg:py-20">
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

function SearchBand({ depts }: { depts: Dept[] }) {
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
            <button type="submit" className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-md bg-primary px-6 font-semibold text-white transition-colors hover:bg-primary-hover">
              Найти
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {depts.map((d) => (
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
  const search = createPgLotSearch(db);
  const [endingSoon, newest, fixed, tree, settings] = await Promise.all([
    lotCards(db, and(openNow(), eq(lots.format, "english")), [asc(lots.endsAt)], 10),
    lotCards(db, openNow(), [desc(lots.createdAt)], 10),
    lotCards(db, and(openNow(), eq(lots.format, "fixed")), [desc(lots.createdAt)], 4),
    getCategoryTree(),
    getSettings(db),
  ]);
  const depts: Dept[] = await Promise.all(
    tree.map(async (c) => {
      const res = await search.search({ categoryId: c.id, status: "active" }, { sort: "ending", page: 1, pageSize: 6 });
      return {
        id: c.id,
        slug: c.slug,
        name: c.name,
        sub: c.children.slice(0, 3).map((ch) => ch.name).join(", "),
        photo: res.items.find((l) => l.thumbUrl)?.thumbUrl ?? null,
      };
    }),
  );

  const seen = new Set<number>();
  const collage = [...endingSoon, ...newest].filter((l) => l.thumbUrl && !seen.has(l.id) && seen.add(l.id)).slice(0, 4);
  // Лоты не повторяются между рядами: «Новые» не берут то, что уже есть в «Скоро закончатся» и «По фиксированной цене».
  const shown = new Set([...endingSoon.slice(0, 5), ...fixed].map((l) => l.id));
  const newestRow = newest.filter((l) => !shown.has(l.id));

  return (
    <>
      <Hero collage={collage} nearest={endingSoon[0]} />
      <TrustStrip />
      {endingSoon.length > 0 && (
        <Band>
          <RowHead title="Скоро закончатся" href="/search?format=english&sort=ending" />
          <LotRow lots={endingSoon} />
        </Band>
      )}
      <Departments items={depts} />
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
      <SearchBand depts={depts} />
    </>
  );
}
