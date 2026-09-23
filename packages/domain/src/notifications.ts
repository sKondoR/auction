export const NOTIFICATION_TYPES = [
  "outbid",
  "auction_won",
  "lot_sold",
  "lot_unsold",
  "lot_withdrawn",
  "bid_cancelled",
  "new_message",
  "question_answered",
  "new_question",
  "offer_received",
  "offer_answered",
  "deal_status",
  "review_received",
  "listing_expiring",
  "invoice_issued",
  "invoice_overdue",
  "subscription_new_lot",
  "saved_search_match",
  "buyout_status",
  "live_starting",
  "moderation",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_CHANNELS = ["site", "email"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  outbid: "Мою ставку перебили",
  auction_won: "Я выиграл торги",
  lot_sold: "Мой лот продан",
  lot_unsold: "Мой лот не продан",
  lot_withdrawn: "Лот с моей ставкой снят",
  bid_cancelled: "Продавец отменил мою ставку",
  new_message: "Новое сообщение",
  question_answered: "Ответ на мой вопрос",
  new_question: "Вопрос по моему лоту",
  offer_received: "Предложение цены по моему лоту",
  offer_answered: "Ответ на моё предложение цены",
  deal_status: "Изменение статуса сделки",
  review_received: "Новый отзыв",
  listing_expiring: "Скоро истекает размещение",
  invoice_issued: "Выставлен счёт",
  invoice_overdue: "Счёт просрочен",
  subscription_new_lot: "Новые лоты продавцов из подписок",
  saved_search_match: "Новые лоты по сохранённым поискам",
  buyout_status: "Заявки на выкуп",
  live_starting: "Скоро начнётся живой аукцион",
  moderation: "Сообщения модерации",
};

/** Каналы по умолчанию, если пользователь не менял настройки. */
export function defaultChannels(type: NotificationType): Record<NotificationChannel, boolean> {
  const emailByDefault: readonly NotificationType[] = [
    "auction_won",
    "lot_sold",
    "deal_status",
    "invoice_issued",
    "invoice_overdue",
    "moderation",
    "buyout_status",
    "listing_expiring",
  ];
  return { site: true, email: emailByDefault.includes(type) };
}
