/**
 * Подмена packages/db/src/client.ts в демо-сборке: вместо Postgres — PGlite из дампа.
 * Экспорты повторяют оригинал.
 */
import type { Db } from "@auction/db";
import { openDemoDb } from "@auction/db/demo";

export type { Db, DbOrTx } from "@auction/db";

const globalForDb = globalThis as unknown as { __auctionDemoDb?: Db };

export function createDb(): never {
  throw new Error("В демо-сборке подключение к Postgres недоступно");
}

export function getDb(): Db {
  const dump = process.env.DEMO_DB;
  if (!dump) throw new Error("DEMO_DB не задан");
  globalForDb.__auctionDemoDb ??= openDemoDb(dump);
  return globalForDb.__auctionDemoDb;
}
