/**
 * Начальные данные: дерево категорий из categories.ts с атрибутами, настройки площадки,
 * служебный аккаунт, сотрудники и демо-лоты.
 * Идемпотентен: повторный запуск не создаёт дубликатов.
 */
import { DAY_MS, MINUTE_MS, rub } from "@auction/domain";
import { eq, inArray, sql } from "drizzle-orm";
import { CATEGORY_TREE, type CategoryNode } from "./categories";
import type { Db, DbOrTx } from "./client";
import { bids, categories, categoryAttributes, lots, savedSearches, user } from "./schema";
import { DEFAULT_SETTINGS, type PlatformSettings, setSetting } from "./settings";

type Attr = { key: string; name: string; type?: "text" | "number" | "select"; options?: string[]; unit?: string };

const condition: Attr = {
  key: "condition",
  name: "Сохранность",
  type: "select",
  options: ["UNC", "AU", "XF", "VF", "F", "VG", "G"],
};

/** Атрибуты фильтров по slug. Категория получает свои атрибуты и атрибуты родителя. */
const ATTRS: Record<string, Attr[]> = {
  antiques: [
    { key: "period", name: "Период", type: "select", options: ["до 1800", "1800–1917", "1917–1945", "1945–1991", "после 1991"] },
    { key: "material", name: "Материал" },
  ],
  "antiques-books": [
    { key: "year", name: "Год издания", type: "number" },
    { key: "author", name: "Автор" },
  ],
  coins: [
    { key: "year", name: "Год", type: "number" },
    { key: "denomination", name: "Номинал" },
    { key: "metal", name: "Металл", type: "select", options: ["Золото", "Серебро", "Медь", "Биллон", "Никель", "Другой"] },
    condition,
  ],
  banknotes: [
    { key: "year", name: "Год", type: "number" },
    { key: "denomination", name: "Номинал" },
    { key: "condition", name: "Состояние", type: "select", options: ["UNC", "aUNC", "XF", "VF", "F", "VG"] },
  ],
  stamps: [
    { key: "year", name: "Год", type: "number" },
    { key: "country", name: "Страна" },
    { key: "cancelled", name: "Гашение", type: "select", options: ["Чистая", "Гашёная"] },
  ],
  medals: [
    { key: "material", name: "Материал" },
    { key: "period", name: "Период" },
  ],
  postcards: [{ key: "year", name: "Год", type: "number" }],
};

/** Куда уходят лоты и сохранённые поиски из категорий прежнего дерева, которых нет в CATEGORY_TREE. */
const RETIRED: Record<string, string> = {
  books: "antiques-books",
};
/** Категория для удаляемых, у которых нет ни записи в RETIRED, ни предка в новом дереве. */
const RETIRED_FALLBACK = "collectibles-other";

async function upsertCategory(db: DbOrTx, c: CategoryNode, parentId: number | null, position: number): Promise<void> {
  const [row] = await db
    .insert(categories)
    .values({ slug: c.slug, name: c.name, parentId, position })
    .onConflictDoUpdate({ target: categories.slug, set: { name: c.name, parentId, position } })
    .returning({ id: categories.id });
  const id = row!.id;
  for (const [i, a] of (ATTRS[c.slug] ?? []).entries()) {
    await db
      .insert(categoryAttributes)
      .values({ categoryId: id, key: a.key, name: a.name, type: a.type ?? "text", options: a.options ?? null, unit: a.unit ?? null, position: i })
      .onConflictDoNothing();
  }
  for (const [i, child] of (c.children ?? []).entries()) await upsertCategory(db, child, id, i);
}

/**
 * Приводит таблицу категорий к CATEGORY_TREE: создаёт и обновляет узлы по slug (id сохраняются),
 * а категории не из дерева удаляет. Их лоты и сохранённые поиски переходят в категорию из RETIRED,
 * иначе в ближайшего предка, оставшегося в дереве, иначе в RETIRED_FALLBACK.
 */
export async function syncCategories(db: Db): Promise<void> {
  await db.transaction(async (tx) => {
    for (const [i, c] of CATEGORY_TREE.entries()) await upsertCategory(tx, c, null, i);

    const keep = new Set<string>();
    const walk = (nodes: CategoryNode[]) => {
      for (const n of nodes) {
        keep.add(n.slug);
        walk(n.children ?? []);
      }
    };
    walk(CATEGORY_TREE);

    const rows = await tx.select({ id: categories.id, slug: categories.slug, parentId: categories.parentId }).from(categories);
    const byId = new Map(rows.map((r) => [r.id, r]));
    const idBySlug = new Map(rows.map((r) => [r.slug, r.id]));
    const target = (r: (typeof rows)[number]): number => {
      if (RETIRED[r.slug]) return idBySlug.get(RETIRED[r.slug]!)!;
      for (let p = r.parentId ? byId.get(r.parentId) : undefined; p; p = p.parentId ? byId.get(p.parentId) : undefined) {
        if (keep.has(p.slug)) return p.id;
      }
      return idBySlug.get(RETIRED_FALLBACK)!;
    };

    const retired = rows.filter((r) => !keep.has(r.slug));
    for (const r of retired) {
      const to = target(r);
      await tx.update(lots).set({ categoryId: to }).where(eq(lots.categoryId, r.id));
      await tx
        .update(savedSearches)
        .set({ filters: sql`jsonb_set(${savedSearches.filters}, '{categoryId}', to_jsonb(${to}::int))` })
        .where(sql`(${savedSearches.filters}->>'categoryId')::int = ${r.id}`);
    }
    if (retired.length) await tx.delete(categories).where(inArray(categories.id, retired.map((r) => r.id)));
  });
}

async function upsertUser(db: Db, p: { id: string; name: string; phone: string; role?: string; isService?: boolean; city?: string }) {
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

/** `lots: false` — без демо-лотов (их создаёт демо-сид для GitHub Pages). */
export async function seed(db: Db, opts: { lots?: boolean } = {}): Promise<void> {
  await syncCategories(db);
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await setSetting(db, key as keyof PlatformSettings, value as never);
  }

  // Служебный аккаунт и сотрудники. Вход — по телефону, SMS-код печатается в консоль web.
  await upsertUser(db, { id: "service", name: "Площадка", phone: "+70000000000", isService: true });
  await upsertUser(db, { id: "staff-admin", name: "Администратор", phone: "+79990000001", role: "admin" });
  await upsertUser(db, { id: "staff-moderator", name: "Модератор", phone: "+79990000002", role: "moderator" });
  await upsertUser(db, { id: "staff-appraiser", name: "Оценщик", phone: "+79990000003", role: "appraiser" });
  await upsertUser(db, { id: "demo-seller", name: "Нумизмат Пётр", phone: "+79991111111", city: "Санкт-Петербург" });
  await upsertUser(db, { id: "demo-buyer", name: "Коллекционер Анна", phone: "+79992222222", city: "Москва" });

  // Демо-лоты — только если их ещё нет.
  const [anyLot] = await db.select({ id: lots.id }).from(lots).limit(1);
  if (!anyLot && opts.lots !== false) {
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
          categoryId: await cat("coins"),
          attributes: { year: 1924, denomination: "1 рубль", metal: "Серебро", condition: "XF" },
          startPrice: rub(1),
          blitzPrice: rub(15_000),
          days: 3,
        }),
        lot({
          title: "5 копеек 1911 СПБ ЭБ",
          description: "Медная монета Российской империи, хорошая сохранность, приятная патина.",
          categoryId: await cat("coins"),
          attributes: { year: 1911, denomination: "5 копеек", metal: "Медь", condition: "VF" },
          startPrice: rub(500),
          days: 0.01, // ~15 минут: для проверки продления торгов и финализации
        }),
        lot({
          title: "Рубль 1898 АГ, Николай II",
          description: "Серебро 900 пробы. Небольшие потёртости, без дефектов гурта.",
          categoryId: await cat("coins"),
          attributes: { year: 1898, denomination: "1 рубль", metal: "Серебро", condition: "VF" },
          startPrice: rub(20_000),
          days: 7,
        }),
        lot({
          format: "fixed",
          title: "Набор разменных монет СССР 1961–1991, 150 шт.",
          description: "Погодовка, все монеты в альбоме. Состояние разное. Продаю по фиксированной цене, рассмотрю предложения.",
          categoryId: await cat("coins"),
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
          categoryId: await cat("banknotes"),
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
}
