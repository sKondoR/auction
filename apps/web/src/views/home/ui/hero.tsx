import { SEARCH_FLOOR } from "@/features/catalog-search";
import { ButtonLink } from "@/shared/ui";
import { HeroSlideshow } from "./hero-slideshow";

/**
 * Hero главной под шапкой с поиском. Слайд-шоу интерьеров — на всю ширину и высоту баннера; его край под текстом
 * растворяется маской, и там проступает сукно: слева на десктопе, снизу на телефоне. Синий — только подложка
 * под текстом, сама сцена остаётся тёплой. Display «Идут *торги*» (курсив — градиент золота монеты).
 */
export function Hero() {
  return (
    <section {...SEARCH_FLOOR} aria-labelledby="hero-h" className="on-dark cloth bleed relative isolate -mt-8 overflow-hidden">
      <HeroSlideshow className="absolute inset-x-0 top-0 -z-10 h-[62%] w-full mask-[linear-gradient(to_bottom,#000_55%,transparent)] lg:inset-y-0 lg:left-auto lg:h-full lg:w-[72%] lg:mask-[linear-gradient(to_right,transparent_14%,#000_56%)]" />

      <div className="wrap flex flex-col pb-10 pt-[min(62vw,380px)] lg:grid lg:min-h-[540px] lg:grid-cols-12 lg:items-center lg:gap-6 lg:py-16">
        <div className="flex flex-col lg:col-span-6">
          {/* Бровь по ширине заголовка: надпись по центру, золотые линии тянутся до краёв. */}
          <div className="w-fit">
            <p className="label-caps flex items-center gap-2 text-[0.6875rem] text-gold-light sm:gap-3 sm:text-[0.75rem]">
              <span aria-hidden className="h-px min-w-4 flex-1 bg-gold" />
              Аукцион вещей с историей
              <span aria-hidden className="h-px min-w-4 flex-1 bg-gold" />
            </p>
            <h1 id="hero-h" className="mt-8 font-serif text-[clamp(4.375rem,2rem+5vw,6rem)] font-normal leading-[0.88] tracking-[-0.025em]">
              <span className="block">Идут</span>
              <em className="-mt-[0.04em] ml-[0.9em] block w-fit bg-[linear-gradient(170deg,var(--color-gold-light)_15%,var(--color-gold)_55%,var(--color-gold-deep))] bg-clip-text pb-[0.14em] pr-[0.1em] italic text-transparent">
                торги
              </em>
            </h1>
          </div>
          <p className="mt-2 max-w-[28ch] text-[1.125rem] leading-relaxed text-pretty text-white/82 lg:text-[1.25rem]">
            По&nbsp;цене торгов, а&nbsp;не за&nbsp;бесценок.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:flex">
            <ButtonLink href="/search?format=english&sort=ending" variant="gold">
              Смотреть торги
            </ButtonLink>
            <ButtonLink href="/lots/new" variant="gold">
              Выставить лот
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
