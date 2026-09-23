import { DomainError, type Kopecks } from "./money";

export const LOT_FORMATS = ["fixed", "english", "dutch", "live"] as const;
export type LotFormat = (typeof LOT_FORMATS)[number];

/** Форматы, доступные для выставления на текущем этапе. */
export const ENABLED_FORMATS: readonly LotFormat[] = ["fixed", "english"];

export const LOT_FORMAT_LABELS: Record<LotFormat, string> = {
  fixed: "Фиксированная цена",
  english: "Английский аукцион",
  dutch: "Голландский аукцион",
  live: "Живой аукцион",
};

export const DAY_MS = 24 * 60 * 60 * 1000;
export const MINUTE_MS = 60 * 1000;

export const FIXED_MAX_DAYS = 60;
export const ENGLISH_MIN_DAYS = 1;
export const ENGLISH_MAX_DAYS = 21;
export const DUTCH_MAX_DAYS = 90;
export const DUTCH_INTERVALS = [3, 5, 7, 10] as const;
export const DUTCH_MIN_STEP_PERCENT = 5;
export const MAX_PHOTOS = 20;
export const MAX_AUTO_RELISTS = 3;
export const FIXED_EXPIRY_REMINDER_DAYS = 3;

export const DELIVERY_METHODS = ["post", "cdek", "boxberry", "pickup", "courier"] as const;
export type DeliveryMethod = (typeof DELIVERY_METHODS)[number];
export const DELIVERY_METHOD_LABELS: Record<DeliveryMethod, string> = {
  post: "Почта России",
  cdek: "СДЭК",
  boxberry: "Boxberry",
  pickup: "Самовывоз",
  courier: "Курьер",
};

export interface LotDraft {
  format: LotFormat;
  title: string;
  description: string;
  categoryId: number;
  city: string;
  deliveryMethods: DeliveryMethod[];
  deliveryCost: string;
  photoCount: number;
  durationDays: number;
  /** Цена для фиксированной цены, стартовая цена для аукционов. */
  startPrice: Kopecks;
  quantity: number;
  blitzPrice: Kopecks | null;
  allowOffers: boolean;
  autoRelist: boolean;
  dutch?: { minPrice: Kopecks; intervalDays: number; stepPercent: number };
}

/** Проверка черновика лота; бросает DomainError с понятным сообщением. */
export function validateLotDraft(d: LotDraft, enabled: readonly LotFormat[] = ENABLED_FORMATS): void {
  const fail = (msg: string): never => {
    throw new DomainError("invalid_lot", msg);
  };
  if (!enabled.includes(d.format)) fail("Этот формат торгов пока недоступен");
  if (d.title.trim().length < 3) fail("Название слишком короткое");
  if (d.title.length > 150) fail("Название длиннее 150 символов");
  if (d.description.length > 20_000) fail("Описание слишком длинное");
  if (!d.city.trim()) fail("Укажите город");
  if (d.deliveryMethods.length === 0) fail("Выберите хотя бы один способ доставки");
  if (d.photoCount > MAX_PHOTOS) fail(`Не больше ${MAX_PHOTOS} фото`);
  if (!Number.isSafeInteger(d.startPrice) || d.startPrice < 100) fail("Цена — от 1 ₽");
  if (!Number.isInteger(d.durationDays) || d.durationDays < 1) fail("Некорректный срок");

  switch (d.format) {
    case "fixed":
      if (d.durationDays > FIXED_MAX_DAYS) fail(`Срок размещения — до ${FIXED_MAX_DAYS} дней`);
      if (!Number.isInteger(d.quantity) || d.quantity < 1 || d.quantity > 10_000) fail("Некорректное количество");
      if (d.blitzPrice !== null) fail("Блиц-цена есть только у аукциона");
      break;
    case "english":
      if (d.durationDays < ENGLISH_MIN_DAYS || d.durationDays > ENGLISH_MAX_DAYS) {
        fail(`Срок аукциона — от ${ENGLISH_MIN_DAYS} до ${ENGLISH_MAX_DAYS} дней`);
      }
      if (d.quantity !== 1) fail("На аукционе продаётся один лот");
      if (d.allowOffers) fail("«Предложить свою цену» — только для фиксированной цены");
      if (d.blitzPrice !== null && d.blitzPrice <= d.startPrice) fail("Блиц-цена должна быть выше стартовой");
      break;
    case "dutch": {
      if (d.durationDays > DUTCH_MAX_DAYS) fail(`Срок — до ${DUTCH_MAX_DAYS} дней`);
      const dutch = d.dutch ?? fail("Не заданы параметры голландского аукциона");
      if (dutch.minPrice >= d.startPrice) fail("Минимальная цена должна быть ниже стартовой");
      if (!(DUTCH_INTERVALS as readonly number[]).includes(dutch.intervalDays)) fail("Интервал: 3, 5, 7 или 10 дней");
      if (dutch.stepPercent < DUTCH_MIN_STEP_PERCENT) fail(`Шаг снижения — не менее ${DUTCH_MIN_STEP_PERCENT}%`);
      break;
    }
    case "live":
      fail("Лоты живого аукциона создаются в каталоге торговой сессии");
  }
}
