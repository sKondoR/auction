"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/shared/lib";

export interface NavGroup {
  title: string;
  items: { href: string; label: string; badge?: number }[];
}

/** Боковая навигация кабинета и админки. */
export function SideNav({ groups }: { groups: NavGroup[] }) {
  const path = usePathname();
  return (
    <nav className="flex gap-4 overflow-x-auto text-sm lg:flex-col lg:gap-5">
      {groups.map((g) => (
        <div key={g.title} className="flex shrink-0 gap-1 lg:flex-col">
          <p className="hidden px-3 pb-1 text-xs uppercase tracking-wide text-muted-foreground lg:block">{g.title}</p>
          {g.items.map((i) => {
            const active = path === i.href || (i.href !== "/cabinet" && i.href !== "/admin" && path.startsWith(i.href));
            return (
              <Link
                key={i.href}
                href={i.href}
                className={cn(
                  "flex items-center justify-between gap-2 whitespace-nowrap rounded-md px-3 py-1.5",
                  active ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted",
                )}
              >
                {i.label}
                {!!i.badge && <span className="rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{i.badge}</span>}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
