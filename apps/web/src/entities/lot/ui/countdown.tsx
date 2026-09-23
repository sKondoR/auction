"use client";

import { useEffect, useState } from "react";
import { cn, formatTimeLeft } from "@/shared/lib";

/** Обратный отсчёт до окончания торгов; в последний час подсвечивается. */
export function Countdown({ endsAt, className }: { endsAt: Date | string; className?: string }) {
  const end = new Date(endsAt).getTime();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (now === null) return <span className={className}>&nbsp;</span>;
  const left = end - now;
  return (
    <span className={cn("tabular", left < 3_600_000 && left > 0 && "font-semibold text-danger", className)} suppressHydrationWarning>
      {formatTimeLeft(left)}
    </span>
  );
}
