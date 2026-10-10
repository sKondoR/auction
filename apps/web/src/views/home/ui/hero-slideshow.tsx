"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { cn } from "@/shared/lib";
import interior from "../assets/hero-interior.webp";
import lamp from "../assets/hero-lamp.webp";
import letters from "../assets/hero-letters.webp";
import peacock from "../assets/hero-peacock.webp";
import sculptures from "../assets/hero-sculptures.webp";

/** Сколько показывается один кадр. */
const SHOW_MS = 7000;

/** `pos` — кадрирование (object-position), `kb` — куда «едет камера» во время наезда. */
const SLIDES = [
  { img: interior, pos: "30% 30%", kb: ["2%", "-1.5%"] },
  { img: sculptures, pos: "60% 30%", kb: ["-2.5%", "1%"] },
  { img: peacock, pos: "60% 45%", kb: ["-1.5%", "2%"] },
  { img: letters, pos: "50% 35%", kb: ["2.5%", "-1%"] },
  { img: lamp, pos: "50% 40%", kb: ["2%", "1.5%"] },
] as const;

/**
 * Фон hero: кадры сменяются наплывом, активный медленно приближается (Ken Burns). Кадры сменяет таймер, а не
 * анимация, поэтому автопроигрывание идёт и при prefers-reduced-motion: тогда глобально выключены только наплыв,
 * наезд и заливка индикатора. Пауза (кнопкой или скрытой вкладкой) запоминает остаток времени кадра.
 */
export function HeroSlideshow({ className }: { className: string }) {
  const [index, setIndex] = useState(0);
  const [leaving, setLeaving] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const remaining = useRef(SHOW_MS);

  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // Ушедший кадр двигается до конца наплыва, затем сбрасывает наезд, чтобы при следующем показе начать заново.
  useEffect(() => {
    if (leaving === null) return;
    const t = setTimeout(() => setLeaving(null), 1600);
    return () => clearTimeout(t);
  }, [leaving]);

  const go = (next: number) => {
    if (next === index) return;
    setLeaving(index);
    setIndex(next);
  };

  // Остаток сбрасывается здесь, а не в go: cleanup предыдущего запуска успевает вычесть из него прошедшее время.
  const timedIndex = useRef(index);
  useEffect(() => {
    if (timedIndex.current !== index) {
      timedIndex.current = index;
      remaining.current = SHOW_MS;
    }
    if (paused || hidden) return;
    const start = Date.now();
    const t = setTimeout(() => go((index + 1) % SLIDES.length), remaining.current);
    return () => {
      clearTimeout(t);
      remaining.current = Math.max(0, remaining.current - (Date.now() - start));
    };
  }, [index, paused, hidden]);

  return (
    <>
      <div aria-hidden className={cn("overflow-hidden", className)}>
        {SLIDES.map(({ img, pos, kb }, i) => {
          const moving = i === index || i === leaving;
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={img.src}
              src={img.src}
              width={img.width}
              height={img.height}
              alt=""
              fetchPriority={i === 0 ? "high" : "low"}
              decoding="async"
              style={{ objectPosition: pos, "--kb-x": kb[0], "--kb-y": kb[1] } as CSSProperties}
              className={cn(
                "absolute inset-0 size-full object-cover transition-opacity duration-[1600ms] ease-in-out will-change-transform",
                i === index ? "opacity-100" : "opacity-0",
                moving && "animate-[kenburns_9s_ease-out_forwards]",
              )}
            />
          );
        })}
      </div>

      <div className="absolute right-4 top-4 z-10 flex items-center gap-2 rounded-md bg-black/35 py-1 pl-2 pr-1 backdrop-blur-sm lg:bottom-8 lg:right-8 lg:top-auto">
        <div className="flex">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => go(i)}
              aria-label={`Фото ${i + 1} из ${SLIDES.length}`}
              aria-current={i === index}
              className="group grid size-7 cursor-pointer place-items-center"
            >
              <span
                className={cn(
                  "relative size-3.5 overflow-hidden rounded-xs transition-colors",
                  i < index ? "bg-white/70" : "bg-white/25 group-hover:bg-white/50",
                )}
              >
                {i === index && (
                  <span
                    key={index}
                    style={{
                      animation: `fill-x ${SHOW_MS}ms linear forwards`,
                      animationPlayState: paused || hidden ? "paused" : "running",
                    }}
                    className="absolute inset-0 origin-left bg-gold"
                  />
                )}
              </span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          aria-label={paused ? "Продолжить слайд-шоу" : "Остановить слайд-шоу"}
          className="grid size-8 cursor-pointer place-items-center rounded-md text-white/85 transition-colors hover:bg-white/15 hover:text-white"
        >
          {paused ? <Play className="size-3.5" fill="currentColor" /> : <Pause className="size-3.5" fill="currentColor" />}
        </button>
      </div>
    </>
  );
}
