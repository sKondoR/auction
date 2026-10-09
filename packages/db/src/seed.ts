import { createDb } from "./client";
import { seed } from "./seed-data";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL не задан");
const { db, sql } = createDb(url, { max: 1 });
await seed(db);
await sql.end();
