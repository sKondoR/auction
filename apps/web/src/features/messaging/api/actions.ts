"use server";

import { conversations } from "@auction/db";
import { hasPermission } from "@auction/domain";
import { forbidden, isParticipant, markConversationRead, sendUserMessage } from "@auction/services";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authed, getDb, ok } from "@/shared/api";
import type { ActionState } from "@/shared/api/types";
import { int, str } from "@/shared/lib";

/** «Связаться с продавцом» — первое сообщение по лоту, дальше беседа. */
export const contactSellerAction = authed(async (viewer, _prev: ActionState, form: FormData) => {
  const conversationId = await sendUserMessage(getDb(), {
    senderId: viewer.id,
    toUserId: str(form.get("sellerId")),
    lotId: int(form.get("lotId")),
    text: str(form.get("text")),
  });
  redirect(`/messages/${conversationId}`);
});

export const sendMessageAction = authed(async (viewer, _prev: ActionState, form: FormData) => {
  const db = getDb();
  const conversationId = int(form.get("conversationId"));
  const [c] = await db.select().from(conversations).where(eq(conversations.id, conversationId));
  if (!c) return { ok: false, error: "Беседа не найдена" };
  // Сотрудник отвечает в беседе с администрацией от имени площадки.
  const asStaff = c.kind === "support" && !isParticipant(c, viewer.id) && hasPermission(viewer.role, "moderation.messages");
  if (!asStaff && !isParticipant(c, viewer.id)) forbidden();
  const lotId = int(form.get("lotId"));
  await sendUserMessage(db, {
    senderId: viewer.id,
    conversationId,
    lotId: Number.isInteger(lotId) && lotId > 0 ? lotId : null,
    text: str(form.get("text")),
    asStaff,
  });
  revalidatePath(`/messages/${conversationId}`);
  revalidatePath(`/admin/support/${conversationId}`);
  return ok();
});

export const markReadAction = authed(async (viewer, conversationId: number) => {
  await markConversationRead(getDb(), conversationId, viewer.id);
});
