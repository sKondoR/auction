"use client";

import { AlertCircle, Check, ChevronDown, Search, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { type ChangeEvent, type FormEvent, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn, plural } from "@/shared/lib";
import { SEARCH_FLOOR_SELECTOR } from "../model/floor";
import { ALL_HINTS, HINTS } from "../model/hints";
import type { ScopeCell, ScopeNode, ScopeSection } from "../model/scopes";

type Picked = ScopeNode & { sectionId: number };

/** По алфавиту, «Другое» и «Разное» (`*-other`) — в конце. */
function sortCats(cats: ScopeNode[]) {
  return [...cats].sort((a, b) => {
    const oa = a.slug.endsWith("-other");
    const ob = b.slug.endsWith("-other");
    return oa !== ob ? (oa ? 1 : -1) : a.name.localeCompare(b.name, "ru");
  });
}

const isDesktop = () => matchMedia("(min-width: 48rem)").matches;

const SLOT_ID = "catalog-search-panel";

/** Место панели поиска в шапке: во всю ширину, под строкой с логотипом. Панель раскрывается отсюда поверх страницы. */
export function CatalogSearchSlot() {
  return <div id={SLOT_ID} className="relative" />;
}

/**
 * Поиск по коллекциям в шапке (концепт 09, вариант «в шапке»): поле справа от логотипа с выбором
 * области «Искать в ⌄». Выбор открывает панель на синем сукне во всю ширину окна под шапкой,
 * содержимое — по ширине контента: вкладки разделов, фото-ячейки «Популярного» или список
 * категорий раздела, частые запросы. На телефоне поле прячется под иконку и живёт в панели.
 *
 * Панель рендерится порталом в `CatalogSearchSlot` и раскрывается слоем поверх строки категорий и страницы — контент не сдвигается.
 * Если на странице есть блок с `SEARCH_FLOOR` (hero главной), низ панели совпадает с его низом, лишнее прокручивается внутри.
 */
export function CatalogSearch({ sections, cells }: { sections: ScopeSection[]; cells: ScopeCell[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const uid = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mInputRef = useRef<HTMLInputElement>(null);
  const scopeBtnRef = useRef<HTMLButtonElement>(null);
  const mBtnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [floor, setFloor] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [rows, setRows] = useState<number | null>(null);

  const [open, setOpen] = useState(false);
  const [groupId, setGroupId] = useState<number | null>(null);
  const [cat, setCat] = useState<Picked | null>(null);
  const [swapKey, setSwapKey] = useState(0);
  const [q, setQ] = useState("");
  const [invalid, setInvalid] = useState(false);

  const group = sections.find((s) => s.id === groupId) ?? null;
  const scope = (cat && HINTS[cat.slug]) || (group && HINTS[group.slug]) || ALL_HINTS;
  const placeholder = cat && !HINTS[cat.slug] ? `Искать в категории «${cat.name}»` : scope.ph;
  const scopeLabel = cat ? cat.name : group ? group.name : "все разделы";

  useEffect(() => setSlot(document.getElementById(SLOT_ID)), []);

  // Высота панели до низа помеченного блока; пока он ниже шапки хотя бы на 240px, иначе — по содержимому.
  useEffect(() => {
    if (!open || !slot) return;
    const measure = () => {
      const el = document.querySelector(SEARCH_FLOOR_SELECTOR);
      const h = el ? el.getBoundingClientRect().bottom - slot.getBoundingClientRect().top : 0;
      setFloor(h >= 240 ? Math.round(h) : null);
    };
    measure();
    // Блок может сменить высоту и без ресайза окна: догрузились шрифты, сменилось содержимое.
    const el = document.querySelector(SEARCH_FLOOR_SELECTOR);
    const ro = el ? new ResizeObserver(measure) : null;
    if (el) ro?.observe(el);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, { passive: true });
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure);
    };
  }, [open, slot, pathname]);

  // Категории раздела идут столбцом вниз, пока помещаются в высоту панели, затем — в следующий столбец.
  // Если в доступные столбцы (`--cols`) не влезают, строк становится больше и панель прокручивается.
  useLayoutEffect(() => {
    if (!group) return;
    const n = group.children.length;
    const measure = () => {
      const sc = scrollRef.current;
      const wrap = wrapRef.current;
      const body = bodyRef.current;
      const list = listRef.current;
      if (!sc || !wrap || !body || !list) return;
      const cols = Number(getComputedStyle(list).getPropertyValue("--cols")) || 1;
      const rowH = (list.firstElementChild as HTMLElement | null)?.offsetHeight ?? 0;
      const limit = floor ?? parseFloat(getComputedStyle(sc).maxHeight);
      const fit = rowH && Number.isFinite(limit) ? Math.floor((limit - (wrap.offsetHeight - body.offsetHeight)) / rowH) : n;
      setRows(Math.max(fit, Math.ceil(n / cols), 1));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [group, floor]);

  // Переход на другую страницу закрывает панель.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!rootRef.current?.contains(t) && !panelRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      (isDesktop() ? scopeBtnRef : mBtnRef).current?.focus();
    };
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function focusInput() {
    (isDesktop() ? inputRef : mInputRef).current?.focus();
  }

  function pickGroup(id: number | null) {
    if (id === groupId) return;
    setGroupId(id);
    setCat(null);
    setSwapKey((k) => k + 1);
  }

  function pickCat(c: Picked) {
    if (cat?.id === c.id) {
      setCat(null);
      return;
    }
    // Ячейка «Популярного» может оказаться самим разделом: тогда показываем его категории.
    if (c.id === c.sectionId) {
      pickGroup(c.id);
      return;
    }
    setCat(c);
    setGroupId(c.sectionId);
    if (isDesktop()) setOpen(false);
    requestAnimationFrame(focusInput);
  }

  function reset() {
    setCat(null);
    setGroupId(null);
    setSwapKey((k) => k + 1);
    focusInput();
  }

  function go(query: string) {
    const v = query.trim();
    const categoryId = cat?.id ?? groupId;
    if (!v && !categoryId) {
      setInvalid(true);
      focusInput();
      return;
    }
    setInvalid(false);
    setOpen(false);
    const p = new URLSearchParams();
    if (v) p.set("q", v);
    if (categoryId) p.set("category", String(categoryId));
    router.push(`/search?${p}`);
  }

  const inputProps = {
    type: "search" as const,
    value: q,
    onChange: (e: ChangeEvent<HTMLInputElement>) => {
      setQ(e.target.value);
      if (e.target.value.trim()) setInvalid(false);
    },
    placeholder,
    autoComplete: "off",
    "aria-invalid": invalid || undefined,
    "aria-describedby": `${uid}-err`,
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    go(q);
  };

  return (
    <div ref={rootRef} className="flex min-w-0 justify-end md:block">
      {/* Поле в шапке: «Искать в ⌄» | запрос | Найти */}
      <form
        role="search"
        noValidate
        onSubmit={submit}
        className={cn(
          "hidden h-12 w-full items-center rounded-lg border bg-surface transition-[border-color,box-shadow] focus-within:border-primary focus-within:shadow-[0_0_0_3px_var(--color-sage-mist)] md:flex",
          invalid ? "border-wax" : "border-border",
        )}
      >
        <button
          ref={scopeBtnRef}
          type="button"
          aria-expanded={open}
          aria-controls={`${uid}-panel`}
          onClick={() => setOpen((v) => !v)}
          className="flex h-full min-w-0 max-w-[45%] shrink-0 cursor-pointer items-center gap-1.5 rounded-l-lg pl-4 pr-2.5 text-[0.8125rem] text-muted-foreground transition-colors hover:bg-sage-mist"
        >
          <span className="hidden whitespace-nowrap lg:inline">Искать в</span>
          <b className="truncate font-semibold text-foreground">{scopeLabel}</b>
          <ChevronDown className={cn("size-4 shrink-0 text-foreground transition-transform duration-300 ease-soft", open && "rotate-180")} strokeWidth={1.5} aria-hidden />
        </button>
        {(cat || group) && (
          <button
            type="button"
            onClick={reset}
            aria-label="Искать во всех разделах"
            className="relative -ml-1 grid size-7 shrink-0 cursor-pointer place-items-center rounded-full text-muted-foreground hover:bg-sage-mist hover:text-foreground"
          >
            <X className="size-4" strokeWidth={1.5} />
          </button>
        )}
        <span aria-hidden className="mx-1 h-6 w-px shrink-0 bg-border" />
        <Search className="ml-2 size-5 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden />
        <label htmlFor={`${uid}-q`} className="sr-only">
          Что ищете
        </label>
        <input
          ref={inputRef}
          id={`${uid}-q`}
          {...inputProps}
          className="h-full min-w-0 flex-1 bg-transparent px-2.5 text-[0.9375rem] text-foreground outline-none placeholder:text-faint"
        />
        <button
          type="submit"
          className="mr-1 inline-flex h-10 shrink-0 cursor-pointer items-center rounded-md bg-action px-4 text-[0.9375rem] font-semibold text-white transition-colors hover:bg-action-hover"
        >
          Найти
        </button>
      </form>

      {/* На телефоне — иконка, поле внутри панели */}
      <button
        ref={mBtnRef}
        type="button"
        aria-label={open ? "Закрыть поиск" : "Поиск"}
        aria-expanded={open}
        aria-controls={`${uid}-panel`}
        onClick={() => {
          setOpen((v) => !v);
          if (!open) requestAnimationFrame(() => mInputRef.current?.focus());
        }}
        className="inline-grid size-11 cursor-pointer place-items-center rounded-full text-foreground transition-colors hover:bg-sage-mist md:hidden [&_svg]:size-5"
      >
        {open ? <X strokeWidth={1.5} /> : <Search strokeWidth={1.5} />}
      </button>

      {/* Панель на сукне во всю ширину окна — в слоте шапки */}
      {slot &&
        createPortal(
          <div
            ref={panelRef}
            id={`${uid}-panel`}
            className={cn(
              "absolute inset-x-0 top-0 grid transition-[grid-template-rows,box-shadow] duration-[450ms] ease-soft",
              open ? "grid-rows-[1fr] shadow-[0_28px_48px_-16px_rgba(0,0,0,0.6)]" : "grid-rows-[0fr]",
            )}
          >
            <div className="min-h-0 overflow-hidden" inert={!open}>
              <div
                ref={scrollRef}
                style={floor ? { height: floor } : undefined}
                className={cn(
                  "cloth overflow-y-auto overscroll-contain shadow-[inset_0_14px_18px_-14px_rgba(0,0,0,0.6)] [&_:focus-visible]:outline-gold-light",
                  !floor && "max-h-[calc(100dvh-64px)] md:max-h-[calc(100dvh-72px)]",
                )}
              >
                <div ref={wrapRef} className="wrap flex min-h-full flex-col pb-8 pt-5 md:pb-10 md:pt-7">
                  <form role="search" noValidate onSubmit={submit} className="mb-5 flex gap-2 md:hidden">
                    <label htmlFor={`${uid}-mq`} className="sr-only">
                      Что ищете
                    </label>
                    <input
                      ref={mInputRef}
                      id={`${uid}-mq`}
                      {...inputProps}
                      className={cn(
                        "h-12 min-w-0 flex-1 rounded-md border bg-surface px-4 text-base text-foreground outline-none placeholder:text-faint",
                        invalid ? "border-wax" : "border-transparent",
                      )}
                    />
                    <button type="submit" className="h-12 shrink-0 cursor-pointer rounded-md bg-white px-4 font-semibold text-primary hover:bg-sage-mist">
                      Найти
                    </button>
                  </form>
      
                  <div className="flex items-start justify-between gap-4">
                    <div role="group" aria-label="Искать в" className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
                      {[null, ...sections].map((s) => {
                        const on = (s?.id ?? null) === groupId;
                        return (
                          <button
                            key={s?.id ?? "all"}
                            type="button"
                            aria-pressed={on}
                            onClick={() => pickGroup(s?.id ?? null)}
                            className={cn(
                              "inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-full px-4 text-[0.9375rem] font-medium transition-colors",
                              on ? "bg-gold text-[#15181f]" : "text-white/85 hover:bg-white/10 hover:text-white",
                            )}
                          >
                            {s ? s.name : "Популярное"}
                            {s && <span className={cn("tabular text-[0.8125rem] font-normal", on ? "font-semibold text-[#15181f]/70" : "text-white/55")}>{s.children.length}</span>}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        scopeBtnRef.current?.focus();
                      }}
                      className="hidden min-h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-white/28 px-3 text-[0.9375rem] font-medium text-white transition-colors hover:border-white/50 hover:bg-white/8 md:inline-flex"
                    >
                      Свернуть
                      <ChevronDown className="size-4 rotate-180" strokeWidth={1.5} aria-hidden />
                    </button>
                  </div>
      
                  <div className="mt-6 flex flex-[1_0_auto] flex-col md:mt-7 lg:flex-row lg:gap-12">
                  <div className="flex flex-[1_0_auto] flex-col lg:min-w-0 lg:flex-1">
                  <div className="mb-5 flex flex-wrap items-baseline gap-x-4 gap-y-1 md:mb-7">
                    <h2 id={`${uid}-h`} className="font-serif text-2xl leading-[1.1] text-white md:text-[1.875rem]">
                      {group ? group.name : "Популярные категории"}
                    </h2>
                    <p className="tabular text-[0.9375rem] text-white/60">
                      {group
                        ? `${group.children.length} ${plural(group.children.length, "категория", "категории", "категорий")}`
                        : "или выберите раздел выше"}
                    </p>
                  </div>
                  <div ref={bodyRef} className="flex-[1_0_auto]">
                  {group ? (
                    <ul
                      key={swapKey}
                      ref={listRef}
                      aria-labelledby={`${uid}-h`}
                      style={{ gridTemplateRows: `repeat(${rows ?? group.children.length}, auto)` }}
                      className="grid grid-flow-col grid-cols-[repeat(var(--cols),minmax(0,max-content))] gap-x-10 [--cols:1] motion-safe:animate-swap sm:[--cols:2] xl:[--cols:3]"
                    >
                      {sortCats(group.children).map((c) => {
                        const on = cat?.id === c.id;
                        return (
                          <li key={c.id}>
                            <button
                              type="button"
                              aria-pressed={on}
                              onClick={() => pickCat({ ...c, sectionId: group.id })}
                              className={cn(
                                "flex min-h-10 w-full cursor-pointer items-center gap-2.5 rounded-xs px-2 py-1.5 text-left text-[0.9375rem] font-medium leading-tight transition-colors sm:min-h-[34px] sm:px-2.5",
                                on ? "bg-gold-light/12 font-semibold text-gold-light" : "text-white/92 hover:bg-white/8 hover:text-white",
                              )}
                            >
                              <span className="truncate">{c.name}</span>
                              <Check className={cn("ml-auto size-4 shrink-0 text-gold transition-opacity", on ? "opacity-100" : "opacity-0")} strokeWidth={2.25} aria-hidden />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <ul
                      key={swapKey}
                      aria-labelledby={`${uid}-h`}
                      className={cn("grid grid-cols-3 gap-x-[18px] gap-y-[26px] md:grid-cols-4 lg:grid-cols-6 lg:gap-x-8 lg:gap-y-9", swapKey > 0 && "motion-safe:animate-swap")}
                    >
                      {cells.map((c) => {
                        const on = cat?.id === c.id;
                        return (
                          <li key={c.id}>
                            <button
                              type="button"
                              aria-pressed={on}
                              onClick={() => pickCat(c)}
                              className="group/cell flex w-full cursor-pointer flex-col items-center gap-3 rounded-lg pb-1 text-center text-white"
                            >
                              <span className={cn("relative block aspect-square w-[67%] rounded-lg transition-shadow duration-300", on && "shadow-[0_0_0_3px_var(--color-cloth),0_0_0_5px_var(--color-gold)]")}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={c.cover.src}
                                  alt=""
                                  loading="lazy"
                                  className={cn(
                                    "absolute inset-0 size-full rounded-lg bg-well shadow-cloth transition-[transform,box-shadow] duration-[400ms] ease-soft group-hover/cell:-translate-y-1 group-hover/cell:shadow-cloth-up",
                                    c.cover.contain ? "object-contain p-[6%]" : "object-cover",
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
                              <span className={cn("text-sm font-medium leading-[1.3] text-balance sm:text-[0.9375rem]", on && "font-semibold text-gold-light")}>{c.name}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  </div>
                  </div>

                  {/* На десктопе — вертикальный список справа от категорий, на узких экранах — строка под ними */}
                  <div className="no-scrollbar -mx-4 mt-7 flex items-baseline gap-x-3.5 overflow-x-auto border-t border-white/14 px-4 pt-5 text-sm text-white/70 md:mx-0 md:px-0 lg:mt-0 lg:w-56 lg:shrink-0 lg:flex-col lg:items-start lg:gap-y-1 lg:self-start lg:overflow-visible lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
                    <h2 className="shrink-0 lg:mb-[calc(1.75rem-0.25rem)] lg:font-serif lg:text-[1.875rem] lg:leading-[1.1] lg:text-white">
                      Часто ищут<span className="lg:hidden">{group || cat ? " здесь" : ""}:</span>
                    </h2>
                    {scope.hints.map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => {
                          setQ(h);
                          go(h);
                        }}
                        className="cursor-pointer whitespace-nowrap py-1 text-left font-medium text-white underline decoration-white/35 decoration-1 underline-offset-4 transition-[text-decoration-color] hover:decoration-gold-light hover:decoration-2 lg:whitespace-normal lg:text-[0.9375rem]"
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          slot,
        )}

      <p id={`${uid}-err`} aria-live="polite" className="sr-only">
        {invalid && "Напишите, что ищете, или выберите раздел"}
      </p>
      {invalid && !open && (
        <p className="absolute left-0 right-0 top-full z-10 hidden md:block">
          <span className="wrap flex">
            <span className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-surface px-3 py-2 text-sm text-wax shadow-lift">
              <AlertCircle className="size-4 shrink-0" strokeWidth={1.5} aria-hidden />
              Напишите, что ищете: название, год или материал, или выберите раздел.
            </span>
          </span>
        </p>
      )}
    </div>
  );
}
