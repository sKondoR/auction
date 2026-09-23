/**
 * Маскировка контактных данных в описаниях, вопросах и сообщениях:
 * телефоны, email, ссылки, упоминания мессенджеров и @никнеймы.
 */
const MASK = "[скрыто]";

// В JS `\b` учитывает только латиницу, поэтому границы слов — через Unicode-lookaround.
const WB_START = "(?<![\\p{L}\\p{N}])";
const WB_END = "(?![\\p{L}\\p{N}])";

const PATTERNS: RegExp[] = [
  // email
  /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/giu,
  // ссылки с протоколом или www
  new RegExp(`${WB_START}(?:https?:\\/\\/|www\\.)[^\\s<>"]+`, "giu"),
  // домены вида site.ru / t.me/xxx
  new RegExp(
    `${WB_START}[\\p{L}\\p{N}-]+\\.(?:ru|рф|com|net|org|me|su|info|io|biz|pro|shop|online|site)${WB_END}(?:\\/[^\\s<>"]*)?`,
    "giu",
  ),
  // телефоны: +7 (999) 123-45-67, 8 999 1234567, 89991234567 и т.п. (10+ цифр с разделителями)
  /(?:\+?\d[\s\-().]{0,3}){10,14}\d?/gu,
  // @никнеймы (телеграм, инстаграм)
  /(?<![\p{L}\p{N}])@[a-z0-9_]{4,}/giu,
  // упоминания мессенджеров
  new RegExp(
    `${WB_START}(?:whats\\s?app|вотсап|ватсап|вацап|telegram|телеграм+|телега|viber|вайбер|вибер|skype|скайп|tg|тг)${WB_END}`,
    "giu",
  ),
];

export function maskContacts(text: string): string {
  let out = text;
  for (const re of PATTERNS) out = out.replace(re, MASK);
  return out;
}

export const containsContacts = (text: string): boolean => maskContacts(text) !== text;
