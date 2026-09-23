"use server";

import { lotPhotos, notificationPreferences, user } from "@auction/db";
import { NOTIFICATION_TYPES, type BuyoutStatus } from "@auction/domain";
import { changeBuyoutStatus, createBuyoutRequest, deleteAccount, markNotificationsRead } from "@auction/services";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authed, getDb, ok } from "@/shared/api";
import type { ActionState } from "@/shared/api/types";
import { int, parseRub, str } from "@/shared/lib";

export const updateProfileAction = authed(async (viewer, _prev: ActionState, form: FormData) => {
  const name = str(form.get("name")).trim();
  const email = str(form.get("notifyEmail")).trim();
  if (name.length < 2 || name.length > 60) return { ok: false, error: "Имя — от 2 до 60 символов" };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Некорректный email" };
  await getDb()
    .update(user)
    .set({ name, city: str(form.get("city")).trim() || null, about: str(form.get("about")).trim().slice(0, 1000) || null, notifyEmail: email || null })
    .where(eq(user.id, viewer.id));
  revalidatePath("/", "layout");
  return ok("Сохранено");
});

export const updateNotificationPrefsAction = authed(async (viewer, _prev: ActionState, form: FormData) => {
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx.delete(notificationPreferences).where(eq(notificationPreferences.userId, viewer.id));
    await tx.insert(notificationPreferences).values(
      NOTIFICATION_TYPES.map((t) => ({
        userId: viewer.id,
        type: t,
        site: form.get(`${t}.site`) === "on",
        email: form.get(`${t}.email`) === "on",
      })),
    );
  });
  return ok("Настройки уведомлений сохранены");
});

export const deleteAccountAction = authed(async (viewer, _prev: ActionState, form: FormData) => {
  if (str(form.get("confirm")) !== "УДАЛИТЬ") return { ok: false, error: "Введите слово УДАЛИТЬ для подтверждения" };
  await getDb().transaction((tx) => deleteAccount(tx, viewer.id));
  redirect("/?deleted=1");
});

export const markAllNotificationsReadAction = authed(async (viewer) => {
  await markNotificationsRead(getDb(), viewer.id);
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
});

export const createBuyoutAction = authed(async (viewer, _prev: ActionState, form: FormData) => {
  const db = getDb();
  const ids = str(form.get("photoIds")).split(",").filter(Boolean).map(Number);
  const photos = ids.length
    ? await db
        .select({ key: lotPhotos.key, thumbKey: lotPhotos.thumbKey })
        .from(lotPhotos)
        .where(and(inArray(lotPhotos.id, ids), eq(lotPhotos.ownerId, viewer.id)))
    : [];
  await createBuyoutRequest(db, viewer.id, {
    title: str(form.get("title")),
    description: str(form.get("description")),
    size: str(form.get("size")),
    desiredPrice: parseRub(form.get("desiredPrice")) ?? 0,
    photos,
  });
  redirect("/cabinet/buyout?created=1");
});

export const answerBuyoutOfferAction = authed(async (viewer, _prev: ActionState, form: FormData) => {
  await changeBuyoutStatus(getDb(), {
    requestId: int(form.get("requestId")),
    actorId: viewer.id,
    to: str(form.get("to")) as BuyoutStatus,
  });
  revalidatePath("/cabinet/buyout");
  return ok("Ответ отправлен");
});
