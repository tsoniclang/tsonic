import type { AstReader, Node } from "@tsonic/tsts";

export function createSourceDeclarationMembership<Definition>(
  ast: Pick<AstReader, "parent">,
  nodes: readonly Node[],
  definitions: ReadonlyMap<Node, Definition>,
): ReadonlyMap<Node, Definition> {
  const selected = new Map<Node, Definition | undefined>(definitions);
  const membership = new Map(definitions);
  for (const node of nodes) {
    if (!selected.has(node)) {
      const path: Node[] = [];
      let current: Node | undefined = node;
      while (current !== undefined && !selected.has(current)) {
        path.push(current);
        current = ast.parent(current);
      }
      const definition = current === undefined ? undefined : selected.get(current);
      for (const member of path) selected.set(member, definition);
    }
    const definition = selected.get(node);
    if (definition !== undefined) membership.set(node, definition);
  }
  return membership;
}
