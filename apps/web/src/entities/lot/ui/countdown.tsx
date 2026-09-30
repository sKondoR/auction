"use client";

import { Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { cn, formatTimeLeft } from "@/shared/lib";

const HOUR = 3_600_000;

/** Время до конца торгов. В последний час — сургуч и иконка часов, чтобы состояние передавал не только цвет. */
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
  const urgent = left > 0 && left < HOUR;
  return (
    <span className={cn("tabular inline-flex items-center gap-1", urgent && "font-medium text-wax", className)} suppressHydrationWarning>
      {urgent && <Clock className="size-3.75 shrink-0" strokeWidth={1.5} aria-hidden />}
      {formatTimeLeft(left)}
    </span>
  );
}
