import "server-only";
import {
  bids,
  categories,
  categoryAttributes,
  favorites,
  getDb,
  getSettings,
  lotAddenda,
  lotPhotos,
  lots,
  questions,
  user,
} from "@auction/db";
import { isBlitzAvailable, minNextBid } from "@auction/domain";
import { publicUrl, userRating, visibleQuestionsCondition } from "@auction/services";
import { and, asc, count, desc, eq, isNull } from "drizzle-orm";
import { cache } from "react";

export type LotDetails = NonNullable<Awaited<ReturnType<typeof getLotDetails>>>;

/** Всё для страницы лота. Скрытый максимум автоставки отдаётся только самому лидеру. */
export const getLotDetails = cache(async (id: number, viewerId: string | null) => {
  const db = getDb();
  const [row] = await db
    .select({ lot: lots, seller: user, category: categories })
    .from(lots)
    .innerJoin(user, eq(user.id, lots.sellerId))
    .innerJoin(categories, eq(categories.id, lots.categoryId))
    .where(eq(lots.id, id));
  if (!row) return null;
  const { lot, seller, category } = row;

  const [photos, addenda, attrDefs, bidRows, qRows, settings, sellerRating, fav] = await Promise.all([
    db.select().from(lotPhotos).where(eq(lotPhotos.lotId, id)).orderBy(asc(lotPhotos.position)),
    db.select().from(lotAddenda).where(eq(lotAddenda.lotId, id)).orderBy(asc(lotAddenda.createdAt)),
    db.select().from(categoryAttributes).where(eq(categoryAttributes.categoryId, lot.categoryId)).orderBy(asc(categoryAttributes.position)),
    db
      .select({ bid: bids, name: user.name })
      .from(bids)
      .innerJoin(user, eq(user.id, bids.bidderId))
      .where(eq(bids.lotId, id))
      .orderBy(desc(bids.amount), asc(bids.createdAt))
      .limit(200),
    db
      .select({ q: questions, askerName: user.name })
      .from(questions)
      .innerJoin(user, eq(user.id, questions.askerId))
      .where(and(visibleQuestionsCondition(id, viewerId, lot.sellerId), isNull(questions.hiddenAt)))
      .orderBy(desc(questions.createdAt)),
    getSettings(db),
    userRating(db, lot.sellerId),
    viewerId
      ? db.select({ n: count() }).from(favorites).where(and(eq(favorites.userId, viewerId), eq(favorites.lotId, id)))
      : Promise.resolve([{ n: 0 }]),
  ]);

  // Атрибуты родительской категории тоже применимы (фильтры задаются на верхнем уровне).
  const parentAttrs = category.parentId
    ? await db.select().from(categoryAttributes).where(eq(categoryAttributes.categoryId, category.parentId)).orderBy(asc(categoryAttributes.position))
    : [];

  const state = { startPrice: lot.startPrice, currentPrice: lot.currentPrice, leaderId: lot.leaderId, leaderMax: lot.leaderMax };
  return {
    lot: { ...lot, leaderMax: viewerId && viewerId === lot.leaderId ? lot.leaderMax : null },
    seller: { id: seller.id, name: seller.name, city: seller.city, createdAt: seller.createdAt, deleted: !!seller.deletedAt },
    sellerRating,
    category,
    photos: photos.map((p) => ({ id: p.id, url: publicUrl(p.key), thumbUrl: publicUrl(p.thumbKey) })),
    addenda,
    attributes: [...parentAttrs, ...attrDefs]
      .filter((a) => lot.attributes[a.key] !== undefined)
      .map((a) => ({ name: a.name, value: String(lot.attributes[a.key]) + (a.unit ? ` ${a.unit}` : "") })),
    bids: bidRows.map((b) => ({
      id: b.bid.id,
      bidderId: b.bid.bidderId,
      bidderName: b.name,
      amount: b.bid.amount,
      isAuto: b.bid.isAuto,
      createdAt: b.bid.createdAt,
      cancelledAt: b.bid.cancelledAt,
      cancelReason: b.bid.cancelReason,
    })),
    questions: qRows.map((r) => ({ ...r.q, askerName: r.askerName })),
    minNextBid: minNextBid(state, settings.bidSteps),
    blitzAvailable: isBlitzAvailable(lot.blitzPrice, lot.currentPrice),
    isFavorite: Number(fav[0]?.n ?? 0) > 0,
    bidSteps: settings.bidSteps,
  };
});

/** Подсказки для формы лота: атрибуты категории (включая родительскую). */
export async function getCategoryAttributeDefs(categoryId: number) {
  const db = getDb();
  const [cat] = await db.select().from(categories).where(eq(categories.id, categoryId));
  if (!cat) return [];
  const ids = [cat.parentId, cat.id].filter((x): x is number => x !== null);
  const all = [];
  for (const cid of ids) {
    all.push(...(await db.select().from(categoryAttributes).where(eq(categoryAttributes.categoryId, cid)).orderBy(asc(categoryAttributes.position))));
  }
  return all;
}
