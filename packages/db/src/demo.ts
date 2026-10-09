/**
 * БД статической демо-версии (GitHub Pages): PGlite — Postgres в WASM — в памяти
 * процесса. Дамп собирает `demo-dump.ts` перед `next build`; каждый процесс сборки
 * загружает его заново, поэтому записи во время рендера никуда не утекают.
 */
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import type { Db } from "./client";
import * as schema from "./schema";

export { DEMO_VIEWER_ID } from "./demo-seed";

export function wrapDemoDb(pg: PGlite): Db {
  // Драйвер другой, но API запросов drizzle общий для всех Postgres-драйверов.
  const db = drizzle(pg, { schema, casing: "snake_case" });
  // Отличие одно: execute() у postgres-js возвращает массив строк, у PGlite — { rows }.
  const execute = db.execute.bind(db);
  db.execute = (async (query: Parameters<typeof execute>[0]) => (await execute(query)).rows) as never;
  return db as unknown as Db;
}

/** Открыть БД из дампа. Синхронно: запросы сами дождутся готовности PGlite. */
export function openDemoDb(dumpPath: string): Db {
  return wrapDemoDb(new PGlite({ loadDataDir: new Blob([readFileSync(dumpPath)]) }));
}
