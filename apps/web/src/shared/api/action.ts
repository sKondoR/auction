import "server-only";
import { type Permission, hasPermission } from "@auction/domain";
import { userMessage } from "@auction/services";
import { type Viewer, getViewer } from "./session";

export type ActionResult<T = undefined> = { ok: true; message?: string; data?: T } | { ok: false; error: string };

export const ok = <T,>(message?: string, data?: T): ActionResult<T> => ({ ok: true, message, data });

/**
 * Обёртка серверного действия: требует вход (и право, если указано), переводит
 * доменные ошибки в сообщение для формы.
 */
export function authed<Args extends unknown[], T>(
  fn: (viewer: Viewer, ...args: Args) => Promise<ActionResult<T> | void>,
  opts: { permission?: Permission } = {},
) {
  return async (...args: Args): Promise<ActionResult<T>> => {
    const viewer = await getViewer();
    if (!viewer) return { ok: false, error: "Войдите, чтобы продолжить" };
    if (opts.permission && !hasPermission(viewer.role, opts.permission)) return { ok: false, error: "Недостаточно прав" };
    try {
      return (await fn(viewer, ...args)) ?? { ok: true };
    } catch (e) {
      // redirect()/notFound() из next/navigation пробрасываем дальше.
      if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_")) throw e;
      return { ok: false, error: userMessage(e) };
    }
  };
}
