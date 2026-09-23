import { type PostgresJsDatabase, drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;
/** Транзакция или сама БД — сервисы принимают любое из них. */
export type DbOrTx = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

export function createDb(url: string, opts: { max?: number } = {}): { db: Db; sql: postgres.Sql } {
  const sql = postgres(url, { max: opts.max ?? 10 });
  return { db: drizzle(sql, { schema, casing: "snake_case" }), sql };
}

const globalForDb = globalThis as unknown as { __auctionDb?: { db: Db; sql: postgres.Sql } };

/** Общий экземпляр на процесс (переживает hot reload в Next.js dev). */
export function getDb(): Db {
  if (!globalForDb.__auctionDb) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL не задан");
    globalForDb.__auctionDb = createDb(url);
  }
  return globalForDb.__auctionDb.db;
}
