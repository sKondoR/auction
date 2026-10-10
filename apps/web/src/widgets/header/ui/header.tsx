import { isStaff } from "@auction/domain";
import { Bell, Clock, Heart, Menu, MessageCircle, User } from "lucide-react";
import Link from "next/link";
import { getCategoryTree } from "@/entities/category/server";
import { unreadConversationCount } from "@/entities/conversation/server";
import { unreadNotificationCount } from "@/entities/notification/server";
import { SignOutButton } from "@/features/auth-by-phone";
import { CatalogSearch, CatalogSearchSlot, buildScopes } from "@/features/catalog-search";
import { getViewer } from "@/shared/api";
import { ButtonLink } from "@/shared/ui";
import { UserLive } from "./user-live";

const roundBtn = "relative inline-grid place-items-center rounded-full text-foreground transition-colors hover:bg-sage-mist";
/** Иконки служебной полосы — 36px, по высоте полосы. */
const iconBtn = `${roundBtn} size-9 [&_svg]:size-[1.125rem]`;

function CountDot({ n, label }: { n: number; label: string }) {
  if (n <= 0) return null;
  return (
    <span className="tabular absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-primary px-1 text-center text-[0.625rem] font-semibold leading-4 text-primary-foreground">
      {n > 99 ? "99+" : n}
      <span className="sr-only"> {label}</span>
    </span>
  );
}

/**
 * Логотип aucs.online: точка домена — золотой шарик с бликом, от которого раз в 2,2 с расходится
 * кольцо («площадка онлайн, торги идут»). Размер точки в целых пикселях, чтобы не съезжала.
 */
function Logo() {
  return (
    <Link
      href="/"
      aria-label="aucs.online — на главную"
      className="flex items-baseline whitespace-nowrap font-serif text-[1.875rem] leading-none tracking-[-0.01em] text-foreground md:text-[2.375rem]"
    >
      aucs
      <i
        aria-hidden
        className="relative mx-0.5 ml-[3px] inline-block size-2 shrink-0 rounded-full bg-[radial-gradient(circle_at_35%_30%,#fbe38c,var(--color-gold)_55%,var(--color-gold-deep))] shadow-[inset_0_0_0_1px_rgba(150,100,10,0.55)] after:pointer-events-none after:absolute after:inset-0 after:rounded-full after:border-[1.5px] after:border-gold-deep after:opacity-0 after:content-[''] motion-safe:after:animate-online md:mx-[3px] md:ml-1 md:size-2.5"
      />
      <span className="text-muted-foreground">online</span>
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
  const scopes = buildScopes(tree);

  return (
    <>
      <div className="border-b border-border bg-surface text-[0.8125rem] leading-tight text-muted-foreground">
        <div className="wrap flex min-h-9 items-center justify-between gap-6">
          <span className="truncate">
            <span className="hidden sm:inline">Выставить лот — бесплатно. Комиссия 1% только с продажи</span>
            <span className="sm:hidden">Лот бесплатно · 1% с продажи</span>
          </span>
          <div className="-mr-2 flex shrink-0 items-center gap-4 md:gap-6">
            <div className="flex items-center">
              {viewer ? (
                <>
                  <UserLive />
                  <Link href="/notifications" className={iconBtn} aria-label="Уведомления">
                    <Bell strokeWidth={1.5} />
                    <CountDot n={notif} label="новых" />
                  </Link>
                  <Link href="/cabinet/favorites" className={`${iconBtn} hidden sm:inline-grid`} aria-label="Избранное">
                    <Heart strokeWidth={1.5} />
                  </Link>
                  <Link href="/messages" className={iconBtn} aria-label="Сообщения">
                    <MessageCircle strokeWidth={1.5} />
                    <CountDot n={msgs} label="непрочитанных" />
                  </Link>
                  <details className="relative">
                    <summary
                      className="flex min-h-9 cursor-pointer list-none items-center gap-1.5 rounded-full px-2 text-foreground hover:bg-sage-mist [&::-webkit-details-marker]:hidden"
                      aria-label="Меню пользователя"
                    >
                      <User className="size-[1.125rem]" strokeWidth={1.5} />
                      <span className="hidden max-w-32 truncate font-medium md:inline">{viewer.name}</span>
                    </summary>
                    <div className="absolute right-0 z-40 mt-1 w-60 rounded-lg border border-border bg-surface p-2 text-[0.9375rem] text-foreground shadow-lift [&>a]:flex [&>a]:min-h-10 [&>a]:items-center [&>a]:rounded-md [&>a]:px-3 [&>a:hover]:bg-sage-mist">
                      <Link href="/cabinet">Личный кабинет</Link>
                      <Link href="/cabinet/bids">Мои ставки</Link>
                      <Link href="/cabinet/lots">Мои лоты</Link>
                      <Link href="/cabinet/deals">Сделки</Link>
                      <Link href="/cabinet/favorites">Избранное</Link>
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
                <Link href="/login" className="flex min-h-9 items-center gap-1.5 rounded-full px-2 font-medium text-foreground hover:bg-sage-mist">
                  <User className="size-[1.125rem]" strokeWidth={1.5} />
                  Войти
                </Link>
              )}
            </div>
            <nav aria-label="Служебное меню" className="hidden gap-6 md:flex [&>a]:text-foreground [&>a:hover]:underline">
              <Link href="/buyout/new" className="hidden lg:inline">
                Продать администрации
              </Link>
              <Link href="/rules">Помощь</Link>
            </nav>
          </div>
        </div>
      </div>

      <header className="sticky top-0 z-30 border-b border-border bg-surface">
        <div className="wrap grid min-h-16 grid-cols-[auto_1fr_auto] items-center gap-1 md:min-h-[72px] md:gap-5">
          <div className="flex items-center gap-1">
            <details className="group relative md:hidden">
              <summary className={`${roundBtn} size-11 cursor-pointer list-none [&_svg]:size-5 [&::-webkit-details-marker]:hidden`} aria-label="Меню">
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
            <Logo />
          </div>

          <CatalogSearch {...scopes} />

          <div className="flex items-center justify-end">
            <ButtonLink href="/lots/new" size="sm" variant="gold" className="hidden md:inline-flex">
              Выставить лот
            </ButtonLink>
          </div>
        </div>
        <CatalogSearchSlot />
      </header>

      <nav aria-label="Категории" className="border-b border-border bg-surface">
        <div className="wrap">
          <ul className="no-scrollbar flex gap-8 overflow-x-auto label-caps lg:justify-center">
            {tree.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/search?category=${c.id}`}
                  className="relative flex h-12 items-center whitespace-nowrap after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] after:scale-x-0 after:transition-transform after:duration-200 after:ease-out hover:after:scale-x-100 text-foreground after:bg-gold"
                >
                  {c.name}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/search?format=english&sort=ending"
                className="relative flex h-12 items-center whitespace-nowrap after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] after:scale-x-0 after:transition-transform after:duration-200 after:ease-out hover:after:scale-x-100 gap-1.5 text-wax after:bg-gold"
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
    <footer className="on-dark border-t-[3px] border-gold bg-primary text-white">
      <div className="wrap grid grid-cols-1 gap-8 pb-12 pt-16 min-[480px]:grid-cols-2 lg:grid-cols-5">
        {cols.map(([title, links]) => (
          <div key={title}>
            <h2 className="mb-4 font-serif text-xl font-bold leading-tight text-gold-light">{title}</h2>
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
          <h2 className="mb-4 font-serif text-xl font-bold leading-tight text-gold-light">Связь</h2>
          <p className="text-sm text-white/80">Вопросы о правилах — в разделе помощи. Споры о деньгах площадка не разрешает: расчёты идут напрямую.</p>
        </div>
      </div>
      <div className="bg-primary-hover text-[0.8125rem] text-white/72">
        <div className="wrap flex flex-wrap justify-between gap-x-6 gap-y-3 py-5">
          <span>© {new Date().getFullYear()} aucs.online. Площадка не участвует в расчётах между пользователями. Комиссия с продаж — 1%.</span>
          <Link href="/rules" className="underline">
            Правила площадки
          </Link>
        </div>
      </div>
    </footer>
  );
}
