/** Сборка дампа демо-БД: миграции + сид + демо-данные → tar.gz каталога данных PGlite. */
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { wrapDemoDb } from "./demo";
import { seedDemo } from "./demo-seed";
import { seed } from "./seed-data";

const out = process.argv[2];
if (!out) throw new Error("Укажите путь для дампа: tsx src/demo-dump.ts <файл.tar.gz>");

const pg = new PGlite();
const db = wrapDemoDb(pg);
await migrate(db as never, { migrationsFolder: fileURLToPath(new URL("../migrations", import.meta.url)) });
await seed(db, { lots: false });
await seedDemo(db);
const dump = await pg.dumpDataDir("gzip");
await writeFile(out, Buffer.from(await dump.arrayBuffer()));
await pg.close();
console.log(`Демо-БД сохранена: ${out}`);
