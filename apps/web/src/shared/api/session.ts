import "server-only";
import { getDb, user } from "@auction/db";
import { type Permission, hasPermission, isStaff } from "@auction/domain";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "./auth";

export type Viewer = typeof user.$inferSelect;

/** Текущий пользователь (свежие данные из БД) или null. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) return null;
  const [u] = await getDb().select().from(user).where(eq(user.id, s.user.id));
  if (!u || u.deletedAt) return null;
  return u;
});

export async function requireViewer(returnTo?: string): Promise<Viewer> {
  const v = await getViewer();
  if (!v) redirect(`/login${returnTo ? `?next=${encodeURIComponent(returnTo)}` : ""}`);
  return v;
}

export async function requirePermission(p: Permission): Promise<Viewer> {
  const v = await requireViewer("/admin");
  if (!hasPermission(v.role, p)) notFound();
  return v;
}

export async function requireStaff(): Promise<Viewer> {
  const v = await requireViewer("/admin");
  if (!isStaff(v.role)) notFound();
  return v;
}

export { getDb };
