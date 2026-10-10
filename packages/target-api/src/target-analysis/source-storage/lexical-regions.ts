import type { AstReader, Node } from "@tsonic/tsts";
import { Node_Initializer } from "../../source-navigation/index.js";
import type { SourceStorageBudget } from "./resource-budget.js";

export function sourceStorageRegionOwner(ast: AstReader, region: Node): Node | undefined {
  const parent = ast.parent(region);
  if (parent === undefined) return undefined;
  if (ast.body(parent) === region) return parent;
  if (Node_Initializer(ast, parent) !== region) return undefined;
  if (ast.is.IsParameterDeclaration(parent) || ast.is.IsPropertyDeclaration(parent)) return ast.parent(parent);
  return undefined;
}

export function createSourceStorageLexicalSelections(ast: AstReader, budget: SourceStorageBudget) {
  const callable = (node: Node): boolean => ast.is.IsFunctionDeclaration(node) || ast.is.IsFunctionExpression(node) ||
    ast.is.IsArrowFunction(node) || ast.is.IsMethodDeclaration(node) || ast.is.IsConstructorDeclaration(node) ||
    ast.is.IsGetAccessorDeclaration(node) || ast.is.IsSetAccessorDeclaration(node);
  const query = (collect: (node: Node, selections: ReadonlyMap<Node, Node | undefined>) => Node | undefined): (node: Node) => Node | undefined => {
    const selections = new Map<Node, Node | undefined>();
    return node => {
      if (!budget.step()) return undefined;
      if (selections.has(node)) return selections.get(node);
      const selected = collect(node, selections);
      if (budget.failure() !== undefined || !budget.row()) return undefined;
      selections.set(node, selected);
      return selected;
    };
  };
  const enclosing = query((node, selections) => {
    let child = node;
    for (let parent = ast.parent(node); parent !== undefined && budget.step(); child = parent, parent = ast.parent(parent)) {
      if (selections.has(child)) return selections.get(child);
      if ((ast.is.IsParameterDeclaration(parent) || ast.is.IsPropertyDeclaration(parent)) &&
        Node_Initializer(ast, parent) === child) return child;
      if (callable(parent)) return ast.body(parent);
      if (ast.is.IsSourceFile(parent)) return parent;
    }
    return undefined;
  });
  const catchDestination = query((node, selections) => {
    let child = node;
    for (let parent = ast.parent(node); parent !== undefined && budget.step(); child = parent, parent = ast.parent(parent)) {
      if (selections.has(child)) return selections.get(child);
      if (callable(parent)) return undefined;
      if (!ast.is.IsTryStatement(parent)) continue;
      const selected = ast.as.AsTryStatement(parent);
      if (selected !== undefined && selected.TryBlock === child) {
        const caught = selected.CatchClause === undefined || !ast.is.IsCatchClause(selected.CatchClause)
          ? undefined : ast.as.AsCatchClause(selected.CatchClause)?.VariableDeclaration;
        if (caught !== undefined) return caught;
      }
    }
    return undefined;
  });
  return Object.freeze({ enclosing, catchDestination });
}
