import { defineConfig } from "drizzle-kit";

process.loadEnvFile?.("../../.env");

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./migrations",
  casing: "snake_case",
  dbCredentials: { url: process.env.DATABASE_URL ?? "postgres://auction:auction@localhost:5433/auction" },
});
