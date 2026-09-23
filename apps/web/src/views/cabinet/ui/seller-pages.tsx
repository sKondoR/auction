import { buyoutRequests, getSetting, invoices, ledgerEntries, lots, notificationPreferences, offers, user } from "@auction/db";
import {
  BUYOUT_STATUS_LABELS,
  DAY_MS,
  FIXED_EXPIRY_REMINDER_DAYS,
  NOTIFICATION_TYPES,
  type NotificationType,
  defaultChannels,
} from "@auction/domain";
import { lotCards, periodLabel, publicUrl, unbilledBalance } from "@auction/services";
import { type SQL, and, desc, eq, gt, inArray, isNull, lte, or } from "drizzle-orm";
import Link from "next/link";
import { InvoiceStatusBadge } from "@/entities/deal";
import { LotStatusBadge } from "@/entities/lot";
import { BuyoutOfferAnswer, DeleteAccountForm, NotificationPrefsForm, ProfileForm } from "@/features/account";
import { RelistManyForm } from "@/features/lot-editor";
import { RespondOfferButtons } from "@/features/lot-trading";
import { getDb, requireViewer } from "@/shared/api";
import { formatDate, formatDateTime, formatRub } from "@/shared/lib";
import { Badge, ButtonLink, Card, CardSection, EmptyState, LinkTabs, PageHeader, Table } from "@/shared/ui";

const LOT_TABS = {
  active: "Активные",
  expiring: "Скоро истекают",
  sold: "Завершённые с продажей",
  unsold: "Завершённые без продажи",
  withdrawn: "Снятые",
} as const;
type LotTab = keyof typeof LOT_TABS;

export async function CabinetLotsPage({ tab: rawTab }: { tab?: string }) {
  const viewer = await requireViewer();
  const tab: LotTab = rawTab && rawTab in LOT_TABS ? (rawTab as LotTab) : "active";
  const now = new Date();
  const mine = eq(lots.sellerId, viewer.id);
  const conds: Record<LotTab, SQL | undefined> = {
    active: and(mine, eq(lots.status, "active"), gt(lots.endsAt, now)),
    expiring: and(mine, eq(lots.status, "active"), gt(lots.endsAt, now), lte(lots.endsAt, new Date(now.getTime() + FIXED_EXPIRY_REMINDER_DAYS * DAY_MS))),
    sold: and(mine, eq(lots.status, "sold")),
    // Не проданные и ещё не перевыставленные (включая завершившиеся, но не финализированные).
    unsold: and(mine, isNull(lots.relistedToId), or(eq(lots.status, "unsold"), and(eq(lots.status, "active"), lte(lots.endsAt, now)))),
    withdrawn: and(mine, inArray(lots.status, ["withdrawn", "removed"])),
  };
  const items = await lotCards(getDb(), conds[tab], [desc(lots.endsAt)], 300);

  return (
    <div>
      <PageHeader title="Мои лоты" actions={<ButtonLink href="/lots/new">Выставить лот</ButtonLink>} />
      <LinkTabs active={tab} items={Object.entries(LOT_TABS).map(([k, label]) => ({ key: k, label, href: `/cabinet/lots?tab=${k}` }))} />
      {items.length === 0 ? (
        <EmptyState title="Здесь пока пусто" />
      ) : (
        (() => {
          const table = (
            <Table>
              <thead>
                <tr>
                  {tab === "unsold" && <th className="w-8" />}
                  <th>Лот</th>
                  <th>Цена</th>
                  <th>Статус</th>
                  <th>Окончание</th>
                </tr>
              </thead>
              <tbody>
                {items.map((l) => (
                  <tr key={l.id}>
                    {tab === "unsold" && (
                      <td>
                        <input type="checkbox" name="lotIds" value={l.id} className="h-4 w-4 accent-[var(--color-primary)]" />
                      </td>
                    )}
                    <td>
                      <Link href={`/lots/${l.id}`} className="hover:text-primary">
                        {l.title}
                      </Link>
                      {l.quantity > 1 && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          продано {l.quantitySold}/{l.quantity}
                        </span>
                      )}
                    </td>
                    <td className="tabular">{formatRub(l.price)}</td>
                    <td>
                      <LotStatusBadge status={l.status} format={l.format} startsAt={l.startsAt} endsAt={l.endsAt} />
                    </td>
                    <td className="text-xs">{formatDateTime(l.endsAt)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          );
          return tab === "unsold" ? <RelistManyForm>{table}</RelistManyForm> : table;
        })()
      )}
    </div>
  );
}

export async function CabinetOffersPage() {
  const viewer = await requireViewer();
  const db = getDb();
  const incoming = await db
    .select({ o: offers, lotTitle: lots.title, listPrice: lots.startPrice, buyerName: user.name })
    .from(offers)
    .innerJoin(lots, eq(lots.id, offers.lotId))
    .innerJoin(user, eq(user.id, offers.buyerId))
    .where(and(eq(lots.sellerId, viewer.id), eq(offers.status, "pending")))
    .orderBy(desc(offers.createdAt));
  const outgoing = await db
    .select({ o: offers, lotTitle: lots.title, listPrice: lots.startPrice })
    .from(offers)
    .innerJoin(lots, eq(lots.id, offers.lotId))
    .where(eq(offers.buyerId, viewer.id))
    .orderBy(desc(offers.createdAt))
    .limit(100);
  const statusLabel = { pending: "ожидает", accepted: "принято", rejected: "отклонено", cancelled: "отменено" } as const;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Предложения цены" />
      <section>
        <h2 className="mb-3 text-lg font-semibold">Мне предлагают</h2>
        {incoming.length === 0 ? (
          <EmptyState title="Новых предложений нет" />
        ) : (
          <Card className="divide-y">
            {incoming.map(({ o, lotTitle, listPrice, buyerName }) => (
              <CardSection key={o.id} className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm">
                  <Link href={`/lots/${o.lotId}`} className="font-medium hover:text-primary">
                    {lotTitle}
                  </Link>
                  <p>
                    {buyerName} предлагает <b className="tabular">{formatRub(o.price)}</b>
                    {o.quantity > 1 && ` × ${o.quantity} шт.`} <span className="text-muted-foreground">(ваша цена {formatRub(listPrice)})</span>
                  </p>
                  {o.message && <p className="text-muted-foreground">«{o.message}»</p>}
                </div>
                <RespondOfferButtons offerId={o.id} />
              </CardSection>
            ))}
          </Card>
        )}
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold">Мои предложения</h2>
        {outgoing.length === 0 ? (
          <EmptyState title="Вы ещё не предлагали цену" />
        ) : (
          <Table>
            <tbody>
              {outgoing.map(({ o, lotTitle }) => (
                <tr key={o.id}>
                  <td>
                    <Link href={`/lots/${o.lotId}`} className="hover:text-primary">
                      {lotTitle}
                    </Link>
                  </td>
                  <td className="tabular">{formatRub(o.price)}</td>
                  <td>
                    <Badge tone={o.status === "accepted" ? "success" : o.status === "pending" ? "warning" : "neutral"}>{statusLabel[o.status]}</Badge>
                  </td>
                  <td className="text-xs text-muted-foreground">{formatDateTime(o.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </section>
    </div>
  );
}

export async function CabinetInvoicesPage() {
  const viewer = await requireViewer();
  const db = getDb();
  const [list, ledger, balance, requisites] = await Promise.all([
    db.select().from(invoices).where(eq(invoices.sellerId, viewer.id)).orderBy(desc(invoices.issuedAt)),
    db.select().from(ledgerEntries).where(eq(ledgerEntries.sellerId, viewer.id)).orderBy(desc(ledgerEntries.createdAt)).limit(200),
    unbilledBalance(db, viewer.id),
    getSetting(db, "requisites"),
  ]);
  const unpaid = list.filter((i) => i.status === "issued" || i.status === "overdue");

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Счета и комиссия"
        description="Комиссия 1% с каждой продажи. Счёт выставляется 1-го числа за прошлый месяц, если сумма от 100 ₽; оплатить — в течение 10 дней."
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardSection>
            <p className="text-sm text-muted-foreground">Начислено, ещё не в счёте</p>
            <p className="tabular font-serif text-3xl">{formatRub(balance)}</p>
          </CardSection>
        </Card>
        <Card className={unpaid.some((i) => i.status === "overdue") ? "border-danger" : undefined}>
          <CardSection>
            <p className="text-sm text-muted-foreground">К оплате по счетам</p>
            <p className="tabular font-serif text-3xl">{formatRub(unpaid.reduce((s, i) => s + i.amount, 0))}</p>
          </CardSection>
        </Card>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Счета</h2>
        {list.length === 0 ? (
          <EmptyState title="Счетов пока нет" />
        ) : (
          <Table>
            <thead>
              <tr>
                <th>№</th>
                <th>Период</th>
                <th>Сумма</th>
                <th>Оплатить до</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {list.map((i) => (
                <tr key={i.id}>
                  <td>{i.id}</td>
                  <td>{periodLabel(i.periodStart)}</td>
                  <td className="tabular font-medium">{formatRub(i.amount)}</td>
                  <td>{formatDate(i.dueAt)}</td>
                  <td>
                    <InvoiceStatusBadge status={i.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {unpaid.length > 0 && (
          <Card className="mt-4">
            <CardSection>
              <p className="mb-2 text-sm font-medium">Реквизиты для оплаты</p>
              <pre className="whitespace-pre-wrap font-sans text-sm">{requisites.replace("{номер}", unpaid.map((i) => i.id).join(", "))}</pre>
              <p className="mt-3 text-xs text-muted-foreground">
                После поступления оплаты администратор отметит счёт оплаченным. Онлайн-оплата картой появится позже.
              </p>
            </CardSection>
          </Card>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Книга начислений</h2>
        {ledger.length === 0 ? (
          <EmptyState title="Начислений пока нет" />
        ) : (
          <Table>
            <tbody>
              {ledger.map((e) => (
                <tr key={e.id}>
                  <td className="text-xs text-muted-foreground">{formatDateTime(e.createdAt)}</td>
                  <td>
                    <Link href={`/deals/${e.dealId}`} className="hover:underline">
                      {e.description}
                    </Link>
                  </td>
                  <td className={e.amount < 0 ? "tabular text-success" : "tabular"}>{e.amount < 0 ? `−${formatRub(-e.amount)}` : formatRub(e.amount)}</td>
                  <td className="text-xs text-muted-foreground">{e.invoiceId ? `счёт №${e.invoiceId}` : "не в счёте"}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </section>
    </div>
  );
}

export async function CabinetBuyoutPage({ created }: { created?: boolean }) {
  const viewer = await requireViewer();
  const list = await getDb().select().from(buyoutRequests).where(eq(buyoutRequests.userId, viewer.id)).orderBy(desc(buyoutRequests.createdAt));
  return (
    <div>
      <PageHeader
        title="Продать площадке"
        description="Предложите предмет на выкуп: оценщик рассмотрит заявку и назовёт цену. Общение — в беседе с администрацией."
        actions={<ButtonLink href="/buyout/new">Новая заявка</ButtonLink>}
      />
      {created && <p className="mb-4 rounded-md bg-success-soft px-4 py-3 text-sm text-success">Заявка отправлена. Оценщик ответит в сообщениях.</p>}
      {list.length === 0 ? (
        <EmptyState title="Заявок пока нет" />
      ) : (
        <div className="flex flex-col gap-3">
          {list.map((r) => (
            <Card key={r.id}>
              <CardSection className="flex gap-4">
                {r.photoKeys[0] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={publicUrl(r.photoKeys[0].thumbKey)} alt="" className="h-20 w-20 shrink-0 rounded border object-cover" />
                )}
                <div className="flex flex-1 flex-col gap-1 text-sm">
                  <p className="font-medium">
                    №{r.id} · {r.title} <Badge tone={r.status === "offered" ? "warning" : r.status === "accepted" ? "success" : "neutral"}>{BUYOUT_STATUS_LABELS[r.status]}</Badge>
                  </p>
                  <p className="text-muted-foreground">Желаемая цена: {formatRub(r.desiredPrice)}</p>
                  {r.offeredPrice && (
                    <p>
                      Предложение площадки: <b className="tabular">{formatRub(r.offeredPrice)}</b>
                    </p>
                  )}
                  {r.appraiserNote && <p className="text-muted-foreground">Комментарий оценщика: {r.appraiserNote}</p>}
                  {r.status === "offered" && <BuyoutOfferAnswer requestId={r.id} />}
                  {r.conversationId && (
                    <Link href={`/messages/${r.conversationId}`} className="text-primary hover:underline">
                      Беседа с администрацией
                    </Link>
                  )}
                </div>
              </CardSection>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export async function CabinetSettingsPage({ welcome }: { welcome?: boolean }) {
  const viewer = await requireViewer();
  const prefsRows = await getDb().select().from(notificationPreferences).where(eq(notificationPreferences.userId, viewer.id));
  const prefs = Object.fromEntries(
    NOTIFICATION_TYPES.map((t) => {
      const p = prefsRows.find((r) => r.type === t);
      return [t, p ? { site: p.site, email: p.email } : defaultChannels(t)];
    }),
  ) as Record<NotificationType, { site: boolean; email: boolean }>;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Настройки" />
      {welcome && (
        <p className="rounded-md bg-success-soft px-4 py-3 text-sm text-success">
          Добро пожаловать! Укажите имя, которое увидят другие участники, и город.
        </p>
      )}
      <Card>
        <CardSection>
          <h2 className="mb-1 text-lg font-semibold">Профиль</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Телефон: {viewer.phoneNumber} {viewer.phoneNumberVerified ? <Badge tone="success">подтверждён</Badge> : <Badge tone="warning">не подтверждён</Badge>}
          </p>
          <ProfileForm initial={{ name: viewer.name, city: viewer.city ?? "", about: viewer.about ?? "", notifyEmail: viewer.notifyEmail ?? "" }} />
        </CardSection>
      </Card>
      <Card id="notifications">
        <CardSection>
          <h2 className="mb-4 text-lg font-semibold">Уведомления</h2>
          {!viewer.notifyEmail && <p className="mb-3 text-sm text-warning">Укажите email в профиле, чтобы получать письма.</p>}
          <NotificationPrefsForm prefs={prefs} />
        </CardSection>
      </Card>
      <Card className="border-danger/30">
        <CardSection>
          <h2 className="mb-2 text-lg font-semibold text-danger">Удаление аккаунта</h2>
          <DeleteAccountForm />
        </CardSection>
      </Card>
    </div>
  );
}
