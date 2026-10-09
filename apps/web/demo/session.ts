/**
 * Подмена src/shared/api/session.ts в демо-сборке: сессий нет, страницы рендерятся
 * от лица демо-пользователя (продавец с правами администратора).
 */
import "server-only";
import { getDb, user } from "@auction/db";
import { DEMO_VIEWER_ID } from "@auction/db/demo";
import { eq } from "drizzle-orm";
import { cache } from "react";

export type Viewer = typeof user.$inferSelect;

export const getViewer = cache(async (): Promise<Viewer | null> => {
  const [u] = await getDb().select().from(user).where(eq(user.id, DEMO_VIEWER_ID));
  return u ?? null;
});

export async function requireViewer(): Promise<Viewer> {
  return (await getViewer())!;
}

export const requirePermission = requireViewer;
export const requireStaff = requireViewer;

export { getDb };
