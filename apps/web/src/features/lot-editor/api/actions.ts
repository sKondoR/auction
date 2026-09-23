"use server";

import { DELIVERY_METHODS, type DeliveryMethod, type LotFormat } from "@auction/domain";
import { type LotInput, addAddendum, createLot, relistLot, relistMany, updateLot, withdrawLot } from "@auction/services";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authed, getDb, ok } from "@/shared/api";
import type { ActionState } from "@/shared/api/types";
import { int, parseRub, str } from "@/shared/lib";

function readLotForm(form: FormData): LotInput {
  const attributes: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (k.startsWith("attr.") && typeof v === "string") attributes[k.slice(5)] = v;
  const format = str(form.get("format")) as LotFormat;
  return {
    format,
    title: str(form.get("title")),
    description: str(form.get("description")),
    categoryId: int(form.get("categoryId")),
    attributes,
    city: str(form.get("city")),
    deliveryMethods: form.getAll("delivery").map(String).filter((d): d is DeliveryMethod => (DELIVERY_METHODS as readonly string[]).includes(d)),
    deliveryCost: str(form.get("deliveryCost")),
    durationDays: int(form.get("durationDays")),
    startPrice: parseRub(form.get("price")) ?? 0,
    quantity: int(form.get("quantity")) || 1,
    blitzPrice: parseRub(form.get("blitzPrice")),
    allowOffers: form.get("allowOffers") === "on",
    autoRelist: form.get("autoRelist") === "on",
    photoIds: str(form.get("photoIds"))
      .split(",")
      .filter(Boolean)
      .map(Number),
  };
}

export const createLotAction = authed(async (viewer, _prev: ActionState, form: FormData) => {
  const id = await createLot(getDb(), viewer.id, readLotForm(form));
  redirect(`/lots/${id}?created=1`);
});

export const updateLotAction = authed(async (viewer, _prev: ActionState, form: FormData) => {
  const lotId = int(form.get("lotId"));
  const input = readLotForm(form);
  const { format: _f, ...patch } = input;
  await updateLot(getDb(), viewer.id, lotId, patch);
  revalidatePath(`/lots/${lotId}`);
  redirect(`/lots/${lotId}`);
});

export const addAddendumAction = authed(async (viewer, _prev: ActionState, form: FormData) => {
  const lotId = int(form.get("lotId"));
  await addAddendum(getDb(), viewer.id, lotId, str(form.get("text")));
  revalidatePath(`/lots/${lotId}`);
  return ok("Дополнение опубликовано");
});

export const withdrawLotAction = authed(async (viewer, _prev: ActionState, form: FormData) => {
  const lotId = int(form.get("lotId"));
  await withdrawLot(getDb(), viewer.id, lotId, str(form.get("reason")));
  revalidatePath(`/lots/${lotId}`);
  return ok("Лот снят с торгов");
});

export const relistLotAction = authed(async (viewer, _prev: ActionState, form: FormData) => {
  const lotId = int(form.get("lotId"));
  const format = str(form.get("format")) as LotFormat | "";
  const price = parseRub(form.get("price"));
  const days = int(form.get("durationDays"));
  const newId = await getDb().transaction((tx) =>
    relistLot(tx, {
      lotId,
      sellerId: viewer.id,
      options: {
        format: format || undefined,
        startPrice: price ?? undefined,
        durationDays: Number.isInteger(days) && days > 0 ? days : undefined,
        blitzPrice: format === "fixed" ? null : undefined,
      },
    }),
  );
  redirect(`/lots/${newId}?relisted=1`);
});

export const relistManyAction = authed(async (viewer, _prev: ActionState, form: FormData) => {
  const ids = form.getAll("lotIds").map(Number).filter(Number.isInteger);
  if (!ids.length) return { ok: false, error: "Выберите лоты" };
  const { created, errors } = await relistMany(getDb(), viewer.id, ids);
  revalidatePath("/cabinet/lots");
  if (errors.length) {
    return { ok: false, error: `Перевыставлено: ${created.length}. Ошибки: ${errors.map((e) => `№${e.lotId} — ${e.message}`).join("; ")}` };
  }
  return ok(`Перевыставлено лотов: ${created.length}`);
});
