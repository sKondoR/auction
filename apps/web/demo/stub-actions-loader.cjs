/**
 * Webpack-лоадер демо-сборки: модуль с "use server" заменяется заглушками с теми же
 * именами экспортов. Static export не поддерживает Server Actions, а заглушки
 * возвращают форме понятную ошибку.
 *
 * Модуль помечается "use client": серверные компоненты передают действия в клиентские
 * формы пропсами, а клиентская ссылка, в отличие от обычной функции, сериализуется.
 */
module.exports = function stubServerActions(source) {
  if (!/^\s*["']use server["']/.test(source)) return source;
  const names = [...source.matchAll(/^export\s+(?:const|(?:async\s+)?function)\s+(\w+)/gm)].map((m) => m[1]);
  return [
    '"use client";',
    'import { DEMO_UNAVAILABLE } from "@/shared/config";',
    "const demoAction = async () => ({ ok: false, error: DEMO_UNAVAILABLE });",
    ...names.map((n) => `export const ${n} = demoAction;`),
  ].join("\n");
};
