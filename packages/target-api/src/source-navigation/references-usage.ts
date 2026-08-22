import type {
  AstReader,
  Node,
  Symbol,
} from "@tsonic/tsts";
import type {
  SourceBindingWrite,
} from "./types.js";

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
      .filter((write): write is SourceBindingWrite => write !== undefined),
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
  for (;;) {
    const parent = ast.parent(current);
    if (parent === undefined) {
      return undefined;
    }
    if (ast.is.IsBinaryExpression(parent)) {
      const binary = ast.as.AsBinaryExpression(parent);
      if (
        binary?.Left === current &&
        assignmentOperatorKinds.has(ast.operatorKindName(parent) ?? "")
      ) {
        return bindingWrite(reference, parent, "assignment");
      }
      return undefined;
    }
    if (ast.is.IsPrefixUnaryExpression(parent)) {
      const unary = ast.as.AsPrefixUnaryExpression(parent);
      return unary?.Operand === current &&
        updateOperatorKinds.has(ast.operatorKindName(parent) ?? "")
        ? bindingWrite(reference, parent, "update")
        : undefined;
    }
    if (ast.is.IsPostfixUnaryExpression(parent)) {
      const unary = ast.as.AsPostfixUnaryExpression(parent);
      return unary?.Operand === current &&
        updateOperatorKinds.has(ast.operatorKindName(parent) ?? "")
        ? bindingWrite(reference, parent, "update")
        : undefined;
    }
    if (ast.is.IsForInStatement(parent) || ast.is.IsForOfStatement(parent)) {
      const statement = ast.as.AsForInOrOfStatement(parent);
      return statement?.Initializer === current
        ? bindingWrite(reference, parent, "iteration")
        : undefined;
    }
    if (!isTransparentAssignmentTargetContainer(ast, parent, current)) {
      return undefined;
    }
    current = parent;
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
): SourceBindingWrite {
  return Object.freeze({ reference, operation, kind });
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
  if (ast.is.IsObjectLiteralExpression(parent)) {
    return ast.properties(parent).some((property) => property === child);
  }
  return false;
}
