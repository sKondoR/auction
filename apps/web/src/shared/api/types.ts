/** Тип результата серверного действия — безопасен для клиентских модулей. */
export type ActionState = { ok: true; message?: string; data?: unknown } | { ok: false; error: string } | null;
