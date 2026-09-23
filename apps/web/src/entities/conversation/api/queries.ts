import "server-only";
import { conversations, getDb, lots, messages, user } from "@auction/db";
import { alias } from "drizzle-orm/pg-core";
import { and, asc, desc, eq, isNull, or, sql } from "drizzle-orm";

const buyer = alias(user, "buyer");
const seller = alias(user, "seller");

const unreadExpr = (userId: string) => sql<boolean>`(
  (${conversations.buyerId} = ${userId} and (${conversations.buyerReadAt} is null or ${conversations.buyerReadAt} < ${conversations.lastMessageAt}))
  or (${conversations.sellerId} = ${userId} and (${conversations.sellerReadAt} is null or ${conversations.sellerReadAt} < ${conversations.lastMessageAt}))
)`;

const lastText = sql<string | null>`(select ${messages.text} from ${messages} where ${messages.conversationId} = ${conversations.id} and ${messages.hiddenAt} is null order by ${messages.createdAt} desc limit 1)`;

export async function listConversations(userId: string) {
  const rows = await getDb()
    .select({
      c: conversations,
      buyerName: buyer.name,
      sellerName: seller.name,
      sellerIsService: seller.isService,
      unread: unreadExpr(userId),
      lastText,
    })
    .from(conversations)
    .innerJoin(buyer, eq(buyer.id, conversations.buyerId))
    .innerJoin(seller, eq(seller.id, conversations.sellerId))
    .where(or(eq(conversations.buyerId, userId), eq(conversations.sellerId, userId)))
    .orderBy(desc(conversations.lastMessageAt))
    .limit(200);
  return rows.map((r) => ({
    id: r.c.id,
    kind: r.c.kind,
    otherName: r.c.buyerId === userId ? (r.sellerIsService ? "Администрация площадки" : r.sellerName) : r.buyerName,
    otherId: r.c.buyerId === userId ? r.c.sellerId : r.c.buyerId,
    lastMessageAt: r.c.lastMessageAt,
    unread: r.unread,
    lastText: r.lastText,
  }));
}

export async function unreadConversationCount(userId: string): Promise<number> {
  const [r] = await getDb()
    .select({ n: sql<number>`count(*)` })
    .from(conversations)
    .where(and(or(eq(conversations.buyerId, userId), eq(conversations.sellerId, userId)), unreadExpr(userId)));
  return Number(r?.n ?? 0);
}

export async function getThread(conversationId: number) {
  const db = getDb();
  const [row] = await db
    .select({ c: conversations, buyerName: buyer.name, sellerName: seller.name, sellerIsService: seller.isService })
    .from(conversations)
    .innerJoin(buyer, eq(buyer.id, conversations.buyerId))
    .innerJoin(seller, eq(seller.id, conversations.sellerId))
    .where(eq(conversations.id, conversationId));
  if (!row) return null;
  const items = await db
    .select({ m: messages, lotTitle: lots.title, senderName: user.name })
    .from(messages)
    .leftJoin(lots, eq(lots.id, messages.lotId))
    .innerJoin(user, eq(user.id, messages.senderId))
    .where(and(eq(messages.conversationId, conversationId), isNull(messages.hiddenAt)))
    .orderBy(asc(messages.createdAt))
    .limit(500);
  return { ...row, messages: items };
}

/** Беседы с администрацией (для раздела поддержки в админке). */
export async function listSupportConversations() {
  return getDb()
    .select({ c: conversations, buyerName: buyer.name, lastText })
    .from(conversations)
    .innerJoin(buyer, eq(buyer.id, conversations.buyerId))
    .where(eq(conversations.kind, "support"))
    .orderBy(desc(conversations.lastMessageAt))
    .limit(200);
}
