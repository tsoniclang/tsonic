import { AsExpressionStatement } from "../source-navigation/checked-casts.js";
import type { AstReader, Node } from "@tsonic/tsts";

type SourceSafetyOperation =
  | { readonly kind: "unsafe-context"; readonly fact: { readonly kind: "expression"; readonly expression: Node } | { readonly kind: "remaining-block" } }
  | { readonly kind: "safety-builder"; readonly fact: { readonly kind: string } };

export function createSourceExplicitUnsafeContextIndex(ast: AstReader, roots: readonly Node[],
  read: (node: Node) => SourceSafetyOperation | undefined): ReadonlySet<Node> {
  const explicit = new Set<Node>();
  const expressionRoots = new Set<Node>();
  const pending = roots.map(node => ({ node, enabled: false }));
  while (pending.length !== 0) {
    const { node, enabled } = pending.pop()!;
    const operation = read(node);
    if (operation?.kind === "unsafe-context" && operation.fact.kind === "expression") expressionRoots.add(operation.fact.expression);
    let active = enabled || expressionRoots.has(node);
    if (ast.is.IsBlock(node)) {
      const first = ast.statements(node)[0];
      const expression = first === undefined ? undefined : AsExpressionStatement(ast, first)?.Expression;
      const marker = expression === undefined ? undefined : read(expression);
      active ||= marker?.kind === "unsafe-context" && marker.fact.kind === "remaining-block";
    }
    if (active) explicit.add(node);
    const children = ast.children(node);
    for (let index = children.length - 1; index >= 0; index--) {
      const child = children[index];
      if (child !== undefined) pending.push({ node: child, enabled: active });
    }
  }
  return explicit;
}
