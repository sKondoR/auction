import { type Db, buyoutRequests } from "@auction/db";
import { BUYOUT_STATUS_LABELS, BUYOUT_TRANSITIONS, type BuyoutStatus, formatRub, hasPermission, maskContacts } from "@auction/domain";
import { eq } from "drizzle-orm";
import { fail, forbidden, notFound } from "./errors";
import { getSupportConversation, postMessage } from "./messaging";
import { flushUserEvents, notify } from "./notify";
import { assertCanTrade, getUser } from "./users";

export interface BuyoutInput {
  title: string;
  description: string;
  size: string;
  desiredPrice: number;
  photos: { key: string; thumbKey: string }[];
}

/** Заявка на выкуп («Продать администрации»): желаемая цена, размер, описание, фото — обязательны. */
export async function createBuyoutRequest(db: Db, userId: string, input: BuyoutInput): Promise<number> {
  const u = await getUser(db, userId);
  assertCanTrade(u);
  if (input.title.trim().length < 3) fail("invalid", "Укажите, что за предмет");
  if (input.description.trim().length < 10) fail("invalid", "Опишите предмет подробнее");
  if (!input.size.trim()) fail("invalid", "Укажите размер");
  if (!Number.isSafeInteger(input.desiredPrice) || input.desiredPrice < 100) fail("invalid", "Укажите желаемую цену");
  if (input.photos.length === 0) fail("invalid", "Добавьте хотя бы одно фото");
  if (input.photos.length > 20) fail("invalid", "Не больше 20 фото");

  return db.transaction(async (tx) => {
    const conversation = await getSupportConversation(tx, userId);
    const [req] = await tx
      .insert(buyoutRequests)
      .values({
        userId,
        title: maskContacts(input.title.trim()),
        description: maskContacts(input.description.trim()),
        size: input.size.trim(),
        desiredPrice: input.desiredPrice,
        photoKeys: input.photos,
        conversationId: conversation.id,
      })
      .returning();
    await postMessage(tx, {
      conversationId: conversation.id,
      senderId: userId,
      buyoutRequestId: req!.id,
      isSystem: true,
      text: `Заявка на выкуп №${req!.id}: «${req!.title}», желаемая цена ${formatRub(req!.desiredPrice)}. Оценщик ответит в этой беседе.`,
    });
    return req!.id;
  });
}

/**
 * Смена статуса заявки. Оценщик: новая → на рассмотрении → предложение (с ценой)
 * или отклонена. Владелец заявки: предложение → принята / отклонена.
 */
export async function changeBuyoutStatus(
  db: Db,
  p: { requestId: number; actorId: string; to: BuyoutStatus; offeredPrice?: number; note?: string },
): Promise<void> {
  let notified: string[] = [];
  await db.transaction(async (tx) => {
    const [req] = await tx.select().from(buyoutRequests).where(eq(buyoutRequests.id, p.requestId)).for("update");
    if (!req) return notFound("Заявка");
    const actor = await getUser(tx, p.actorId);
    const isOwner = req.userId === actor.id;
    const isAppraiser = hasPermission(actor.role, "buyout.review");
    if (!BUYOUT_TRANSITIONS[req.status].includes(p.to)) fail("invalid_transition", "Недопустимая смена статуса");

    const ownerMove = req.status === "offered" && (p.to === "accepted" || p.to === "rejected");
    if (ownerMove ? !isOwner : !isAppraiser) forbidden();

    const set: Partial<typeof buyoutRequests.$inferInsert> = { status: p.to };
    if (p.to === "offered") {
      if (!p.offeredPrice || p.offeredPrice < 100) fail("price_required", "Укажите предлагаемую цену");
      set.offeredPrice = p.offeredPrice;
    }
    if (!ownerMove) {
      set.appraiserId = actor.id;
      if (p.note !== undefined) set.appraiserNote = p.note;
    }
    await tx.update(buyoutRequests).set(set).where(eq(buyoutRequests.id, req.id));

    const statusText =
      p.to === "offered"
        ? `Предложение площадки: ${formatRub(p.offeredPrice!)}`
        : `Статус: «${BUYOUT_STATUS_LABELS[p.to]}»`;
    if (req.conversationId) {
      await postMessage(tx, {
        conversationId: req.conversationId,
        senderId: actor.id,
        buyoutRequestId: req.id,
        isSystem: true,
        text: `Заявка на выкуп №${req.id}. ${statusText}${p.note ? `\nКомментарий: ${p.note}` : ""}`,
      });
    }
    if (!ownerMove) {
      notified = await notify(tx, {
        userId: req.userId,
        type: "buyout_status",
        title: `Заявка на выкуп «${req.title}»: ${BUYOUT_STATUS_LABELS[p.to]}`,
        body: statusText,
        link: `/cabinet/buyout`,
      });
    }
  });
  await flushUserEvents(notified);
}
