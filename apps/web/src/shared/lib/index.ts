import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export { formatRub } from "@auction/domain";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const dateFmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Moscow",
});

export const formatDate = (d: Date | string) => dateFmt.format(new Date(d));
export const formatDateTime = (d: Date | string) => dateTimeFmt.format(new Date(d));

/** «2 д 4 ч», «35 мин», «12 с» — остаток времени до окончания. */
export function formatTimeLeft(ms: number): string {
  if (ms <= 0) return "завершён";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d} д ${h} ч`;
  if (h > 0) return `${h} ч ${m} мин`;
  if (m > 0) return `${m} мин ${s % 60} с`;
  return `${s} с`;
}

/** «1 234,5» / «1234» ₽ → копейки; null — некорректно. */
export function parseRub(input: FormDataEntryValue | null | undefined): number | null {
  if (input == null) return null;
  const s = String(input).replace(/\s|₽/g, "").replace(",", ".");
  if (!s) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}

export const kopecksToInput = (k: number | null | undefined) =>
  k == null ? "" : (k / 100).toString().replace(".", ",");

export function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

export const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");
export const int = (v: FormDataEntryValue | null) => {
  const n = Number(str(v));
  return Number.isInteger(n) ? n : NaN;
};
