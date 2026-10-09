"use client";

import { useEffect, useState } from "react";
import { cn } from "@/shared/lib";

const pad = (n: number) => String(n).padStart(2, "0");

/** Обратный отсчёт в четырёх кольцах (DESIGN.md → Обратный отсчёт). Меньше 5 минут — минуты и секунды сургучом. */
export function CountdownRings({ endsAt }: { endsAt: string }) {
  const end = new Date(endsAt).getTime();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = now === null ? null : Math.max(0, Math.floor((end - now) / 1000));
  const parts: [string, string][] =
    left === null
      ? [["ДНИ", "··"], ["ЧАСЫ", "··"], ["МИН", "··"], ["СЕК", "··"]]
      : [
          ["ДНИ", pad(Math.floor(left / 86400))],
          ["ЧАСЫ", pad(Math.floor((left % 86400) / 3600))],
          ["МИН", pad(Math.floor((left % 3600) / 60))],
          ["СЕК", pad(left % 60)],
        ];
  const hot = left !== null && left > 0 && left < 300;
  return (
    <div role="timer" aria-label="До конца торгов" className="flex flex-wrap gap-2.5 sm:gap-4">
      {parts.map(([label, value], i) => (
        <div key={label} className="flex flex-col items-center gap-2">
          <b
            className={cn(
              "tabular grid size-16 place-items-center rounded-full border-[1.5px] border-gold-light text-2xl font-semibold transition-colors duration-300 sm:size-[72px] sm:text-[1.75rem]",
              hot && i >= 2 && "border-white bg-wax",
            )}
            suppressHydrationWarning
          >
            {value}
          </b>
          <span className="text-[0.6875rem] font-semibold tracking-[0.08em] text-white/74">{label}</span>
        </div>
      ))}
    </div>
  );
}
