import { isStaff } from "@auction/domain";
import { Bell, Gavel, MessageSquare, Plus, Search, User } from "lucide-react";
import Link from "next/link";
import { getCategoryTree } from "@/entities/category/server";
import { unreadConversationCount } from "@/entities/conversation/server";
import { unreadNotificationCount } from "@/entities/notification/server";
import { SignOutButton } from "@/features/auth-by-phone";
import { getViewer } from "@/shared/api";
import { ButtonLink } from "@/shared/ui";
import { UserLive } from "./user-live";

function CountDot({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] font-semibold leading-4 text-primary-foreground">
      {n > 99 ? "99+" : n}
    </span>
  );
}

export async function Header() {
  const viewer = await getViewer();
  const [tree, notif, msgs] = await Promise.all([
    getCategoryTree(),
    viewer ? unreadNotificationCount(viewer.id) : 0,
    viewer ? unreadConversationCount(viewer.id) : 0,
  ]);

  return (
    <header className="border-b bg-surface">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Gavel className="h-4 w-4" />
          </span>
          <span className="hidden font-serif text-xl font-semibold sm:inline">Аукцион</span>
        </Link>

        <form action="/search" className="relative mx-2 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            name="q"
            placeholder="Монеты, банкноты, фарфор…"
            className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm focus:border-accent focus:outline-none"
          />
        </form>

        <ButtonLink href="/lots/new" size="md" className="hidden md:inline-flex">
          <Plus className="h-4 w-4" /> Продать
        </ButtonLink>

        {viewer ? (
          <div className="flex items-center gap-1">
            <UserLive />
            <Link href="/messages" className="relative rounded-md p-2 hover:bg-muted" aria-label="Сообщения">
              <MessageSquare className="h-5 w-5" />
              <CountDot n={msgs} />
            </Link>
            <Link href="/notifications" className="relative rounded-md p-2 hover:bg-muted" aria-label="Уведомления">
              <Bell className="h-5 w-5" />
              <CountDot n={notif} />
            </Link>
            <details className="relative">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md p-2 hover:bg-muted">
                <User className="h-5 w-5" />
                <span className="hidden max-w-32 truncate text-sm lg:inline">{viewer.name}</span>
              </summary>
              <div className="absolute right-0 z-30 mt-1 w-56 rounded-md border bg-surface p-1 text-sm shadow-lg [&>a]:block [&>a]:rounded [&>a]:px-3 [&>a]:py-2 [&>a:hover]:bg-muted">
                <Link href="/cabinet">Личный кабинет</Link>
                <Link href="/cabinet/bids">Мои ставки</Link>
                <Link href="/cabinet/lots">Мои лоты</Link>
                <Link href="/cabinet/deals">Сделки</Link>
                <Link href="/cabinet/favorites">Избранное</Link>
                <Link href={`/users/${viewer.id}`}>Моя страница продавца</Link>
                <Link href="/lots/new" className="md:hidden">
                  Продать
                </Link>
                {isStaff(viewer.role) && (
                  <Link href="/admin" className="font-medium text-primary">
                    Администрирование
                  </Link>
                )}
                <Link href="/cabinet/settings">Настройки</Link>
                <div className="my-1 border-t" />
                <div className="rounded px-3 py-2 hover:bg-muted">
                  <SignOutButton />
                </div>
              </div>
            </details>
          </div>
        ) : (
          <ButtonLink href="/login" variant="outline">
            Войти
          </ButtonLink>
        )}
      </div>
      <nav className="mx-auto flex max-w-7xl gap-5 overflow-x-auto px-4 pb-2 text-sm text-muted-foreground">
        {tree.map((c) => (
          <Link key={c.id} href={`/search?category=${c.id}`} className="whitespace-nowrap hover:text-foreground">
            {c.name}
          </Link>
        ))}
        <Link href="/search?status=ended" className="whitespace-nowrap hover:text-foreground">
          Архив торгов
        </Link>
      </nav>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-16 border-t bg-surface">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 text-sm text-muted-foreground sm:grid-cols-3">
        <div>
          <p className="font-serif text-base text-foreground">Аукцион</p>
          <p className="mt-2">Площадка торгов предметами коллекционирования и антиквариата. Работаем в России, в рублях.</p>
        </div>
        <div className="flex flex-col gap-1">
          <Link href="/rules" className="hover:text-foreground">Правила площадки</Link>
          <Link href="/buyout/new" className="hover:text-foreground">Продать площадке</Link>
          <Link href="/search?status=ended" className="hover:text-foreground">Архив торгов</Link>
        </div>
        <p>
          Площадка не участвует в расчётах между покупателем и продавцом и не разрешает денежные споры. Комиссия с продаж — 1%.
        </p>
      </div>
    </footer>
  );
}
