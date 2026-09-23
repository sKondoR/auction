import { type DbOrTx, notificationPreferences, notifications, user } from "@auction/db";
import { type NotificationType, defaultChannels } from "@auction/domain";
import { and, eq, inArray } from "drizzle-orm";
import { publishUserEvent } from "./infra/redis";

export interface NotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
}

/**
 * Создаёт уведомления с учётом настроек каналов пользователя. Запись идёт в той
 * же транзакции, что и событие; email отправит worker (outbox по wantsEmail).
 * Возвращает id получателей — после коммита им стоит отправить `flushUserEvents`.
 */
export async function notify(tx: DbOrTx, items: NotificationInput | NotificationInput[]): Promise<string[]> {
  const list = (Array.isArray(items) ? items : [items]).filter((i) => i.userId);
  if (list.length === 0) return [];

  const userIds = [...new Set(list.map((i) => i.userId))];
  const prefs = await tx
    .select()
    .from(notificationPreferences)
    .where(inArray(notificationPreferences.userId, userIds));
  const users = await tx
    .select({ id: user.id, notifyEmail: user.notifyEmail, deletedAt: user.deletedAt, isService: user.isService })
    .from(user)
    .where(inArray(user.id, userIds));
  const byUser = new Map(users.map((u) => [u.id, u]));

  const rows = [];
  for (const i of list) {
    const u = byUser.get(i.userId);
    if (!u || u.deletedAt || u.isService) continue;
    const pref = prefs.find((p) => p.userId === i.userId && p.type === i.type);
    const ch = pref ? { site: pref.site, email: pref.email } : defaultChannels(i.type);
    if (!ch.site && !ch.email) continue;
    rows.push({
      userId: i.userId,
      type: i.type,
      title: i.title,
      body: i.body ?? "",
      link: i.link ?? null,
      site: ch.site,
      wantsEmail: ch.email && !!u.notifyEmail,
    });
  }
  if (rows.length) await tx.insert(notifications).values(rows);
  return [...new Set(rows.filter((r) => r.site).map((r) => r.userId))];
}

/** Сообщить открытым вкладкам получателей о новых уведомлениях (после коммита). */
export async function flushUserEvents(userIds: string[]): Promise<void> {
  await Promise.all(userIds.map((id) => publishUserEvent(id, { type: "notification" })));
}

export async function markNotificationsRead(db: DbOrTx, userId: string, ids?: number[]): Promise<void> {
  const cond = ids?.length
    ? and(eq(notifications.userId, userId), inArray(notifications.id, ids))
    : eq(notifications.userId, userId);
  await db.update(notifications).set({ readAt: new Date() }).where(cond);
}
