import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceProgramNavigation } from "./types.js";
import { sourceBindingScope } from "./lexical-captures.js";
import { sourceCallableValueExpression } from "./callable-values.js";
import { sourceBindingWriteAtReference } from "./references-usage.js";

/**
 * Whether a binding with a callable initializer, such as `const visit = () => { visit(); }`, is captured by a
 * function value created before its declaration completes.
 */
export function sourceBindingCapturedBeforeInitialization(
  declaration: Node,
  ast: AstReader,
  navigation: Pick<SourceProgramNavigation, "declarationUses">,
): boolean {
  if (!ast.is.IsVariableDeclaration(declaration)) return false;
  const initializer = sourceCallableValueExpression(ast, ast.as.AsVariableDeclaration(declaration)?.Initializer);
  if (initializer === undefined) return false;
  const scope = sourceBindingScope(declaration, ast);
  const boundaryEnd = authoredEnd(ast, declaration);
  if (scope === undefined || ast.is.IsSourceFile(scope) || boundaryEnd === undefined) return false;
  return capturedBefore(declaration, scope, initializer, boundaryEnd, ast, navigation);
}

/**
 * Whether a binding declared without an initializer, such as `let value: number; const read = () => value; value = 9;`,
 * is captured by a function value created before its first direct write in its own scope completes. A binding with
 * no such write is never initialized, so any capture reads it before initialization.
 */
export function sourceBindingCapturedBeforeFirstWrite(
  declaration: Node,
  ast: AstReader,
  navigation: Pick<SourceProgramNavigation, "declarationUses">,
): boolean {
  if (!ast.is.IsVariableDeclaration(declaration) || ast.as.AsVariableDeclaration(declaration)?.Initializer !== undefined) return false;
  const scope = sourceBindingScope(declaration, ast);
  if (scope === undefined || ast.is.IsSourceFile(scope)) return false;
  const boundaryEnd = firstDirectWriteEnd(declaration, scope, ast, navigation);
  return boundaryEnd !== undefined && capturedBefore(declaration, scope, undefined, boundaryEnd, ast, navigation);
}

function capturedBefore(
  declaration: Node,
  scope: Node,
  initializer: Node | undefined,
  boundaryEnd: number,
  ast: AstReader,
  navigation: Pick<SourceProgramNavigation, "declarationUses">,
): boolean {
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
      if (creation === initializer && (ast.is.IsArrowFunction(creation) || ast.is.IsFunctionExpression(creation))) continue;
      const range = ast.authoredRange(creation);
      if (range.kind === "authored" && range.start < boundaryEnd) return true;
    }
  }
  return false;
}

function authoredEnd(ast: AstReader, node: Node): number | undefined {
  const range = ast.authoredRange(node);
  return range.kind === "authored" ? range.end : undefined;
}

function firstDirectWriteEnd(
  declaration: Node,
  scope: Node,
  ast: AstReader,
  navigation: Pick<SourceProgramNavigation, "declarationUses">,
): number | undefined {
  let first: { readonly start: number; readonly end: number } | undefined;
  for (const use of navigation.declarationUses(declaration)) {
    if (use.kind === "type-only" || use.kind === "source-linkage") continue;
    const write = sourceBindingWriteAtReference(ast, use.reference);
    if (write === undefined || write.kind === "initialization") continue;
    let current: Node | undefined = ast.parent(use.reference);
    while (current !== undefined && current !== scope && !sourceCallableBoundary(ast, current)) current = ast.parent(current);
    if (current !== scope) continue;
    const range = ast.authoredRange(write.operation);
    if (range.kind !== "authored") return undefined;
    if (first === undefined || range.start < first.start) first = { start: range.start, end: range.end };
  }
  return first?.end ?? Number.POSITIVE_INFINITY;
}

function sourceCallableBoundary(ast: AstReader, node: Node): boolean {
  return ast.is.IsFunctionDeclaration(node) || ast.is.IsFunctionExpression(node) || ast.is.IsArrowFunction(node) ||
    ast.is.IsClassDeclaration(node) || ast.is.IsClassExpression(node) || ast.is.IsMethodDeclaration(node) ||
    ast.is.IsGetAccessorDeclaration(node) || ast.is.IsSetAccessorDeclaration(node) || ast.is.IsConstructorDeclaration(node);
}
