import { type Db, type DbOrTx, complaints, messages, questions, session, user } from "@auction/db";
import type { ComplaintTarget } from "@auction/domain";
import { and, eq } from "drizzle-orm";
import { fail } from "./errors";
import { flushUserEvents, notify } from "./notify";
import { getUser, logModeration } from "./users";

export async function fileComplaint(
  db: DbOrTx,
  p: { reporterId: string; targetType: ComplaintTarget; targetId: string; reason: string },
): Promise<void> {
  const reason = p.reason.trim();
  if (reason.length < 5) fail("too_short", "Опишите нарушение");
  const [dup] = await db
    .select({ id: complaints.id })
    .from(complaints)
    .where(
      and(
        eq(complaints.reporterId, p.reporterId),
        eq(complaints.targetType, p.targetType),
        eq(complaints.targetId, p.targetId),
        eq(complaints.status, "open"),
      ),
    );
  if (dup) fail("duplicate", "Вы уже пожаловались — модератор рассмотрит жалобу");
  await db.insert(complaints).values({ ...p, reason: reason.slice(0, 2000) });
}

export async function resolveComplaint(
  db: DbOrTx,
  p: { complaintId: number; moderatorId: string; status: "resolved" | "dismissed"; resolution: string },
): Promise<void> {
  await db
    .update(complaints)
    .set({ status: p.status, resolution: p.resolution, resolvedBy: p.moderatorId, resolvedAt: new Date() })
    .where(eq(complaints.id, p.complaintId));
}

export async function warnUser(db: Db, p: { userId: string; moderatorId: string; reason: string }): Promise<void> {
  const ids = await db.transaction(async (tx) => {
    await logModeration(tx, { userId: p.userId, moderatorId: p.moderatorId, kind: "warning", reason: p.reason });
    return notify(tx, {
      userId: p.userId,
      type: "moderation",
      title: "Предупреждение от модерации",
      body: p.reason,
    });
  });
  await flushUserEvents(ids);
}

export async function banUser(
  db: Db,
  p: { userId: string; moderatorId: string; reason: string; until?: Date | null },
): Promise<void> {
  const target = await getUser(db, p.userId);
  if (target.role !== "user") fail("staff", "Сотрудника нельзя заблокировать — сначала снимите роль");
  await db.transaction(async (tx) => {
    await tx
      .update(user)
      .set({ banned: true, banReason: p.reason, banExpires: p.until ?? null })
      .where(eq(user.id, p.userId));
    await tx.delete(session).where(eq(session.userId, p.userId));
    await logModeration(tx, { userId: p.userId, moderatorId: p.moderatorId, kind: "ban", reason: p.reason });
  });
}

export async function unbanUser(db: Db, p: { userId: string; moderatorId: string; reason: string }): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.update(user).set({ banned: false, banReason: null, banExpires: null }).where(eq(user.id, p.userId));
    await logModeration(tx, { userId: p.userId, moderatorId: p.moderatorId, kind: "unban", reason: p.reason });
  });
}

export async function hideMessage(db: DbOrTx, messageId: number): Promise<void> {
  await db.update(messages).set({ hiddenAt: new Date() }).where(eq(messages.id, messageId));
}

export async function hideQuestion(db: DbOrTx, questionId: number): Promise<void> {
  await db.update(questions).set({ hiddenAt: new Date() }).where(eq(questions.id, questionId));
}
