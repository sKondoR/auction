"use server";

import { favorites, savedSearches, sellerSubscriptions, type SearchFilters } from "@auction/db";
import type { ComplaintTarget } from "@auction/domain";
import { answerQuestion, askQuestion, fileComplaint } from "@auction/services";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { authed, getDb, ok } from "@/shared/api";
import type { ActionState } from "@/shared/api/types";
import { int, str } from "@/shared/lib";

export const toggleFavoriteAction = authed(async (viewer, lotId: number) => {
  const db = getDb();
  const cond = and(eq(favorites.userId, viewer.id), eq(favorites.lotId, lotId));
  const [existing] = await db.select().from(favorites).where(cond);
  if (existing) await db.delete(favorites).where(cond);
  else await db.insert(favorites).values({ userId: viewer.id, lotId }).onConflictDoNothing();
  revalidatePath(`/lots/${lotId}`);
  return ok(existing ? "removed" : "added");
});

export const toggleSubscriptionAction = authed(async (viewer, sellerId: string) => {
  if (sellerId === viewer.id) return { ok: false, error: "Нельзя подписаться на себя" };
  const db = getDb();
  const cond = and(eq(sellerSubscriptions.subscriberId, viewer.id), eq(sellerSubscriptions.sellerId, sellerId));
  const [existing] = await db.select().from(sellerSubscriptions).where(cond);
  if (existing) await db.delete(sellerSubscriptions).where(cond);
  else await db.insert(sellerSubscriptions).values({ subscriberId: viewer.id, sellerId }).onConflictDoNothing();
  revalidatePath(`/users/${sellerId}`);
  revalidatePath(`/cabinet/subscriptions`);
  return ok(existing ? "removed" : "added");
});

export const askQuestionAction = authed(async (viewer, _prev: ActionState, form: FormData) => {
  const lotId = int(form.get("lotId"));
  await askQuestion(getDb(), { lotId, askerId: viewer.id, text: str(form.get("text")), isPrivate: form.get("isPrivate") === "on" });
  revalidatePath(`/lots/${lotId}`);
  return ok("Вопрос отправлен продавцу");
});

export const answerQuestionAction = authed(async (viewer, _prev: ActionState, form: FormData) => {
  await answerQuestion(getDb(), { questionId: int(form.get("questionId")), sellerId: viewer.id, answer: str(form.get("answer")) });
  revalidatePath(`/lots/${int(form.get("lotId"))}`);
  return ok("Ответ опубликован");
});

export const complainAction = authed(async (viewer, _prev: ActionState, form: FormData) => {
  await fileComplaint(getDb(), {
    reporterId: viewer.id,
    targetType: str(form.get("targetType")) as ComplaintTarget,
    targetId: str(form.get("targetId")),
    reason: str(form.get("reason")),
  });
  return ok("Жалоба отправлена модератору");
});

export const saveSearchAction = authed(async (viewer, _prev: ActionState, form: FormData) => {
  const filters = JSON.parse(str(form.get("filters")) || "{}") as SearchFilters;
  const name = str(form.get("name")).trim() || filters.q || "Мой поиск";
  await getDb().insert(savedSearches).values({ userId: viewer.id, name: name.slice(0, 100), filters });
  revalidatePath("/cabinet/searches");
  return ok("Поиск сохранён — пришлём уведомление о новых лотах");
});

export const deleteSavedSearchAction = authed(async (viewer, id: number) => {
  await getDb().delete(savedSearches).where(and(eq(savedSearches.id, id), eq(savedSearches.userId, viewer.id)));
  revalidatePath("/cabinet/searches");
});
