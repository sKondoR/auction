import {
  type DbOrTx,
  account,
  bids,
  lots,
  moderationActions,
  notificationPreferences,
  reviews,
  savedSearches,
  sellerSubscriptions,
  session,
  user,
} from "@auction/db";
import { DELETED_USER_NAME, type ReviewCounts, rating } from "@auction/domain";
import { and, count, eq, inArray, isNull, sql } from "drizzle-orm";
import { fail, notFound } from "./errors";

export type UserRow = typeof user.$inferSelect;

export async function getUser(db: DbOrTx, id: string): Promise<UserRow> {
  const [u] = await db.select().from(user).where(eq(user.id, id));
  return u ?? notFound("Пользователь");
}

/** Ставить, покупать и продавать может только пользователь с подтверждённым телефоном без блокировки. */
export function assertCanTrade(u: UserRow): void {
  if (u.deletedAt) fail("deleted", "Аккаунт удалён");
  if (u.banned && (!u.banExpires || u.banExpires > new Date())) {
    fail("banned", `Аккаунт заблокирован${u.banReason ? `: ${u.banReason}` : ""}`);
  }
  if (!u.phoneNumberVerified) fail("phone_unverified", "Подтвердите телефон, чтобы торговать");
}

export async function reviewCounts(db: DbOrTx, userId: string): Promise<ReviewCounts & { penalties: number }> {
  const rows = await db
    .select({ rating: reviews.rating, n: count(), penalties: sql<number>`count(*) filter (where ${reviews.isPenalty})` })
    .from(reviews)
    .where(eq(reviews.targetId, userId))
    .groupBy(reviews.rating);
  const c = { positive: 0, neutral: 0, negative: 0, penalties: 0 };
  for (const r of rows) {
    c[r.rating] = Number(r.n);
    c.penalties += Number(r.penalties);
  }
  return c;
}

export async function userRating(db: DbOrTx, userId: string) {
  const c = await reviewCounts(db, userId);
  return { ...rating(c), counts: c };
}

/** Число торгов (активных английских лотов), в которых пользователь участвует. */
export async function activeBidLotCount(db: DbOrTx, userId: string): Promise<number> {
  const [r] = await db
    .select({ n: sql<number>`count(distinct ${bids.lotId})` })
    .from(bids)
    .innerJoin(lots, eq(lots.id, bids.lotId))
    .where(and(eq(bids.bidderId, userId), isNull(bids.cancelledAt), eq(lots.status, "active"), sql`${lots.endsAt} > now()`));
  return Number(r?.n ?? 0);
}

export async function activeLotCount(db: DbOrTx, sellerId: string): Promise<number> {
  const [r] = await db
    .select({ n: count() })
    .from(lots)
    .where(and(eq(lots.sellerId, sellerId), inArray(lots.status, ["active", "scheduled"])));
  return Number(r?.n ?? 0);
}

/** Служебный аккаунт площадки (создаётся сидом). */
export async function getServiceAccount(db: DbOrTx): Promise<UserRow> {
  const [u] = await db.select().from(user).where(eq(user.isService, true)).limit(1);
  return u ?? fail("no_service_account", "Служебный аккаунт не создан — выполните pnpm db:seed");
}

/**
 * Удаление аккаунта (152-ФЗ): персональные данные обезличиваются, лоты, ставки,
 * сделки и отзывы остаются в истории без привязки к человеку.
 */
export async function deleteAccount(db: DbOrTx, userId: string): Promise<void> {
  const u = await getUser(db, userId);
  if (u.deletedAt) return;
  const [active] = await db
    .select({ n: count() })
    .from(lots)
    .where(and(eq(lots.sellerId, userId), eq(lots.status, "active"), sql`${lots.endsAt} > now()`));
  if (Number(active?.n) > 0) fail("has_active_lots", "Сначала снимите или дождитесь окончания активных лотов");

  await db
    .update(user)
    .set({
      name: DELETED_USER_NAME,
      email: `deleted-${userId}@deleted.local`,
      emailVerified: false,
      image: null,
      phoneNumber: null,
      phoneNumberVerified: false,
      city: null,
      about: null,
      notifyEmail: null,
      deletedAt: new Date(),
    })
    .where(eq(user.id, userId));
  await db.delete(session).where(eq(session.userId, userId));
  await db.delete(account).where(eq(account.userId, userId));
  await db.delete(savedSearches).where(eq(savedSearches.userId, userId));
  await db.delete(sellerSubscriptions).where(eq(sellerSubscriptions.subscriberId, userId));
  await db.delete(notificationPreferences).where(eq(notificationPreferences.userId, userId));
}

export async function logModeration(
  db: DbOrTx,
  a: typeof moderationActions.$inferInsert,
): Promise<void> {
  await db.insert(moderationActions).values(a);
}
