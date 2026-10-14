import type { AstReader, Node } from "@tsonic/tsts";

// One question: does this node start a separate callable body? Statements and expressions inside such a body run
// when the callable runs, not when the enclosing code runs. A class static block is not in this set: it runs
// immediately as part of class evaluation. Other questions (call targets, name scopes, lexical receivers) keep
// their own sets.
const callableBodyBoundaryKinds: ReadonlySet<string> = new Set([
  "KindFunctionDeclaration", "KindFunctionExpression", "KindArrowFunction", "KindMethodDeclaration",
  "KindConstructor", "KindGetAccessor", "KindSetAccessor",
]);

export function isSourceCallableBodyBoundary(ast: Pick<AstReader, "kindName">, node: Node): boolean {
  return callableBodyBoundaryKinds.has(ast.kindName(node));
}
