import "server-only";
import { deals, getDb, lotPhotos, lots, reviews, user } from "@auction/db";
import { LOT_FORMATS, type LotFormat } from "@auction/domain";
import { publicUrl } from "@auction/services";
import { alias } from "drizzle-orm/pg-core";
import { and, desc, eq, gte, notInArray, or, sql } from "drizzle-orm";

const seller = alias(user, "seller");
const buyer = alias(user, "buyer");
const thumb = sql<string | null>`(select ${lotPhotos.thumbKey} from ${lotPhotos} where ${lotPhotos.lotId} = ${deals.lotId} order by ${lotPhotos.position} limit 1)`;

const columns = {
  deal: deals,
  lotTitle: lots.title,
  sellerName: seller.name,
  buyerName: buyer.name,
  thumbKey: thumb,
};

export async function listDeals(userId: string, role: "seller" | "buyer" | "all" = "all") {
  const cond =
    role === "seller" ? eq(deals.sellerId, userId) : role === "buyer" ? eq(deals.buyerId, userId) : or(eq(deals.sellerId, userId), eq(deals.buyerId, userId));
  const rows = await getDb()
    .select(columns)
    .from(deals)
    .innerJoin(lots, eq(lots.id, deals.lotId))
    .innerJoin(seller, eq(seller.id, deals.sellerId))
    .innerJoin(buyer, eq(buyer.id, deals.buyerId))
    .where(cond)
    .orderBy(desc(deals.createdAt))
    .limit(200);
  return rows.map((r) => ({ ...r, thumbUrl: r.thumbKey ? publicUrl(r.thumbKey) : null }));
}

export async function getDeal(dealId: number) {
  const db = getDb();
  const [row] = await db
    .select(columns)
    .from(deals)
    .innerJoin(lots, eq(lots.id, deals.lotId))
    .innerJoin(seller, eq(seller.id, deals.sellerId))
    .innerJoin(buyer, eq(buyer.id, deals.buyerId))
    .where(eq(deals.id, dealId));
  if (!row) return null;
  const dealReviews = await db.select().from(reviews).where(eq(reviews.dealId, dealId));
  return { ...row, thumbUrl: row.thumbKey ? publicUrl(row.thumbKey) : null, reviews: dealReviews };
}

/**
 * Самые дорогие сделки за последние 7 дней в одном формате торгов — для «Топа сделок недели» на главной.
 * Сорванные сделки (не оплачен, не получен) не попадают. Рейтинг продавца — по формуле
 * `rating()` из domain: положительные минус отрицательные.
 */
async function topDealsOfFormat(format: LotFormat, limit: number, since: Date) {
  const score = sql<number>`(select count(*) filter (where ${reviews.rating} = 'positive') - count(*) filter (where ${reviews.rating} = 'negative') from ${reviews} where ${reviews.targetId} = ${deals.sellerId})`;
  const rows = await getDb()
    .select({
      id: deals.id,
      lotId: deals.lotId,
      source: deals.source,
      totalPrice: deals.totalPrice,
      createdAt: deals.createdAt,
      title: lots.title,
      format: lots.format,
      startPrice: lots.startPrice,
      bidCount: lots.bidCount,
      extended: sql<boolean>`${lots.endsAt} > ${lots.originalEndsAt}`,
      sellerId: deals.sellerId,
      sellerName: seller.name,
      sellerScore: score,
      thumbKey: thumb,
    })
    .from(deals)
    .innerJoin(lots, eq(lots.id, deals.lotId))
    .innerJoin(seller, eq(seller.id, deals.sellerId))
    .where(and(gte(deals.createdAt, since), eq(lots.format, format), notInArray(deals.status, ["not_paid", "not_received"])))
    .orderBy(desc(deals.totalPrice))
    .limit(limit);
  return rows.map(({ thumbKey, ...r }) => ({ ...r, sellerScore: Number(r.sellerScore), thumbUrl: thumbKey ? publicUrl(thumbKey) : null }));
}

/** Топ сделок недели по дорожкам: до `perFormat` самых дорогих сделок в каждом формате торгов. */
export async function topDealsByFormat(perFormat = 3) {
  const since = new Date(Date.now() - 7 * 86_400_000);
  const lists = await Promise.all(LOT_FORMATS.map((f) => topDealsOfFormat(f, perFormat, since)));
  return Object.fromEntries(LOT_FORMATS.map((f, i) => [f, lists[i]!])) as Record<LotFormat, TopDeal[]>;
}

export type TopDeal = Awaited<ReturnType<typeof topDealsOfFormat>>[number];

/** Отзывы о пользователе. */
export async function listReviewsAbout(userId: string, limit = 50) {
  const author = alias(user, "author");
  return getDb()
    .select({ review: reviews, authorName: author.name, lotTitle: lots.title, lotId: lots.id })
    .from(reviews)
    .innerJoin(deals, eq(deals.id, reviews.dealId))
    .innerJoin(lots, eq(lots.id, deals.lotId))
    .leftJoin(author, eq(author.id, reviews.authorId))
    .where(eq(reviews.targetId, userId))
    .orderBy(desc(reviews.createdAt))
    .limit(limit);
}

export async function countActiveDeals(userId: string) {
  const [r] = await getDb()
    .select({ n: sql<number>`count(*)` })
    .from(deals)
    .where(
      and(
        or(eq(deals.sellerId, userId), eq(deals.buyerId, userId)),
        sql`${deals.status} in ('sold','awaiting_payment','paid','shipped')`,
      ),
    );
  return Number(r?.n ?? 0);
}
