"use server";

import { buyBlitz, buyFixed, cancelBids, makeOffer, placeBid, respondOffer } from "@auction/services";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { authed, getDb, ok } from "@/shared/api";
import type { ActionState } from "@/shared/api/types";
import { formatRub, int, parseRub, str } from "@/shared/lib";

export const placeBidAction = authed(async (viewer, _prev: ActionState, form: FormData) => {
  const lotId = int(form.get("lotId"));
  const amount = parseRub(form.get("amount"));
  const max = parseRub(form.get("maxAmount"));
  if (!amount) return { ok: false, error: "Введите сумму ставки" };
  const r = await placeBid(getDb(), { lotId, bidderId: viewer.id, amount, maxAmount: max });
  revalidatePath(`/lots/${lotId}`);
  return ok(
    r.leading
      ? `Вы лидируете. Текущая цена — ${formatRub(r.currentPrice)}${max ? `, автоставка до ${formatRub(Math.max(max, amount))}` : ""}.`
      : `Вашу ставку сразу перебила автоставка другого участника. Текущая цена — ${formatRub(r.currentPrice)}.`,
  );
});

export const buyBlitzAction = authed(async (viewer, _prev: ActionState, form: FormData) => {
  const dealId = await buyBlitz(getDb(), { lotId: int(form.get("lotId")), buyerId: viewer.id });
  redirect(`/deals/${dealId}`);
});

export const buyFixedAction = authed(async (viewer, _prev: ActionState, form: FormData) => {
  const qty = int(form.get("quantity")) || 1;
  const dealId = await buyFixed(getDb(), { lotId: int(form.get("lotId")), buyerId: viewer.id, quantity: qty });
  redirect(`/deals/${dealId}`);
});

export const makeOfferAction = authed(async (viewer, _prev: ActionState, form: FormData) => {
  const price = parseRub(form.get("price"));
  if (!price) return { ok: false, error: "Введите цену" };
  await makeOffer(getDb(), {
    lotId: int(form.get("lotId")),
    buyerId: viewer.id,
    price,
    quantity: int(form.get("quantity")) || 1,
    message: str(form.get("message")),
  });
  return ok("Предложение отправлено продавцу. Ответ придёт в уведомлениях.");
});

export const respondOfferAction = authed(async (viewer, _prev: ActionState, form: FormData) => {
  const accept = form.get("decision") === "accept";
  const dealId = await respondOffer(getDb(), { offerId: int(form.get("offerId")), sellerId: viewer.id, accept });
  revalidatePath("/cabinet/offers");
  if (dealId) redirect(`/deals/${dealId}`);
  return ok("Предложение отклонено");
});

export const cancelBidsAction = authed(async (viewer, _prev: ActionState, form: FormData) => {
  const lotId = int(form.get("lotId"));
  await cancelBids(getDb(), { lotId, sellerId: viewer.id, bidderId: str(form.get("bidderId")), reason: str(form.get("reason")) });
  revalidatePath(`/lots/${lotId}`);
  return ok("Ставки участника отменены, торги пересчитаны");
});
