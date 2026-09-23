import "server-only";
import { deals, getDb, lotPhotos, lots, reviews, user } from "@auction/db";
import { publicUrl } from "@auction/services";
import { alias } from "drizzle-orm/pg-core";
import { and, desc, eq, or, sql } from "drizzle-orm";

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
