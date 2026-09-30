import type { ReactNode } from "react";

/** Пастель «отдела лавки» (DESIGN.md → Colors → Пастели). Закрепление постоянно на всём сайте. */
export type Pastel = "butter" | "blush" | "powder" | "peach" | "sage";

const PASTEL_BY_SLUG: Record<string, Pastel> = {
  coins: "butter",
  banknotes: "butter",
  stamps: "blush",
  antiques: "powder",
  postcards: "peach",
  books: "peach",
  medals: "sage",
};

export function categoryPastel(slug: string): Pastel {
  return PASTEL_BY_SLUG[slug] ?? "sage";
}

/** Классы фона пастели и её глубокой подложки. */
export const PASTEL_CLASSES: Record<Pastel, { bg: string; deep: string }> = {
  butter: { bg: "bg-p-butter", deep: "bg-p-butter-deep" },
  blush: { bg: "bg-p-blush", deep: "bg-p-blush-deep" },
  powder: { bg: "bg-p-powder", deep: "bg-p-powder-deep" },
  peach: { bg: "bg-p-peach", deep: "bg-p-peach-deep" },
  sage: { bg: "bg-p-sage", deep: "bg-p-sage-deep" },
};

/* Гравюрные рисунки предметов: квадрат 160×120, линия 1.25, без заливки. */
const ART: Record<string, ReactNode> = {
  coins: (
    <>
      <circle cx="80" cy="60" r="44" />
      <circle cx="80" cy="60" r="38" strokeDasharray="0.1 4.4" strokeWidth="2" />
      <text x="80" y="66" textAnchor="middle" fontFamily="var(--font-display), serif" fontSize="30" strokeWidth="1">
        5
      </text>
      <path d="M68 72h24" />
      <path d="M58 84c-8-8-11-20-8-32" />
      <path d="M102 84c8-8 11-20 8-32" />
      <path d="M54 74c-4 0-7-3-7-6 4 0 7 3 7 6zM52 62c-4-1-6-4-5-7 3 1 5 4 5 7zM106 74c4 0 7-3 7-6-4 0-7 3-7 6zM108 62c4-1 6-4 5-7-3 1-5 4-5 7z" />
      <path d="M72 40l8-6 8 6" />
    </>
  ),
  banknotes: (
    <>
      <rect x="22" y="28" width="116" height="64" rx="2" transform="rotate(-3 80 60)" />
      <g transform="rotate(-3 80 60)">
        <rect x="30" y="36" width="100" height="48" strokeDasharray="0.1 3.6" strokeWidth="1.8" />
        <ellipse cx="108" cy="60" rx="14" ry="17" />
        <path d="M101 70c2-6 12-6 14 0M104 55a4 4 0 1 0 8 0 4 4 0 1 0-8 0" />
        <text x="54" y="67" textAnchor="middle" fontFamily="var(--font-display), serif" fontSize="22" strokeWidth="1">
          25
        </text>
        <path d="M38 76h36M38 46h20M78 46h10" />
      </g>
    </>
  ),
  stamps: (
    <>
      <rect x="46" y="14" width="68" height="92" rx="1" strokeDasharray="0.1 5.2" strokeWidth="3" />
      <rect x="54" y="22" width="52" height="76" />
      <path d="M60 70c10-26 30-34 40-36" />
      <path d="M60 58c12-20 28-26 40-27" />
      <path d="M80 90c-9-6-8-18 0-26 8 8 9 20 0 26z" />
      <path d="M62 92h8M92 92h8" />
    </>
  ),
  medals: (
    <>
      <path d="M64 12h32l-6 34H70z" />
      <path d="M72 12l8 34M88 12l-8 34" />
      <circle cx="80" cy="76" r="28" />
      <circle cx="80" cy="76" r="22" strokeDasharray="2 3" />
      <path d="M80 60l4.7 9.6 10.6 1.5-7.7 7.5 1.8 10.5L80 84.1l-9.4 5 1.8-10.5-7.7-7.5 10.6-1.5z" />
    </>
  ),
  antiques: (
    <>
      <path d="M44 58h72" />
      <path d="M48 58c2 22 14 34 32 34s30-12 32-34" />
      <path d="M50 58c4-14 16-22 30-22s26 8 30 22" />
      <path d="M76 36c0-5 2-8 4-8s4 3 4 8" />
      <ellipse cx="80" cy="100" rx="44" ry="6" />
      <path d="M64 92c-2 3-2 5 0 8M96 92c2 3 2 5 0 8" />
      <path d="M58 70c8 4 36 4 44 0" strokeDasharray="2 4" />
    </>
  ),
  postcards: (
    <>
      <rect x="28" y="22" width="104" height="72" rx="2" transform="rotate(-4 80 58)" />
      <g transform="rotate(-4 80 58)">
        <path d="M40 82h60" />
        <path d="M44 82V58h40v24" />
        <path d="M40 58l24-14 24 14" />
        <path d="M60 44v-8h8v4" />
        <path d="M52 82V68h8v14M70 66h8v8h-8z" />
        <rect x="104" y="30" width="18" height="22" strokeDasharray="2 2" />
        <path d="M96 64h28M96 72h22M96 80h26" />
      </g>
    </>
  ),
  books: (
    <>
      <path d="M80 30c-12-8-30-10-46-6v68c16-4 34-2 46 6 12-8 30-10 46-6V24c-16-4-34-2-46 6z" />
      <path d="M80 30v68" />
      <path d="M42 40c10-2 22-1 30 3M42 50c10-2 22-1 30 3M42 60c10-2 22-1 30 3M88 43c8-4 20-5 30-3M88 53c8-4 20-5 30-3" />
      <path d="M96 66c4 6 14 8 20 2" strokeDasharray="2 3" />
      <path d="M34 92l-6 6h52M126 92l6 6H80" />
    </>
  ),
};

export function CategoryArt({ slug, className }: { slug: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 160 120"
      aria-hidden
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ART[slug] ?? ART.antiques}
    </svg>
  );
}
