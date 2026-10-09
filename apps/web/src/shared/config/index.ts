/**
 * Статическая демо-версия (GitHub Pages): данные из встроенной демо-БД, сервера нет.
 * Флаг задаётся при сборке в next.config.ts.
 */
export const IS_DEMO = process.env.NEXT_PUBLIC_DEMO === "1";

export const DEMO_UNAVAILABLE = "Это демо-версия на GitHub Pages: действия, которые меняют данные, здесь недоступны.";
