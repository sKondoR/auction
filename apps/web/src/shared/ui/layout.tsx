import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "../lib";

/** Панель прилавка: белая, рамка line, 12px, без тени в покое. */
export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-lg border border-border bg-surface", className)} {...props} />;
}

export function CardSection({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("p-4 sm:p-6", className)} {...props} />;
}

const badgeTones = {
  neutral: "bg-well text-muted-foreground",
  primary: "bg-sage-mist text-primary",
  accent: "bg-brass-soft text-[#6f521a]",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-wax-soft text-wax-deep",
  info: "bg-info-soft text-info",
} as const;

export type BadgeTone = keyof typeof badgeTones;

/** Ярлык статуса: 4px, как бирка. */
export function Badge({ tone = "neutral", className, ...props }: ComponentProps<"span"> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-xs px-2 py-0.5 text-[0.8125rem] font-medium leading-5", badgeTones[tone], className)}
      {...props}
    />
  );
}

export function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="headline">{title}</h1>
        {description && <p className="mt-2 max-w-[70ch] text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div className="rounded-xl bg-well px-6 py-14 text-center">
      <p className="font-serif text-[1.375rem] font-bold leading-tight">{title}</p>
      {children && <div className="mx-auto mt-2 max-w-[52ch] text-muted-foreground">{children}</div>}
    </div>
  );
}

/** Табы-ссылки (состояние в URL). */
export function LinkTabs({ items, active }: { items: { href: string; label: ReactNode; key: string }[]; active: string }) {
  return (
    <nav className="no-scrollbar mb-6 flex gap-2 overflow-x-auto border-b border-border">
      {items.map((i) => (
        <Link
          key={i.key}
          href={i.href}
          aria-current={i.key === active ? "page" : undefined}
          className={cn(
            "-mb-px flex min-h-11 items-center whitespace-nowrap border-b-2 px-3 text-[0.9375rem]",
            i.key === active ? "border-primary font-semibold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {i.label}
        </Link>
      ))}
    </nav>
  );
}

const pageLink =
  "inline-flex min-h-11 items-center gap-1 rounded-md border border-border bg-surface px-4 font-medium hover:border-border-strong hover:bg-sage-mist";

export function Pagination({ page, total, pageSize, href }: { page: number; total: number; pageSize: number; href: (p: number) => string }) {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return null;
  return (
    <nav aria-label="Страницы" className="mt-10 flex items-center justify-center gap-3 text-[0.9375rem]">
      {page > 1 && (
        <Link className={pageLink} href={href(page - 1)}>
          <ChevronLeft className="size-4" strokeWidth={1.5} /> Назад
        </Link>
      )}
      <span className="tabular px-2 text-muted-foreground">
        {page} из {pages}
      </span>
      {page < pages && (
        <Link className={pageLink} href={href(page + 1)}>
          Вперёд <ChevronRight className="size-4" strokeWidth={1.5} />
        </Link>
      )}
    </nav>
  );
}

export function Table({ className, ...props }: ComponentProps<"table">) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table
        className={cn(
          "tabular w-full text-[0.9375rem] [&_td]:px-4 [&_td]:py-3 [&_th]:px-4 [&_th]:py-3 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-[0.08em] [&_th]:text-muted-foreground [&_tr]:border-b [&_tr]:border-border last:[&_tr]:border-0",
          className,
        )}
        {...props}
      />
    </div>
  );
}
