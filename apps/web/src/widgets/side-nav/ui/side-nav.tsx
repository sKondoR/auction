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
    <nav className="no-scrollbar flex gap-4 overflow-x-auto text-[0.9375rem] lg:flex-col lg:gap-6">
      {groups.map((g) => (
        <div key={g.title} className="flex shrink-0 gap-1 lg:flex-col">
          <p className="label-caps hidden px-3 pb-1 text-muted-foreground lg:block">{g.title}</p>
          {g.items.map((i) => {
            const active = path === i.href || (i.href !== "/cabinet" && i.href !== "/admin" && path.startsWith(i.href));
            return (
              <Link
                key={i.href}
                href={i.href}
                className={cn(
                  "flex min-h-11 items-center justify-between gap-2 whitespace-nowrap rounded-md px-3 lg:min-h-10",
                  active ? "bg-sage-mist font-semibold text-primary" : "hover:bg-sage-mist/60",
                )}
              >
                {i.label}
                {!!i.badge && <span className="tabular min-w-5 rounded-full bg-primary px-1.5 text-center text-[0.6875rem] font-semibold leading-5 text-primary-foreground">{i.badge}</span>}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
