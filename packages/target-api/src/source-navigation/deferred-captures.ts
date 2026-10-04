import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceProgramNavigation } from "./types.js";
import { sourceBindingScope } from "./lexical-captures.js";

export function sourceBindingCapturedBeforeInitialization(
  declaration: Node,
  ast: AstReader,
  navigation: Pick<SourceProgramNavigation, "declarationUses">,
): boolean {
  if (!ast.is.IsVariableDeclaration(declaration) || ast.as.AsVariableDeclaration(declaration)?.Initializer === undefined) return false;
  const scope = sourceBindingScope(declaration, ast);
  const boundary = ast.authoredRange(declaration);
  if (scope === undefined || ast.is.IsSourceFile(scope) || boundary.kind !== "authored") return false;
  const pending: { readonly declaration: Node; readonly captured: boolean }[] = [{ declaration, captured: false }];
  const visited = new Set<Node>();
  while (pending.length > 0) {
    const selected = pending.pop()!;
    if (visited.has(selected.declaration)) continue;
    visited.add(selected.declaration);
    for (const use of navigation.declarationUses(selected.declaration)) {
      if (use.kind === "type-only" || use.kind === "source-linkage") continue;
      let creation = use.reference;
      let captured = selected.captured;
      let item: Node | undefined;
      let current: Node | undefined = ast.parent(use.reference);
      while (current !== undefined && current !== scope) {
        if (ast.is.IsFunctionDeclaration(current) || ast.is.IsClassDeclaration(current)) {
          item = current;
          break;
        }
        if (ast.is.IsArrowFunction(current) || ast.is.IsFunctionExpression(current) || ast.is.IsClassExpression(current)) {
          creation = current;
          captured = true;
        }
        if (ast.is.IsObjectLiteralExpression(current) && captured) creation = current;
        if (ast.is.IsMethodDeclaration(current) || ast.is.IsGetAccessorDeclaration(current) || ast.is.IsSetAccessorDeclaration(current)) captured = true;
        current = ast.parent(current);
      }
      if (item !== undefined) {
        pending.push({ declaration: item, captured: true });
        continue;
      }
      if (!captured || current !== scope) continue;
      const range = ast.authoredRange(creation);
      if (range.kind === "authored" && range.start < boundary.end) return true;
    }
  }
  return false;
}
