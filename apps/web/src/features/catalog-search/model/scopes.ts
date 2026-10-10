import { type CategoryCover, POPULAR_CELLS } from "@/entities/category";

export type ScopeNode = { id: number; slug: string; name: string };
export type ScopeSection = ScopeNode & { children: ScopeNode[] };
export type ScopeCell = ScopeNode & { sectionId: number; cover: CategoryCover };

type TreeNode = { id: number; slug: string; name: string; children: TreeNode[] };

/**
 * Области поиска из дерева категорий: разделы с их категориями и фото-ячейки «Популярного»
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
    children: s.children.map((c) => ({ id: c.id, slug: c.slug, name: c.name })),
  }));
  const cells = POPULAR_CELLS.flatMap(([slug, cover]) => {
    const hit = bySlug.get(slug);
    return hit ? [{ id: hit.node.id, slug, name: hit.node.name, sectionId: hit.section.id, cover }] : [];
  });
  return { sections, cells };
}
