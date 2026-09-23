/**
 * Начальные данные для локальной разработки: дерево категорий с атрибутами,
 * настройки площадки, служебный аккаунт, сотрудники и демо-лоты.
 * Идемпотентен: повторный запуск не создаёт дубликатов.
 */
import { DAY_MS, MINUTE_MS, rub } from "@auction/domain";
import { eq } from "drizzle-orm";
import { createDb } from "./client";
import { bids, categories, categoryAttributes, lots, user } from "./schema";
import { DEFAULT_SETTINGS, type PlatformSettings, setSetting } from "./settings";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL не задан");
const { db, sql } = createDb(url, { max: 1 });

type Attr = { key: string; name: string; type?: "text" | "number" | "select"; options?: string[]; unit?: string };
type Cat = { slug: string; name: string; attrs?: Attr[]; children?: Cat[] };

const condition: Attr = {
  key: "condition",
  name: "Сохранность",
  type: "select",
  options: ["UNC", "AU", "XF", "VF", "F", "VG", "G"],
};

const TREE: Cat[] = [
  {
    slug: "coins",
    name: "Монеты",
    attrs: [
      { key: "year", name: "Год", type: "number" },
      { key: "denomination", name: "Номинал" },
      { key: "metal", name: "Металл", type: "select", options: ["Золото", "Серебро", "Медь", "Биллон", "Никель", "Другой"] },
      condition,
    ],
    children: [
      { slug: "coins-russia-empire", name: "Российская империя" },
      { slug: "coins-ussr", name: "СССР" },
      { slug: "coins-russia", name: "Современная Россия" },
      { slug: "coins-world", name: "Иностранные монеты" },
      { slug: "coins-ancient", name: "Античные монеты" },
    ],
  },
  {
    slug: "banknotes",
    name: "Банкноты",
    attrs: [
      { key: "year", name: "Год", type: "number" },
      { key: "denomination", name: "Номинал" },
      { key: "condition", name: "Состояние", type: "select", options: ["UNC", "aUNC", "XF", "VF", "F", "VG"] },
    ],
    children: [
      { slug: "banknotes-russia", name: "Россия и СССР" },
      { slug: "banknotes-world", name: "Иностранные банкноты" },
    ],
  },
  {
    slug: "stamps",
    name: "Марки",
    attrs: [
      { key: "year", name: "Год", type: "number" },
      { key: "country", name: "Страна" },
      { key: "cancelled", name: "Гашение", type: "select", options: ["Чистая", "Гашёная"] },
    ],
  },
  {
    slug: "medals",
    name: "Знаки, медали, значки",
    attrs: [
      { key: "material", name: "Материал" },
      { key: "period", name: "Период" },
    ],
  },
  {
    slug: "antiques",
    name: "Антиквариат",
    attrs: [
      { key: "period", name: "Период", type: "select", options: ["до 1800", "1800–1917", "1917–1945", "1945–1991", "после 1991"] },
      { key: "material", name: "Материал" },
    ],
    children: [
      { slug: "antiques-porcelain", name: "Фарфор и керамика" },
      { slug: "antiques-silver", name: "Серебро" },
      { slug: "antiques-icons", name: "Иконы" },
      { slug: "antiques-furniture", name: "Мебель" },
      { slug: "antiques-clocks", name: "Часы" },
    ],
  },
  {
    slug: "postcards",
    name: "Открытки и фотографии",
    attrs: [{ key: "year", name: "Год", type: "number" }],
  },
  {
    slug: "books",
    name: "Букинистика",
    attrs: [
      { key: "year", name: "Год издания", type: "number" },
      { key: "author", name: "Автор" },
    ],
  },
];

async function upsertCategory(c: Cat, parentId: number | null, position: number): Promise<void> {
  const [existing] = await db.select().from(categories).where(eq(categories.slug, c.slug));
  const id =
    existing?.id ??
    (await db.insert(categories).values({ slug: c.slug, name: c.name, parentId, position }).returning())[0]!.id;
  for (const [i, a] of (c.attrs ?? []).entries()) {
    await db
      .insert(categoryAttributes)
      .values({ categoryId: id, key: a.key, name: a.name, type: a.type ?? "text", options: a.options ?? null, unit: a.unit ?? null, position: i })
      .onConflictDoNothing();
  }
  for (const [i, child] of (c.children ?? []).entries()) await upsertCategory(child, id, i);
}

async function upsertUser(p: { id: string; name: string; phone: string; role?: string; isService?: boolean; city?: string }) {
  await db
    .insert(user)
    .values({
      id: p.id,
      name: p.name,
      email: `${p.phone.replace("+", "")}@phone.local`,
      phoneNumber: p.phone,
      phoneNumberVerified: true,
      role: p.role ?? "user",
      isService: p.isService ?? false,
      city: p.city ?? "Москва",
    })
    .onConflictDoUpdate({ target: user.id, set: { role: p.role ?? "user", name: p.name } });
}

for (const [i, c] of TREE.entries()) await upsertCategory(c, null, i);
for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
  await setSetting(db, key as keyof PlatformSettings, value as never);
}

// Служебный аккаунт и сотрудники. Вход — по телефону, SMS-код печатается в консоль web.
await upsertUser({ id: "service", name: "Площадка", phone: "+70000000000", isService: true });
await upsertUser({ id: "staff-admin", name: "Администратор", phone: "+79990000001", role: "admin" });
await upsertUser({ id: "staff-moderator", name: "Модератор", phone: "+79990000002", role: "moderator" });
await upsertUser({ id: "staff-appraiser", name: "Оценщик", phone: "+79990000003", role: "appraiser" });
await upsertUser({ id: "demo-seller", name: "Нумизмат Пётр", phone: "+79991111111", city: "Санкт-Петербург" });
await upsertUser({ id: "demo-buyer", name: "Коллекционер Анна", phone: "+79992222222", city: "Москва" });

// Демо-лоты — только если их ещё нет.
const [anyLot] = await db.select({ id: lots.id }).from(lots).limit(1);
if (!anyLot) {
  const cat = async (slug: string) => (await db.select().from(categories).where(eq(categories.slug, slug)))[0]!.id;
  const now = Date.now();
  const lot = (p: Partial<typeof lots.$inferInsert> & { title: string; categoryId: number; startPrice: number; days: number }) => {
    const endsAt = new Date(now + p.days * DAY_MS);
    const { days: _d, ...rest } = p;
    return {
      sellerId: "demo-seller",
      format: "english" as const,
      city: "Санкт-Петербург",
      deliveryMethods: ["post", "cdek"],
      deliveryCost: "Почта — 350 ₽, СДЭК — по тарифу",
      startsAt: new Date(now - DAY_MS),
      endsAt,
      originalEndsAt: endsAt,
      ...rest,
    };
  };
  const created = await db
    .insert(lots)
    .values([
      lot({
        title: "1 рубль 1924 года, ПЛ, серебро",
        description: "Серебряный рубль 1924 года. Состояние на фото. Оригинал, гарантия подлинности.",
        categoryId: await cat("coins-ussr"),
        attributes: { year: 1924, denomination: "1 рубль", metal: "Серебро", condition: "XF" },
        startPrice: rub(1),
        blitzPrice: rub(15_000),
        days: 3,
      }),
      lot({
        title: "5 копеек 1911 СПБ ЭБ",
        description: "Медная монета Российской империи, хорошая сохранность, приятная патина.",
        categoryId: await cat("coins-russia-empire"),
        attributes: { year: 1911, denomination: "5 копеек", metal: "Медь", condition: "VF" },
        startPrice: rub(500),
        days: 0.01, // ~15 минут: для проверки продления торгов и финализации
      }),
      lot({
        title: "Рубль 1898 АГ, Николай II",
        description: "Серебро 900 пробы. Небольшие потёртости, без дефектов гурта.",
        categoryId: await cat("coins-russia-empire"),
        attributes: { year: 1898, denomination: "1 рубль", metal: "Серебро", condition: "VF" },
        startPrice: rub(20_000),
        days: 7,
      }),
      lot({
        format: "fixed",
        title: "Набор разменных монет СССР 1961–1991, 150 шт.",
        description: "Погодовка, все монеты в альбоме. Состояние разное. Продаю по фиксированной цене, рассмотрю предложения.",
        categoryId: await cat("coins-ussr"),
        attributes: { metal: "Никель" },
        startPrice: rub(3_500),
        quantity: 3,
        allowOffers: true,
        days: 30,
      }),
      lot({
        format: "fixed",
        title: "Банкнота 100 рублей 1910 года, «Катенька»",
        description: "Государственный кредитный билет, подписи Шипов — Метц.",
        categoryId: await cat("banknotes-russia"),
        attributes: { year: 1910, denomination: "100 рублей", condition: "VF" },
        startPrice: rub(4_200),
        days: 2,
      }),
      lot({
        title: "Фарфоровая статуэтка ЛФЗ «Балерина», 1950-е",
        description: "Ленинградский фарфоровый завод, клеймо на донце. Без сколов и реставрации. Высота 24 см.",
        categoryId: await cat("antiques-porcelain"),
        attributes: { period: "1945–1991", material: "Фарфор" },
        startPrice: rub(2_000),
        blitzPrice: rub(12_000),
        days: 5,
      }),
      lot({
        format: "fixed",
        title: "Марка «Первый полёт в космос» 1961, чистая",
        description: "Почтовая марка СССР, без наклейки, клей оригинальный.",
        categoryId: await cat("stamps"),
        attributes: { year: 1961, country: "СССР", cancelled: "Чистая" },
        startPrice: rub(350),
        quantity: 10,
        days: 45,
      }),
      lot({
        title: "Настенные часы Gustav Becker, начало XX века",
        description: "Механизм в рабочем состоянии, бой на гонг. Корпус орех.",
        categoryId: await cat("antiques-clocks"),
        attributes: { period: "1800–1917", material: "Дерево" },
        startPrice: rub(15_000),
        days: 10,
        autoRelist: true,
      }),
    ])
    .returning();

  // Ставка покупателя на первый лот.
  const first = created[0]!;
  await db.insert(bids).values({ lotId: first.id, bidderId: "demo-buyer", amount: rub(100), requestedAmount: rub(100), maxAmount: rub(100) });
  await db
    .update(lots)
    .set({ currentPrice: rub(100), leaderId: "demo-buyer", leaderMax: rub(100), bidCount: 1 })
    .where(eq(lots.id, first.id));
  console.log(`Создано демо-лотов: ${created.length}`);
}

console.log("Сид выполнен. Входы (SMS-код — в консоли web):");
console.log("  администратор +7 999 000-00-01, модератор …02, оценщик …03");
console.log("  продавец +7 999 111-11-11, покупатель +7 999 222-22-22");
await sql.end();
