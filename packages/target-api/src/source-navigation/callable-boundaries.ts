import type { AstReader, Node } from "@tsonic/tsts";

const callableBodyBoundaryKinds: ReadonlySet<string> = new Set([
  "KindFunctionDeclaration", "KindFunctionExpression", "KindArrowFunction", "KindMethodDeclaration",
  "KindConstructor", "KindGetAccessor", "KindSetAccessor",
]);

export function isSourceCallableBodyBoundary(ast: Pick<AstReader, "kindName">, node: Node): boolean {
  return callableBodyBoundaryKinds.has(ast.kindName(node));
}
