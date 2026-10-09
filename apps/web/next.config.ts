import { resolve } from "node:path";
import type { NextConfig } from "next";

/**
 * DEMO=1 — статическая демо-версия для GitHub Pages (`pnpm build:pages`): данные из
 * встроенной БД PGlite, Server Actions заменены заглушками, API-маршрутов нет.
 */
const isDemo = process.env.DEMO === "1";

if (!isDemo) process.loadEnvFile?.("../../.env");

const config: NextConfig = {
  // Пакеты монорепозитория экспортируют исходники на TS.
  transpilePackages: ["@auction/domain", "@auction/db", "@auction/services"],
  // dev запускается на webpack (`next dev --webpack`): Turbopack создаёт на внешние
  // пакеты junction-ссылки в .next, а на этой Windows-машине это падает с «Access is denied».
  // Эти пакеты должны быть прямыми зависимостями web — иначе webpack начнёт их бандлить.
  serverExternalPackages: ["sharp", "ioredis", "postgres", "nodemailer", "@electric-sql/pglite"],
  experimental: {
    serverActions: { bodySizeLimit: "20mb" },
  },
};

function demoConfig(base: NextConfig): NextConfig {
  // Сайт проекта на GitHub Pages живёт в подкаталоге: https://<user>.github.io/<repo>/.
  const basePath = process.env.DEMO_BASE_PATH ?? "";
  // Фото демо-лотов копируются в out/demo/ (см. demo/build-pages.mjs).
  process.env.S3_PUBLIC_URL = basePath;
  process.env.DEMO_DB = resolve(".demo/db.tar.gz");
  return {
    ...base,
    output: "export",
    basePath,
    trailingSlash: true,
    // Без .ts из сборки выпадают route.ts (API, SSE, загрузка фото); .js нужен
    // встроенным страницам Next.
    pageExtensions: ["tsx", "js"],
    images: { unoptimized: true },
    env: { NEXT_PUBLIC_DEMO: "1" },
    webpack(config, { webpack }) {
      const replace = (from: RegExp, to: string) => new webpack.NormalModuleReplacementPlugin(from, resolve(to));
      config.plugins.push(
        replace(/packages[\\/]db[\\/]src[\\/]client\.ts$/, "demo/db-client.ts"),
        replace(/src[\\/]shared[\\/]api[\\/]session\.ts$/, "demo/session.ts"),
        replace(/src[\\/]shared[\\/]api[\\/]auth\.ts$/, "demo/auth.ts"),
      );
      config.module.rules.unshift({
        test: /[\\/]api[\\/]actions\.ts$/,
        enforce: "pre",
        use: resolve("demo/stub-actions-loader.cjs"),
      });
      return config;
    },
  };
}

export default isDemo ? demoConfig(config) : config;
