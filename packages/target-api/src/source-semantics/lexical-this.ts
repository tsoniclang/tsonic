import type {
  AstReader,
  Node,
} from "@tsonic/tsts";

type LexicalThisAstReader = Pick<
  AstReader,
  "body" | "children" | "kindName"
>;

const ownThisBindingKinds = new Set([
  "KindClassDeclaration",
  "KindClassExpression",
  "KindConstructor",
  "KindFunctionDeclaration",
  "KindFunctionExpression",
  "KindGetAccessor",
  "KindMethodDeclaration",
  "KindSetAccessor",
]);

export function sourceCallableUsesLexicalThis(
  ast: LexicalThisAstReader,
  callable: Node,
): boolean {
  const body = ast.body(callable);
  return body !== undefined && containsLexicalThis(ast, body, body);
}

function containsLexicalThis(
  ast: LexicalThisAstReader,
  node: Node,
  root: Node,
): boolean {
  const kind = ast.kindName(node);
  if (kind === "KindThisKeyword") {
    return true;
  }
  if (node !== root && ownThisBindingKinds.has(kind)) {
    return false;
  }
  return ast.children(node).some((child) =>
    child !== undefined && containsLexicalThis(ast, child, root)
  );
}
