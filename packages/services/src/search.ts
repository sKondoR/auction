import { type DbOrTx, type SearchFilters, categories, lotPhotos, lotViews, lots, user } from "@auction/db";
import type { LotFormat, LotStatus } from "@auction/domain";
import { type SQL, and, asc, desc, eq, gt, gte, ilike, inArray, lte, ne, notInArray, or, sql } from "drizzle-orm";
import { publicUrl } from "./infra/storage";

/** Карточка лота для списков. */
export interface LotCard {
  id: number;
  title: string;
  format: LotFormat;
  status: LotStatus;
  price: number;
  hasBids: boolean;
  bidCount: number;
  blitzPrice: number | null;
  quantity: number;
  quantitySold: number;
  city: string;
  startsAt: Date;
  endsAt: Date;
  thumbUrl: string | null;
  sellerId: string;
  sellerName: string;
  promoted: boolean;
}

export type SearchSort = "relevance" | "ending" | "newest" | "price_asc" | "price_desc";

/**
 * Поиск лотов — интерфейс, за которым сейчас PostgreSQL FTS с русской
 * морфологией (ADR 0005). Замена на отдельный движок не затронет вызывающих.
 */
export interface LotSearch {
  search(filters: SearchFilters, opts?: { sort?: SearchSort; page?: number; pageSize?: number; createdAfter?: Date }): Promise<{
    items: LotCard[];
    total: number;
  }>;
}

const thumbSubquery = sql<string | null>`(select ${lotPhotos.thumbKey} from ${lotPhotos} where ${lotPhotos.lotId} = ${lots.id} order by ${lotPhotos.position} limit 1)`;
const priceExpr = sql<number>`coalesce(${lots.currentPrice}, ${lots.startPrice})`;

export const cardColumns = {
  id: lots.id,
  title: lots.title,
  format: lots.format,
  status: lots.status,
  price: priceExpr,
  currentPrice: lots.currentPrice,
  bidCount: lots.bidCount,
  blitzPrice: lots.blitzPrice,
  quantity: lots.quantity,
  quantitySold: lots.quantitySold,
  city: lots.city,
  startsAt: lots.startsAt,
  endsAt: lots.endsAt,
  thumbKey: thumbSubquery,
  sellerId: lots.sellerId,
  sellerName: user.name,
  promotedUntil: lots.promotedUntil,
};

type CardRow = {
  id: number;
  title: string;
  format: LotFormat;
  status: LotStatus;
  price: number;
  currentPrice: number | null;
  bidCount: number;
  blitzPrice: number | null;
  quantity: number;
  quantitySold: number;
  city: string;
  startsAt: Date;
  endsAt: Date;
  thumbKey: string | null;
  sellerId: string;
  sellerName: string;
  promotedUntil: Date | null;
};

export function toCard(r: CardRow, now = new Date()): LotCard {
  return {
    id: r.id,
    title: r.title,
    format: r.format,
    status: r.status,
    price: Number(r.price),
    hasBids: r.currentPrice !== null,
    bidCount: r.bidCount,
    blitzPrice: r.blitzPrice,
    quantity: r.quantity,
    quantitySold: r.quantitySold,
    city: r.city,
    startsAt: r.startsAt,
    endsAt: r.endsAt,
    thumbUrl: r.thumbKey ? publicUrl(r.thumbKey) : null,
    sellerId: r.sellerId,
    sellerName: r.sellerName,
    promoted: !!r.promotedUntil && r.promotedUntil > now,
  };
}

/** Условие «торги идут сейчас» — из времени, а не из статуса (ADR 0003). */
export const openNow = (now = new Date()) =>
  and(eq(lots.status, "active"), lte(lots.startsAt, now), gt(lots.endsAt, now));

/** id категории и всех её потомков. */
export async function categoryWithDescendants(db: DbOrTx, categoryId: number): Promise<number[]> {
  const rows = await db.execute<{ id: number }>(sql`
    with recursive tree as (
      select id from ${categories} where id = ${categoryId}
      union all
      select c.id from ${categories} c join tree t on c.parent_id = t.id
    ) select id from tree`);
  return rows.map((r) => Number(r.id));
}

export function createPgLotSearch(db: DbOrTx): LotSearch {
  return {
    async search(filters, opts = {}) {
      const now = new Date();
      const page = Math.max(1, opts.page ?? 1);
      const pageSize = Math.min(100, opts.pageSize ?? 24);
      const conds: SQL[] = [ne(lots.status, "removed")];

      const q = filters.q?.trim();
      const tsQuery = q ? sql`websearch_to_tsquery('russian', ${q})` : null;
      if (tsQuery) conds.push(sql`${lots.searchVector} @@ ${tsQuery}`);

      if (filters.categoryId) {
        conds.push(inArray(lots.categoryId, await categoryWithDescendants(db, filters.categoryId)));
      }
      if (filters.format) conds.push(eq(lots.format, filters.format as LotFormat));
      if (filters.city?.trim()) conds.push(ilike(lots.city, `${filters.city.trim()}%`));
      if (filters.priceMin != null) conds.push(gte(priceExpr, filters.priceMin));
      if (filters.priceMax != null) conds.push(lte(priceExpr, filters.priceMax));
      for (const [key, value] of Object.entries(filters.attrs ?? {})) {
        if (value) conds.push(sql`${lots.attributes}->>${key} = ${value}`);
      }
      const status = filters.status ?? "active";
      if (status === "active") conds.push(openNow(now)!);
      else if (status === "upcoming") conds.push(and(inArray(lots.status, ["active", "scheduled"]), gt(lots.startsAt, now))!);
      else if (status === "ended") conds.push(or(notInArray(lots.status, ["active", "scheduled"]), lte(lots.endsAt, now))!);
      if (opts.createdAfter) conds.push(gt(lots.createdAt, opts.createdAfter));

      const where = and(...conds);
      const promoted = sql`(${lots.promotedUntil} is not null and ${lots.promotedUntil} > now()) desc`;
      const sort = opts.sort ?? (tsQuery ? "relevance" : status === "ended" ? "newest" : "ending");
      const order: SQL[] = [promoted];
      if (sort === "relevance" && tsQuery) order.push(sql`ts_rank(${lots.searchVector}, ${tsQuery}) desc`);
      else if (sort === "ending") order.push(status === "ended" ? desc(lots.endsAt) : asc(lots.endsAt));
      else if (sort === "price_asc") order.push(asc(priceExpr));
      else if (sort === "price_desc") order.push(desc(priceExpr));
      else order.push(desc(lots.createdAt));
      order.push(desc(lots.id));

      const [rows, [countRow]] = await Promise.all([
        db
          .select(cardColumns)
          .from(lots)
          .innerJoin(user, eq(user.id, lots.sellerId))
          .where(where)
          .orderBy(...order)
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        db.select({ n: sql<number>`count(*)` }).from(lots).where(where),
      ]);
      return { items: rows.map((r) => toCard(r as CardRow, now)), total: Number(countRow?.n ?? 0) };
    },
  };
}

export async function lotCards(db: DbOrTx, where: SQL | undefined, orderBy: SQL[], limit: number): Promise<LotCard[]> {
  const rows = await db
    .select(cardColumns)
    .from(lots)
    .innerJoin(user, eq(user.id, lots.sellerId))
    .where(where)
    .orderBy(...orderBy)
    .limit(limit);
  return rows.map((r) => toCard(r as CardRow));
}

/* ---------------- Рекомендации ---------------- */

/** Похожие: та же категория, цена в пределах ×0.5…×2. */
export async function similarLots(db: DbOrTx, lot: { id: number; categoryId: number; price: number }, limit = 8) {
  return lotCards(
    db,
    and(
      openNow(),
      eq(lots.categoryId, lot.categoryId),
      ne(lots.id, lot.id),
      gte(priceExpr, Math.floor(lot.price / 2)),
      lte(priceExpr, lot.price * 2),
    ),
    [sql`abs(${priceExpr} - ${lot.price})`],
    limit,
  );
}

export async function sellerAlsoSells(db: DbOrTx, sellerId: string, excludeId: number, limit = 8) {
  return lotCards(db, and(openNow(), eq(lots.sellerId, sellerId), ne(lots.id, excludeId)), [asc(lots.endsAt)], limit);
}

export async function recordView(db: DbOrTx, userId: string, lotId: number): Promise<void> {
  await db
    .insert(lotViews)
    .values({ userId, lotId })
    .onConflictDoUpdate({ target: [lotViews.userId, lotViews.lotId], set: { viewedAt: new Date() } });
}

export async function recentlyViewed(db: DbOrTx, userId: string, excludeId?: number, limit = 8) {
  const rows = await db
    .select({ ...cardColumns, viewedAt: lotViews.viewedAt })
    .from(lotViews)
    .innerJoin(lots, eq(lots.id, lotViews.lotId))
    .innerJoin(user, eq(user.id, lots.sellerId))
    .where(and(eq(lotViews.userId, userId), excludeId ? ne(lots.id, excludeId) : undefined))
    .orderBy(desc(lotViews.viewedAt))
    .limit(limit);
  return rows.map((r) => toCard(r as CardRow));
}
