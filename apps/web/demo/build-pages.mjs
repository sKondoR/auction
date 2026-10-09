/**
 * Статическая демо-версия для GitHub Pages: дамп демо-БД → `next build` (static export)
 * → фото лотов в out/demo/. Запуск: `pnpm --filter @auction/web build:pages`.
 * DEMO_BASE_PATH — подкаталог сайта, например `/auction`.
 */
import { execSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const web = fileURLToPath(new URL("..", import.meta.url));
const db = fileURLToPath(new URL("../../../packages/db", import.meta.url));
const run = (cwd, cmd, env = {}) => execSync(cmd, { cwd, stdio: "inherit", env: { ...process.env, ...env } });

mkdirSync(join(web, ".demo"), { recursive: true });
run(db, `pnpm exec tsx src/demo-dump.ts "${join(web, ".demo/db.tar.gz")}"`);

const out = join(web, "out");
rmSync(out, { recursive: true, force: true });
run(web, "pnpm exec next build --webpack", { DEMO: "1" });

cpSync(join(web, "demo/photos"), join(out, "demo"), { recursive: true });
// Без .nojekyll GitHub Pages не отдаёт каталог _next.
writeFileSync(join(out, ".nojekyll"), "");
console.log("Готово: apps/web/out");
