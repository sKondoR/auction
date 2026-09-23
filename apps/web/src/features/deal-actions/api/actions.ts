"use server";

import type { DealAction, ReviewRating } from "@auction/domain";
import { applyDealAction, flushUserEvents, leaveReview } from "@auction/services";
import { revalidatePath } from "next/cache";
import { authed, getDb, ok } from "@/shared/api";
import type { ActionState } from "@/shared/api/types";
import { int, str } from "@/shared/lib";

export const dealAction = authed(async (viewer, _prev: ActionState, form: FormData) => {
  const dealId = int(form.get("dealId"));
  const db = getDb();
  const { notified } = await db.transaction((tx) =>
    applyDealAction(tx, { dealId, userId: viewer.id, action: str(form.get("action")) as DealAction }),
  );
  await flushUserEvents(notified);
  revalidatePath(`/deals/${dealId}`);
  return ok("Статус сделки обновлён");
});

export const reviewAction = authed(async (viewer, _prev: ActionState, form: FormData) => {
  const dealId = int(form.get("dealId"));
  const db = getDb();
  const { notified } = await db.transaction((tx) =>
    leaveReview(tx, {
      dealId,
      authorId: viewer.id,
      rating: str(form.get("rating")) as ReviewRating,
      text: str(form.get("text")),
    }),
  );
  await flushUserEvents(notified);
  revalidatePath(`/deals/${dealId}`);
  return ok("Спасибо за отзыв");
});
