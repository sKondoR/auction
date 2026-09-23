import { type DbOrTx, conversations, lots, messages, questions, user } from "@auction/db";
import { maskContacts } from "@auction/domain";
import { and, eq, or } from "drizzle-orm";
import { fail, forbidden, notFound } from "./errors";
import { publishUserEvent } from "./infra/redis";
import { flushUserEvents, notify } from "./notify";
import { assertCanTrade, getServiceAccount, getUser } from "./users";

type Conversation = typeof conversations.$inferSelect;

/** Беседа одна на пару «покупатель — продавец». */
export async function getOrCreateConversation(
  db: DbOrTx,
  p: { buyerId: string; sellerId: string; kind?: "trade" | "support" },
): Promise<Conversation> {
  const kind = p.kind ?? "trade";
  if (p.buyerId === p.sellerId) fail("self_conversation", "Нельзя написать самому себе");
  const [existing] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.kind, kind), eq(conversations.buyerId, p.buyerId), eq(conversations.sellerId, p.sellerId)));
  if (existing) return existing;
  const [created] = await db
    .insert(conversations)
    .values({ kind, buyerId: p.buyerId, sellerId: p.sellerId })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  const [again] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.kind, kind), eq(conversations.buyerId, p.buyerId), eq(conversations.sellerId, p.sellerId)));
  return again!;
}

/** Беседа пользователя с администрацией (от лица служебного аккаунта). */
export async function getSupportConversation(db: DbOrTx, userId: string): Promise<Conversation> {
  const service = await getServiceAccount(db);
  return getOrCreateConversation(db, { buyerId: userId, sellerId: service.id, kind: "support" });
}

export function isParticipant(c: Conversation, userId: string): boolean {
  return c.buyerId === userId || c.sellerId === userId;
}

export async function postMessage(
  db: DbOrTx,
  p: {
    conversationId: number;
    senderId: string;
    text: string;
    lotId?: number | null;
    dealId?: number | null;
    buyoutRequestId?: number | null;
    isSystem?: boolean;
    /** Сотрудник пишет от имени служебного аккаунта в беседе с администрацией. */
    asStaff?: boolean;
  },
): Promise<{ id: number; recipientId: string }> {
  const [c] = await db.select().from(conversations).where(eq(conversations.id, p.conversationId));
  if (!c) return notFound("Беседа");
  const senderId = p.asStaff ? c.sellerId : p.senderId;
  if (!p.isSystem && !p.asStaff && !isParticipant(c, senderId)) forbidden();
  const text = p.isSystem ? p.text.trim() : maskContacts(p.text.trim());
  if (!text) fail("empty", "Пустое сообщение");
  if (text.length > 4000) fail("too_long", "Сообщение длиннее 4000 символов");

  const [m] = await db
    .insert(messages)
    .values({
      conversationId: c.id,
      senderId,
      text,
      lotId: p.lotId ?? null,
      dealId: p.dealId ?? null,
      buyoutRequestId: p.buyoutRequestId ?? null,
      isSystem: p.isSystem ?? false,
    })
    .returning({ id: messages.id });
  const now = new Date();
  await db
    .update(conversations)
    .set({
      lastMessageAt: now,
      ...(senderId === c.buyerId ? { buyerReadAt: now } : {}),
      ...(senderId === c.sellerId ? { sellerReadAt: now } : {}),
    })
    .where(eq(conversations.id, c.id));
  const recipientId = senderId === c.buyerId ? c.sellerId : c.buyerId;
  return { id: m!.id, recipientId };
}

/** Сообщение пользователя из интерфейса: маскировка, уведомление, real-time. */
export async function sendUserMessage(
  db: DbOrTx,
  p: { senderId: string; conversationId?: number; toUserId?: string; lotId?: number | null; text: string; asStaff?: boolean },
): Promise<number> {
  const sender = await getUser(db, p.senderId);
  if (!p.asStaff) assertCanTrade(sender);

  let conversationId = p.conversationId;
  if (!conversationId) {
    if (!p.toUserId || !p.lotId) fail("bad_request", "Не указан получатель");
    // «Связаться с продавцом»: покупатель — отправитель, продавец — владелец лота.
    const [lot] = await db.select({ sellerId: lots.sellerId }).from(lots).where(eq(lots.id, p.lotId!));
    if (!lot) notFound("Лот");
    const buyerId = lot!.sellerId === p.senderId ? p.toUserId! : p.senderId;
    const c = await getOrCreateConversation(db, { buyerId, sellerId: lot!.sellerId });
    conversationId = c.id;
  }
  const { id, recipientId } = await postMessage(db, {
    conversationId,
    senderId: p.senderId,
    text: p.text,
    lotId: p.lotId ?? null,
    asStaff: p.asStaff,
  });
  const [recipient] = await db.select({ isService: user.isService }).from(user).where(eq(user.id, recipientId));
  const notified = recipient?.isService
    ? []
    : await notify(db, {
        userId: recipientId,
        type: "new_message",
        title: p.asStaff ? "Сообщение от администрации" : `Новое сообщение от ${sender.name}`,
        body: maskContacts(p.text).slice(0, 200),
        link: `/messages/${conversationId}`,
      });
  await publishUserEvent(recipientId, { type: "message", conversationId });
  await flushUserEvents(notified);
  return conversationId;
}

export async function markConversationRead(db: DbOrTx, conversationId: number, userId: string): Promise<void> {
  const [c] = await db.select().from(conversations).where(eq(conversations.id, conversationId));
  if (!c) return;
  const now = new Date();
  if (c.buyerId === userId) await db.update(conversations).set({ buyerReadAt: now }).where(eq(conversations.id, c.id));
  if (c.sellerId === userId) await db.update(conversations).set({ sellerReadAt: now }).where(eq(conversations.id, c.id));
}

/* ---------------- Вопросы под лотом ---------------- */

export async function askQuestion(
  db: DbOrTx,
  p: { lotId: number; askerId: string; text: string; isPrivate: boolean },
): Promise<void> {
  const asker = await getUser(db, p.askerId);
  assertCanTrade(asker);
  const [lot] = await db.select().from(lots).where(eq(lots.id, p.lotId));
  if (!lot) return notFound("Лот");
  if (lot.sellerId === p.askerId) fail("own_lot", "Нельзя задать вопрос по своему лоту");
  const text = maskContacts(p.text.trim());
  if (text.length < 3) fail("too_short", "Слишком короткий вопрос");
  if (text.length > 1000) fail("too_long", "Вопрос длиннее 1000 символов");
  await db.insert(questions).values({ lotId: p.lotId, askerId: p.askerId, text, isPrivate: p.isPrivate });
  const ids = await notify(db, {
    userId: lot.sellerId,
    type: "new_question",
    title: `Вопрос по лоту «${lot.title}»`,
    body: text.slice(0, 200),
    link: `/lots/${lot.id}#questions`,
  });
  await flushUserEvents(ids);
}

export async function answerQuestion(db: DbOrTx, p: { questionId: number; sellerId: string; answer: string }): Promise<void> {
  const [q] = await db
    .select({ q: questions, sellerId: lots.sellerId, title: lots.title })
    .from(questions)
    .innerJoin(lots, eq(lots.id, questions.lotId))
    .where(eq(questions.id, p.questionId));
  if (!q) return notFound("Вопрос");
  if (q.sellerId !== p.sellerId) forbidden("Отвечать может только продавец");
  const answer = maskContacts(p.answer.trim());
  if (!answer) fail("empty", "Пустой ответ");
  await db.update(questions).set({ answer, answeredAt: new Date() }).where(eq(questions.id, p.questionId));
  const ids = await notify(db, {
    userId: q.q.askerId,
    type: "question_answered",
    title: `Продавец ответил на ваш вопрос по лоту «${q.title}»`,
    body: answer.slice(0, 200),
    link: `/lots/${q.q.lotId}#questions`,
  });
  await flushUserEvents(ids);
}

/** Вопросы лота, видимые пользователю: публичные — всем, приватные — автору и продавцу. */
export function visibleQuestionsCondition(lotId: number, viewerId: string | null, sellerId: string) {
  if (viewerId === sellerId) return eq(questions.lotId, lotId);
  return and(
    eq(questions.lotId, lotId),
    viewerId ? or(eq(questions.isPrivate, false), eq(questions.askerId, viewerId)) : eq(questions.isPrivate, false),
  );
}
