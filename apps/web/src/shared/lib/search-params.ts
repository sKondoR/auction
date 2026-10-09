import { IS_DEMO } from "../config";

/**
 * searchParams страницы. В демо-сборке (static export) страница рендерится один раз
 * при сборке, параметров запроса нет — возвращаем пустой объект.
 */
export async function readSearchParams<T extends object>(searchParams: Promise<T>): Promise<Partial<T>> {
  return IS_DEMO ? {} : searchParams;
}
