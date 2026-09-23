import "server-only";
import { categories, categoryAttributes, getDb } from "@auction/db";
import { asc, eq, inArray } from "drizzle-orm";
import { cache } from "react";

export interface CategoryNode {
  id: number;
  slug: string;
  name: string;
  parentId: number | null;
  isHidden: boolean;
  position: number;
  children: CategoryNode[];
}

export const getCategoryTree = cache(async (includeHidden = false): Promise<CategoryNode[]> => {
  const rows = await getDb().select().from(categories).orderBy(asc(categories.position), asc(categories.name));
  const byId = new Map<number, CategoryNode>();
  for (const r of rows) if (includeHidden || !r.isHidden) byId.set(r.id, { ...r, children: [] });
  const roots: CategoryNode[] = [];
  for (const n of byId.values()) {
    const parent = n.parentId ? byId.get(n.parentId) : null;
    if (parent) parent.children.push(n);
    else if (!n.parentId) roots.push(n);
  }
  return roots;
});

/** Плоский список для select: «Монеты / СССР». */
export async function getCategoryOptions(): Promise<{ id: number; label: string }[]> {
  const tree = await getCategoryTree();
  const out: { id: number; label: string }[] = [];
  const walk = (nodes: CategoryNode[], prefix: string) => {
    for (const n of nodes) {
      out.push({ id: n.id, label: prefix + n.name });
      walk(n.children, `${prefix}${n.name} / `);
    }
  };
  walk(tree, "");
  return out;
}

/** Атрибуты для фильтров: категория и её родитель. */
export async function getFilterAttributes(categoryId: number) {
  const db = getDb();
  const [cat] = await db.select().from(categories).where(eq(categories.id, categoryId));
  if (!cat) return [];
  const ids = [cat.id, ...(cat.parentId ? [cat.parentId] : [])];
  return db
    .select()
    .from(categoryAttributes)
    .where(inArray(categoryAttributes.categoryId, ids))
    .orderBy(asc(categoryAttributes.position));
}

/** Все атрибуты всех категорий — для клиентской формы лота. */
export async function getAllAttributeDefs() {
  const db = getDb();
  const [cats, attrs] = await Promise.all([
    db.select({ id: categories.id, parentId: categories.parentId }).from(categories),
    db.select().from(categoryAttributes).orderBy(asc(categoryAttributes.position)),
  ]);
  const map: Record<number, typeof attrs> = {};
  for (const c of cats) {
    map[c.id] = attrs.filter((a) => a.categoryId === c.parentId || a.categoryId === c.id);
  }
  return map;
}
