/**
 * Cost center types — supports hierarchical parent/child relationships.
 * Used by /admin/cost-centers view and reusable CostCenterTree component.
 */

export interface CostCenter {
  cost_center_id: number;
  code: string;
  name: string;
  parent_id: number | null;
  active?: boolean;
}

export interface CostCenterNode extends CostCenter {
  depth: number;
  children: CostCenterNode[];
}

export interface CostCenterFormValues {
  code: string;
  name: string;
  parent_id: number | null;
}

export type CostCenterFormErrors = Partial<Record<keyof CostCenterFormValues, string>>;

export function buildCostCenterTree(items: CostCenter[]): CostCenterNode[] {
  const map = new Map<number, CostCenterNode>();
  items.forEach((item) => {
    map.set(item.cost_center_id, { ...item, depth: 0, children: [] });
  });

  const roots: CostCenterNode[] = [];
  map.forEach((node) => {
    if (node.parent_id != null && map.has(node.parent_id)) {
      const parent = map.get(node.parent_id)!;
      node.depth = parent.depth + 1;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const assignDepth = (node: CostCenterNode, depth: number) => {
    node.depth = depth;
    node.children.forEach((child) => assignDepth(child, depth + 1));
  };
  roots.forEach((root) => assignDepth(root, 0));

  const sortRec = (nodes: CostCenterNode[]): CostCenterNode[] => {
    nodes.sort((a, b) => a.code.localeCompare(b.code, "es", { sensitivity: "base" }));
    nodes.forEach((n) => sortRec(n.children));
    return nodes;
  };
  return sortRec(roots);
}

export function flattenCostCenterTree(nodes: CostCenterNode[]): CostCenterNode[] {
  const out: CostCenterNode[] = [];
  const walk = (list: CostCenterNode[]) => {
    list.forEach((n) => {
      out.push(n);
      walk(n.children);
    });
  };
  walk(nodes);
  return out;
}

export function getDescendantIds(nodes: CostCenterNode[], targetId: number): Set<number> {
  const result = new Set<number>();
  const find = (list: CostCenterNode[]): CostCenterNode | null => {
    for (const n of list) {
      if (n.cost_center_id === targetId) return n;
      const found = find(n.children);
      if (found) return found;
    }
    return null;
  };
  const target = find(nodes);
  if (!target) return result;
  const collect = (n: CostCenterNode) => {
    result.add(n.cost_center_id);
    n.children.forEach(collect);
  };
  collect(target);
  return result;
}
