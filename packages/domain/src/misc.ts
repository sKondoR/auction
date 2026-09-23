/* Справочники статусов прочих сущностей. */

export const BUYOUT_STATUSES = ["new", "reviewing", "offered", "accepted", "rejected"] as const;
export type BuyoutStatus = (typeof BUYOUT_STATUSES)[number];
export const BUYOUT_STATUS_LABELS: Record<BuyoutStatus, string> = {
  new: "Новая",
  reviewing: "На рассмотрении",
  offered: "Предложение",
  accepted: "Принята",
  rejected: "Отклонена",
};

/** Кто и в какой статус может перевести заявку на выкуп. */
export const BUYOUT_TRANSITIONS: Record<BuyoutStatus, readonly BuyoutStatus[]> = {
  new: ["reviewing", "rejected"],
  reviewing: ["offered", "rejected"],
  offered: ["accepted", "rejected"],
  accepted: [],
  rejected: [],
};

export const STAFF_ROLES = ["admin", "moderator", "appraiser"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];
export type UserRole = "user" | StaffRole;

export const ROLE_LABELS: Record<UserRole, string> = {
  user: "Пользователь",
  admin: "Администратор",
  moderator: "Модератор",
  appraiser: "Оценщик",
};

export type Permission =
  | "admin.settings"
  | "admin.categories"
  | "admin.invoices"
  | "admin.users"
  | "moderation.lots"
  | "moderation.complaints"
  | "moderation.messages"
  | "moderation.users"
  | "buyout.review";

const PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  user: [],
  admin: [
    "admin.settings",
    "admin.categories",
    "admin.invoices",
    "admin.users",
    "moderation.lots",
    "moderation.complaints",
    "moderation.messages",
    "moderation.users",
    "buyout.review",
  ],
  moderator: ["moderation.lots", "moderation.complaints", "moderation.messages", "moderation.users"],
  appraiser: ["buyout.review"],
};

export function hasPermission(role: string | null | undefined, p: Permission): boolean {
  const r = (role ?? "user") as UserRole;
  return PERMISSIONS[r]?.includes(p) ?? false;
}

export const isStaff = (role: string | null | undefined): boolean =>
  role === "admin" || role === "moderator" || role === "appraiser";

export const COMPLAINT_TARGETS = ["lot", "message", "question", "user"] as const;
export type ComplaintTarget = (typeof COMPLAINT_TARGETS)[number];
export const COMPLAINT_STATUSES = ["open", "resolved", "dismissed"] as const;
export type ComplaintStatus = (typeof COMPLAINT_STATUSES)[number];

/** Удаление аккаунта по 152-ФЗ: что остаётся от пользователя. */
export const DELETED_USER_NAME = "Пользователь удалён";
