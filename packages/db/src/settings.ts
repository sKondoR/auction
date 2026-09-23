import {
  type BidStepGrid,
  DEFAULT_BID_STEPS,
  DEFAULT_COMMISSION_BPS,
  DEFAULT_NEWBIE_LIMITS,
  DEFAULT_PENALTY_BAN_THRESHOLD,
  MIN_INVOICE_AMOUNT,
  type NewbieLimits,
} from "@auction/domain";
import { eq } from "drizzle-orm";
import type { DbOrTx } from "./client";
import { settings } from "./schema";

/** Настройки площадки, редактируемые в админке. */
export interface PlatformSettings {
  bidSteps: BidStepGrid;
  newbieLimits: NewbieLimits;
  penaltyBanThreshold: number;
  commissionBps: number;
  minInvoiceAmount: number;
  /** Реквизиты для оплаты счетов (показываются продавцу в кабинете). */
  requisites: string;
}

export const DEFAULT_SETTINGS: PlatformSettings = {
  bidSteps: DEFAULT_BID_STEPS,
  newbieLimits: DEFAULT_NEWBIE_LIMITS,
  penaltyBanThreshold: DEFAULT_PENALTY_BAN_THRESHOLD,
  commissionBps: DEFAULT_COMMISSION_BPS,
  minInvoiceAmount: MIN_INVOICE_AMOUNT,
  requisites:
    "Получатель: ИП Иванов Иван Иванович\nИНН 000000000000\nР/с 40802810000000000000\nБанк: АО «Банк»\nБИК 044525000\nК/с 30101810000000000000\nНазначение: оплата счёта №{номер} за услуги площадки",
};

export type SettingKey = keyof PlatformSettings;

export async function getSettings(db: DbOrTx): Promise<PlatformSettings> {
  const rows = await db.select().from(settings);
  const out: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const r of rows) if (r.key in DEFAULT_SETTINGS) out[r.key] = r.value;
  return out as unknown as PlatformSettings;
}

export async function setSetting<K extends SettingKey>(db: DbOrTx, key: K, value: PlatformSettings[K]): Promise<void> {
  await db
    .insert(settings)
    .values({ key, value: value as unknown })
    .onConflictDoUpdate({ target: settings.key, set: { value: value as unknown, updatedAt: new Date() } });
}

export async function getSetting<K extends SettingKey>(db: DbOrTx, key: K): Promise<PlatformSettings[K]> {
  const [row] = await db.select().from(settings).where(eq(settings.key, key));
  return (row?.value as PlatformSettings[K] | undefined) ?? DEFAULT_SETTINGS[key];
}
