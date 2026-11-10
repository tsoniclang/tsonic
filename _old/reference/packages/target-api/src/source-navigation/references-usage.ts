import type { AstReader, Node } from "@tsonic/tsts";
import { Node_Expression } from "./ast.js";
import type { SourceNodeWrite, SourceNodeWriteValue } from "../source-model/navigation.js";

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
  declaration: Node,
  root: Node,
  referencesToDeclaration: (declaration: Node) => readonly Node[],
): readonly SourceNodeWrite[] {
  return Object.freeze(
    sourceReferencesWithin(ast, declaration, root, referencesToDeclaration)
      .map((reference) => sourceBindingWriteAtReference(ast, reference))
      .filter((write): write is SourceNodeWrite => write !== undefined && write.kind !== "initialization"),
  );
}

export function sourceReferencesWithin(
  ast: AstReader,
  declaration: Node,
  root: Node,
  referencesToDeclaration: (declaration: Node) => readonly Node[],
): readonly Node[] {
  return Object.freeze(
    referencesToDeclaration(declaration).filter((reference) =>
      sourceNodeIsWithin(ast, reference, root)),
  );
}

export function sourceHasReferenceOutside(
  ast: AstReader,
  declaration: Node,
  excludedNode: Node,
  referencesToDeclaration: (declaration: Node) => readonly Node[],
): boolean {
  return referencesToDeclaration(declaration).some((reference) =>
    !sourceNodeIsWithin(ast, reference, excludedNode));
}

export function sourceBindingWriteAtReference(
  ast: AstReader,
  reference: Node,
): SourceNodeWrite | undefined {
  let current = reference;
  let selected: SourceNodeWrite | undefined;
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

  function value(expression: Node, projection: readonly Node[]): SourceNodeWriteValue {
    return Object.freeze({ kind: "value", expression, projection: Object.freeze([...projection]) });
  }
}

export function sourceNodeIsWithin(
  ast: AstReader,
  node: Node,
  root: Node,
): boolean {
  let current: Node | undefined = node;
  const visited = new Set<Node>();
  while (current !== undefined) {
    if (current === root) {
      return true;
    }
    if (visited.has(current)) throw new Error("Original Source reference ancestry must be acyclic.");
    visited.add(current);
    current = ast.parent(current);
  }
  return false;
}

function bindingWrite(
  reference: Node,
  operation: Node,
  kind: SourceNodeWrite["kind"],
  values: readonly SourceNodeWriteValue[],
): SourceNodeWrite {
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
