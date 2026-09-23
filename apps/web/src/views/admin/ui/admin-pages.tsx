import {
  buyoutRequests,
  categories,
  categoryAttributes,
  complaints,
  getSettings,
  invoices,
  lots,
  messages,
  moderationActions,
  questions,
  user,
} from "@auction/db";
import { BUYOUT_STATUS_LABELS, BUYOUT_TRANSITIONS, ROLE_LABELS, type UserRole, hasPermission } from "@auction/domain";
import { periodLabel, publicUrl } from "@auction/services";
import { and, asc, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import Link from "next/link";
import type { ReactNode } from "react";
import { getCategoryTree } from "@/entities/category/server";
import { listSupportConversations } from "@/entities/conversation/server";
import { InvoiceStatusBadge } from "@/entities/deal";
import {
  deleteAttributeAction,
  deleteCategoryAction,
  hideContentAction,
  markInvoicePaidAction,
  moderateUserAction,
  removeLotAction,
  resolveComplaintAction,
  reviewBuyoutAction,
  saveAttributeAction,
  saveCategoryAction,
  saveSettingsAction,
  setRoleAction,
} from "@/features/admin";
import { getDb, requirePermission, requireStaff } from "@/shared/api";
import { formatDate, formatDateTime, formatRub, kopecksToInput } from "@/shared/lib";
import { ActionForm, Badge, Card, CardSection, Checkbox, EmptyState, Field, Input, LinkTabs, PageHeader, Select, Table, Textarea } from "@/shared/ui";
import { ConversationView } from "@/widgets/conversation";
import { SideNav } from "@/widgets/side-nav";

export async function AdminLayout({ children }: { children: ReactNode }) {
  const v = await requireStaff();
  const db = getDb();
  const [[openComplaints], [newBuyouts]] = await Promise.all([
    db.select({ n: count() }).from(complaints).where(eq(complaints.status, "open")),
    db.select({ n: count() }).from(buyoutRequests).where(eq(buyoutRequests.status, "new")),
  ]);
  const can = (p: Parameters<typeof hasPermission>[1]) => hasPermission(v.role, p);
  const items = [
    { href: "/admin", label: "Обзор", show: true },
    { href: "/admin/complaints", label: "Жалобы", show: can("moderation.complaints"), badge: Number(openComplaints?.n) },
    { href: "/admin/lots", label: "Лоты", show: can("moderation.lots") },
    { href: "/admin/users", label: "Пользователи", show: can("moderation.users") },
    { href: "/admin/support", label: "Беседы с администрацией", show: can("moderation.messages") },
    { href: "/admin/buyout", label: "Заявки на выкуп", show: can("buyout.review"), badge: Number(newBuyouts?.n) },
    { href: "/admin/invoices", label: "Счета", show: can("admin.invoices") },
    { href: "/admin/categories", label: "Категории", show: can("admin.categories") },
    { href: "/admin/settings", label: "Настройки", show: can("admin.settings") },
  ];
  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <aside>
        <p className="mb-3 px-3 text-sm">
          <Badge tone="primary">{ROLE_LABELS[v.role as UserRole]}</Badge>
        </p>
        <SideNav groups={[{ title: "Администрирование", items: items.filter((i) => i.show) }]} />
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export async function AdminDashboardPage() {
  await requireStaff();
  const db = getDb();
  const [[activeLots], [users], [openComplaints], [overdue], [newBuyouts]] = await Promise.all([
    db.select({ n: count() }).from(lots).where(and(eq(lots.status, "active"), sql`${lots.endsAt} > now()`)),
    db.select({ n: count() }).from(user).where(sql`${user.deletedAt} is null and not ${user.isService}`),
    db.select({ n: count() }).from(complaints).where(eq(complaints.status, "open")),
    db.select({ n: count() }).from(invoices).where(eq(invoices.status, "overdue")),
    db.select({ n: count() }).from(buyoutRequests).where(eq(buyoutRequests.status, "new")),
  ]);
  const tiles = [
    ["Активных лотов", activeLots?.n],
    ["Пользователей", users?.n],
    ["Открытых жалоб", openComplaints?.n],
    ["Просроченных счетов", overdue?.n],
    ["Новых заявок на выкуп", newBuyouts?.n],
  ] as const;
  return (
    <div>
      <PageHeader title="Администрирование" />
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map(([label, n]) => (
          <Card key={label}>
            <CardSection>
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="tabular font-serif text-3xl">{Number(n ?? 0)}</p>
            </CardSection>
          </Card>
        ))}
      </div>
    </div>
  );
}

export async function AdminComplaintsPage({ status }: { status?: string }) {
  await requirePermission("moderation.complaints");
  const st = status === "resolved" || status === "dismissed" ? status : "open";
  const list = await getDb()
    .select({ c: complaints, reporter: user.name })
    .from(complaints)
    .innerJoin(user, eq(user.id, complaints.reporterId))
    .where(eq(complaints.status, st))
    .orderBy(desc(complaints.createdAt))
    .limit(200);
  // Тексты сообщений и вопросов, на которые пожаловались.
  const msgIds = list.filter((r) => r.c.targetType === "message").map((r) => Number(r.c.targetId));
  const qIds = list.filter((r) => r.c.targetType === "question").map((r) => Number(r.c.targetId));
  const db = getDb();
  const [msgs, qs] = await Promise.all([
    msgIds.length ? db.select().from(messages).where(inArray(messages.id, msgIds)) : [],
    qIds.length ? db.select().from(questions).where(inArray(questions.id, qIds)) : [],
  ]);
  const targetLink = (t: string, id: string) =>
    t === "lot" ? `/lots/${id}` : t === "user" ? `/users/${id}` : t === "question" ? `/lots/${qs.find((q) => q.id === Number(id))?.lotId}#questions` : null;

  return (
    <div>
      <PageHeader title="Жалобы" />
      <LinkTabs
        active={st}
        items={[
          { key: "open", href: "/admin/complaints", label: "Открытые" },
          { key: "resolved", href: "/admin/complaints?status=resolved", label: "Решённые" },
          { key: "dismissed", href: "/admin/complaints?status=dismissed", label: "Отклонённые" },
        ]}
      />
      {list.length === 0 ? (
        <EmptyState title="Жалоб нет" />
      ) : (
        <div className="flex flex-col gap-3">
          {list.map(({ c, reporter }) => {
            const link = targetLink(c.targetType, c.targetId);
            const quoted =
              c.targetType === "message"
                ? msgs.find((m) => m.id === Number(c.targetId))?.text
                : c.targetType === "question"
                  ? qs.find((q) => q.id === Number(c.targetId))?.text
                  : null;
            return (
              <Card key={c.id}>
                <CardSection className="flex flex-col gap-2 text-sm">
                  <p className="text-xs text-muted-foreground">
                    №{c.id} · {reporter} · {formatDateTime(c.createdAt)} · на{" "}
                    {{ lot: "лот", message: "сообщение", question: "вопрос", user: "пользователя" }[c.targetType]}{" "}
                    {link ? (
                      <Link href={link} className="text-primary underline">
                        {c.targetId}
                      </Link>
                    ) : (
                      c.targetId
                    )}
                  </p>
                  <p>{c.reason}</p>
                  {quoted && <blockquote className="border-l-2 pl-3 text-muted-foreground">{quoted}</blockquote>}
                  {c.resolution && <p className="text-muted-foreground">Решение: {c.resolution}</p>}
                  {c.status === "open" && (
                    <div className="flex flex-wrap gap-4">
                      <ActionForm action={resolveComplaintAction} submit="Закрыть" inline>
                        <input type="hidden" name="complaintId" value={c.id} />
                        <Select name="status" className="h-8 w-40">
                          <option value="resolved">Нарушение подтверждено</option>
                          <option value="dismissed">Нарушения нет</option>
                        </Select>
                        <Input name="resolution" placeholder="Решение" className="h-8 w-56" />
                      </ActionForm>
                      {(c.targetType === "message" || c.targetType === "question") && (
                        <ActionForm action={hideContentAction} submit="Скрыть текст" submitVariant="outline" inline>
                          <input type="hidden" name="type" value={c.targetType} />
                          <input type="hidden" name="id" value={c.targetId} />
                        </ActionForm>
                      )}
                    </div>
                  )}
                </CardSection>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export async function AdminLotsPage({ q }: { q?: string }) {
  await requirePermission("moderation.lots");
  const db = getDb();
  const cond = q ? (Number(q) ? eq(lots.id, Number(q)) : ilike(lots.title, `%${q}%`)) : undefined;
  const list = await db
    .select({ lot: lots, seller: user.name })
    .from(lots)
    .innerJoin(user, eq(user.id, lots.sellerId))
    .where(cond)
    .orderBy(desc(lots.createdAt))
    .limit(100);
  return (
    <div>
      <PageHeader title="Лоты" description="Лоты публикуются без премодерации; модератор снимает их постфактум." />
      <form className="mb-4 flex gap-2">
        <Input name="q" defaultValue={q} placeholder="Номер или название" className="max-w-sm" />
      </form>
      <Table>
        <tbody>
          {list.map(({ lot, seller }) => (
            <tr key={lot.id}>
              <td className="w-16 text-muted-foreground">{lot.id}</td>
              <td>
                <Link href={`/lots/${lot.id}`} className="hover:text-primary">
                  {lot.title}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {seller} · {formatDateTime(lot.createdAt)}
                </p>
              </td>
              <td>
                <Badge tone={lot.status === "removed" ? "danger" : "neutral"}>{lot.status}</Badge>
              </td>
              <td>
                {lot.status !== "removed" && (
                  <ActionForm action={removeLotAction} submit="Снять" submitVariant="danger" inline confirmText="Снять лот?">
                    <input type="hidden" name="lotId" value={lot.id} />
                    <Input name="reason" placeholder="Причина" required className="h-8 w-44" />
                  </ActionForm>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

export async function AdminUsersPage({ q }: { q?: string }) {
  const viewer = await requirePermission("moderation.users");
  const db = getDb();
  const cond = q ? or(ilike(user.name, `%${q}%`), ilike(user.phoneNumber, `%${q.replace(/\D/g, "")}%`), eq(user.id, q)) : undefined;
  const list = await db.select().from(user).where(and(sql`not ${user.isService}`, cond)).orderBy(desc(user.createdAt)).limit(50);
  const actions = list.length
    ? await db
        .select()
        .from(moderationActions)
        .where(inArray(moderationActions.userId, list.map((u) => u.id)))
        .orderBy(desc(moderationActions.createdAt))
    : [];
  const canRoles = hasPermission(viewer.role, "admin.users");

  return (
    <div>
      <PageHeader title="Пользователи" />
      <form className="mb-4 flex gap-2">
        <Input name="q" defaultValue={q} placeholder="Имя, телефон или id" className="max-w-sm" />
      </form>
      <div className="flex flex-col gap-3">
        {list.map((u) => (
          <Card key={u.id}>
            <CardSection className="flex flex-col gap-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/users/${u.id}`} className="font-medium hover:text-primary">
                  {u.name}
                </Link>
                <span className="text-muted-foreground">{u.phoneNumber}</span>
                <Badge tone={u.role === "user" ? "neutral" : "primary"}>{ROLE_LABELS[u.role as UserRole] ?? u.role}</Badge>
                {u.banned && <Badge tone="danger">заблокирован{u.banReason ? `: ${u.banReason}` : ""}</Badge>}
                {u.listingBlocked && <Badge tone="warning">блокировка выставления</Badge>}
                {u.deletedAt && <Badge>удалён</Badge>}
                <span className="text-xs text-muted-foreground">с {formatDate(u.createdAt)}</span>
              </div>
              {!u.deletedAt && u.id !== viewer.id && (
                <div className="flex flex-wrap gap-4">
                  <ActionForm action={moderateUserAction} submit="Применить" inline>
                    <input type="hidden" name="userId" value={u.id} />
                    <Select name="kind" className="h-8 w-44">
                      <option value="warn">Предупреждение</option>
                      {u.banned ? <option value="unban">Разблокировать</option> : <option value="ban">Заблокировать</option>}
                    </Select>
                    <Input name="days" type="number" min={0} placeholder="дней (0 — навсегда)" className="h-8 w-40" />
                    <Input name="reason" placeholder="Причина" required className="h-8 w-56" />
                  </ActionForm>
                  {canRoles && (
                    <ActionForm action={setRoleAction} submit="Сменить роль" submitVariant="outline" inline>
                      <input type="hidden" name="userId" value={u.id} />
                      <Select name="role" defaultValue={u.role} className="h-8 w-40">
                        {Object.entries(ROLE_LABELS).map(([k, l]) => (
                          <option key={k} value={k}>
                            {l}
                          </option>
                        ))}
                      </Select>
                    </ActionForm>
                  )}
                </div>
              )}
              {actions
                .filter((a) => a.userId === u.id)
                .slice(0, 5)
                .map((a) => (
                  <p key={a.id} className="text-xs text-muted-foreground">
                    {formatDateTime(a.createdAt)} · {a.kind} · {a.reason}
                  </p>
                ))}
            </CardSection>
          </Card>
        ))}
      </div>
    </div>
  );
}

export async function AdminSupportPage() {
  await requirePermission("moderation.messages");
  const list = await listSupportConversations();
  return (
    <div>
      <PageHeader title="Беседы с администрацией" description="Ответы отправляются от имени площадки." />
      {list.length === 0 ? (
        <EmptyState title="Бесед нет" />
      ) : (
        <Card className="divide-y">
          {list.map((r) => (
            <Link key={r.c.id} href={`/admin/support/${r.c.id}`} className="block px-4 py-3 hover:bg-muted/50">
              <p className="font-medium">{r.buyerName}</p>
              <p className="truncate text-sm text-muted-foreground">{r.lastText}</p>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}

export async function AdminSupportThreadPage({ id }: { id: number }) {
  const viewer = await requirePermission("moderation.messages");
  return <ConversationView id={id} viewer={viewer} staffMode />;
}

export async function AdminBuyoutPage({ status }: { status?: string }) {
  await requirePermission("buyout.review");
  const st = (["new", "reviewing", "offered", "accepted", "rejected"] as const).find((s) => s === status) ?? "new";
  const list = await getDb()
    .select({ r: buyoutRequests, userName: user.name })
    .from(buyoutRequests)
    .innerJoin(user, eq(user.id, buyoutRequests.userId))
    .where(eq(buyoutRequests.status, st))
    .orderBy(asc(buyoutRequests.createdAt));
  return (
    <div>
      <PageHeader title="Заявки на выкуп" />
      <LinkTabs
        active={st}
        items={Object.entries(BUYOUT_STATUS_LABELS).map(([k, l]) => ({ key: k, label: l, href: `/admin/buyout?status=${k}` }))}
      />
      {list.length === 0 ? (
        <EmptyState title="Заявок нет" />
      ) : (
        <div className="flex flex-col gap-3">
          {list.map(({ r, userName }) => {
            const next = BUYOUT_TRANSITIONS[r.status].filter((s) => !(r.status === "offered" && (s === "accepted" || s === "rejected")));
            return (
              <Card key={r.id}>
                <CardSection className="flex flex-col gap-3 text-sm">
                  <p className="font-medium">
                    №{r.id} · {r.title}{" "}
                    <span className="font-normal text-muted-foreground">
                      от {userName}, {formatDateTime(r.createdAt)}
                    </span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {r.photoKeys.map((p) => (
                      <a key={p.key} href={publicUrl(p.key)} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={publicUrl(p.thumbKey)} alt="" className="h-20 w-20 rounded border object-cover" />
                      </a>
                    ))}
                  </div>
                  <p className="whitespace-pre-line">{r.description}</p>
                  <p className="text-muted-foreground">
                    Размер: {r.size} · Желаемая цена: <b>{formatRub(r.desiredPrice)}</b>
                    {r.offeredPrice && ` · Предложено: ${formatRub(r.offeredPrice)}`}
                  </p>
                  {r.conversationId && (
                    <Link href={`/admin/support/${r.conversationId}`} className="text-primary hover:underline">
                      Беседа с заявителем
                    </Link>
                  )}
                  {next.length > 0 && (
                    <ActionForm action={reviewBuyoutAction} submit="Сохранить" inline>
                      <input type="hidden" name="requestId" value={r.id} />
                      <Select name="to" className="h-8 w-44">
                        {next.map((s) => (
                          <option key={s} value={s}>
                            {BUYOUT_STATUS_LABELS[s]}
                          </option>
                        ))}
                      </Select>
                      {next.includes("offered") && <Input name="offeredPrice" placeholder="Цена выкупа, ₽" className="h-8 w-40" inputMode="decimal" />}
                      <Input name="note" placeholder="Комментарий заявителю" className="h-8 w-64" />
                    </ActionForm>
                  )}
                </CardSection>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export async function AdminInvoicesPage({ status }: { status?: string }) {
  await requirePermission("admin.invoices");
  const st = status === "paid" ? ["paid" as const] : ["issued" as const, "overdue" as const];
  const list = await getDb()
    .select({ i: invoices, seller: user.name })
    .from(invoices)
    .innerJoin(user, eq(user.id, invoices.sellerId))
    .where(inArray(invoices.status, st))
    .orderBy(desc(invoices.issuedAt))
    .limit(300);
  return (
    <div>
      <PageHeader title="Счета" description="До подключения эквайринга оплату отмечает администратор вручную." />
      <LinkTabs
        active={status === "paid" ? "paid" : "unpaid"}
        items={[
          { key: "unpaid", href: "/admin/invoices", label: "Неоплаченные" },
          { key: "paid", href: "/admin/invoices?status=paid", label: "Оплаченные" },
        ]}
      />
      {list.length === 0 ? (
        <EmptyState title="Счетов нет" />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>№</th>
              <th>Продавец</th>
              <th>Период</th>
              <th>Сумма</th>
              <th>Срок</th>
              <th>Статус</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map(({ i, seller }) => (
              <tr key={i.id}>
                <td>{i.id}</td>
                <td>
                  <Link href={`/users/${i.sellerId}`} className="hover:underline">
                    {seller}
                  </Link>
                </td>
                <td>{periodLabel(i.periodStart)}</td>
                <td className="tabular font-medium">{formatRub(i.amount)}</td>
                <td>{formatDate(i.dueAt)}</td>
                <td>
                  <InvoiceStatusBadge status={i.status} />
                </td>
                <td>
                  {i.status !== "paid" && (
                    <ActionForm action={markInvoicePaidAction} submit="Оплачен" confirmText={`Отметить счёт №${i.id} оплаченным?`}>
                      <input type="hidden" name="invoiceId" value={i.id} />
                    </ActionForm>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}

export async function AdminCategoriesPage() {
  await requirePermission("admin.categories");
  const [tree, attrs] = await Promise.all([
    getCategoryTree(true),
    getDb().select().from(categoryAttributes).orderBy(asc(categoryAttributes.position)),
  ]);
  const flat = tree.flatMap((c) => [c, ...c.children]);
  const CategoryRow = ({ c, depth }: { c: (typeof flat)[number]; depth: number }) => (
    <Card className={depth ? "ml-6" : undefined}>
      <CardSection className="flex flex-col gap-3">
        <ActionForm action={saveCategoryAction} submit="Сохранить" inline>
          <input type="hidden" name="id" value={c.id} />
          <input type="hidden" name="parentId" value={c.parentId ?? ""} />
          <Input name="name" defaultValue={c.name} className="h-8 w-56" />
          <Input name="slug" defaultValue={c.slug} className="h-8 w-44" />
          <Input name="position" type="number" defaultValue={c.position} className="h-8 w-20" />
          <Checkbox name="isHidden" defaultChecked={c.isHidden} label="скрыта" />
        </ActionForm>
        {attrs
          .filter((a) => a.categoryId === c.id)
          .map((a) => (
            <div key={a.id} className="flex flex-wrap items-center gap-2 text-sm">
              <Badge>{a.key}</Badge> {a.name} <span className="text-muted-foreground">({a.type}{a.options ? `: ${a.options.join(", ")}` : ""})</span>
              <ActionForm action={deleteAttributeAction} submit="×" submitVariant="ghost" inline>
                <input type="hidden" name="id" value={a.id} />
              </ActionForm>
            </div>
          ))}
        <details>
          <summary className="cursor-pointer text-sm text-primary">Добавить атрибут (фильтр)</summary>
          <ActionForm action={saveAttributeAction} submit="Добавить" inline className="mt-2">
            <input type="hidden" name="categoryId" value={c.id} />
            <Input name="key" placeholder="ключ, напр. year" className="h-8 w-36" />
            <Input name="name" placeholder="Название" className="h-8 w-40" />
            <Select name="type" className="h-8 w-28">
              <option value="text">текст</option>
              <option value="number">число</option>
              <option value="select">список</option>
            </Select>
            <Input name="options" placeholder="варианты через запятую" className="h-8 w-56" />
            <Input name="unit" placeholder="ед. изм." className="h-8 w-20" />
          </ActionForm>
        </details>
        <ActionForm action={deleteCategoryAction} submit="Удалить категорию" submitVariant="ghost" confirmText={`Удалить «${c.name}»?`}>
          <input type="hidden" name="id" value={c.id} />
        </ActionForm>
      </CardSection>
    </Card>
  );
  return (
    <div className="flex flex-col gap-3">
      <PageHeader title="Категории" description="Атрибуты категории наследуются подкатегориями и работают как фильтры поиска." />
      {tree.map((c) => (
        <div key={c.id} className="flex flex-col gap-2">
          <CategoryRow c={c} depth={0} />
          {c.children.map((ch) => (
            <CategoryRow key={ch.id} c={ch} depth={1} />
          ))}
        </div>
      ))}
      <Card>
        <CardSection>
          <p className="mb-2 font-medium">Новая категория</p>
          <ActionForm action={saveCategoryAction} submit="Создать" inline>
            <Input name="name" placeholder="Название" className="h-8 w-56" />
            <Input name="slug" placeholder="slug" className="h-8 w-44" />
            <Select name="parentId" className="h-8 w-56">
              <option value="">Корневая</option>
              {tree.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </ActionForm>
        </CardSection>
      </Card>
    </div>
  );
}

export async function AdminSettingsPage() {
  await requirePermission("admin.settings");
  const s = await getSettings(getDb());
  const rows = [...s.bidSteps, { from: null, step: null }, { from: null, step: null }];
  return (
    <div>
      <PageHeader title="Настройки площадки" />
      <Card>
        <CardSection>
          <ActionForm action={saveSettingsAction} submit="Сохранить настройки" submitSize="md">
            <h2 className="text-lg font-semibold">Сетка шагов ставки</h2>
            <p className="text-sm text-muted-foreground">Для цены от X ₽ шаг — Y ₽. Первая строка должна начинаться с 0. Пустые строки игнорируются.</p>
            <div className="grid max-w-md grid-cols-2 gap-2">
              <span className="text-xs text-muted-foreground">Цена от, ₽</span>
              <span className="text-xs text-muted-foreground">Шаг, ₽</span>
              {rows.map((r, i) => (
                <div key={i} className="contents">
                  <Input name="stepFrom" defaultValue={r.from === null ? "" : kopecksToInput(r.from)} />
                  <Input name="stepValue" defaultValue={r.step === null ? "" : kopecksToInput(r.step)} />
                </div>
              ))}
            </div>
            <h2 className="pt-4 text-lg font-semibold">Новички и штрафы</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Одновременных торгов у новичка">
                <Input name="maxConcurrentBidLots" type="number" min={0} defaultValue={s.newbieLimits.maxConcurrentBidLots} />
              </Field>
              <Field label="Активных лотов у новичка">
                <Input name="maxActiveLots" type="number" min={0} defaultValue={s.newbieLimits.maxActiveLots} />
              </Field>
              <Field label="Штрафных отзывов до блокировки" hint="0 — не блокировать">
                <Input name="penaltyBanThreshold" type="number" min={0} defaultValue={s.penaltyBanThreshold} />
              </Field>
            </div>
            <h2 className="pt-4 text-lg font-semibold">Счета</h2>
            <Field label="Минимальная сумма счёта, ₽" hint="Меньшая сумма переносится на следующий месяц">
              <Input name="minInvoiceAmount" defaultValue={kopecksToInput(s.minInvoiceAmount)} className="max-w-40" />
            </Field>
            <Field label="Реквизиты для оплаты" hint="{номер} заменяется номером счёта">
              <Textarea name="requisites" defaultValue={s.requisites} rows={7} />
            </Field>
          </ActionForm>
        </CardSection>
      </Card>
    </div>
  );
}
