import "server-only";
import { getDb, notifications } from "@auction/db";
import { and, count, desc, eq, isNull } from "drizzle-orm";

export async function unreadNotificationCount(userId: string): Promise<number> {
  const [r] = await getDb()
    .select({ n: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.site, true), isNull(notifications.readAt)));
  return Number(r?.n ?? 0);
}

export async function listNotifications(userId: string, limit = 100) {
  return getDb()
    .select()
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.site, true)))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}
