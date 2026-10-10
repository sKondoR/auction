// Ищет классы Tailwind, у которых есть каноническая запись (как подсказка
// suggestCanonicalClasses в Tailwind IntelliSense): `w-[280px]` → `w-70`,
// `z-[1]` → `z-1`, `duration-[450ms]` → `duration-450`.
//   node scripts/tw-canonical.mjs        — список, код выхода 1, если что-то нашлось
//   node scripts/tw-canonical.mjs --fix  — заменить в файлах
import { readFile, readdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { __unstable__loadDesignSystem } from "tailwindcss";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cssPath = path.join(root, "src/app/globals.css");
const require = createRequire(import.meta.url);
const fix = process.argv.includes("--fix");

const designSystem = await __unstable__loadDesignSystem(await readFile(cssPath, "utf8"), {
  base: path.dirname(cssPath),
  async loadStylesheet(id, base) {
    const file = id.startsWith(".")
      ? path.resolve(base, id)
      : require.resolve(id === "tailwindcss" ? "tailwindcss/index.css" : id, { paths: [base] });
    return { path: file, base: path.dirname(file), content: await readFile(file, "utf8") };
  },
});

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (/\.(tsx?|jsx?)$/.test(entry.name)) yield full;
  }
}

const cache = new Map();
function canonical(token) {
  if (!cache.has(token)) {
    let result = null;
    if (/[-:[]/.test(token) && designSystem.candidatesToCss([token])[0]) {
      const [next] = designSystem.canonicalizeCandidates([token], { rem: 16 });
      if (next && next !== token) result = next;
    }
    cache.set(token, result);
  }
  return cache.get(token);
}

// Классы ищем только внутри строковых литералов.
const STRING = /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/g;

let total = 0;
for await (const file of walk(path.join(root, "src"))) {
  const source = await readFile(file, "utf8");
  const found = [];
  const output = source.replace(STRING, (literal, offset) =>
    literal.replace(/[^\s"'`]+/g, (token, inner) => {
      const next = canonical(token);
      if (!next) return token;
      const line = source.slice(0, offset + inner).split("\n").length;
      found.push(`${path.relative(root, file)}:${line}  ${token} → ${next}`);
      return next;
    }),
  );
  if (!found.length) continue;
  total += found.length;
  console.log(found.join("\n"));
  if (fix) await writeFile(file, output);
}

console.log(total ? `${fix ? "Исправлено" : "Найдено"}: ${total}` : "Неканонических классов нет");
if (total && !fix) process.exitCode = 1;
