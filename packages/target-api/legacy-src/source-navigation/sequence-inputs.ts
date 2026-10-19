import type { AstReader, Node } from "@tsonic/tsts";

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
  let remaining = 2048;
  while (pending.length !== 0) {
    if (--remaining < 0) return undefined;
    const node = pending.pop()!;
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
  for (let remaining = 2048; remaining > 0; remaining--) {
    const parent = ast.parent(current);
    if (parent === undefined) return undefined;
    if (ast.is.IsSpreadElement(parent)) {
      const array = ast.parent(parent);
      return array !== undefined && ast.is.IsArrayLiteralExpression(array) ? parent : undefined;
    }
    if (ast.is.IsParenthesizedExpression(parent) || ast.is.IsSatisfiesExpression(parent) ||
      ast.is.IsBinaryExpression(parent) && ast.operatorKindName(parent) === "KindQuestionQuestionToken") {
      current = parent;
    } else return undefined;
  }
  return undefined;
}
