import { type CategoryCover, POPULAR_CELLS } from "@/entities/category";

export type ScopeNode = { id: number; slug: string; name: string };
export type ScopeSection = ScopeNode & { children: ScopeNode[] };
export type ScopeCell = ScopeNode & { sectionId: number; cover: CategoryCover };

type TreeNode = { id: number; slug: string; name: string; children: TreeNode[] };

/** По алфавиту, «Другое» и «Разное» (`*-other`) — в конце. */
function sortCats(cats: ScopeNode[]) {
  return [...cats].sort((a, b) => {
    const oa = a.slug.endsWith("-other");
    const ob = b.slug.endsWith("-other");
    return oa !== ob ? (oa ? 1 : -1) : a.name.localeCompare(b.name, "ru");
  });
}

/**
 * Области поиска из дерева категорий: разделы с их категориями (уже в порядке показа) и фото-ячейки «Популярного»
 * (только те, чьи slug есть в дереве). Результат сериализуем — его передают в клиентский компонент.
 */
export function buildScopes(tree: TreeNode[]): { sections: ScopeSection[]; cells: ScopeCell[] } {
  const bySlug = new Map<string, { node: TreeNode; section: TreeNode }>();
  const walk = (nodes: TreeNode[], section: TreeNode | null) => {
    for (const n of nodes) {
      bySlug.set(n.slug, { node: n, section: section ?? n });
      walk(n.children, section ?? n);
    }
  };
  walk(tree, null);

  const sections = tree.map((s) => ({
    id: s.id,
    slug: s.slug,
    name: s.name,
    children: sortCats(s.children.map((c) => ({ id: c.id, slug: c.slug, name: c.name }))),
  }));
  const cells = POPULAR_CELLS.flatMap(([slug, cover]) => {
    const hit = bySlug.get(slug);
    return hit ? [{ id: hit.node.id, slug, name: hit.node.name, sectionId: hit.section.id, cover }] : [];
  });
  return { sections, cells };
}
