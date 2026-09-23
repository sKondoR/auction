import { type Db, notifications, user } from "@auction/db";
import { notificationEmail, sendEmail } from "@auction/services";
import { and, asc, eq, isNull } from "drizzle-orm";

/** Отправка писем по уведомлениям с wantsEmail (outbox в той же БД). */
export async function flushEmailOutbox(db: Db, batch = 50): Promise<number> {
  const rows = await db
    .select({ n: notifications, email: user.notifyEmail })
    .from(notifications)
    .innerJoin(user, eq(user.id, notifications.userId))
    .where(and(eq(notifications.wantsEmail, true), isNull(notifications.emailedAt)))
    .orderBy(asc(notifications.createdAt))
    .limit(batch);

  let sent = 0;
  for (const { n, email } of rows) {
    try {
      if (email) {
        const body = notificationEmail({ title: n.title, body: n.body, link: n.link });
        await sendEmail({ to: email, subject: n.title, ...body });
        sent++;
      }
      await db.update(notifications).set({ emailedAt: new Date() }).where(eq(notifications.id, n.id));
    } catch (e) {
      console.error(`[email] notification ${n.id}`, e);
    }
  }
  return sent;
}
