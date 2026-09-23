import { bids, favorites, lots, savedSearches, sellerSubscriptions, user } from "@auction/db";
import { filtersToQuery, lotCards, recentlyViewed, unbilledBalance, userRating } from "@auction/services";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import Link from "next/link";
import { countActiveDeals, listDeals } from "@/entities/deal/server";
import { DealStatusBadge } from "@/entities/deal";
import { Countdown, LotGrid } from "@/entities/lot";
import { RatingBadge } from "@/entities/user";
import { DeleteSavedSearchButton, SubscribeButton } from "@/features/engagement";
import { getDb, requireViewer } from "@/shared/api";
import { cn, formatDate, formatDateTime, formatRub } from "@/shared/lib";
import { Badge, ButtonLink, Card, CardSection, EmptyState, LinkTabs, PageHeader, Table } from "@/shared/ui";

export async function CabinetOverviewPage() {
  const viewer = await requireViewer();
  const db = getDb();
  const [rating, activeDeals, balance, myActive] = await Promise.all([
    userRating(db, viewer.id),
    countActiveDeals(viewer.id),
    unbilledBalance(db, viewer.id),
    db.select({ n: sql<number>`count(*)` }).from(lots).where(and(eq(lots.sellerId, viewer.id), eq(lots.status, "active"))),
  ]);
  const tiles = [
    { label: "Активные сделки", value: activeDeals, href: "/cabinet/deals" },
    { label: "Мои активные лоты", value: Number(myActive[0]?.n ?? 0), href: "/cabinet/lots" },
    { label: "Комиссия к счёту", value: formatRub(balance), href: "/cabinet/invoices" },
  ];
  return (
    <div>
      <PageHeader title={`Здравствуйте, ${viewer.name}`} description={<RatingBadge {...rating} />} />
      {!viewer.phoneNumberVerified && <p className="mb-4 rounded-md bg-warning-soft px-4 py-3 text-sm text-warning">Телефон не подтверждён.</p>}
      {viewer.listingBlocked && (
        <p className="mb-4 rounded-md bg-danger-soft px-4 py-3 text-sm text-danger">
          Выставление новых лотов заблокировано: есть просроченный счёт. <Link href="/cabinet/invoices" className="underline">Перейти к счетам</Link>
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        {tiles.map((t) => (
          <Link key={t.label} href={t.href} className="rounded-lg border bg-surface p-4 hover:border-accent">
            <p className="text-sm text-muted-foreground">{t.label}</p>
            <p className="tabular mt-1 font-serif text-3xl">{t.value}</p>
          </Link>
        ))}
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        <ButtonLink href="/lots/new">Выставить лот</ButtonLink>
        <ButtonLink href="/buyout/new" variant="outline">
          Продать площадке
        </ButtonLink>
      </div>
    </div>
  );
}

export async function CabinetBidsPage({ tab }: { tab?: string }) {
  const viewer = await requireViewer();
  const db = getDb();
  const now = new Date();
  const myMax = sql<number>`max(${bids.amount})`;
  const rows = await db
    .select({
      lotId: lots.id,
      title: lots.title,
      currentPrice: lots.currentPrice,
      leaderId: lots.leaderId,
      endsAt: lots.endsAt,
      status: lots.status,
      myMax,
    })
    .from(bids)
    .innerJoin(lots, eq(lots.id, bids.lotId))
    .where(and(eq(bids.bidderId, viewer.id), isNull(bids.cancelledAt)))
    .groupBy(lots.id)
    .orderBy(desc(lots.endsAt))
    .limit(300);
  const active = rows.filter((r) => r.status === "active" && r.endsAt > now);
  const leading = active.filter((r) => r.leaderId === viewer.id);
  const outbid = active.filter((r) => r.leaderId !== viewer.id);
  const ended = rows.filter((r) => !(r.status === "active" && r.endsAt > now));
  const current = tab === "outbid" ? outbid : tab === "ended" ? ended : tab === "leading" ? leading : active;

  return (
    <div>
      <PageHeader title="Мои ставки" />
      <LinkTabs
        active={tab ?? "active"}
        items={[
          { key: "active", href: "/cabinet/bids", label: `Идут торги · ${active.length}` },
          { key: "leading", href: "/cabinet/bids?tab=leading", label: `Лидирую · ${leading.length}` },
          { key: "outbid", href: "/cabinet/bids?tab=outbid", label: `Перебита · ${outbid.length}` },
          { key: "ended", href: "/cabinet/bids?tab=ended", label: `Завершённые · ${ended.length}` },
        ]}
      />
      {current.length === 0 ? (
        <EmptyState title="Здесь пока пусто" />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Лот</th>
              <th>Моя ставка</th>
              <th>Текущая</th>
              <th>Статус</th>
              <th>Окончание</th>
            </tr>
          </thead>
          <tbody>
            {current.map((r) => {
              const open = r.status === "active" && r.endsAt > now;
              const lead = r.leaderId === viewer.id;
              return (
                <tr key={r.lotId}>
                  <td>
                    <Link href={`/lots/${r.lotId}`} className="hover:text-primary">
                      {r.title}
                    </Link>
                  </td>
                  <td className="tabular">{formatRub(Number(r.myMax))}</td>
                  <td className="tabular font-medium">{formatRub(r.currentPrice ?? 0)}</td>
                  <td>
                    {open ? (
                      <Badge tone={lead ? "success" : "danger"}>{lead ? "лидирую" : "перебита"}</Badge>
                    ) : (
                      <Badge tone={lead && r.status === "sold" ? "primary" : "neutral"}>{lead && r.status === "sold" ? "выиграл" : "завершён"}</Badge>
                    )}
                  </td>
                  <td className="text-xs">{open ? <Countdown endsAt={r.endsAt} /> : formatDateTime(r.endsAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </div>
  );
}

export async function CabinetDealsPage({ role }: { role?: string }) {
  const viewer = await requireViewer();
  const r = role === "seller" || role === "buyer" ? role : "all";
  const list = await listDeals(viewer.id, r);
  return (
    <div>
      <PageHeader title={r === "seller" ? "Продажи" : r === "buyer" ? "Покупки и выигрыши" : "Сделки"} />
      <LinkTabs
        active={r}
        items={[
          { key: "all", href: "/cabinet/deals", label: "Все" },
          { key: "buyer", href: "/cabinet/deals?role=buyer", label: "Покупки" },
          { key: "seller", href: "/cabinet/deals?role=seller", label: "Продажи" },
        ]}
      />
      {list.length === 0 ? (
        <EmptyState title="Сделок пока нет" />
      ) : (
        <Card className="divide-y">
          {list.map((d) => (
            <Link key={d.deal.id} href={`/deals/${d.deal.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50">
              {d.thumbUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={d.thumbUrl} alt="" className="h-12 w-12 rounded border object-cover" />
              ) : (
                <div className="h-12 w-12 rounded border bg-muted" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  №{d.deal.id} · {d.lotTitle}
                </p>
                <p className="text-xs text-muted-foreground">
                  {d.deal.sellerId === viewer.id ? `Покупатель: ${d.buyerName}` : `Продавец: ${d.sellerName}`} · {formatDate(d.deal.createdAt)}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="tabular text-sm font-semibold">{formatRub(d.deal.totalPrice)}</span>
                <DealStatusBadge status={d.deal.status} />
              </div>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}

export async function CabinetFavoritesPage() {
  const viewer = await requireViewer();
  const db = getDb();
  const ids = (await db.select({ id: favorites.lotId }).from(favorites).where(eq(favorites.userId, viewer.id))).map((r) => r.id);
  const items = ids.length ? await lotCards(db, inArray(lots.id, ids), [desc(lots.endsAt)], 200) : [];
  return (
    <div>
      <PageHeader title="Избранное" />
      {items.length ? <LotGrid lots={items} /> : <EmptyState title="В избранном пусто">Нажмите «В избранное» на странице лота.</EmptyState>}
    </div>
  );
}

export async function CabinetViewedPage() {
  const viewer = await requireViewer();
  const items = await recentlyViewed(getDb(), viewer.id, undefined, 50);
  return (
    <div>
      <PageHeader title="Недавно смотрели" />
      {items.length ? <LotGrid lots={items} /> : <EmptyState title="Вы ещё ничего не смотрели" />}
    </div>
  );
}

export async function CabinetSearchesPage() {
  const viewer = await requireViewer();
  const list = await getDb().select().from(savedSearches).where(eq(savedSearches.userId, viewer.id)).orderBy(desc(savedSearches.createdAt));
  return (
    <div>
      <PageHeader title="Сохранённые поиски" description="Проверяем раз в 10 минут и присылаем уведомление о новых совпадениях." />
      {list.length === 0 ? (
        <EmptyState title="Нет сохранённых поисков">На странице поиска нажмите «Сохранить поиск».</EmptyState>
      ) : (
        <Card className="divide-y">
          {list.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <Link href={`/search?${filtersToQuery(s.filters)}`} className="font-medium hover:text-primary">
                {s.name}
              </Link>
              <DeleteSavedSearchButton id={s.id} />
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

export async function CabinetSubscriptionsPage() {
  const viewer = await requireViewer();
  const list = await getDb()
    .select({ id: user.id, name: user.name, city: user.city })
    .from(sellerSubscriptions)
    .innerJoin(user, eq(user.id, sellerSubscriptions.sellerId))
    .where(eq(sellerSubscriptions.subscriberId, viewer.id));
  return (
    <div>
      <PageHeader title="Подписки на продавцов" description="Уведомим о новых лотах этих продавцов." />
      {list.length === 0 ? (
        <EmptyState title="Подписок нет">Подпишитесь на странице продавца.</EmptyState>
      ) : (
        <Card className="divide-y">
          {list.map((s) => (
            <CardSection key={s.id} className={cn("flex items-center justify-between gap-3 py-3")}>
              <Link href={`/users/${s.id}`} className="font-medium hover:text-primary">
                {s.name} <span className="text-sm font-normal text-muted-foreground">{s.city}</span>
              </Link>
              <SubscribeButton sellerId={s.id} initial loggedIn />
            </CardSection>
          ))}
        </Card>
      )}
    </div>
  );
}
