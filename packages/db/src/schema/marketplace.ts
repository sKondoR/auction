import {
  BUYOUT_STATUSES,
  COMPLAINT_STATUSES,
  COMPLAINT_TARGETS,
  DEAL_STATUSES,
  INVOICE_STATUSES,
  LOT_FORMATS,
  LOT_STATUSES,
  OFFER_STATUSES,
  REVIEW_RATINGS,
} from "@auction/domain";
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

/** Суммы — копейки, bigint в БД, number в TS (безопасно до 9·10^15). */
const money = (name: string) => bigint(name, { mode: "number" });
const ts = (name: string) => timestamp(name, { withTimezone: true });
const userRef = (name: string) => text(name).references(() => user.id);

const tsvector = customType<{ data: string }>({ dataType: () => "tsvector" });

export const lotFormat = pgEnum("lot_format", LOT_FORMATS);
export const lotStatus = pgEnum("lot_status", LOT_STATUSES);
export const offerStatus = pgEnum("offer_status", OFFER_STATUSES);
export const dealStatus = pgEnum("deal_status", DEAL_STATUSES);
export const reviewRating = pgEnum("review_rating", REVIEW_RATINGS);
export const invoiceStatus = pgEnum("invoice_status", INVOICE_STATUSES);
export const buyoutStatus = pgEnum("buyout_status", BUYOUT_STATUSES);
export const complaintTarget = pgEnum("complaint_target", COMPLAINT_TARGETS);
export const complaintStatus = pgEnum("complaint_status", COMPLAINT_STATUSES);
export const attributeType = pgEnum("attribute_type", ["text", "number", "select"]);
export const conversationKind = pgEnum("conversation_kind", ["trade", "support"]);
export const ledgerKind = pgEnum("ledger_kind", ["charge", "reversal"]);
export const liveSessionStatus = pgEnum("live_session_status", ["draft", "published", "live", "finished", "cancelled"]);

/* ---------------- Категории ---------------- */

export const categories = pgTable(
  "categories",
  {
    id: serial("id").primaryKey(),
    parentId: integer("parent_id"),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
    /** Запрещённая к продаже категория (в правилах площадки). */
    isHidden: boolean("is_hidden").notNull().default(false),
  },
  (t) => [index("categories_parent_idx").on(t.parentId)],
);

export const categoryAttributes = pgTable(
  "category_attributes",
  {
    id: serial("id").primaryKey(),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    type: attributeType("type").notNull().default("text"),
    options: jsonb("options").$type<string[]>(),
    unit: text("unit"),
    position: integer("position").notNull().default(0),
  },
  (t) => [uniqueIndex("category_attributes_key_uq").on(t.categoryId, t.key)],
);

/* ---------------- Живой аукцион (этап 3, модель данных) ---------------- */

export const liveSessions = pgTable("live_sessions", {
  id: serial("id").primaryKey(),
  sellerId: userRef("seller_id").notNull(),
  title: text("title").notNull(),
  startsAt: ts("starts_at").notNull(),
  /** Место, где предметы можно осмотреть лично; null — такого места нет. */
  inspectionPlace: text("inspection_place"),
  streamId: text("stream_id"),
  status: liveSessionStatus("status").notNull().default("draft"),
  currentLotId: integer("current_lot_id"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const liveRegistrations = pgTable(
  "live_registrations",
  {
    sessionId: integer("session_id")
      .notNull()
      .references(() => liveSessions.id, { onDelete: "cascade" }),
    userId: userRef("user_id").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.sessionId, t.userId] })],
);

/* ---------------- Лоты ---------------- */

export const lots = pgTable(
  "lots",
  {
    id: serial("id").primaryKey(),
    sellerId: userRef("seller_id").notNull(),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id),
    /** Предмет: общий для цепочки перевыставлений. */
    itemId: uuid("item_id").notNull().defaultRandom(),
    format: lotFormat("format").notNull(),
    status: lotStatus("status").notNull().default("active"),

    title: text("title").notNull(),
    /** Описание с замаскированными контактами. */
    description: text("description").notNull().default(""),
    attributes: jsonb("attributes").$type<Record<string, string | number>>().notNull().default({}),
    city: text("city").notNull(),
    deliveryMethods: text("delivery_methods").array().notNull().default(sql`'{}'::text[]`),
    deliveryCost: text("delivery_cost").notNull().default(""),

    /** Цена (фиксированная) или стартовая цена (аукционы). */
    startPrice: money("start_price").notNull(),
    /** Текущая цена английского аукциона; null — ставок нет. */
    currentPrice: money("current_price"),
    leaderId: userRef("leader_id"),
    /** Максимум автоставки лидера (скрыт от других). */
    leaderMax: money("leader_max"),
    bidCount: integer("bid_count").notNull().default(0),
    blitzPrice: money("blitz_price"),

    quantity: integer("quantity").notNull().default(1),
    quantitySold: integer("quantity_sold").notNull().default(0),
    allowOffers: boolean("allow_offers").notNull().default(false),

    // Голландский аукцион (этап 2)
    minPrice: money("min_price"),
    dutchIntervalDays: smallint("dutch_interval_days"),
    dutchStepPercent: smallint("dutch_step_percent"),

    // Живой аукцион (этап 3)
    liveSessionId: integer("live_session_id").references(() => liveSessions.id),
    catalogPosition: integer("catalog_position"),

    startsAt: ts("starts_at").notNull().defaultNow(),
    endsAt: ts("ends_at").notNull(),
    /** Окончание без продлений — для расчёта длительности при перевыставлении. */
    originalEndsAt: ts("original_ends_at").notNull(),

    autoRelist: boolean("auto_relist").notNull().default(false),
    autoRelistCount: smallint("auto_relist_count").notNull().default(0),
    relistedFromId: integer("relisted_from_id"),
    /** Лот уже перевыставлен (новым лотом) — чтобы не перевыставить дважды. */
    relistedToId: integer("relisted_to_id"),

    finalizedAt: ts("finalized_at"),
    expiryReminderSentAt: ts("expiry_reminder_sent_at"),
    withdrawnAt: ts("withdrawn_at"),
    withdrawReason: text("withdraw_reason"),
    removedReason: text("removed_reason"),
    /** Продвижение (платное, интерфейса пока нет): учитывается в сортировке. */
    promotedUntil: ts("promoted_until"),
    viewCount: integer("view_count").notNull().default(0),

    searchVector: tsvector("search_vector").generatedAlwaysAs(
      sql`setweight(to_tsvector('russian', coalesce(title, '')), 'A') || setweight(to_tsvector('russian', coalesce(description, '')), 'B')`,
    ),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("lots_seller_idx").on(t.sellerId, t.status),
    index("lots_category_idx").on(t.categoryId, t.status),
    index("lots_status_ends_idx").on(t.status, t.endsAt),
    index("lots_item_idx").on(t.itemId),
    index("lots_search_idx").using("gin", t.searchVector),
    index("lots_attributes_idx").using("gin", t.attributes),
  ],
);

export const lotPhotos = pgTable(
  "lot_photos",
  {
    id: serial("id").primaryKey(),
    lotId: integer("lot_id").references(() => lots.id, { onDelete: "cascade" }),
    /** Загрузивший пользователь (фото загружаются до создания лота). */
    ownerId: userRef("owner_id").notNull(),
    position: integer("position").notNull().default(0),
    key: text("key").notNull(),
    thumbKey: text("thumb_key").notNull(),
    width: integer("width"),
    height: integer("height"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("lot_photos_lot_idx").on(t.lotId, t.position)],
);

/** Дополнения к описанию после первой ставки. */
export const lotAddenda = pgTable("lot_addenda", {
  id: serial("id").primaryKey(),
  lotId: integer("lot_id")
    .notNull()
    .references(() => lots.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

/* ---------------- Ставки и предложения ---------------- */

export const bids = pgTable(
  "bids",
  {
    id: serial("id").primaryKey(),
    lotId: integer("lot_id")
      .notNull()
      .references(() => lots.id),
    bidderId: userRef("bidder_id").notNull(),
    amount: money("amount").notNull(),
    /** Заявка покупателя (для пересчёта после отмены ставки): сумма и максимум автоставки. */
    requestedAmount: money("requested_amount"),
    maxAmount: money("max_amount"),
    isAuto: boolean("is_auto").notNull().default(false),
    cancelledAt: ts("cancelled_at"),
    cancelReason: text("cancel_reason"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("bids_lot_idx").on(t.lotId, t.createdAt), index("bids_bidder_idx").on(t.bidderId)],
);

export const offers = pgTable(
  "offers",
  {
    id: serial("id").primaryKey(),
    lotId: integer("lot_id")
      .notNull()
      .references(() => lots.id),
    buyerId: userRef("buyer_id").notNull(),
    price: money("price").notNull(),
    quantity: integer("quantity").notNull().default(1),
    message: text("message"),
    status: offerStatus("status").notNull().default("pending"),
    createdAt: ts("created_at").notNull().defaultNow(),
    respondedAt: ts("responded_at"),
  },
  (t) => [index("offers_lot_idx").on(t.lotId, t.status), index("offers_buyer_idx").on(t.buyerId)],
);

/* ---------------- Вопросы, беседы ---------------- */

export const questions = pgTable(
  "questions",
  {
    id: serial("id").primaryKey(),
    lotId: integer("lot_id")
      .notNull()
      .references(() => lots.id),
    askerId: userRef("asker_id").notNull(),
    text: text("text").notNull(),
    isPrivate: boolean("is_private").notNull().default(false),
    answer: text("answer"),
    answeredAt: ts("answered_at"),
    hiddenAt: ts("hidden_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("questions_lot_idx").on(t.lotId)],
);

/**
 * Беседа — одна на пару «покупатель — продавец» (kind = trade) или
 * «пользователь — администрация» (kind = support, sellerId = служебный аккаунт).
 */
export const conversations = pgTable(
  "conversations",
  {
    id: serial("id").primaryKey(),
    kind: conversationKind("kind").notNull().default("trade"),
    buyerId: userRef("buyer_id").notNull(),
    sellerId: userRef("seller_id").notNull(),
    lastMessageAt: ts("last_message_at").notNull().defaultNow(),
    buyerReadAt: ts("buyer_read_at"),
    sellerReadAt: ts("seller_read_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("conversations_pair_uq").on(t.kind, t.buyerId, t.sellerId),
    index("conversations_seller_idx").on(t.sellerId, t.lastMessageAt),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: serial("id").primaryKey(),
    conversationId: integer("conversation_id")
      .notNull()
      .references(() => conversations.id),
    senderId: userRef("sender_id").notNull(),
    /** Лот, о котором идёт речь. */
    lotId: integer("lot_id").references(() => lots.id),
    dealId: integer("deal_id"),
    buyoutRequestId: integer("buyout_request_id"),
    text: text("text").notNull(),
    /** Системное сообщение (карточка сделки, смена статуса). */
    isSystem: boolean("is_system").notNull().default(false),
    hiddenAt: ts("hidden_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("messages_conversation_idx").on(t.conversationId, t.createdAt)],
);

/* ---------------- Сделки, отзывы ---------------- */

export const deals = pgTable(
  "deals",
  {
    id: serial("id").primaryKey(),
    lotId: integer("lot_id")
      .notNull()
      .references(() => lots.id),
    sellerId: userRef("seller_id").notNull(),
    buyerId: userRef("buyer_id").notNull(),
    quantity: integer("quantity").notNull().default(1),
    unitPrice: money("unit_price").notNull(),
    totalPrice: money("total_price").notNull(),
    status: dealStatus("status").notNull().default("sold"),
    source: text("source").$type<"auction" | "blitz" | "fixed" | "offer" | "second_chance">().notNull(),
    offerId: integer("offer_id"),
    conversationId: integer("conversation_id"),
    createdAt: ts("created_at").notNull().defaultNow(),
    paidAt: ts("paid_at"),
    shippedAt: ts("shipped_at"),
    receivedAt: ts("received_at"),
    closedAt: ts("closed_at"),
    updatedAt: ts("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("deals_seller_idx").on(t.sellerId, t.createdAt),
    index("deals_buyer_idx").on(t.buyerId, t.createdAt),
    index("deals_lot_idx").on(t.lotId),
  ],
);

export const reviews = pgTable(
  "reviews",
  {
    id: serial("id").primaryKey(),
    dealId: integer("deal_id")
      .notNull()
      .references(() => deals.id),
    authorId: userRef("author_id"),
    targetId: userRef("target_id").notNull(),
    /** Роль получателя отзыва в сделке. */
    targetRole: text("target_role").$type<"seller" | "buyer">().notNull(),
    rating: reviewRating("rating").notNull(),
    text: text("text").notNull().default(""),
    /** Штрафной отзыв (выставлен автоматически при неоплате). */
    isPenalty: boolean("is_penalty").notNull().default(false),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("reviews_deal_target_uq").on(t.dealId, t.targetId),
    index("reviews_target_idx").on(t.targetId, t.createdAt),
  ],
);

/* ---------------- Комиссия и счета ---------------- */

export const invoices = pgTable(
  "invoices",
  {
    id: serial("id").primaryKey(),
    sellerId: userRef("seller_id").notNull(),
    periodStart: date("period_start", { mode: "date" }).notNull(),
    amount: money("amount").notNull(),
    status: invoiceStatus("status").notNull().default("issued"),
    issuedAt: ts("issued_at").notNull().defaultNow(),
    dueAt: ts("due_at").notNull(),
    paidAt: ts("paid_at"),
    markedPaidBy: userRef("marked_paid_by"),
    /** Будущая оплата через ЮKassa. */
    paymentId: text("payment_id"),
  },
  (t) => [
    uniqueIndex("invoices_seller_period_uq").on(t.sellerId, t.periodStart),
    index("invoices_status_idx").on(t.status, t.dueAt),
  ],
);

export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: serial("id").primaryKey(),
    sellerId: userRef("seller_id").notNull(),
    dealId: integer("deal_id")
      .notNull()
      .references(() => deals.id),
    kind: ledgerKind("kind").notNull(),
    /** Положительная сумма — начисление, отрицательная — сторно. */
    amount: money("amount").notNull(),
    description: text("description").notNull(),
    invoiceId: integer("invoice_id").references(() => invoices.id),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("ledger_seller_idx").on(t.sellerId, t.createdAt),
    uniqueIndex("ledger_deal_kind_uq").on(t.dealId, t.kind),
  ],
);

/* ---------------- Избранное, просмотры, подписки ---------------- */

export const favorites = pgTable(
  "favorites",
  {
    userId: userRef("user_id").notNull(),
    lotId: integer("lot_id")
      .notNull()
      .references(() => lots.id, { onDelete: "cascade" }),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.lotId] })],
);

export const lotViews = pgTable(
  "lot_views",
  {
    userId: userRef("user_id").notNull(),
    lotId: integer("lot_id")
      .notNull()
      .references(() => lots.id, { onDelete: "cascade" }),
    viewedAt: ts("viewed_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.lotId] }), index("lot_views_user_idx").on(t.userId, t.viewedAt)],
);

export const sellerSubscriptions = pgTable(
  "seller_subscriptions",
  {
    subscriberId: userRef("subscriber_id").notNull(),
    sellerId: userRef("seller_id").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.subscriberId, t.sellerId] }), index("seller_subs_seller_idx").on(t.sellerId)],
);

export interface SearchFilters {
  q?: string;
  categoryId?: number;
  format?: string;
  priceMin?: number;
  priceMax?: number;
  city?: string;
  status?: "active" | "upcoming" | "ended";
  attrs?: Record<string, string>;
}

export const savedSearches = pgTable(
  "saved_searches",
  {
    id: serial("id").primaryKey(),
    userId: userRef("user_id").notNull(),
    name: text("name").notNull(),
    filters: jsonb("filters").$type<SearchFilters>().notNull(),
    /** Лоты, созданные после этого момента, считаются новыми совпадениями. */
    lastCheckedAt: ts("last_checked_at").notNull().defaultNow(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("saved_searches_user_idx").on(t.userId)],
);

/* ---------------- Заявки на выкуп ---------------- */

export const buyoutRequests = pgTable(
  "buyout_requests",
  {
    id: serial("id").primaryKey(),
    userId: userRef("user_id").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    size: text("size").notNull(),
    desiredPrice: money("desired_price").notNull(),
    photoKeys: jsonb("photo_keys").$type<{ key: string; thumbKey: string }[]>().notNull().default([]),
    status: buyoutStatus("status").notNull().default("new"),
    offeredPrice: money("offered_price"),
    appraiserId: userRef("appraiser_id"),
    appraiserNote: text("appraiser_note"),
    conversationId: integer("conversation_id"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("buyout_status_idx").on(t.status, t.createdAt), index("buyout_user_idx").on(t.userId)],
);

/* ---------------- Уведомления ---------------- */

export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    userId: userRef("user_id").notNull(),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    link: text("link"),
    readAt: ts("read_at"),
    /** Показывать на сайте (колокольчик). */
    site: boolean("site").notNull().default(true),
    /** Outbox для email: worker отправляет письма с wantsEmail и пустым emailedAt. */
    wantsEmail: boolean("wants_email").notNull().default(false),
    emailedAt: ts("emailed_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("notifications_user_idx").on(t.userId, t.createdAt),
    index("notifications_email_outbox_idx")
      .on(t.createdAt)
      .where(sql`wants_email and emailed_at is null`),
  ],
);

export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    userId: userRef("user_id").notNull(),
    type: text("type").notNull(),
    site: boolean("site").notNull(),
    email: boolean("email").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.type] })],
);

/* ---------------- Модерация ---------------- */

export const complaints = pgTable(
  "complaints",
  {
    id: serial("id").primaryKey(),
    reporterId: userRef("reporter_id").notNull(),
    targetType: complaintTarget("target_type").notNull(),
    targetId: text("target_id").notNull(),
    reason: text("reason").notNull(),
    status: complaintStatus("status").notNull().default("open"),
    resolvedBy: userRef("resolved_by"),
    resolution: text("resolution"),
    createdAt: ts("created_at").notNull().defaultNow(),
    resolvedAt: ts("resolved_at"),
  },
  (t) => [index("complaints_status_idx").on(t.status, t.createdAt)],
);

export const moderationActions = pgTable(
  "moderation_actions",
  {
    id: serial("id").primaryKey(),
    userId: userRef("user_id").notNull(),
    moderatorId: userRef("moderator_id"),
    kind: text("kind").$type<"warning" | "ban" | "unban" | "lot_removed" | "auto_ban">().notNull(),
    reason: text("reason").notNull(),
    lotId: integer("lot_id"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("moderation_actions_user_idx").on(t.userId, t.createdAt)],
);

/* ---------------- Настройки площадки ---------------- */

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: ts("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
