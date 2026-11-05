import type { AstReader, Node } from "@tsonic/tsts";

const callableBodyBoundaryKinds: ReadonlySet<string> = new Set([
  "KindFunctionDeclaration", "KindFunctionExpression", "KindArrowFunction", "KindMethodDeclaration",
  "KindConstructor", "KindGetAccessor", "KindSetAccessor",
]);
const callableSignatureKinds: ReadonlySet<string> = new Set([
  "KindMethodSignature", "KindCallSignature", "KindConstructSignature", "KindFunctionType", "KindConstructorType",
]);

export function isSourceCallableBodyBoundary(ast: Pick<AstReader, "kindName">, node: Node): boolean {
  return callableBodyBoundaryKinds.has(ast.kindName(node));
}

export function isSourceCallableSignatureDeclaration(ast: Pick<AstReader, "kindName">, node: Node): boolean {
  return isSourceCallableBodyBoundary(ast, node) || callableSignatureKinds.has(ast.kindName(node));
}
