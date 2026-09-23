import { fileURLToPath } from "node:url";
import { type Db, categories, createDb, user } from "@auction/db";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

/**
 * Отдельная база auction_test для интеграционных тестов: создаётся при
 * необходимости, накатываются миграции, данные очищаются перед прогоном.
 */
export const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://auction:auction@localhost:5433/auction_test";

export async function setupTestDb(): Promise<{ db: Db; close: () => Promise<void> }> {
  const url = new URL(TEST_DB_URL);
  const dbName = url.pathname.slice(1);
  const adminUrl = new URL(TEST_DB_URL);
  adminUrl.pathname = "/postgres";
  const admin = postgres(adminUrl.toString(), { max: 1 });
  const exists = await admin`select 1 from pg_database where datname = ${dbName}`;
  if (exists.length === 0) await admin.unsafe(`create database "${dbName}"`);
  await admin.end();

  const { db, sql } = createDb(TEST_DB_URL, { max: 5 });
  await migrate(db, { migrationsFolder: fileURLToPath(new URL("../../db/migrations", import.meta.url)) });
  await sql.unsafe(`
    truncate table notifications, notification_preferences, reviews, ledger_entries, invoices, messages, conversations,
      deals, offers, bids, questions, lot_addenda, lot_photos, favorites, lot_views, saved_searches, seller_subscriptions,
      buyout_requests, complaints, moderation_actions, lots, category_attributes, categories, settings, session, account,
      verification, "user" restart identity cascade
  `);
  await db.insert(categories).values({ slug: "coins", name: "Монеты" });
  await db.insert(user).values([
    { id: "service", name: "Площадка", email: "service@test", isService: true, phoneNumberVerified: true },
    { id: "seller", name: "Продавец", email: "seller@test", phoneNumber: "+70000000001", phoneNumberVerified: true, notifyEmail: "seller@test.ru" },
    { id: "alice", name: "Алиса", email: "alice@test", phoneNumber: "+70000000002", phoneNumberVerified: true },
    { id: "bob", name: "Боб", email: "bob@test", phoneNumber: "+70000000003", phoneNumberVerified: true },
    { id: "carol", name: "Кэрол", email: "carol@test", phoneNumber: "+70000000004", phoneNumberVerified: true },
    { id: "unverified", name: "Без телефона", email: "u@test" },
  ]);
  return { db, close: () => sql.end() };
}
