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
  if (scope === undefined || ast.is.IsSourceFile(scope) || entryPoints.length === 0 || entryPoints.length > 65_536) return false;
  const selected = new Set(entryPoints);
  if (selected.size !== entryPoints.length) return false;
  const reachable = new Set<Node>();
  const callees = new Map<Node, Set<Node>>();
  let steps = 0;
  for (const entryPoint of entryPoints) {
    let current: Node | undefined = entryPoint;
    while (current !== undefined && current !== owner) {
      if (++steps > 262_144) return false;
      current = ast.parent(current);
    }
    if (current === owner) {
      reachable.add(entryPoint);
      continue;
    }
    if (!ast.is.IsFunctionDeclaration(entryPoint) || sourceBindingScope(entryPoint, ast) !== scope) return false;
    const uses = navigation.declarationUseSummary(entryPoint);
    if (uses.exported || uses.hasUnclassifiedValueUse) return false;
    for (const use of uses.uses) {
      if (++steps > 262_144) return false;
      if (use.kind === "type-only") continue;
      if (use.kind !== "direct-call") return false;
      let containing = ast.parent(use.reference);
      while (containing !== undefined && !selected.has(containing) && containing !== scope) {
        if (++steps > 262_144) return false;
        if (callableKinds.has(ast.kindName(containing))) return false;
        containing = ast.parent(containing);
      }
      if (containing === undefined || !selected.has(containing)) return false;
      const called = callees.get(containing) ?? new Set<Node>();
      called.add(entryPoint);
      callees.set(containing, called);
    }
  }
  const pending = [...reachable];
  while (pending.length > 0) {
    if (++steps > 262_144) return false;
    for (const callee of callees.get(pending.pop()!) ?? []) {
      if (reachable.has(callee)) continue;
      reachable.add(callee);
      pending.push(callee);
    }
  }
  if (reachable.size !== selected.size) return false;
  let current = ast.parent(owner);
  while (current !== undefined && current !== scope) {
    if (++steps > 262_144) return false;
    if (repeatedActivationKinds.has(ast.kindName(current))) return false;
    current = ast.parent(current);
  }
  if (current !== scope) return false;
  const uses = navigation.declarationUseSummary(declaration);
  return !uses.exported && !uses.hasUnclassifiedValueUse && uses.uses.every(use => {
    if (++steps > 262_144) return false;
    if (use.kind === "type-only") return true;
    for (let current = ast.parent(use.reference); current !== undefined; current = ast.parent(current)) {
      if (++steps > 262_144) return false;
      if (selected.has(current)) return true;
      if (current === owner || current === scope) return false;
    }
    return false;
  });
}

const callableKinds: ReadonlySet<string> = new Set([
  "KindArrowFunction", "KindFunctionExpression", "KindFunctionDeclaration", "KindMethodDeclaration",
  "KindGetAccessor", "KindSetAccessor", "KindConstructor",
]);

const repeatedActivationKinds: ReadonlySet<string> = new Set([
  "KindForStatement", "KindForInStatement", "KindForOfStatement", "KindWhileStatement", "KindDoStatement",
  "KindArrowFunction", "KindFunctionExpression", "KindFunctionDeclaration", "KindMethodDeclaration",
  "KindGetAccessor", "KindSetAccessor", "KindConstructor",
]);
