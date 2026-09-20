import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceProgramNavigation } from "./types.js";

export function sourceMayReadBeforeInitialization(
  declaration: Node,
  ast: AstReader,
  navigation: SourceProgramNavigation,
): boolean {
  const file = ast.getSourceFile(declaration);
  const boundary = ast.authoredRange(declaration);
  if (file === undefined || boundary.kind !== "authored") return true;
  const pending = [declaration];
  const visited = new Set<Node>();
  while (pending.length > 0) {
    const subject = pending.pop()!;
    if (visited.has(subject)) continue;
    visited.add(subject);
    for (const use of navigation.declarationUses(subject)) {
      if (use.kind === "type-only" || use.kind === "source-linkage" ||
        ast.getSourceFile(use.reference) !== file) continue;
      const range = ast.authoredRange(use.reference);
      if (range.kind !== "authored") return true;
      let current: Node | undefined = use.reference;
      let deferred = false;
      while (current !== undefined && current !== file) {
        const parent = ast.parent(current);
        if (parent === undefined) return true;
        if (ast.body(parent) === current && isCallable(ast, parent)) {
          const owner = callableOwner(parent, ast);
          if (owner === undefined) return true;
          if (ast.is.IsMethodDeclaration(owner) || ast.is.IsGetAccessorDeclaration(owner) ||
            ast.is.IsSetAccessorDeclaration(owner)) {
            const contracts = navigation.memberContracts(owner);
            if (contracts.kind !== "resolved") return true;
            pending.push(...contracts.contracts);
          }
          pending.push(owner);
          deferred = true;
          break;
        }
        current = parent;
      }
      if (!deferred && range.start < boundary.end) return true;
    }
  }
  return false;
}

function isCallable(ast: AstReader, node: Node): boolean {
  return ast.is.IsFunctionDeclaration(node) || ast.is.IsFunctionExpression(node) ||
    ast.is.IsArrowFunction(node) || ast.is.IsMethodDeclaration(node) ||
    ast.is.IsConstructorDeclaration(node) || ast.is.IsGetAccessorDeclaration(node) ||
    ast.is.IsSetAccessorDeclaration(node);
}

function callableOwner(node: Node, ast: AstReader): Node | undefined {
  if (ast.is.IsFunctionExpression(node) || ast.is.IsArrowFunction(node)) {
    const binding = ast.parent(node);
    return binding !== undefined && ast.is.IsVariableDeclaration(binding) &&
      ast.as.AsVariableDeclaration(binding)?.Initializer === node ? binding : undefined;
  }
  return ast.is.IsConstructorDeclaration(node) ? ast.parent(node) : node;
}
