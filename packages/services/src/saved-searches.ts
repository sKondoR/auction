import { type Db, type SearchFilters, savedSearches } from "@auction/db";
import { eq } from "drizzle-orm";
import { flushUserEvents, notify } from "./notify";
import { createPgLotSearch } from "./search";

/** Строка запроса /search из фильтров сохранённого поиска. */
export function filtersToQuery(f: SearchFilters): string {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.categoryId) p.set("category", String(f.categoryId));
  if (f.format) p.set("format", f.format);
  if (f.city) p.set("city", f.city);
  if (f.priceMin != null) p.set("priceMin", String(f.priceMin / 100));
  if (f.priceMax != null) p.set("priceMax", String(f.priceMax / 100));
  if (f.status && f.status !== "active") p.set("status", f.status);
  for (const [k, v] of Object.entries(f.attrs ?? {})) if (v) p.set(`attr.${k}`, v);
  return p.toString();
}

/**
 * Проверка сохранённых поисков: новые лоты (созданные после прошлой проверки)
 * по каждому поиску — одно уведомление со сводкой.
 */
export async function checkSavedSearches(db: Db, now = new Date()): Promise<number> {
  const all = await db.select().from(savedSearches);
  const search = createPgLotSearch(db);
  let sent = 0;
  for (const s of all) {
    const { items, total } = await search.search(
      { ...s.filters, status: "active" },
      { createdAfter: s.lastCheckedAt, pageSize: 5, sort: "newest" },
    );
    const ids = await db.transaction(async (tx) => {
      await tx.update(savedSearches).set({ lastCheckedAt: now }).where(eq(savedSearches.id, s.id));
      if (total === 0) return [];
      sent++;
      return notify(tx, {
        userId: s.userId,
        type: "saved_search_match",
        title: `Новые лоты по поиску «${s.name}»: ${total}`,
        body: items.map((i) => `• ${i.title}`).join("\n"),
        link: `/search?${filtersToQuery(s.filters)}`,
      });
    });
    await flushUserEvents(ids);
  }
  return sent;
}
