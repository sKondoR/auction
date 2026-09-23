import type { SearchFilters } from "@auction/db";
import { LOT_FORMAT_LABELS } from "@auction/domain";
import { type SearchSort, createPgLotSearch } from "@auction/services";
import { getCategoryOptions, getFilterAttributes } from "@/entities/category/server";
import { LotGrid } from "@/entities/lot";
import { SaveSearchForm } from "@/features/engagement";
import { getDb, getViewer } from "@/shared/api";
import { kopecksToInput, parseRub, plural } from "@/shared/lib";
import { Button, EmptyState, Field, Input, Pagination, Select } from "@/shared/ui";

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export function parseFilters(sp: Params): SearchFilters {
  const attrs: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) if (k.startsWith("attr.") && one(v)) attrs[k.slice(5)] = one(v);
  const status = one(sp.status);
  return {
    q: one(sp.q) || undefined,
    categoryId: Number(one(sp.category)) || undefined,
    format: one(sp.format) || undefined,
    city: one(sp.city) || undefined,
    priceMin: parseRub(one(sp.priceMin)) ?? undefined,
    priceMax: parseRub(one(sp.priceMax)) ?? undefined,
    status: status === "ended" || status === "upcoming" ? status : "active",
    attrs: Object.keys(attrs).length ? attrs : undefined,
  };
}

export async function SearchPage({ searchParams }: { searchParams: Params }) {
  const filters = parseFilters(searchParams);
  const sort = (one(searchParams.sort) || undefined) as SearchSort | undefined;
  const page = Math.max(1, Number(one(searchParams.page)) || 1);
  const pageSize = 30;
  const [viewer, cats, attrDefs, result] = await Promise.all([
    getViewer(),
    getCategoryOptions(),
    filters.categoryId ? getFilterAttributes(filters.categoryId) : Promise.resolve([]),
    createPgLotSearch(getDb()).search(filters, { sort, page, pageSize }),
  ]);

  const href = (p: number) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) if (one(v) && k !== "page") u.set(k, one(v));
    u.set("page", String(p));
    return `/search?${u}`;
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <aside>
        <form action="/search" className="flex flex-col gap-4 rounded-lg border bg-surface p-4">
          <Field label="Запрос">
            <Input name="q" defaultValue={filters.q} placeholder="Например: рубль 1924" />
          </Field>
          <Field label="Торги">
            <Select name="status" defaultValue={filters.status}>
              <option value="active">Идущие</option>
              <option value="upcoming">Предстоящие</option>
              <option value="ended">Прошедшие</option>
            </Select>
          </Field>
          <Field label="Категория">
            <Select name="category" defaultValue={filters.categoryId ?? ""}>
              <option value="">Все категории</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
          {attrDefs.map((a) => (
            <Field key={a.id} label={a.name}>
              {a.type === "select" ? (
                <Select name={`attr.${a.key}`} defaultValue={filters.attrs?.[a.key] ?? ""}>
                  <option value="">Любое</option>
                  {a.options?.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </Select>
              ) : (
                <Input name={`attr.${a.key}`} defaultValue={filters.attrs?.[a.key] ?? ""} />
              )}
            </Field>
          ))}
          <Field label="Формат">
            <Select name="format" defaultValue={filters.format ?? ""}>
              <option value="">Любой</option>
              <option value="english">{LOT_FORMAT_LABELS.english}</option>
              <option value="fixed">{LOT_FORMAT_LABELS.fixed}</option>
            </Select>
          </Field>
          <Field label="Цена, ₽">
            <div className="flex gap-2">
              <Input name="priceMin" placeholder="от" defaultValue={kopecksToInput(filters.priceMin)} inputMode="decimal" />
              <Input name="priceMax" placeholder="до" defaultValue={kopecksToInput(filters.priceMax)} inputMode="decimal" />
            </div>
          </Field>
          <Field label="Город">
            <Input name="city" defaultValue={filters.city} />
          </Field>
          <Field label="Сортировка">
            <Select name="sort" defaultValue={sort ?? ""}>
              <option value="">По умолчанию</option>
              <option value="ending">Скоро завершатся</option>
              <option value="newest">Новые</option>
              <option value="price_asc">Сначала дешёвые</option>
              <option value="price_desc">Сначала дорогие</option>
              {filters.q && <option value="relevance">По релевантности</option>}
            </Select>
          </Field>
          <Button type="submit">Показать</Button>
        </form>
      </aside>

      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">
            {filters.q ? `«${filters.q}»` : filters.status === "ended" ? "Архив торгов" : "Лоты"}
            <span className="ml-2 text-base font-normal text-muted-foreground">
              {result.total} {plural(result.total, "лот", "лота", "лотов")}
            </span>
          </h1>
          {viewer && <SaveSearchForm filters={filters} defaultName={filters.q ?? "Мой поиск"} />}
        </div>
        {result.items.length ? (
          <>
            <LotGrid lots={result.items} />
            <Pagination page={page} total={result.total} pageSize={pageSize} href={href} />
          </>
        ) : (
          <EmptyState title="Ничего не нашлось">
            Попробуйте изменить запрос или фильтры.
            {viewer && " Сохраните поиск — пришлём уведомление, когда появятся подходящие лоты."}
          </EmptyState>
        )}
      </div>
    </div>
  );
}
