import { DomainError } from "@auction/domain";

/** Ошибка сценария, которую можно показать пользователю. */
export class ServiceError extends DomainError {}

export const fail = (code: string, message: string): never => {
  throw new ServiceError(code, message);
};

export const notFound = (what = "Объект"): never => fail("not_found", `${what} не найден`);
export const forbidden = (msg = "Недостаточно прав"): never => fail("forbidden", msg);

/** Текст ошибки для пользователя; непредвиденные ошибки не раскрываются. */
export function userMessage(e: unknown): string {
  if (e instanceof DomainError) return e.message;
  console.error(e);
  return "Что-то пошло не так. Попробуйте ещё раз.";
}
