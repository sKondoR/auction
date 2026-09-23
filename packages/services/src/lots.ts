import {
  type Db,
  type DbOrTx,
  bids,
  categories,
  categoryAttributes,
  getSettings,
  lotAddenda,
  lotPhotos,
  lots,
  offers,
  sellerSubscriptions,
} from "@auction/db";
import {
  DAY_MS,
  type DeliveryMethod,
  type LotDraft,
  type LotFormat,
  assertCanEdit,
  assertNewbieCanList,
  formatRub,
  isOpen,
  maskContacts,
  relistWindow,
  validateBlitzChange,
  validateLotDraft,
} from "@auction/domain";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { fail, forbidden, notFound } from "./errors";
import { publishLotEvent } from "./infra/redis";
import { flushUserEvents, notify } from "./notify";
import { type LotRow, englishState, lockLot, lotEvent } from "./trading";
import { activeLotCount, assertCanTrade, getUser, logModeration, reviewCounts } from "./users";

export interface LotInput {
  format: LotFormat;
  title: string;
  description: string;
  categoryId: number;
  attributes: Record<string, string>;
  city: string;
  deliveryMethods: DeliveryMethod[];
  deliveryCost: string;
  durationDays: number;
  startPrice: number;
  quantity: number;
  blitzPrice: number | null;
  allowOffers: boolean;
  autoRelist: boolean;
  /** id загруженных фото в нужном порядке. */
  photoIds: number[];
}

/** Оставляет только атрибуты категории, приводя числа. */
async function cleanAttributes(
  db: DbOrTx,
  categoryId: number,
  attrs: Record<string, string>,
): Promise<Record<string, string | number>> {
  // Атрибуты задаются на категории и наследуются подкатегориями.
  const [cat] = await db.select().from(categories).where(eq(categories.id, categoryId));
  const catIds = [categoryId, ...(cat?.parentId ? [cat.parentId] : [])];
  const defs = await db.select().from(categoryAttributes).where(inArray(categoryAttributes.categoryId, catIds));
  const out: Record<string, string | number> = {};
  for (const d of defs) {
    const raw = attrs[d.key]?.trim();
    if (!raw) continue;
    if (d.type === "number") {
      const n = Number(raw.replace(",", "."));
      if (Number.isFinite(n)) out[d.key] = n;
    } else if (d.type === "select") {
      if (d.options?.includes(raw)) out[d.key] = raw;
    } else out[d.key] = raw.slice(0, 200);
  }
  return out;
}

function toDraft(input: LotInput): LotDraft {
  return {
    format: input.format,
    title: input.title,
    description: input.description,
    categoryId: input.categoryId,
    city: input.city,
    deliveryMethods: input.deliveryMethods,
    deliveryCost: input.deliveryCost,
    photoCount: input.photoIds.length,
    durationDays: input.durationDays,
    startPrice: input.startPrice,
    quantity: input.format === "english" ? 1 : input.quantity,
    blitzPrice: input.format === "english" ? input.blitzPrice : null,
    allowOffers: input.format === "fixed" ? input.allowOffers : false,
    autoRelist: input.autoRelist,
  };
}

async function assertCanList(db: DbOrTx, sellerId: string): Promise<void> {
  const seller = await getUser(db, sellerId);
  assertCanTrade(seller);
  if (seller.listingBlocked) {
    fail("listing_blocked", "Выставление новых лотов заблокировано: есть просроченный счёт за комиссию");
  }
  const settings = await getSettings(db);
  const rc = await reviewCounts(db, sellerId);
  assertNewbieCanList({
    reviewsReceived: rc.positive + rc.neutral + rc.negative,
    activeLots: await activeLotCount(db, sellerId),
    limits: settings.newbieLimits,
  });
}

async function attachPhotos(db: DbOrTx, lotId: number, ownerId: string, photoIds: number[]): Promise<void> {
  if (photoIds.length === 0) return;
  const rows = await db.select().from(lotPhotos).where(inArray(lotPhotos.id, photoIds));
  for (const r of rows) {
    if (r.ownerId !== ownerId) forbidden("Чужое фото");
    if (r.lotId !== null && r.lotId !== lotId) fail("photo_in_use", "Фото уже прикреплено к другому лоту");
  }
  for (const [i, id] of photoIds.entries()) {
    await db.update(lotPhotos).set({ lotId, position: i }).where(eq(lotPhotos.id, id));
  }
}

export async function createLot(db: Db, sellerId: string, input: LotInput, now = new Date()): Promise<number> {
  const draft = toDraft(input);
  validateLotDraft(draft);
  let notified: string[] = [];
  const id = await db.transaction(async (tx) => {
    await assertCanList(tx, sellerId);
    const [cat] = await tx.select().from(categories).where(eq(categories.id, input.categoryId));
    if (!cat || cat.isHidden) fail("bad_category", "Выберите категорию");

    const endsAt = new Date(now.getTime() + input.durationDays * DAY_MS);
    const [lot] = await tx
      .insert(lots)
      .values({
        sellerId,
        categoryId: input.categoryId,
        format: input.format,
        title: maskContacts(input.title.trim()),
        description: maskContacts(input.description.trim()),
        attributes: await cleanAttributes(tx, input.categoryId, input.attributes),
        city: input.city.trim(),
        deliveryMethods: input.deliveryMethods,
        deliveryCost: maskContacts(input.deliveryCost.trim()),
        startPrice: input.startPrice,
        quantity: draft.quantity,
        blitzPrice: draft.blitzPrice,
        allowOffers: draft.allowOffers,
        autoRelist: input.autoRelist,
        startsAt: now,
        endsAt,
        originalEndsAt: endsAt,
      })
      .returning();
    await attachPhotos(tx, lot!.id, sellerId, input.photoIds);
    notified = await notifySubscribers(tx, lot!);
    return lot!.id;
  });
  await flushUserEvents(notified);
  return id;
}

/** Уведомления подписчикам продавца о новом лоте. */
async function notifySubscribers(tx: DbOrTx, lot: LotRow): Promise<string[]> {
  const subs = await tx
    .select({ id: sellerSubscriptions.subscriberId })
    .from(sellerSubscriptions)
    .where(eq(sellerSubscriptions.sellerId, lot.sellerId));
  if (!subs.length) return [];
  const seller = await getUser(tx, lot.sellerId);
  return notify(
    tx,
    subs.map((s) => ({
      userId: s.id,
      type: "subscription_new_lot" as const,
      title: `Новый лот продавца ${seller.name}`,
      body: `«${lot.title}» — ${formatRub(lot.startPrice)}`,
      link: `/lots/${lot.id}`,
    })),
  );
}

export type LotPatch = Partial<Omit<LotInput, "format">>;

/**
 * Редактирование лота. До первой ставки — всё, кроме формата; после — только
 * снижение блиц-цены, фото и доставка (описание — через дополнение).
 */
export async function updateLot(db: Db, sellerId: string, lotId: number, patch: LotPatch, now = new Date()): Promise<void> {
  let lotAfter: LotRow | undefined;
  await db.transaction(async (tx) => {
    const lot = await lockLot(tx, lotId);
    if (lot.sellerId !== sellerId) forbidden();
    if (!isOpen(lot, now)) fail("lot_closed", "Торги завершены — лот можно только перевыставить");
    const hasBids = lot.bidCount > 0 || lot.quantitySold > 0;

    const set: Partial<LotRow> = {};
    const changed = <K extends keyof LotPatch>(k: K) => patch[k] !== undefined;

    if (changed("title") && patch.title !== lot.title) {
      assertCanEdit("title", hasBids);
      set.title = maskContacts(patch.title!.trim());
    }
    if (changed("description") && patch.description !== lot.description) {
      assertCanEdit("description", hasBids);
      set.description = maskContacts(patch.description!.trim());
    }
    if (changed("categoryId") && patch.categoryId !== lot.categoryId) {
      assertCanEdit("category", hasBids);
      set.categoryId = patch.categoryId!;
    }
    if (changed("attributes")) {
      if (!hasBids) set.attributes = await cleanAttributes(tx, set.categoryId ?? lot.categoryId, patch.attributes!);
    }
    if (changed("city") && patch.city !== lot.city) {
      assertCanEdit("city", hasBids);
      set.city = patch.city!.trim();
    }
    if (changed("deliveryMethods")) set.deliveryMethods = patch.deliveryMethods!;
    if (changed("deliveryCost")) set.deliveryCost = maskContacts(patch.deliveryCost!.trim());
    if (changed("startPrice") && patch.startPrice !== lot.startPrice) {
      assertCanEdit("price", hasBids);
      set.startPrice = patch.startPrice!;
    }
    if (changed("quantity") && patch.quantity !== lot.quantity && lot.format === "fixed") {
      assertCanEdit("quantity", hasBids);
      set.quantity = patch.quantity!;
    }
    if (changed("allowOffers") && lot.format === "fixed") set.allowOffers = patch.allowOffers!;
    if (changed("autoRelist")) set.autoRelist = patch.autoRelist!;
    if (changed("durationDays")) {
      const newEnd = new Date(lot.startsAt.getTime() + patch.durationDays! * DAY_MS);
      if (newEnd.getTime() !== lot.originalEndsAt.getTime()) {
        assertCanEdit("duration", hasBids);
        set.endsAt = newEnd;
        set.originalEndsAt = newEnd;
      }
    }
    if (patch.blitzPrice !== undefined && patch.blitzPrice !== lot.blitzPrice && lot.format === "english") {
      const settings = await getSettings(tx);
      validateBlitzChange(
        { oldBlitz: lot.blitzPrice, newBlitz: patch.blitzPrice, state: englishState(lot) },
        settings.bidSteps,
      );
      set.blitzPrice = patch.blitzPrice;
    }

    // Итоговая проверка лота по правилам формата.
    const merged = { ...lot, ...set };
    validateLotDraft({
      format: merged.format,
      title: merged.title,
      description: merged.description,
      categoryId: merged.categoryId,
      city: merged.city,
      deliveryMethods: merged.deliveryMethods as DeliveryMethod[],
      deliveryCost: merged.deliveryCost,
      photoCount: patch.photoIds?.length ?? 0,
      durationDays: Math.round((merged.originalEndsAt.getTime() - merged.startsAt.getTime()) / DAY_MS),
      startPrice: merged.startPrice,
      quantity: merged.quantity,
      blitzPrice: hasBids ? null : merged.blitzPrice, // после ставок блиц проверен отдельно
      allowOffers: merged.allowOffers,
      autoRelist: merged.autoRelist,
    });

    if (Object.keys(set).length) {
      const [u] = await tx.update(lots).set(set).where(eq(lots.id, lot.id)).returning();
      lotAfter = u;
    }
    if (patch.photoIds) {
      await tx.update(lotPhotos).set({ lotId: null }).where(eq(lotPhotos.lotId, lot.id));
      await attachPhotos(tx, lot.id, sellerId, patch.photoIds);
    }
  });
  if (lotAfter) await publishLotEvent(lotEvent(lotAfter, "updated"));
}

export async function addAddendum(db: DbOrTx, sellerId: string, lotId: number, text: string): Promise<void> {
  const [lot] = await db.select().from(lots).where(eq(lots.id, lotId));
  if (!lot) return notFound("Лот");
  if (lot.sellerId !== sellerId) forbidden();
  if (!isOpen(lot, new Date())) fail("lot_closed", "Торги завершены");
  const clean = maskContacts(text.trim());
  if (clean.length < 3) fail("too_short", "Слишком короткое дополнение");
  await db.insert(lotAddenda).values({ lotId, text: clean.slice(0, 5000) });
}

/** Участники торгов по лоту (для уведомлений). */
async function lotParticipants(db: DbOrTx, lotId: number): Promise<string[]> {
  const rows = await db
    .selectDistinct({ id: bids.bidderId })
    .from(bids)
    .where(and(eq(bids.lotId, lotId), isNull(bids.cancelledAt)));
  const off = await db
    .selectDistinct({ id: offers.buyerId })
    .from(offers)
    .where(and(eq(offers.lotId, lotId), eq(offers.status, "pending")));
  return [...new Set([...rows, ...off].map((r) => r.id))];
}

/** Досрочное снятие продавцом: участники получают уведомление. */
export async function withdrawLot(db: Db, sellerId: string, lotId: number, reason: string, now = new Date()): Promise<void> {
  let notified: string[] = [];
  let lotAfter: LotRow | undefined;
  await db.transaction(async (tx) => {
    const lot = await lockLot(tx, lotId);
    if (lot.sellerId !== sellerId) forbidden();
    if (!isOpen(lot, now)) fail("lot_closed", "Торги уже завершены");
    const [u] = await tx
      .update(lots)
      .set({ status: "withdrawn", withdrawnAt: now, withdrawReason: reason.trim() || null, finalizedAt: now, endsAt: now })
      .where(eq(lots.id, lot.id))
      .returning();
    lotAfter = u;
    const participants = await lotParticipants(tx, lot.id);
    await tx
      .update(offers)
      .set({ status: "cancelled", respondedAt: now })
      .where(and(eq(offers.lotId, lot.id), eq(offers.status, "pending")));
    notified = await notify(
      tx,
      participants.map((userId) => ({
        userId,
        type: "lot_withdrawn" as const,
        title: `Продавец снял лот «${lot.title}» с торгов`,
        body: reason ? `Причина: ${maskContacts(reason)}` : "",
        link: `/lots/${lot.id}`,
      })),
    );
  });
  if (lotAfter) await publishLotEvent(lotEvent(lotAfter, "ended"));
  await flushUserEvents(notified);
}

/** Снятие лота модератором. */
export async function removeLotByModerator(
  db: Db,
  moderatorId: string,
  lotId: number,
  reason: string,
  now = new Date(),
): Promise<void> {
  let notified: string[] = [];
  let lotAfter: LotRow | undefined;
  await db.transaction(async (tx) => {
    const lot = await lockLot(tx, lotId);
    if (lot.status === "removed") return;
    const [u] = await tx
      .update(lots)
      .set({
        status: "removed",
        removedReason: reason,
        finalizedAt: lot.finalizedAt ?? now,
        ...(isOpen(lot, now) ? { endsAt: now } : {}),
      })
      .where(eq(lots.id, lot.id))
      .returning();
    lotAfter = u;
    await logModeration(tx, { userId: lot.sellerId, moderatorId, kind: "lot_removed", reason, lotId: lot.id });
    const participants = await lotParticipants(tx, lot.id);
    notified = await notify(tx, [
      {
        userId: lot.sellerId,
        type: "moderation",
        title: `Лот «${lot.title}» снят модератором`,
        body: `Причина: ${reason}`,
        link: `/lots/${lot.id}`,
      },
      ...participants.map((userId) => ({
        userId,
        type: "lot_withdrawn" as const,
        title: `Лот «${lot.title}» снят с торгов модератором`,
        link: `/lots/${lot.id}`,
      })),
    ]);
  });
  if (lotAfter) await publishLotEvent(lotEvent(lotAfter, "ended"));
  await flushUserEvents(notified);
}

export interface RelistOptions {
  format?: LotFormat;
  startPrice?: number;
  durationDays?: number;
  blitzPrice?: number | null;
  quantity?: number;
}

/**
 * Перевыставление: новый лот для того же предмета (тот же itemId), с копией
 * фото. Доступно для завершённых без продажи, истёкших и снятых лотов, а также
 * проданных частично (остаток количества).
 */
export async function relistLot(
  tx: DbOrTx,
  p: { lotId: number; sellerId: string; options?: RelistOptions; auto?: boolean; now?: Date },
): Promise<number> {
  const now = p.now ?? new Date();
  const [lot] = await tx.select().from(lots).where(eq(lots.id, p.lotId)).for("update");
  if (!lot) return notFound("Лот");
  if (lot.sellerId !== p.sellerId) forbidden();
  if (lot.relistedToId) fail("already_relisted", "Лот уже перевыставлен");
  const ended = lot.status !== "active" && lot.status !== "scheduled";
  const endedByTime = now >= lot.endsAt;
  if (!ended && !endedByTime) fail("lot_open", "Лот ещё на торгах");
  if (lot.status === "removed") fail("removed", "Лот снят модератором — перевыставить нельзя");
  const remaining = lot.quantity - lot.quantitySold;
  if (remaining <= 0) fail("sold_out", "Лот продан полностью");
  if (!p.auto) await assertCanList(tx, p.sellerId);

  const o = p.options ?? {};
  const format = o.format ?? lot.format;
  const window = o.durationDays
    ? { startsAt: now, endsAt: new Date(now.getTime() + o.durationDays * DAY_MS) }
    : relistWindow(lot, now);
  const durationDays = Math.round((window.endsAt.getTime() - window.startsAt.getTime()) / DAY_MS);
  const photos = await tx.select().from(lotPhotos).where(eq(lotPhotos.lotId, lot.id)).orderBy(asc(lotPhotos.position));

  const blitz = format === "english" ? (o.blitzPrice !== undefined ? o.blitzPrice : lot.blitzPrice) : null;
  const draft: LotDraft = {
    format,
    title: lot.title,
    description: lot.description,
    categoryId: lot.categoryId,
    city: lot.city,
    deliveryMethods: lot.deliveryMethods as DeliveryMethod[],
    deliveryCost: lot.deliveryCost,
    photoCount: photos.length,
    durationDays: format === "english" ? Math.min(durationDays, 21) : Math.min(durationDays, 60),
    startPrice: o.startPrice ?? lot.startPrice,
    quantity: format === "english" ? 1 : (o.quantity ?? remaining),
    blitzPrice: blitz,
    allowOffers: format === "fixed" ? lot.allowOffers : false,
    autoRelist: lot.autoRelist,
  };
  validateLotDraft(draft);
  const endsAt = new Date(now.getTime() + draft.durationDays * DAY_MS);

  const [created] = await tx
    .insert(lots)
    .values({
      sellerId: lot.sellerId,
      categoryId: lot.categoryId,
      itemId: lot.itemId,
      format,
      title: lot.title,
      description: lot.description,
      attributes: lot.attributes,
      city: lot.city,
      deliveryMethods: lot.deliveryMethods,
      deliveryCost: lot.deliveryCost,
      startPrice: draft.startPrice,
      quantity: draft.quantity,
      blitzPrice: draft.blitzPrice,
      allowOffers: draft.allowOffers,
      autoRelist: lot.autoRelist,
      autoRelistCount: p.auto ? lot.autoRelistCount + 1 : 0,
      relistedFromId: lot.id,
      startsAt: now,
      endsAt,
      originalEndsAt: endsAt,
    })
    .returning();
  if (photos.length) {
    await tx.insert(lotPhotos).values(
      photos.map((ph) => ({
        lotId: created!.id,
        ownerId: ph.ownerId,
        position: ph.position,
        key: ph.key,
        thumbKey: ph.thumbKey,
        width: ph.width,
        height: ph.height,
      })),
    );
  }
  const addenda = await tx.select().from(lotAddenda).where(eq(lotAddenda.lotId, lot.id));
  if (addenda.length) {
    // При перевыставлении дополнения вливаются в описание.
    const desc = [lot.description, ...addenda.map((a) => a.text)].filter(Boolean).join("\n\n");
    await tx.update(lots).set({ description: desc }).where(eq(lots.id, created!.id));
  }
  await tx
    .update(lots)
    .set({
      relistedToId: created!.id,
      ...(lot.status === "active" ? { status: lot.quantitySold > 0 ? "sold" : "unsold", finalizedAt: now } : {}),
    })
    .where(eq(lots.id, lot.id));
  return created!.id;
}

/** Массовое перевыставление; возвращает id новых лотов и ошибки по остальным. */
export async function relistMany(
  db: Db,
  sellerId: string,
  lotIds: number[],
): Promise<{ created: number[]; errors: { lotId: number; message: string }[] }> {
  const created: number[] = [];
  const errors: { lotId: number; message: string }[] = [];
  for (const lotId of lotIds) {
    try {
      created.push(await db.transaction((tx) => relistLot(tx, { lotId, sellerId })));
    } catch (e) {
      errors.push({ lotId, message: e instanceof Error ? e.message : "Ошибка" });
    }
  }
  return { created, errors };
}

/** Фото, загруженное до создания лота. */
export async function registerPhoto(
  db: DbOrTx,
  ownerId: string,
  img: { key: string; thumbKey: string; width: number; height: number },
): Promise<number> {
  const [row] = await db.insert(lotPhotos).values({ ownerId, ...img }).returning({ id: lotPhotos.id });
  return row!.id;
}

export async function incrementViews(db: DbOrTx, lotId: number): Promise<void> {
  await db.update(lots).set({ viewCount: sql`${lots.viewCount} + 1` }).where(eq(lots.id, lotId));
}
