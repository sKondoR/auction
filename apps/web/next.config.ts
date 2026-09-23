import type { NextConfig } from "next";

process.loadEnvFile?.("../../.env");

const config: NextConfig = {
  // Пакеты монорепозитория экспортируют исходники на TS.
  transpilePackages: ["@auction/domain", "@auction/db", "@auction/services"],
  // dev запускается на webpack (`next dev --webpack`): Turbopack создаёт на внешние
  // пакеты junction-ссылки в .next, а на этой Windows-машине это падает с «Access is denied».
  // Эти пакеты должны быть прямыми зависимостями web — иначе webpack начнёт их бандлить.
  serverExternalPackages: ["sharp", "ioredis", "postgres", "nodemailer"],
  experimental: {
    serverActions: { bodySizeLimit: "20mb" },
  },
};

export default config;
