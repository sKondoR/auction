/**
 * Локальные данные для «Топа сделок недели»: 12 завершённых лотов с фото (по три на формат торгов)
 * и сделки по ним за последние дни. Фото берутся из концепта frontend-ideas/09 и загружаются в S3 (MinIO).
 * Повторный запуск не дублирует лоты: существующие названия пропускаются.
 *
 *   pnpm --filter @auction/services seed:top-deals
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { categories, createDb, deals, lotPhotos, lots } from "@auction/db";
import { DAY_MS, type LotFormat, MINUTE_MS, rub } from "@auction/domain";
import { inArray } from "drizzle-orm";
import { storeImage } from "../src/infra/storage";

type Source = "auction" | "blitz" | "fixed" | "offer";

interface SeedDeal {
  format: LotFormat;
  photo: string;
  category: string;
  title: string;
  start: number;
  price: number;
  bids: number;
  source: Source;
  /** Сколько дней назад завершились торги. */
  daysAgo: number;
  extended?: boolean;
}

const SEED: SeedDeal[] = [
  { format: "english", photo: "bill", category: "banknotes", title: "25 рублей 1899, Тимашев, надпечатка «Образец»", start: 1, price: 86_500, bids: 64, source: "auction", daysAgo: 1.2, extended: true },
  { format: "english", photo: "gramophone", category: "antiques-musical", title: "Граммофон с трубой, рабочий, пластинки в комплекте", start: 5_000, price: 45_000, bids: 9, source: "blitz", daysAgo: 2.5 },
  { format: "english", photo: "coin", category: "coins", title: "5 рублей 1899, ЭБ, золото", start: 1, price: 41_200, bids: 48, source: "auction", daysAgo: 3.1 },
  { format: "dutch", photo: "teapot", category: "antiques-porcelain", title: "Чайник фарфоровый, роспись эмалями, ручка-бамбук", start: 90_000, price: 52_000, bids: 0, source: "auction", daysAgo: 0.6 },
  { format: "dutch", photo: "sugar", category: "antiques-silver", title: "Сахарница с крышкой, серебро 84 пробы", start: 40_000, price: 27_500, bids: 0, source: "auction", daysAgo: 4.2 },
  { format: "dutch", photo: "kerosene", category: "antiques-lighting", title: "Лампа керосиновая, бронза, стекло родное", start: 24_000, price: 14_200, bids: 0, source: "auction", daysAgo: 2.8 },
  { format: "live", photo: "peacock", category: "antiques-glass", title: "Витраж «Павлин», тиффани, в дубовой раме", start: 40_000, price: 124_000, bids: 27, source: "auction", daysAgo: 1.7 },
  { format: "live", photo: "matryoshka", category: "toys-games", title: "Матрёшки, ранний набор из 6 штук, роспись", start: 12_000, price: 38_000, bids: 22, source: "auction", daysAgo: 1.75 },
  { format: "live", photo: "watch", category: "antiques-clocks", title: "Карманные часы «Павел Буре», серебро", start: 8_000, price: 24_800, bids: 19, source: "auction", daysAgo: 0.4 },
  { format: "fixed", photo: "samovar", category: "antiques-household", title: "Самовар «рюмка», Тула, клеймо фабрики", start: 32_000, price: 32_000, bids: 0, source: "fixed", daysAgo: 5.1 },
  { format: "fixed", photo: "watch-dome", category: "antiques-clocks", title: "Часы карманные с колпаком-витриной", start: 21_000, price: 18_500, bids: 0, source: "offer", daysAgo: 3.4 },
  { format: "fixed", photo: "enamel", category: "antiques-icons", title: "Фрагмент оклада, перегородчатая эмаль", start: 15_500, price: 14_000, bids: 0, source: "offer", daysAgo: 4.6 },
];

const SELLER = "demo-seller";
const BUYER = "demo-buyer";
const photos = fileURLToPath(new URL("../../../frontend-ideas/09/img/", import.meta.url));

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL не задан");
const { db, sql } = createDb(url, { max: 1 });

const existing = new Set(
  (await db.select({ title: lots.title }).from(lots).where(inArray(lots.title, SEED.map((s) => s.title)))).map((r) => r.title),
);
const catRows = await db.select({ id: categories.id, slug: categories.slug }).from(categories);
const cat = (slug: string) => {
  const hit = catRows.find((c) => c.slug === slug);
  if (!hit) throw new Error(`Нет категории ${slug}: запустите pnpm db:seed`);
  return hit.id;
};

const now = Date.now();
let created = 0;
for (const s of SEED) {
  if (existing.has(s.title)) continue;
  const endsAt = new Date(now - s.daysAgo * DAY_MS);
  const originalEndsAt = s.extended ? new Date(endsAt.getTime() - 15 * MINUTE_MS) : endsAt;
  const price = rub(s.price);
  const image = await storeImage(await readFile(`${photos}${s.photo}.webp`), `lots/${SELLER}`);

  await db.transaction(async (tx) => {
    const [lot] = await tx
      .insert(lots)
      .values({
        sellerId: SELLER,
        categoryId: cat(s.category),
        format: s.format,
        status: "sold",
        title: s.title,
        description: "Лот для проверки «Топа сделок недели».",
        city: "Санкт-Петербург",
        deliveryMethods: ["post", "cdek"],
        startPrice: rub(s.start),
        currentPrice: s.bids ? price : null,
        leaderId: s.bids ? BUYER : null,
        leaderMax: s.bids ? price : null,
        bidCount: s.bids,
        blitzPrice: s.source === "blitz" ? price : null,
        quantitySold: 1,
        startsAt: new Date(endsAt.getTime() - 7 * DAY_MS),
        endsAt,
        originalEndsAt,
        finalizedAt: endsAt,
      })
      .returning({ id: lots.id });
    await tx.insert(lotPhotos).values({ lotId: lot!.id, ownerId: SELLER, key: image.key, thumbKey: image.thumbKey, width: image.width, height: image.height });
    await tx.insert(deals).values({
      lotId: lot!.id,
      sellerId: SELLER,
      buyerId: BUYER,
      unitPrice: price,
      totalPrice: price,
      status: "paid",
      source: s.source,
      createdAt: endsAt,
      paidAt: new Date(endsAt.getTime() + 3 * 60 * MINUTE_MS),
    });
  });
  created++;
}

console.log(`Сделок для топа создано: ${created}, уже были: ${existing.size}`);
await sql.end();
