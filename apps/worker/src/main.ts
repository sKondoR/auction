/**
 * Фоновые задачи площадки (BullMQ).
 *
 * Состояние торгов вычисляется из времени (ADR 0003), поэтому worker только
 * финализирует завершившиеся лоты: точные отложенные задачи на момент окончания
 * + периодическое «подметание» на случай сбоев очереди.
 */
import { getDb } from "@auction/db";
import {
  checkSavedSearches,
  finalizeLot,
  issueMonthlyInvoices,
  lotsEndingBefore,
  markOverdueInvoices,
  sendExpiryReminders,
  sweepEndedLots,
} from "@auction/services";
import { type Job, Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { flushEmailOutbox } from "./email-outbox";

const QUEUE = "auction";
const TZ = "Europe/Moscow";
const connection = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", { maxRetriesPerRequest: null });
const queue = new Queue(QUEUE, { connection });
const db = getDb();

type JobName =
  | "schedule-finalizations"
  | "finalize-lot"
  | "sweep"
  | "expiry-reminders"
  | "issue-invoices"
  | "overdue-invoices"
  | "saved-searches"
  | "email-outbox";

/** Планирует точные задачи финализации для лотов, заканчивающихся в ближайшую минуту. */
async function scheduleFinalizations(): Promise<number> {
  const horizon = new Date(Date.now() + 60_000);
  const due = await lotsEndingBefore(db, horizon);
  for (const lot of due) {
    const delay = Math.max(0, lot.endsAt.getTime() - Date.now());
    // jobId учитывает время окончания: при продлении торгов появится новая задача,
    // а старая отработает вхолостую (финализация идемпотентна и проверяет время).
    await queue.add(
      "finalize-lot",
      { lotId: lot.id },
      { delay, jobId: `finalize-${lot.id}-${lot.endsAt.getTime()}`, removeOnComplete: 1000, removeOnFail: 1000 },
    );
  }
  return due.length;
}

const handlers: Record<JobName, (job: Job) => Promise<unknown>> = {
  "schedule-finalizations": () => scheduleFinalizations(),
  "finalize-lot": (job) => finalizeLot(db, (job.data as { lotId: number }).lotId),
  sweep: () => sweepEndedLots(db),
  "expiry-reminders": () => sendExpiryReminders(db),
  "issue-invoices": () => issueMonthlyInvoices(db),
  "overdue-invoices": () => markOverdueInvoices(db),
  "saved-searches": () => checkSavedSearches(db),
  "email-outbox": () => flushEmailOutbox(db),
};

async function registerSchedulers(): Promise<void> {
  const every = (name: JobName, ms: number) =>
    queue.upsertJobScheduler(name, { every: ms }, { name, opts: { removeOnComplete: 100, removeOnFail: 500 } });
  const cron = (name: JobName, pattern: string) =>
    queue.upsertJobScheduler(name, { pattern, tz: TZ }, { name, opts: { removeOnComplete: 100, removeOnFail: 500 } });

  await every("schedule-finalizations", 30_000);
  await every("sweep", 60_000);
  await every("email-outbox", 15_000);
  await every("saved-searches", 10 * 60_000);
  await cron("expiry-reminders", "0 0 * * * *"); // каждый час
  await cron("issue-invoices", "0 5 0 1 * *"); // 1-го числа в 00:05 МСК
  await cron("overdue-invoices", "0 15 0 * * *"); // ежедневно в 00:15 МСК
}

const worker = new Worker(
  QUEUE,
  async (job) => {
    const handler = handlers[job.name as JobName];
    if (!handler) throw new Error(`Неизвестная задача: ${job.name}`);
    const result = await handler(job);
    if (typeof result === "number" && result > 0) console.log(`[${job.name}] обработано: ${result}`);
    else if (typeof result === "string" && result !== "skipped") console.log(`[${job.name}] ${job.data?.lotId}: ${result}`);
    return result;
  },
  { connection, concurrency: 4 },
);

worker.on("failed", (job, err) => console.error(`[${job?.name}] ошибка`, err));

await registerSchedulers();
// Сразу после старта — подметаем всё, что закончилось, пока worker не работал.
await queue.add("sweep", {}, { removeOnComplete: true });
console.log("Worker запущен");

async function shutdown() {
  console.log("Остановка worker…");
  await worker.close();
  await queue.close();
  await connection.quit();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
