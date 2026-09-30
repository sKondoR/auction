import { isStaff } from "@auction/domain";
import { Bell, Clock, Heart, Menu, MessageCircle, Plus, Search, User } from "lucide-react";
import Link from "next/link";
import { getCategoryTree } from "@/entities/category/server";
import { unreadConversationCount } from "@/entities/conversation/server";
import { unreadNotificationCount } from "@/entities/notification/server";
import { SignOutButton } from "@/features/auth-by-phone";
import { getViewer } from "@/shared/api";
import { ButtonLink } from "@/shared/ui";
import { UserLive } from "./user-live";

const iconBtn =
  "relative inline-grid size-11 place-items-center rounded-full text-foreground transition-colors hover:bg-sage-mist [&_svg]:size-5";

function CountDot({ n, label }: { n: number; label: string }) {
  if (n <= 0) return null;
  return (
    <span className="tabular absolute right-0.5 top-0.5 min-w-5 rounded-full bg-primary px-1 text-center text-[0.6875rem] font-semibold leading-5 text-primary-foreground">
      {n > 99 ? "99+" : n}
      <span className="sr-only"> {label}</span>
    </span>
  );
}

function Logo() {
  return (
    <Link href="/" aria-label="Аукцион — на главную" className="flex items-baseline gap-1.5 font-serif text-[1.625rem] leading-none text-foreground md:text-[2rem]">
      Аукцион
      <i aria-hidden className="inline-block size-[7px] -translate-y-0.5 rounded-full bg-wax" />
    </Link>
  );
}

/**
 * Шапка в три яруса (DESIGN.md → Layout → Шапка): служебная полоса, липкая главная строка,
 * строка категорий. Возвращает соседние элементы, чтобы главная строка липла к окну.
 */
export async function Header() {
  const viewer = await getViewer();
  const [tree, notif, msgs] = await Promise.all([
    getCategoryTree(),
    viewer ? unreadNotificationCount(viewer.id) : 0,
    viewer ? unreadConversationCount(viewer.id) : 0,
  ]);

  return (
    <>
      <div className="bg-primary text-[0.8125rem] leading-tight text-white">
        <div className="wrap flex min-h-9 items-center justify-between gap-6">
          <span className="truncate">
            <span className="hidden sm:inline">Выставить лот — бесплатно. Комиссия 1% только с продажи</span>
            <span className="sm:hidden">Лот бесплатно · 1% с продажи</span>
          </span>
          <nav aria-label="Служебное меню" className="hidden gap-6 md:flex">
            <Link href="/buyout/new" className="opacity-90 hover:underline hover:opacity-100">
              Продать администрации
            </Link>
            <Link href="/rules" className="opacity-90 hover:underline hover:opacity-100">
              Помощь
            </Link>
          </nav>
        </div>
      </div>

      <header className="sticky top-0 z-30 border-b border-border bg-surface">
        <div className="wrap grid min-h-16 grid-cols-[auto_1fr_auto] items-center gap-2 md:min-h-[72px] md:grid-cols-[1fr_auto_1fr] md:gap-6">
          <details className="group relative md:hidden">
            <summary className={`${iconBtn} cursor-pointer list-none [&::-webkit-details-marker]:hidden`} aria-label="Меню">
              <Menu strokeWidth={1.5} />
            </summary>
            <nav
              aria-label="Категории"
              className="absolute left-0 top-full z-40 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-lg border border-border bg-surface p-2 shadow-lift [&>a]:flex [&>a]:min-h-11 [&>a]:items-center [&>a]:rounded-md [&>a]:px-3 [&>a:hover]:bg-sage-mist"
            >
              {tree.map((c) => (
                <Link key={c.id} href={`/search?category=${c.id}`}>
                  {c.name}
                </Link>
              ))}
              <Link href="/search?format=english&sort=ending" className="text-wax">
                Идут сейчас
              </Link>
              <div className="my-1 border-t border-border" />
              <Link href="/lots/new">Выставить лот</Link>
              <Link href="/buyout/new">Продать администрации</Link>
              <Link href="/rules">Помощь</Link>
            </nav>
          </details>

          <form action="/search" role="search" className="hidden md:block">
            <label className="flex h-12 max-w-[340px] items-center gap-2.5 rounded-full border border-border bg-surface px-5 text-muted-foreground transition-[border-color,box-shadow] focus-within:border-primary focus-within:shadow-[0_0_0_3px_var(--color-sage-mist)]">
              <Search className="size-5 shrink-0" strokeWidth={1.5} />
              <span className="sr-only">Поиск лотов</span>
              <input
                name="q"
                type="search"
                placeholder="Монета 1899, самовар, марки СССР"
                className="w-full bg-transparent text-[0.9375rem] text-foreground outline-none placeholder:text-faint"
              />
            </label>
          </form>

          <div className="justify-self-start md:justify-self-center">
            <Logo />
          </div>

          <div className="flex items-center justify-end gap-1">
            <Link href="/search" className={`${iconBtn} md:hidden`} aria-label="Поиск">
              <Search strokeWidth={1.5} />
            </Link>
            {viewer ? (
              <>
                <UserLive />
                <Link href="/notifications" className={iconBtn} aria-label="Уведомления">
                  <Bell strokeWidth={1.5} />
                  <CountDot n={notif} label="новых" />
                </Link>
                <Link href="/cabinet/favorites" className={`${iconBtn} hidden lg:inline-grid`} aria-label="Избранное">
                  <Heart strokeWidth={1.5} />
                </Link>
                <Link href="/messages" className={`${iconBtn} hidden sm:inline-grid`} aria-label="Сообщения">
                  <MessageCircle strokeWidth={1.5} />
                  <CountDot n={msgs} label="непрочитанных" />
                </Link>
                <details className="relative">
                  <summary
                    className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-full px-2.5 hover:bg-sage-mist [&::-webkit-details-marker]:hidden"
                    aria-label="Меню пользователя"
                  >
                    <User className="size-5" strokeWidth={1.5} />
                    <span className="hidden max-w-32 truncate text-[0.9375rem] font-medium xl:inline">{viewer.name}</span>
                  </summary>
                  <div className="absolute right-0 z-40 mt-2 w-60 rounded-lg border border-border bg-surface p-2 text-[0.9375rem] shadow-lift [&>a]:flex [&>a]:min-h-10 [&>a]:items-center [&>a]:rounded-md [&>a]:px-3 [&>a:hover]:bg-sage-mist">
                    <Link href="/cabinet">Личный кабинет</Link>
                    <Link href="/cabinet/bids">Мои ставки</Link>
                    <Link href="/cabinet/lots">Мои лоты</Link>
                    <Link href="/cabinet/deals">Сделки</Link>
                    <Link href="/cabinet/favorites">Избранное</Link>
                    <Link href="/messages" className="sm:hidden">
                      Сообщения
                    </Link>
                    <Link href={`/users/${viewer.id}`}>Моя страница продавца</Link>
                    {isStaff(viewer.role) && (
                      <Link href="/admin" className="font-semibold text-primary">
                        Администрирование
                      </Link>
                    )}
                    <Link href="/cabinet/settings">Настройки</Link>
                    <div className="my-1 border-t border-border" />
                    <div className="flex min-h-10 items-center rounded-md px-3 hover:bg-sage-mist">
                      <SignOutButton />
                    </div>
                  </div>
                </details>
              </>
            ) : (
              <Link href="/login" className="hidden min-h-11 items-center rounded-md px-3 font-medium hover:bg-sage-mist sm:inline-flex">
                Войти
              </Link>
            )}
            <ButtonLink href="/lots/new" size="sm" className="ml-2 hidden md:inline-flex">
              <Plus strokeWidth={1.5} /> Выставить лот
            </ButtonLink>
            {!viewer && (
              <Link href="/login" className={`${iconBtn} sm:hidden`} aria-label="Войти">
                <User strokeWidth={1.5} />
              </Link>
            )}
          </div>
        </div>
      </header>

      <nav aria-label="Категории" className="border-b border-border bg-surface">
        <div className="wrap">
          <ul className="no-scrollbar flex gap-8 overflow-x-auto label-caps lg:justify-center">
            {tree.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/search?category=${c.id}`}
                  className="flex h-12 items-center whitespace-nowrap border-b-2 border-transparent text-foreground hover:border-primary"
                >
                  {c.name}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/search?format=english&sort=ending"
                className="flex h-12 items-center gap-1.5 whitespace-nowrap border-b-2 border-transparent text-wax hover:border-wax"
              >
                <Clock className="size-4" strokeWidth={1.5} />
                Идут сейчас
              </Link>
            </li>
          </ul>
        </div>
      </nav>
    </>
  );
}

export function Footer() {
  const cols: [string, [string, string][]][] = [
    ["О площадке", [["Правила торгов", "/rules"], ["Архив торгов", "/search?status=ended"]]],
    ["Покупателям", [["Идут сейчас", "/search?format=english&sort=ending"], ["Сохранённые поиски", "/cabinet/searches"], ["Избранное", "/cabinet/favorites"]]],
    ["Продавцам", [["Выставить лот", "/lots/new"], ["Продать администрации", "/buyout/new"], ["Счета и комиссия", "/cabinet/invoices"]]],
    ["Помощь", [["Как сделать ставку", "/rules"], ["Сделки и отзывы", "/cabinet/deals"]]],
  ];
  return (
    <footer className="on-dark bg-primary text-white">
      <div className="wrap grid grid-cols-1 gap-8 pb-12 pt-16 min-[480px]:grid-cols-2 lg:grid-cols-5">
        {cols.map(([title, links]) => (
          <div key={title}>
            <h2 className="mb-4 font-serif text-xl font-bold leading-tight">{title}</h2>
            <ul className="grid gap-2.5">
              {links.map(([label, href]) => (
                <li key={href + label}>
                  <Link href={href} className="text-sm text-white/80 hover:text-white hover:underline">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div>
          <h2 className="mb-4 font-serif text-xl font-bold leading-tight">Связь</h2>
          <p className="text-sm text-white/80">Вопросы о правилах — в разделе помощи. Споры о деньгах площадка не разрешает: расчёты идут напрямую.</p>
        </div>
      </div>
      <div className="bg-primary-hover text-[0.8125rem] text-white/72">
        <div className="wrap flex flex-wrap justify-between gap-x-6 gap-y-3 py-5">
          <span>Площадка не участвует в расчётах между покупателем и продавцом. Комиссия с продаж — 1%.</span>
          <Link href="/rules" className="underline">
            Правила площадки
          </Link>
        </div>
      </div>
    </footer>
  );
}
