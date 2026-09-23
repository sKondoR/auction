"use server";

import { categories, categoryAttributes, lots, setSetting, user } from "@auction/db";
import { type BidStepRow, type BuyoutStatus, STAFF_ROLES, validateBidStepGrid } from "@auction/domain";
import {
  banUser,
  changeBuyoutStatus,
  hideMessage,
  hideQuestion,
  markInvoicePaid,
  removeLotByModerator,
  resolveComplaint,
  unbanUser,
  warnUser,
} from "@auction/services";
import { count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { authed, getDb, ok } from "@/shared/api";
import type { ActionState } from "@/shared/api/types";
import { int, parseRub, str } from "@/shared/lib";

/* ---------- Модерация ---------- */

export const removeLotAction = authed(
  async (viewer, _prev: ActionState, form: FormData) => {
    const lotId = int(form.get("lotId"));
    const reason = str(form.get("reason")).trim();
    if (!reason) return { ok: false, error: "Укажите причину" };
    await removeLotByModerator(getDb(), viewer.id, lotId, reason);
    revalidatePath(`/lots/${lotId}`);
    revalidatePath("/admin/lots");
    return ok("Лот снят");
  },
  { permission: "moderation.lots" },
);

export const resolveComplaintAction = authed(
  async (viewer, _prev: ActionState, form: FormData) => {
    await resolveComplaint(getDb(), {
      complaintId: int(form.get("complaintId")),
      moderatorId: viewer.id,
      status: str(form.get("status")) === "dismissed" ? "dismissed" : "resolved",
      resolution: str(form.get("resolution")),
    });
    revalidatePath("/admin/complaints");
    return ok("Жалоба закрыта");
  },
  { permission: "moderation.complaints" },
);

export const moderateUserAction = authed(
  async (viewer, _prev: ActionState, form: FormData) => {
    const userId = str(form.get("userId"));
    const reason = str(form.get("reason")).trim();
    const kind = str(form.get("kind"));
    if (!reason) return { ok: false, error: "Укажите причину" };
    const db = getDb();
    if (kind === "warn") await warnUser(db, { userId, moderatorId: viewer.id, reason });
    else if (kind === "ban") {
      const days = int(form.get("days"));
      await banUser(db, { userId, moderatorId: viewer.id, reason, until: days > 0 ? new Date(Date.now() + days * 86_400_000) : null });
    } else if (kind === "unban") await unbanUser(db, { userId, moderatorId: viewer.id, reason });
    revalidatePath("/admin/users");
    return ok("Готово");
  },
  { permission: "moderation.users" },
);

export const hideContentAction = authed(
  async (_viewer, _prev: ActionState, form: FormData) => {
    const id = int(form.get("id"));
    if (str(form.get("type")) === "message") await hideMessage(getDb(), id);
    else await hideQuestion(getDb(), id);
    revalidatePath("/admin/complaints");
    return ok("Скрыто");
  },
  { permission: "moderation.messages" },
);

/* ---------- Администрирование ---------- */

export const setRoleAction = authed(
  async (viewer, _prev: ActionState, form: FormData) => {
    const userId = str(form.get("userId"));
    const role = str(form.get("role"));
    if (userId === viewer.id) return { ok: false, error: "Нельзя менять собственную роль" };
    if (role !== "user" && !(STAFF_ROLES as readonly string[]).includes(role)) return { ok: false, error: "Неизвестная роль" };
    await getDb().update(user).set({ role }).where(eq(user.id, userId));
    revalidatePath("/admin/users");
    return ok("Роль изменена");
  },
  { permission: "admin.users" },
);

export const saveCategoryAction = authed(
  async (_viewer, _prev: ActionState, form: FormData) => {
    const db = getDb();
    const id = int(form.get("id"));
    const name = str(form.get("name")).trim();
    const slug = str(form.get("slug")).trim().toLowerCase();
    const parentId = int(form.get("parentId")) || null;
    if (!name || !/^[a-z0-9-]+$/.test(slug)) return { ok: false, error: "Название и slug (латиница, цифры, дефис) обязательны" };
    const values = { name, slug, parentId, position: int(form.get("position")) || 0, isHidden: form.get("isHidden") === "on" };
    if (id > 0) await db.update(categories).set(values).where(eq(categories.id, id));
    else await db.insert(categories).values(values);
    revalidatePath("/admin/categories");
    revalidatePath("/", "layout");
    return ok("Категория сохранена");
  },
  { permission: "admin.categories" },
);

export const deleteCategoryAction = authed(
  async (_viewer, _prev: ActionState, form: FormData) => {
    const db = getDb();
    const id = int(form.get("id"));
    const [used] = await db.select({ n: count() }).from(lots).where(eq(lots.categoryId, id));
    const [children] = await db.select({ n: count() }).from(categories).where(eq(categories.parentId, id));
    if (Number(used?.n) > 0 || Number(children?.n) > 0) {
      return { ok: false, error: "В категории есть лоты или подкатегории — скройте её вместо удаления" };
    }
    await db.delete(categories).where(eq(categories.id, id));
    revalidatePath("/admin/categories");
    return ok("Удалено");
  },
  { permission: "admin.categories" },
);

export const saveAttributeAction = authed(
  async (_viewer, _prev: ActionState, form: FormData) => {
    const db = getDb();
    const categoryId = int(form.get("categoryId"));
    const key = str(form.get("key")).trim();
    const name = str(form.get("name")).trim();
    const type = str(form.get("type")) as "text" | "number" | "select";
    if (!/^[a-z][a-z0-9_]*$/.test(key) || !name) return { ok: false, error: "Ключ (латиница) и название обязательны" };
    const options = type === "select" ? str(form.get("options")).split(",").map((s) => s.trim()).filter(Boolean) : null;
    await db
      .insert(categoryAttributes)
      .values({ categoryId, key, name, type, options, unit: str(form.get("unit")).trim() || null, position: int(form.get("position")) || 0 })
      .onConflictDoUpdate({
        target: [categoryAttributes.categoryId, categoryAttributes.key],
        set: { name, type, options, unit: str(form.get("unit")).trim() || null },
      });
    revalidatePath("/admin/categories");
    return ok("Атрибут сохранён");
  },
  { permission: "admin.categories" },
);

export const deleteAttributeAction = authed(
  async (_viewer, _prev: ActionState, form: FormData) => {
    await getDb().delete(categoryAttributes).where(eq(categoryAttributes.id, int(form.get("id"))));
    revalidatePath("/admin/categories");
    return ok("Удалено");
  },
  { permission: "admin.categories" },
);

export const saveSettingsAction = authed(
  async (_viewer, _prev: ActionState, form: FormData) => {
    const db = getDb();
    // Сетка шагов: строки «от ₽ — шаг ₽».
    const rows: BidStepRow[] = [];
    const froms = form.getAll("stepFrom");
    const steps = form.getAll("stepValue");
    froms.forEach((f, i) => {
      const from = parseRub(f);
      const step = parseRub(steps[i] ?? null);
      if (from !== null && step !== null) rows.push({ from, step });
    });
    rows.sort((a, b) => a.from - b.from);
    validateBidStepGrid(rows);
    const maxBidLots = int(form.get("maxConcurrentBidLots"));
    const maxLots = int(form.get("maxActiveLots"));
    const threshold = int(form.get("penaltyBanThreshold"));
    const minInvoice = parseRub(form.get("minInvoiceAmount"));
    if (![maxBidLots, maxLots, threshold].every((n) => Number.isInteger(n) && n >= 0) || minInvoice === null) {
      return { ok: false, error: "Проверьте числовые значения" };
    }
    await setSetting(db, "bidSteps", rows);
    await setSetting(db, "newbieLimits", { maxConcurrentBidLots: maxBidLots, maxActiveLots: maxLots });
    await setSetting(db, "penaltyBanThreshold", threshold);
    await setSetting(db, "minInvoiceAmount", minInvoice);
    await setSetting(db, "requisites", str(form.get("requisites")));
    revalidatePath("/admin/settings");
    return ok("Настройки сохранены");
  },
  { permission: "admin.settings" },
);

export const markInvoicePaidAction = authed(
  async (viewer, _prev: ActionState, form: FormData) => {
    await markInvoicePaid(getDb(), int(form.get("invoiceId")), viewer.id);
    revalidatePath("/admin/invoices");
    return ok("Оплата отмечена");
  },
  { permission: "admin.invoices" },
);

export const reviewBuyoutAction = authed(
  async (viewer, _prev: ActionState, form: FormData) => {
    await changeBuyoutStatus(getDb(), {
      requestId: int(form.get("requestId")),
      actorId: viewer.id,
      to: str(form.get("to")) as BuyoutStatus,
      offeredPrice: parseRub(form.get("offeredPrice")) ?? undefined,
      note: str(form.get("note")) || undefined,
    });
    revalidatePath("/admin/buyout");
    return ok("Статус заявки обновлён");
  },
  { permission: "buyout.review" },
);
