import type { AstReader, Node, Symbol } from "@tsonic/tsts";
import { Node_Expression } from "./ast.js";
import type { SourceBindingWrite, SourceBindingWriteValue } from "./types.js";

const assignmentOperatorKinds = new Set([
  "KindEqualsToken",
  "KindPlusEqualsToken",
  "KindMinusEqualsToken",
  "KindAsteriskEqualsToken",
  "KindAsteriskAsteriskEqualsToken",
  "KindSlashEqualsToken",
  "KindPercentEqualsToken",
  "KindLessThanLessThanEqualsToken",
  "KindGreaterThanGreaterThanEqualsToken",
  "KindGreaterThanGreaterThanGreaterThanEqualsToken",
  "KindAmpersandEqualsToken",
  "KindBarEqualsToken",
  "KindCaretEqualsToken",
  "KindBarBarEqualsToken",
  "KindAmpersandAmpersandEqualsToken",
  "KindQuestionQuestionEqualsToken",
]);

const updateOperatorKinds = new Set([
  "KindPlusPlusToken",
  "KindMinusMinusToken",
]);

export function sourceBindingWritesWithin(
  ast: AstReader,
  symbol: Symbol,
  root: Node,
  referencesForSymbol: (symbol: Symbol) => readonly Node[],
): readonly SourceBindingWrite[] {
  return Object.freeze(
    sourceSymbolReferencesWithin(ast, symbol, root, referencesForSymbol)
      .map((reference) => sourceBindingWriteAtReference(ast, reference))
      .filter((write): write is SourceBindingWrite => write !== undefined && write.kind !== "initialization"),
  );
}

export function sourceSymbolReferencesWithin(
  ast: AstReader,
  symbol: Symbol,
  root: Node,
  referencesForSymbol: (symbol: Symbol) => readonly Node[],
): readonly Node[] {
  return Object.freeze(
    referencesForSymbol(symbol).filter((reference) =>
      sourceNodeIsWithin(ast, reference, root)),
  );
}

export function sourceSymbolHasReferenceOutside(
  ast: AstReader,
  symbol: Symbol,
  excludedNode: Node,
  referencesForSymbol: (symbol: Symbol) => readonly Node[],
): boolean {
  return referencesForSymbol(symbol).some((reference) =>
    !sourceNodeIsWithin(ast, reference, excludedNode));
}

export function sourceBindingWriteAtReference(
  ast: AstReader,
  reference: Node,
): SourceBindingWrite | undefined {
  let current = reference;
  let selected: SourceBindingWrite | undefined;
  let declaration: Node | undefined;
  const projection: Node[] = [];
  for (;;) {
    const parent = ast.parent(current);
    if (parent === undefined) return selected;
    if (ast.is.IsDeleteExpression(parent)) {
      return Node_Expression(ast, parent) === current
        ? bindingWrite(reference, parent, "deletion", []) : selected;
    }
    if (ast.is.IsBinaryExpression(parent)) {
      const binary = ast.as.AsBinaryExpression(parent);
      const operator = ast.operatorKindName(parent) ?? "";
      if (binary?.Left === current && assignmentOperatorKinds.has(operator) && binary.Right !== undefined) {
        const expression = operator === "KindEqualsToken" || operator === "KindBarBarEqualsToken" ||
          operator === "KindAmpersandAmpersandEqualsToken" || operator === "KindQuestionQuestionEqualsToken" ? binary.Right : parent;
        selected = bindingWrite(reference, parent, "assignment", [value(expression, projection), ...(selected?.values ?? [])]);
        current = parent;
        continue;
      }
      return selected;
    }
    if (ast.is.IsPrefixUnaryExpression(parent)) {
      const unary = ast.as.AsPrefixUnaryExpression(parent);
      return unary?.Operand === current &&
        updateOperatorKinds.has(ast.operatorKindName(parent) ?? "")
        ? bindingWrite(reference, parent, "update", [value(parent, [])]) : selected;
    }
    if (ast.is.IsPostfixUnaryExpression(parent)) {
      const unary = ast.as.AsPostfixUnaryExpression(parent);
      return unary?.Operand === current &&
        updateOperatorKinds.has(ast.operatorKindName(parent) ?? "")
        ? bindingWrite(reference, parent, "update", [value(parent, [])]) : selected;
    }
    if (ast.is.IsForInStatement(parent) || ast.is.IsForOfStatement(parent)) {
      const statement = ast.as.AsForInOrOfStatement(parent);
      return statement?.Initializer === current && statement.Expression !== undefined
        ? bindingWrite(reference, parent, "iteration", [Object.freeze({ kind: ast.is.IsForInStatement(parent)
          ? "iteration-key" : "iteration-value", expression: statement.Expression,
          projection: Object.freeze([declaration ?? current, ...projection]) }), ...(selected?.values ?? [])]) : selected;
    }
    if (ast.is.IsVariableDeclaration(parent) || ast.is.IsParameterDeclaration(parent) || ast.is.IsBindingElement(parent)) {
      if (ast.name(parent) !== current) return selected;
      const initializer = ast.is.IsVariableDeclaration(parent) ? ast.as.AsVariableDeclaration(parent)?.Initializer
        : ast.is.IsParameterDeclaration(parent) ? ast.as.AsParameterDeclaration(parent)?.Initializer : ast.as.AsBindingElement(parent)?.Initializer;
      if (initializer !== undefined) {
        selected = bindingWrite(reference, parent, "initialization", [value(initializer, projection), ...(selected?.values ?? [])]);
        if (!ast.is.IsBindingElement(parent)) return selected;
      }
      if (ast.is.IsVariableDeclaration(parent) || ast.is.IsParameterDeclaration(parent)) declaration = parent;
      current = parent;
      continue;
    }
    if (ast.is.IsVariableDeclarationList(parent)) {
      if (!ast.as.AsVariableDeclarationList(parent)?.Declarations?.Nodes?.includes(current)) return selected;
      current = parent;
      continue;
    }
    if (ast.is.IsShorthandPropertyAssignment(parent) && ast.name(parent) === current) {
      const initializer = ast.as.AsShorthandPropertyAssignment(parent)?.ObjectAssignmentInitializer;
      if (initializer !== undefined) selected = bindingWrite(reference, parent, "assignment",
        [value(initializer, projection), ...(selected?.values ?? [])]);
    }
    if (!isTransparentAssignmentTargetContainer(ast, parent, current)) {
      return selected;
    }
    if (ast.is.IsArrayLiteralExpression(parent) || ast.is.IsArrayBindingPattern(parent)) projection.unshift(current);
    if (ast.is.IsObjectLiteralExpression(parent) || ast.is.IsObjectBindingPattern(parent)) projection.unshift(current);
    current = parent;
  }

  function value(expression: Node, projection: readonly Node[]): SourceBindingWriteValue {
    return Object.freeze({ kind: "value", expression, projection: Object.freeze([...projection]) });
  }
}

function sourceNodeIsWithin(
  ast: AstReader,
  node: Node,
  root: Node,
): boolean {
  let current: Node | undefined = node;
  while (current !== undefined) {
    if (current === root) {
      return true;
    }
    current = ast.parent(current);
  }
  return false;
}

function bindingWrite(
  reference: Node,
  operation: Node,
  kind: SourceBindingWrite["kind"],
  values: readonly SourceBindingWriteValue[],
): SourceBindingWrite {
  return Object.freeze({ reference, operation, kind, values: Object.freeze([...values]) });
}

function isTransparentAssignmentTargetContainer(
  ast: AstReader,
  parent: Node,
  child: Node,
): boolean {
  if (ast.is.IsParenthesizedExpression(parent)) {
    return ast.as.AsParenthesizedExpression(parent)?.Expression === child;
  }
  if (ast.is.IsAsExpression(parent)) {
    return ast.as.AsAsExpression(parent)?.Expression === child;
  }
  if (ast.is.IsTypeAssertion(parent)) {
    return ast.as.AsTypeAssertion(parent)?.Expression === child;
  }
  if (ast.is.IsNonNullExpression(parent)) {
    return ast.as.AsNonNullExpression(parent)?.Expression === child;
  }
  if (ast.is.IsSatisfiesExpression(parent)) {
    return ast.as.AsSatisfiesExpression(parent)?.Expression === child;
  }
  if (ast.is.IsSpreadElement(parent)) {
    return ast.as.AsSpreadElement(parent)?.Expression === child;
  }
  if (ast.is.IsSpreadAssignment(parent)) {
    return ast.as.AsSpreadAssignment(parent)?.Expression === child;
  }
  if (ast.is.IsPropertyAssignment(parent)) {
    return ast.as.AsPropertyAssignment(parent)?.Initializer === child;
  }
  if (ast.is.IsShorthandPropertyAssignment(parent)) {
    return ast.name(parent) === child;
  }
  if (ast.is.IsArrayLiteralExpression(parent)) {
    return ast.elements(parent).some((element) => element === child);
  }
  if (ast.is.IsArrayBindingPattern(parent) || ast.is.IsObjectBindingPattern(parent)) {
    return ast.elements(parent).includes(child);
  }
  if (ast.is.IsObjectLiteralExpression(parent)) {
    return ast.properties(parent).some((property) => property === child);
  }
  return false;
}
