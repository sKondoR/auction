import "server-only";
import { IS_DEMO } from "../config";

/**
 * Параметры динамического маршрута для `generateStaticParams`. Демо-сборка (static export)
 * пререндерит все страницы из демо-БД; обычная — ничего, страницы рендерятся по запросу.
 */
export async function demoStaticParams(ids: () => Promise<{ id: string | number }[]>): Promise<{ id: string }[]> {
  if (!IS_DEMO) return [];
  return (await ids()).map(({ id }) => ({ id: String(id) }));
}
