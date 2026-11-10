import type { AstReader, Node } from "@tsonic/tsts";
import { createSourceSyntaxDomain } from "./node-inventory.js";

export interface SourceSequenceInputChoice {
  readonly expression: Node;
  readonly inputs: readonly Node[];
  readonly controlNodes: readonly Node[];
}

export function sourceSequenceInputIsEmpty(ast: AstReader, node: Node): boolean {
  return ast.is.IsArrayLiteralExpression(node) && ast.elements(node).length === 0;
}

export function sourceSequenceInputChoice(ast: AstReader, expression: Node): SourceSequenceInputChoice | undefined {
  const inputs: Node[] = [];
  const controlNodes: Node[] = [];
  const pending = [expression];
  const contains = createSourceSyntaxDomain(ast, expression);
  const visited = new Set<Node>();
  while (pending.length !== 0) {
    const node = pending.pop()!;
    if (!contains(node) || visited.has(node)) return undefined;
    visited.add(node);
    if (ast.is.IsParenthesizedExpression(node) || ast.is.IsSatisfiesExpression(node)) {
      const operand = ast.is.IsParenthesizedExpression(node)
        ? ast.as.AsParenthesizedExpression(node)?.Expression : ast.as.AsSatisfiesExpression(node)?.Expression;
      if (operand === undefined) return undefined;
      controlNodes.push(node);
      pending.push(operand);
    } else if (ast.is.IsBinaryExpression(node) && ast.operatorKindName(node) === "KindQuestionQuestionToken") {
      const binary = ast.as.AsBinaryExpression(node);
      if (binary?.Left === undefined || binary.Right === undefined) return undefined;
      controlNodes.push(node);
      pending.push(binary.Right, binary.Left);
    } else {
      inputs.push(node);
    }
  }
  return Object.freeze({ expression, inputs: Object.freeze(inputs), controlNodes: Object.freeze(controlNodes) });
}

export function sourceSequenceConsumptionRoot(ast: AstReader, node: Node): Node | undefined {
  let current = node;
  const contains = createSourceSyntaxDomain(ast, node);
  const visited = new Set<Node>();
  while (contains(current) && !visited.has(current)) {
    visited.add(current);
    const parent = ast.parent(current);
    if (parent === undefined || !contains(parent)) return undefined;
    if (ast.is.IsSpreadElement(parent)) {
      const array = ast.parent(parent);
      return array !== undefined && contains(array) && ast.is.IsArrayLiteralExpression(array) ? parent : undefined;
    }
    if (ast.is.IsParenthesizedExpression(parent) || ast.is.IsSatisfiesExpression(parent) ||
      ast.is.IsBinaryExpression(parent) && ast.operatorKindName(parent) === "KindQuestionQuestionToken") {
      current = parent;
    } else return undefined;
  }
  return undefined;
}
