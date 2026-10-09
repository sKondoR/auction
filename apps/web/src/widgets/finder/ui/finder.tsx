"use client";

import { AlertCircle, Check, ChevronDown, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import type { CategoryCover } from "@/entities/category";
import { cn, plural } from "@/shared/lib";
import { Button } from "@/shared/ui";
import { ALL_HINTS, HINTS } from "../model/hints";

export type FinderNode = { id: number; slug: string; name: string };
export type FinderSection = FinderNode & { children: FinderNode[] };
export type FinderCell = FinderNode & { sectionId: number; cover: CategoryCover };

type Picked = FinderNode & { sectionId: number };

const TRAY_KEY = "aucs-tray";

/** По алфавиту, «Другое» и «Разное» (`*-other`) — в конце. */
function sortCats(cats: FinderNode[]) {
  return [...cats].sort((a, b) => {
    const oa = a.slug.endsWith("-other");
    const ob = b.slug.endsWith("-other");
    return oa !== ob ? (oa ? 1 : -1) : a.name.localeCompare(b.name, "ru");
  });
}

/**
 * Поиск по коллекциям (концепт 09): широкое поле, полоса «Искать в: раздел ⌄» с частыми запросами
 * и лоток на синем сукне. В «Популярном» лоток показывает фото-ячейки категорий, в разделе —
 * список его категорий по алфавиту. Выбранная категория (или раздел) становится областью поиска.
 */
export function Finder({ sections, cells }: { sections: FinderSection[]; cells: FinderCell[] }) {
  const router = useRouter();
  const uid = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const optsRef = useRef<(HTMLLIElement | null)[]>([]);

  const [groupId, setGroupId] = useState<number | null>(null);
  const [cat, setCat] = useState<Picked | null>(null);
  const [trayOpen, setTrayOpen] = useState(true);
  const [animated, setAnimated] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [swapKey, setSwapKey] = useState(0);
  const [q, setQ] = useState("");
  const [invalid, setInvalid] = useState(false);

  const group = sections.find((s) => s.id === groupId) ?? null;
  const scope = (cat && HINTS[cat.slug]) || (group && HINTS[group.slug]) || ALL_HINTS;
  const placeholder = cat && !HINTS[cat.slug] ? `Искать в категории «${cat.name}»` : scope.ph;
  const options: (FinderSection | null)[] = [null, ...sections];

  // Свёрнут лоток или раскрыт — выбор пользователя; анимацию включаем после первого кадра.
  useEffect(() => {
    try {
      if (localStorage.getItem(TRAY_KEY) === "0") setTrayOpen(false);
    } catch {}
    const t = requestAnimationFrame(() => setAnimated(true));
    return () => cancelAnimationFrame(t);
  }, []);

  // Пока большой поиск на экране, поле в шапке скрыто (см. widgets/header).
  useEffect(() => {
    const el = formRef.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const root = document.documentElement;
    const io = new IntersectionObserver(([e]) => (root.dataset.finder = e!.isIntersecting ? "in" : "out"), { rootMargin: "-72px 0px 0px 0px" });
    io.observe(el);
    return () => {
      io.disconnect();
      delete root.dataset.finder;
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (!(e.target as Element).closest("[data-finder-grp]")) setMenuOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuOpen]);

  useEffect(() => {
    if (menuOpen) optsRef.current[Math.max(0, options.findIndex((o) => (o?.id ?? null) === groupId))]?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuOpen]);

  function saveTray(open: boolean) {
    setTrayOpen(open);
    try {
      localStorage.setItem(TRAY_KEY, open ? "1" : "0");
    } catch {}
  }

  function pickGroup(s: FinderSection | null) {
    if ((s?.id ?? null) !== groupId) {
      setGroupId(s?.id ?? null);
      setCat(null);
      setSwapKey((k) => k + 1);
    }
    setMenuOpen(false);
    menuBtnRef.current?.focus();
    saveTray(true);
  }

  function pickCat(c: Picked) {
    if (cat?.id === c.id) {
      setCat(null);
      return;
    }
    // Ячейка «Популярного» может быть самим разделом: тогда областью становится раздел.
    const isSection = c.id === c.sectionId;
    setCat(isSection ? null : c);
    setTimeout(() => {
      setTrayOpen(false);
      if (c.sectionId !== groupId) setGroupId(c.sectionId);
      formRef.current?.scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      inputRef.current?.focus({ preventScroll: true });
    }, 280);
  }

  function go(query: string) {
    const v = query.trim();
    const categoryId = cat?.id ?? groupId;
    if (!v && !categoryId) {
      setInvalid(true);
      inputRef.current?.focus();
      return;
    }
    setInvalid(false);
    const p = new URLSearchParams();
    if (v) p.set("q", v);
    if (categoryId) p.set("category", String(categoryId));
    router.push(`/search?${p}`);
  }

  function onMenuKey(e: KeyboardEvent<HTMLUListElement>) {
    const opts = optsRef.current;
    const n = options.length;
    const i = opts.indexOf(document.activeElement as HTMLLIElement);
    const move: Record<string, number> = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: n - 1 };
    if (e.key in move) {
      e.preventDefault();
      opts[(move[e.key]! + n) % n]?.focus();
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (i >= 0) pickGroup(options[i]!);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setMenuOpen(false);
      menuBtnRef.current?.focus();
    } else if (e.key === "Tab") setMenuOpen(false);
  }

  return (
    <section aria-label="Поиск по коллекциям" className="pt-0 sm:pt-6">
      <form
        ref={formRef}
        role="search"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          go(q);
        }}
        className="relative z-[2] rounded-lg bg-sage-mist shadow-layer"
      >
        <div
          className={cn(
            "flex h-[60px] items-center gap-2 rounded-lg border bg-surface pl-4 pr-2.5 transition-[border-color,box-shadow] focus-within:border-primary focus-within:shadow-[0_0_0_3px_rgba(38,44,64,0.14)] sm:h-[72px] sm:gap-3 sm:pl-6",
            invalid ? "border-wax" : "border-border-strong",
          )}
        >
          <Search className="size-5 shrink-0 text-muted-foreground sm:size-6" strokeWidth={1.5} aria-hidden />
          <label htmlFor={`${uid}-q`} className="sr-only">
            Что ищете
          </label>
          <input
            ref={inputRef}
            id={`${uid}-q`}
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              if (e.target.value.trim()) setInvalid(false);
            }}
            placeholder={placeholder}
            autoComplete="off"
            aria-invalid={invalid || undefined}
            aria-describedby={`${uid}-msg`}
            className="h-full min-w-0 flex-1 bg-transparent text-base text-foreground caret-primary outline-none placeholder:text-faint sm:text-lg"
          />
          <Button type="submit" className="min-h-11 px-4 sm:min-h-[52px] sm:px-7">
            Найти
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-1 pb-3 pt-1 sm:pl-3 sm:pr-4 lg:min-h-[60px] lg:flex-nowrap lg:py-1.5">
          <div className="flex min-w-0 flex-[1_1_100%] flex-wrap items-center lg:flex-none">
            <div className="relative" data-finder-grp>
              <button
                ref={menuBtnRef}
                type="button"
                aria-haspopup="listbox"
                aria-expanded={menuOpen}
                aria-controls={`${uid}-menu`}
                onClick={() => setMenuOpen((v) => !v)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                    e.preventDefault();
                    setMenuOpen(true);
                  }
                }}
                className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-3 text-[0.9375rem] text-muted-foreground transition-colors hover:bg-white/70"
              >
                <span id={`${uid}-lbl`}>Искать в:</span>
                <b className="font-semibold text-foreground">{group ? group.name : "популярное"}</b>
                <ChevronDown
                  className={cn("size-[18px] text-foreground transition-transform duration-[450ms] ease-soft", menuOpen && "rotate-180")}
                  strokeWidth={1.5}
                  aria-hidden
                />
              </button>
              {menuOpen && (
                <ul
                  id={`${uid}-menu`}
                  role="listbox"
                  aria-labelledby={`${uid}-lbl`}
                  onKeyDown={onMenuKey}
                  className="absolute left-0 top-[calc(100%+6px)] z-[6] w-[300px] max-w-[calc(100vw-32px)] rounded-lg border border-border bg-surface p-1.5 shadow-layer"
                >
                  {options.map((s, i) => {
                    const selected = (s?.id ?? null) === groupId;
                    return (
                      <li
                        key={s?.id ?? "all"}
                        ref={(el) => {
                          optsRef.current[i] = el;
                        }}
                        role="option"
                        tabIndex={-1}
                        aria-selected={selected}
                        onClick={() => pickGroup(s)}
                        className={cn(
                          "relative flex min-h-11 cursor-pointer items-center gap-3 rounded-xs px-3 py-2 text-[0.9375rem] text-foreground outline-none hover:bg-sage-mist focus-visible:bg-sage-mist focus-visible:shadow-[inset_0_0_0_2px_var(--color-action)]",
                          selected && "font-semibold",
                          !s && "mb-1.5 after:absolute after:inset-x-3 after:-bottom-1 after:h-px after:bg-border",
                        )}
                      >
                        <Check className={cn("size-4 shrink-0 text-action", !selected && "invisible")} strokeWidth={1.5} aria-hidden />
                        <span>{s ? s.name : "Популярное"}</span>
                        {s && <span className="tabular ml-auto text-[0.8125rem] font-normal text-faint">{s.children.length}</span>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            {cat && (
              <span className="ml-1 inline-flex min-h-9 items-center gap-0.5 rounded-full bg-surface pl-3.5 pr-1 text-[0.9375rem] shadow-[inset_0_0_0_1px_var(--color-border)]">
                <span className="sr-only">Категория: </span>
                <b className="font-semibold text-foreground">{cat.name}</b>
                <button
                  type="button"
                  onClick={() => {
                    setCat(null);
                    inputRef.current?.focus();
                  }}
                  aria-label={group ? `Искать во всех категориях раздела «${group.name}»` : "Искать во всех разделах"}
                  className="relative grid size-8 cursor-pointer place-items-center rounded-full text-muted-foreground after:absolute after:-inset-1.5 hover:bg-white/70 hover:text-foreground"
                >
                  <X className="size-4" strokeWidth={1.5} />
                </button>
              </span>
            )}
          </div>
          <p className="no-scrollbar -mr-2 flex min-w-0 items-baseline gap-x-3.5 overflow-x-auto px-3 text-sm text-muted-foreground [mask-image:linear-gradient(90deg,#000_calc(100%-32px),transparent)] sm:mr-0 sm:flex-wrap sm:overflow-visible sm:[mask-image:none] lg:ml-auto lg:justify-end lg:px-0">
            <span className="shrink-0">Часто ищут{group || cat ? " здесь" : ""}:</span>
            {scope.hints.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => {
                  setQ(h);
                  go(h);
                }}
                className="cursor-pointer whitespace-nowrap py-1 font-medium text-foreground underline decoration-border-strong decoration-1 underline-offset-4 transition-[text-decoration-color] last:pr-6 hover:decoration-primary hover:decoration-2 sm:last:pr-0"
              >
                {h}
              </button>
            ))}
          </p>
        </div>
        <p id={`${uid}-msg`} aria-live="polite" className="empty:hidden">
          {invalid && (
            <span className="flex items-start gap-2 px-6 pb-4 text-[0.9375rem] leading-snug text-wax">
              <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={1.5} aria-hidden />
              Напишите, что ищете: название, год или материал, или выберите раздел.
            </span>
          )}
        </p>
      </form>

      {/* Лоток монетного футляра выезжает из-под полосы поиска. */}
      <div
        id={`${uid}-drawer`}
        className={cn(
          "relative z-[1] -mt-5 grid",
          animated && "transition-[grid-template-rows] duration-[550ms] ease-soft",
          trayOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0 overflow-hidden" inert={!trayOpen}>
          <div
            className={cn(
              "cloth rounded-b-lg px-4 pb-7 pt-11 shadow-[inset_0_18px_22px_-14px_rgba(8,10,20,0.75),inset_0_-1px_0_rgba(246,212,106,0.25)] sm:px-9 sm:pb-9 sm:pt-[52px] [&_:focus-visible]:outline-gold-light",
              animated && "transition-transform duration-[550ms] ease-soft",
              !trayOpen && "-translate-y-6",
            )}
          >
            <div className="mb-[22px] flex flex-col items-start gap-2 px-1 sm:mb-7 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-0">
              <h2 id={`${uid}-tray`} className="font-serif text-2xl leading-[1.1] text-white sm:text-[1.875rem]">
                {group ? group.name : "Популярные категории"}
              </h2>
              <div className="flex w-full flex-wrap items-center justify-between gap-x-5 gap-y-2 sm:w-auto sm:justify-end">
                <p className="text-[0.9375rem] text-white/78">
                  {group
                    ? group.children.length
                      ? `${group.children.length} ${plural(group.children.length, "категория", "категории", "категорий")} · выберите, чтобы искать только в ней`
                      : "Ищем по всему разделу"
                    : "Выберите категорию или раздел в «Искать в»"}
                </p>
                <button
                  type="button"
                  aria-controls={`${uid}-drawer`}
                  onClick={() => {
                    saveTray(false);
                    menuBtnRef.current?.focus();
                  }}
                  className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-md border border-white/28 px-3 text-[0.9375rem] font-medium leading-none text-white transition-colors hover:border-white/50 hover:bg-white/8"
                >
                  Свернуть
                  <ChevronDown className="size-4 rotate-180" strokeWidth={1.5} aria-hidden />
                </button>
              </div>
            </div>

            {group ? (
              group.children.length > 0 && (
                <ul key={swapKey} aria-labelledby={`${uid}-tray`} className="columns-1 gap-8 motion-safe:animate-swap sm:columns-2">
                  {sortCats(group.children).map((c) => {
                    const on = cat?.id === c.id;
                    return (
                      <li key={c.id} className="break-inside-avoid">
                        <button
                          type="button"
                          aria-pressed={on}
                          onClick={() => pickCat({ ...c, sectionId: group.id })}
                          className={cn(
                            "flex min-h-10 w-full cursor-pointer items-center gap-2.5 rounded-xs px-2 py-1.5 text-left text-[0.9375rem] font-medium leading-tight transition-colors sm:min-h-[34px] sm:px-2.5",
                            on ? "bg-gold-light/12 font-semibold text-gold-light" : "text-white/92 hover:bg-white/8 hover:text-white",
                          )}
                        >
                          <span>{c.name}</span>
                          <Check
                            className={cn("ml-auto size-4 shrink-0 text-gold transition-opacity", on ? "opacity-100" : "opacity-0")}
                            strokeWidth={2.25}
                            aria-hidden
                          />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )
            ) : (
              <ul
                key={swapKey}
                aria-labelledby={`${uid}-tray`}
                className={cn(
                  "grid grid-cols-3 gap-x-[18px] gap-y-[26px] md:grid-cols-4 lg:grid-cols-6 lg:gap-x-8 lg:gap-y-9",
                  swapKey > 0 && "motion-safe:animate-swap",
                )}
              >
                {cells.map((c) => {
                  const on = cat?.id === c.id || (!cat && c.id === c.sectionId && groupId === c.id);
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() => pickCat(c)}
                        className="group/cell flex w-full cursor-pointer flex-col items-center gap-3 rounded-lg pb-1 text-center text-white"
                      >
                        <span
                          className={cn(
                            "relative block aspect-square w-[67%] rounded-lg transition-shadow duration-300",
                            on && "shadow-[0_0_0_3px_var(--color-cloth),0_0_0_5px_var(--color-gold)]",
                          )}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={c.cover.src}
                            alt=""
                            loading="lazy"
                            className={cn(
                              "absolute inset-0 size-full rounded-lg shadow-cloth transition-[transform,box-shadow] duration-[400ms] ease-soft group-hover/cell:-translate-y-1 group-hover/cell:shadow-cloth-up",
                              c.cover.contain ? "bg-well object-contain p-[6%]" : "bg-well object-cover",
                            )}
                          />
                          <span
                            className={cn(
                              "absolute -right-2 -top-2 z-[1] grid size-7 place-items-center rounded-full bg-gold text-primary-hover shadow-[0_2px_6px_rgba(0,0,0,0.45)] transition-[opacity,transform] duration-300 ease-soft",
                              on ? "scale-100 opacity-100" : "scale-[0.6] opacity-0",
                            )}
                          >
                            <Check className="size-4" strokeWidth={2.25} aria-hidden />
                          </span>
                        </span>
                        <span className={cn("text-sm font-medium leading-[1.3] text-balance sm:text-[0.9375rem]", on && "font-semibold text-gold-light")}>
                          {c.name}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
