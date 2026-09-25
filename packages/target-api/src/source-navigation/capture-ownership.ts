import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceProgramNavigation } from "./types.js";
import { sourceBindingScope } from "./lexical-captures.js";

export function sourceBindingHasSingleCaptureOwner(
  declaration: Node,
  owner: Node,
  entryPoints: readonly Node[],
  ast: AstReader,
  navigation: Pick<SourceProgramNavigation, "declarationUseSummary">,
): boolean {
  const scope = sourceBindingScope(declaration, ast);
  if (scope === undefined || ast.is.IsSourceFile(scope) || entryPoints.length === 0) return false;
  for (const entryPoint of entryPoints) {
    let current: Node | undefined = entryPoint;
    while (current !== undefined && current !== owner) current = ast.parent(current);
    if (current !== owner) return false;
  }
  let current = ast.parent(owner);
  while (current !== undefined && current !== scope) {
    if (repeatedActivationKinds.has(ast.kindName(current))) return false;
    current = ast.parent(current);
  }
  if (current !== scope) return false;
  const uses = navigation.declarationUseSummary(declaration);
  const selected = new Set(entryPoints);
  return !uses.exported && uses.uses.every(use => {
    if (use.kind === "type-only") return true;
    for (let current = ast.parent(use.reference); current !== undefined; current = ast.parent(current)) {
      if (selected.has(current)) return true;
      if (current === owner || current === scope) return false;
    }
    return false;
  });
}

const repeatedActivationKinds: ReadonlySet<string> = new Set([
  "KindForStatement", "KindForInStatement", "KindForOfStatement", "KindWhileStatement", "KindDoStatement",
  "KindArrowFunction", "KindFunctionExpression", "KindFunctionDeclaration", "KindMethodDeclaration",
  "KindGetAccessor", "KindSetAccessor", "KindConstructor",
]);
