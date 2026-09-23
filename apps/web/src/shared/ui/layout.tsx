import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "../lib";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-lg border bg-surface", className)} {...props} />;
}

export function CardSection({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("p-4 sm:p-5", className)} {...props} />;
}

const badgeTones = {
  neutral: "bg-muted text-muted-foreground",
  primary: "bg-primary/10 text-primary",
  accent: "bg-accent-soft text-[#7a5a24]",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
} as const;

export type BadgeTone = keyof typeof badgeTones;

export function Badge({ tone = "neutral", className, ...props }: ComponentProps<"span"> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn("inline-flex items-center rounded-sm px-1.5 py-0.5 text-xs font-medium", badgeTones[tone], className)}
      {...props}
    />
  );
}

export function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed bg-surface/60 px-6 py-12 text-center">
      <p className="font-serif text-lg">{title}</p>
      {children && <div className="mt-2 text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}

/** Табы-ссылки (состояние в URL). */
export function LinkTabs({ items, active }: { items: { href: string; label: ReactNode; key: string }[]; active: string }) {
  return (
    <nav className="mb-5 flex gap-1 overflow-x-auto border-b">
      {items.map((i) => (
        <Link
          key={i.key}
          href={i.href}
          className={cn(
            "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm",
            i.key === active ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {i.label}
        </Link>
      ))}
    </nav>
  );
}

export function Pagination({ page, total, pageSize, href }: { page: number; total: number; pageSize: number; href: (p: number) => string }) {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return null;
  return (
    <div className="mt-8 flex items-center justify-center gap-2 text-sm">
      {page > 1 && (
        <Link className="rounded-md border bg-surface px-3 py-1.5 hover:bg-muted" href={href(page - 1)}>
          ← Назад
        </Link>
      )}
      <span className="px-2 text-muted-foreground">
        {page} из {pages}
      </span>
      {page < pages && (
        <Link className="rounded-md border bg-surface px-3 py-1.5 hover:bg-muted" href={href(page + 1)}>
          Вперёд →
        </Link>
      )}
    </div>
  );
}

export function Table({ className, ...props }: ComponentProps<"table">) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-surface">
      <table className={cn("w-full text-sm [&_td]:px-3 [&_td]:py-2.5 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-medium [&_th]:text-muted-foreground [&_thead]:bg-muted/60 [&_tr]:border-b last:[&_tr]:border-0", className)} {...props} />
    </div>
  );
}
