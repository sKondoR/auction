/**
 * Данные статической демо-версии (GitHub Pages): лоты с фото, ставки, сделки,
 * беседы и уведомления. Запускается после `seed(db, { lots: false })` на пустой БД.
 * Демо-зритель — продавец «Нумизмат Пётр» с правами администратора: так в демо
 * видны и кабинет покупателя, и кабинет продавца, и админка.
 */
import { DAY_MS, DEFAULT_COMMISSION_BPS, MINUTE_MS, rub } from "@auction/domain";
import { eq } from "drizzle-orm";
import type { Db } from "./client";
import {
  bids,
  buyoutRequests,
  categories,
  complaints,
  conversations,
  deals,
  favorites,
  ledgerEntries,
  lotPhotos,
  lotViews,
  lots,
  messages,
  notifications,
  offers,
  questions,
  reviews,
  savedSearches,
  sellerSubscriptions,
  user,
} from "./schema";

export const DEMO_VIEWER_ID = "demo-seller";

const PETR = DEMO_VIEWER_ID;
const ANNA = "demo-buyer";
const OLGA = "demo-antiquar";
const IGOR = "demo-collector";

type Bid = { by: string; amount: number; minutesAgo: number };

interface DemoLot {
  key: string;
  photo: string;
  seller: string;
  category: string;
  title: string;
  description: string;
  attributes?: Record<string, string | number>;
  format: "english" | "fixed";
  startPrice: number;
  blitzPrice?: number;
  quantity?: number;
  /** Сколько штук уже продано у лота, который ещё в продаже. */
  sold?: number;
  allowOffers?: boolean;
  /** Дней до окончания; отрицательное — лот уже завершён. */
  days: number;
  bids?: Bid[];
}

const LOTS: DemoLot[] = [
  {
    key: "coin",
    photo: "coin",
    seller: PETR,
    category: "coins",
    title: "5 рублей 1899 года, золото, ФЗ",
    description: "Золотая монета Николая II, Санкт-Петербургский монетный двор. Блеск сохранён, мелкие следы обращения.",
    attributes: { year: 1899, denomination: "5 рублей", metal: "Золото", condition: "XF" },
    format: "english",
    startPrice: rub(18_000),
    blitzPrice: rub(45_000),
    days: 3,
    bids: [
      { by: ANNA, amount: rub(18_000), minutesAgo: 600 },
      { by: IGOR, amount: rub(19_500), minutesAgo: 240 },
      { by: ANNA, amount: rub(21_000), minutesAgo: 35 },
    ],
  },
  {
    key: "bill",
    photo: "bill",
    seller: PETR,
    category: "banknotes",
    title: "25 рублей 1899 года, Тимашев — Брут",
    description: "Государственный кредитный билет. Бумага плотная, без надрывов, один вертикальный сгиб.",
    attributes: { year: 1899, denomination: "25 рублей", condition: "VF" },
    format: "english",
    startPrice: rub(2_500),
    days: 0.03,
    bids: [
      { by: IGOR, amount: rub(2_500), minutesAgo: 300 },
      { by: ANNA, amount: rub(3_100), minutesAgo: 12 },
    ],
  },
  {
    key: "stamp",
    photo: "stamp",
    seller: PETR,
    category: "stamps",
    title: "Марка СССР 1963 года, чистая",
    description: "Почтовая марка без наклейки, клей оригинальный, зубцовка целая.",
    attributes: { year: 1963, country: "СССР", cancelled: "Чистая" },
    format: "fixed",
    startPrice: rub(450),
    quantity: 8,
    sold: 3,
    days: 40,
  },
  {
    key: "cover",
    photo: "cover",
    seller: PETR,
    category: "stamps",
    title: "Заказной конверт, прошедший почту, 1963",
    description: "Конверт с марками и штемпелями 14 марта 1963 года. Рассмотрю предложения цены.",
    attributes: { year: 1963, country: "СССР", cancelled: "Гашёная" },
    format: "fixed",
    startPrice: rub(1_200),
    allowOffers: true,
    days: 25,
  },
  {
    key: "postcard",
    photo: "postcard",
    seller: PETR,
    category: "postcards",
    title: "Открытка «Одесская выставка. Воздухоплавание», 1910",
    description: "Дореволюционная открытка, чистая, не подписана. Цвета яркие.",
    attributes: { year: 1910 },
    format: "english",
    startPrice: rub(800),
    days: -4,
    bids: [
      { by: IGOR, amount: rub(800), minutesAgo: 9_000 },
      { by: ANNA, amount: rub(1_350), minutesAgo: 6_000 },
    ],
  },
  {
    key: "watch",
    photo: "watch",
    seller: PETR,
    category: "antiques-clocks",
    title: "Карманные часы с гравировкой, начало XX века",
    description: "Механизм на ходу, стекло без трещин, крышка с растительным орнаментом.",
    attributes: { period: "1800–1917", material: "Латунь" },
    format: "english",
    startPrice: rub(6_000),
    days: -6,
    bids: [{ by: IGOR, amount: rub(7_400), minutesAgo: 9_000 }],
  },
  {
    key: "samovar",
    photo: "samovar",
    seller: OLGA,
    category: "antiques-household",
    title: "Самовар «рюмка», Тула, конец XIX века",
    description: "Латунь, клейма на крышке. Кран и конфорка родные, следов пайки нет. Объём около 5 литров.",
    attributes: { period: "1800–1917", material: "Латунь" },
    format: "english",
    startPrice: rub(9_000),
    blitzPrice: rub(25_000),
    days: 2,
    bids: [
      { by: ANNA, amount: rub(9_000), minutesAgo: 900 },
      { by: PETR, amount: rub(10_500), minutesAgo: 120 },
    ],
  },
  {
    key: "podstakannik",
    photo: "podstakannik",
    seller: OLGA,
    category: "antiques-silver",
    title: "Подстаканник мельхиоровый, 1950-е",
    description: "Ажурная стенка, клеймо завода на донце. Без вмятин.",
    attributes: { period: "1945–1991", material: "Мельхиор" },
    format: "fixed",
    startPrice: rub(2_300),
    quantity: 2,
    sold: 1,
    days: 30,
  },
  {
    key: "sugar",
    photo: "sugar",
    seller: OLGA,
    category: "antiques-silver",
    title: "Сахарница серебряная с крышкой, XIX век",
    description: "Серебро, чеканка, позолота внутри. Вес 412 г.",
    attributes: { period: "1800–1917", material: "Серебро" },
    format: "english",
    startPrice: rub(30_000),
    days: 5,
    bids: [
      { by: PETR, amount: rub(30_000), minutesAgo: 1_400 },
      { by: IGOR, amount: rub(32_000), minutesAgo: 200 },
    ],
  },
  {
    key: "teapot",
    photo: "teapot",
    seller: OLGA,
    category: "antiques-porcelain",
    title: "Чайник фарфоровый с крышкой, роспись",
    description: "Тонкий фарфор, ручная роспись, без сколов и реставрации.",
    attributes: { period: "1800–1917", material: "Фарфор" },
    format: "english",
    startPrice: rub(4_000),
    days: 6,
  },
  {
    key: "matryoshka",
    photo: "matryoshka",
    seller: OLGA,
    category: "toys-games",
    title: "Матрёшка ранняя, начало XX века",
    description: "Восемь мест, роспись темперой, лак местами потёрт.",
    attributes: { period: "1800–1917", material: "Дерево" },
    format: "fixed",
    startPrice: rub(14_000),
    allowOffers: true,
    days: -1.5,
  },
  {
    key: "gramophone",
    photo: "gramophone",
    seller: OLGA,
    category: "antiques-musical",
    title: "Граммофон HMV с трубой",
    description: "Пружинный механизм исправен, мембрана родная. Самовывоз или СДЭК.",
    attributes: { period: "1917–1945", material: "Дерево, металл" },
    format: "english",
    startPrice: rub(22_000),
    days: 0.012,
    bids: [{ by: ANNA, amount: rub(22_000), minutesAgo: 50 }],
  },
  {
    key: "enamel",
    photo: "enamel",
    seller: OLGA,
    category: "antiques-icons",
    title: "Фрагмент оклада иконы, перегородчатая эмаль",
    description: "Серебро, эмаль, конец XIX века. Утраты эмали в двух ячейках.",
    attributes: { period: "1800–1917", material: "Серебро, эмаль" },
    format: "english",
    startPrice: rub(16_000),
    days: 9,
  },
  {
    key: "watch-dome",
    photo: "watch-dome",
    seller: OLGA,
    category: "antiques-clocks",
    title: "Карманные часы под стеклянным колпаком",
    description: "Часы с цепочкой на подставке под колпаком. Подходит для витрины.",
    attributes: { period: "1800–1917", material: "Серебро" },
    format: "english",
    startPrice: rub(5_000),
    days: -2,
    bids: [
      { by: ANNA, amount: rub(5_000), minutesAgo: 5_000 },
      { by: PETR, amount: rub(6_200), minutesAgo: 3_100 },
    ],
  },
];

export async function seedDemo(db: Db): Promise<void> {
  const now = Date.now();
  const ago = (minutes: number) => new Date(now - minutes * MINUTE_MS);

  await db.update(user).set({ role: "admin", about: "Собираю монеты Российской империи и бумажные деньги." }).where(eq(user.id, PETR));
  await db.insert(user).values([
    { id: OLGA, name: "Антиквар Ольга", email: "79993333333@phone.local", phoneNumber: "+79993333333", phoneNumberVerified: true, city: "Казань" },
    { id: IGOR, name: "Коллекционер Игорь", email: "79994444444@phone.local", phoneNumber: "+79994444444", phoneNumberVerified: true, city: "Тула" },
  ]);

  const catRows = await db.select({ id: categories.id, slug: categories.slug }).from(categories);
  const cat = (slug: string) => catRows.find((c) => c.slug === slug)!.id;

  const ids: Record<string, number> = {};
  for (const l of LOTS) {
    const endsAt = new Date(now + l.days * DAY_MS);
    const ended = l.days < 0;
    const sorted = [...(l.bids ?? [])].sort((a, b) => a.amount - b.amount);
    const top = sorted.at(-1);
    const [row] = await db
      .insert(lots)
      .values({
        sellerId: l.seller,
        categoryId: cat(l.category),
        format: l.format,
        status: ended ? "sold" : "active",
        title: l.title,
        description: l.description,
        attributes: l.attributes ?? {},
        city: l.seller === OLGA ? "Казань" : "Санкт-Петербург",
        deliveryMethods: ["post", "cdek"],
        deliveryCost: "Почта — 350 ₽, СДЭК — по тарифу",
        startPrice: l.startPrice,
        currentPrice: top?.amount ?? null,
        leaderId: top?.by ?? null,
        leaderMax: top?.amount ?? null,
        bidCount: sorted.length,
        blitzPrice: l.blitzPrice ?? null,
        quantity: l.quantity ?? 1,
        quantitySold: ended ? (l.quantity ?? 1) : (l.sold ?? 0),
        allowOffers: l.allowOffers ?? false,
        startsAt: new Date(Math.min(now, endsAt.getTime()) - 7 * DAY_MS),
        endsAt,
        originalEndsAt: endsAt,
        finalizedAt: ended ? endsAt : null,
        viewCount: 40 + sorted.length * 23,
      })
      .returning({ id: lots.id });
    ids[l.key] = row!.id;
    await db.insert(lotPhotos).values({ lotId: row!.id, ownerId: l.seller, key: `demo/${l.photo}.webp`, thumbKey: `demo/${l.photo}.webp` });
    for (const b of sorted) {
      await db.insert(bids).values({ lotId: row!.id, bidderId: b.by, amount: b.amount, requestedAmount: b.amount, maxAmount: b.amount, createdAt: ago(b.minutesAgo) });
    }
  }

  // Беседы.
  const [annaPetr] = await db
    .insert(conversations)
    .values({ buyerId: ANNA, sellerId: PETR, lastMessageAt: ago(90), buyerReadAt: ago(90), sellerReadAt: ago(400) })
    .returning();
  const [petrOlga] = await db
    .insert(conversations)
    .values({ buyerId: PETR, sellerId: OLGA, lastMessageAt: ago(1_500), buyerReadAt: ago(1_500), sellerReadAt: ago(1_500) })
    .returning();
  const [igorPetr] = await db
    .insert(conversations)
    .values({ buyerId: IGOR, sellerId: PETR, lastMessageAt: ago(3_000), buyerReadAt: ago(3_000), sellerReadAt: ago(3_000) })
    .returning();
  await db.insert(conversations).values({ kind: "support", buyerId: PETR, sellerId: "service", lastMessageAt: ago(3_000), buyerReadAt: ago(3_000) });

  // Сделки: Анна купила открытку (отправлена), Игорь — часы (завершена), Пётр выиграл часы под колпаком (ждёт оплаты).
  const total = (key: string) => LOTS.find((l) => l.key === key)!.bids!.reduce((m, b) => Math.max(m, b.amount), 0);
  const [dPostcard] = await db
    .insert(deals)
    .values({
      lotId: ids.postcard!,
      sellerId: PETR,
      buyerId: ANNA,
      unitPrice: total("postcard"),
      totalPrice: total("postcard"),
      status: "shipped",
      source: "auction",
      conversationId: annaPetr!.id,
      createdAt: ago(5_700),
      paidAt: ago(3_000),
      shippedAt: ago(1_200),
    })
    .returning();
  const [dWatch] = await db
    .insert(deals)
    .values({
      lotId: ids.watch!,
      sellerId: PETR,
      buyerId: IGOR,
      unitPrice: total("watch"),
      totalPrice: total("watch"),
      status: "completed",
      source: "auction",
      conversationId: igorPetr!.id,
      createdAt: ago(8_600),
      paidAt: ago(8_000),
      shippedAt: ago(7_200),
      receivedAt: ago(4_300),
      closedAt: ago(4_300),
    })
    .returning();
  // Сделки по фиксированной цене: Игорь купил три марки, Анна — подстаканник, матрёшку Ольга продала Игорю, приняв его предложение цены.
  const [dStamp] = await db
    .insert(deals)
    .values({
      lotId: ids.stamp!,
      sellerId: PETR,
      buyerId: IGOR,
      quantity: 3,
      unitPrice: rub(450),
      totalPrice: rub(1_350),
      status: "shipped",
      source: "fixed",
      conversationId: igorPetr!.id,
      createdAt: ago(4_000),
      paidAt: ago(3_900),
      shippedAt: ago(3_000),
    })
    .returning();
  await db.insert(deals).values({
    lotId: ids.podstakannik!,
    sellerId: OLGA,
    buyerId: ANNA,
    unitPrice: rub(2_300),
    totalPrice: rub(2_300),
    status: "paid",
    source: "fixed",
    createdAt: ago(1_300),
    paidAt: ago(1_100),
  });
  const matryoshkaSold = (-LOTS.find((l) => l.key === "matryoshka")!.days * DAY_MS) / MINUTE_MS;
  const [offer] = await db
    .insert(offers)
    .values({
      lotId: ids.matryoshka!,
      buyerId: IGOR,
      price: rub(12_500),
      message: "Готов забрать сразу.",
      status: "accepted",
      createdAt: ago(matryoshkaSold + 240),
      respondedAt: ago(matryoshkaSold),
    })
    .returning();
  await db.insert(deals).values({
    lotId: ids.matryoshka!,
    sellerId: OLGA,
    buyerId: IGOR,
    unitPrice: rub(12_500),
    totalPrice: rub(12_500),
    status: "awaiting_payment",
    source: "offer",
    offerId: offer!.id,
    createdAt: ago(matryoshkaSold),
  });

  await db.insert(deals).values({
    lotId: ids["watch-dome"]!,
    sellerId: OLGA,
    buyerId: PETR,
    unitPrice: total("watch-dome"),
    totalPrice: total("watch-dome"),
    status: "awaiting_payment",
    source: "auction",
    conversationId: petrOlga!.id,
    createdAt: ago(2_800),
  });
  for (const d of [dPostcard!, dWatch!, dStamp!]) {
    await db.insert(ledgerEntries).values({
      sellerId: PETR,
      dealId: d.id,
      kind: "charge",
      amount: Math.round((d.totalPrice * DEFAULT_COMMISSION_BPS) / 10_000),
      description: `Комиссия по сделке №${d.id}`,
      createdAt: d.createdAt,
    });
  }
  await db.insert(reviews).values([
    { dealId: dWatch!.id, authorId: IGOR, targetId: PETR, targetRole: "seller", rating: "positive", text: "Часы пришли быстро, упаковка надёжная. Рекомендую.", createdAt: ago(4_200) },
    { dealId: dWatch!.id, authorId: PETR, targetId: IGOR, targetRole: "buyer", rating: "positive", text: "Оплата в тот же день, спасибо!", createdAt: ago(4_100) },
  ]);

  await db.insert(messages).values([
    { conversationId: annaPetr!.id, senderId: ANNA, lotId: ids.postcard!, text: "Здравствуйте! Можно отправить открытку в жёстком конверте?", createdAt: ago(5_500) },
    { conversationId: annaPetr!.id, senderId: PETR, text: "Да, конечно, положу между картоном.", createdAt: ago(5_400) },
    { conversationId: annaPetr!.id, senderId: PETR, isSystem: true, dealId: dPostcard!.id, text: "Продавец отметил отправку. Трек-номер: 80085234123456", createdAt: ago(1_200) },
    { conversationId: annaPetr!.id, senderId: ANNA, text: "Спасибо, жду!", createdAt: ago(90) },
    { conversationId: petrOlga!.id, senderId: PETR, lotId: ids["watch-dome"]!, text: "Ольга, добрый день. Пришлите, пожалуйста, реквизиты для оплаты.", createdAt: ago(2_000) },
    { conversationId: petrOlga!.id, senderId: OLGA, text: "Добрый! Отправила в личном сообщении, жду оплату до пятницы.", createdAt: ago(1_500) },
    { conversationId: igorPetr!.id, senderId: IGOR, lotId: ids.watch!, text: "Часы получил, всё отлично.", createdAt: ago(4_300) },
    { conversationId: igorPetr!.id, senderId: IGOR, lotId: ids.stamp!, text: "Добавьте, пожалуйста, марки в ту же посылку, что и в прошлый раз — в кляссере.", createdAt: ago(3_950) },
    { conversationId: igorPetr!.id, senderId: PETR, isSystem: true, dealId: dStamp!.id, text: "Продавец отметил отправку. Трек-номер: 80085234198765", createdAt: ago(3_000) },
  ]);

  await db.insert(questions).values([
    { lotId: ids.coin!, askerId: IGOR, text: "Есть ли сертификат подлинности?", answer: "Да, монета в слабе ННР, фото сертификата пришлю по запросу.", answeredAt: ago(500), createdAt: ago(700) },
    { lotId: ids.samovar!, askerId: ANNA, text: "Внутри есть полуда?", answer: "Полуда частично сохранилась, течи нет.", answeredAt: ago(800), createdAt: ago(1_000) },
  ]);
  await db.insert(offers).values({ lotId: ids.cover!, buyerId: ANNA, price: rub(950), message: "Возьму сразу, если уступите.", createdAt: ago(180) });

  await db.insert(favorites).values([
    { userId: PETR, lotId: ids.matryoshka! },
    { userId: PETR, lotId: ids.enamel! },
    { userId: PETR, lotId: ids.gramophone! },
  ]);
  await db.insert(lotViews).values(
    ["teapot", "enamel", "matryoshka", "gramophone", "podstakannik"].map((k, i) => ({ userId: PETR, lotId: ids[k]!, viewedAt: ago(30 + i * 60) })),
  );
  await db.insert(sellerSubscriptions).values({ subscriberId: PETR, sellerId: OLGA });
  await db.insert(savedSearches).values({ userId: PETR, name: "Самовары", filters: { q: "самовар" } });

  await db.insert(notifications).values([
    { userId: PETR, type: "outbid", title: "Вашу ставку перебили", body: "Сахарница серебряная с крышкой, XIX век — новая цена 32 000 ₽", link: `/lots/${ids.sugar}`, createdAt: ago(200) },
    { userId: PETR, type: "offer", title: "Новое предложение цены", body: "Заказной конверт: 950 ₽ от Коллекционер Анна", link: "/cabinet/offers", createdAt: ago(180) },
    { userId: PETR, type: "question", title: "Вопрос по лоту", body: "5 рублей 1899 года: «Есть ли сертификат подлинности?»", link: `/lots/${ids.coin}`, createdAt: ago(700), readAt: ago(600) },
    { userId: PETR, type: "won", title: "Вы выиграли торги", body: "Карманные часы под стеклянным колпаком — 6 200 ₽", link: "/cabinet/deals", createdAt: ago(2_800), readAt: ago(2_700) },
  ]);

  await db.insert(complaints).values({ reporterId: ANNA, targetType: "lot", targetId: String(ids.teapot), reason: "Похоже на позднюю реплику, на фото нет клейма." });
  await db.insert(buyoutRequests).values({
    userId: ANNA,
    title: "Коллекция значков «Города СССР», 120 шт.",
    description: "Альбом со значками, большинство в хорошем состоянии.",
    size: "Альбом А4",
    desiredPrice: rub(12_000),
  });
}
