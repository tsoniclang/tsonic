import type { TstsNode, TstsSymbol } from "@tsonic/tsts";
import {
  forEachTstsChild,
  getTstsNodeNameText,
  getTstsTypeParameterNodes,
  TstsSyntax,
} from "@tsonic/tsts";
import type { TstsSourceSemanticView } from "./source-frontend/index.js";

export type GenericFunctionValueNode = TstsNode;

export const isGenericFunctionValueNode = (
  node: TstsNode
): node is GenericFunctionValueNode =>
  (TstsSyntax.IsArrowFunction(node) || TstsSyntax.IsFunctionExpression(node)) &&
  getTstsTypeParameterNodes(node).length > 0;

export const isGenericFunctionDeclarationNode = (
  node: TstsNode
): boolean =>
  TstsSyntax.IsFunctionDeclaration(node) &&
  getTstsNodeNameText(node) !== undefined &&
  getTstsTypeParameterNodes(node).length > 0;

const isGenericFunctionDeclarationSymbol = (
  symbol: TstsSymbol,
  sourceSemantics: TstsSourceSemanticView
): boolean => {
  const declarations = sourceSemantics.getSymbolDeclarations(symbol);
  if (declarations.length === 0) return false;
  for (const declaration of declarations) {
    if (isGenericFunctionDeclarationNode(declaration)) {
      return true;
    }
  }
  return false;
};

export const isDeterministicGenericFunctionAliasTargetSymbol = (
  symbol: TstsSymbol,
  supportedSymbols: ReadonlySet<TstsSymbol>,
  sourceSemantics: TstsSourceSemanticView
): boolean =>
  supportedSymbols.has(symbol) ||
  isGenericFunctionDeclarationSymbol(symbol, sourceSemantics);

const resolveSymbol = (
  sourceSemantics: TstsSourceSemanticView,
  node: TstsNode
): TstsSymbol | undefined => {
  const symbol = sourceSemantics.getSymbol(node);
  if (!symbol) return undefined;
  return sourceSemantics.resolveAlias(symbol) ?? symbol;
};

const getVariableDeclarationList = (
  declaration: TstsNode
): TstsNode | undefined => {
  const list = declaration.Parent;
  return list && TstsSyntax.IsVariableDeclarationList(list) ? list : undefined;
};

const getConstLetKind = (
  declaration: TstsNode
): { readonly isConst: boolean; readonly isLet: boolean } | undefined => {
  const list = getVariableDeclarationList(declaration);
  if (!list) return undefined;
  const flags = TstsSyntax.AsVariableDeclarationList(list)?.Flags ?? 0;

  const isConst = (flags & TstsSyntax.NodeFlagsConst) !== 0;
  const isLet = (flags & TstsSyntax.NodeFlagsLet) !== 0;
  if (!isConst && !isLet) return undefined;
  return { isConst, isLet };
};

const getVariableDeclarationSymbol = (
  sourceSemantics: TstsSourceSemanticView,
  declaration: TstsNode
): TstsSymbol | undefined => {
  const name = TstsSyntax.Node_Name(declaration);
  if (!name || !TstsSyntax.IsIdentifier(name)) return undefined;
  return resolveSymbol(sourceSemantics, name);
};

const isAssignmentOperator = (kind: number): boolean => {
  switch (kind) {
    case TstsSyntax.KindEqualsToken:
    case TstsSyntax.KindPlusEqualsToken:
    case TstsSyntax.KindMinusEqualsToken:
    case TstsSyntax.KindAsteriskEqualsToken:
    case TstsSyntax.KindAsteriskAsteriskEqualsToken:
    case TstsSyntax.KindSlashEqualsToken:
    case TstsSyntax.KindPercentEqualsToken:
    case TstsSyntax.KindLessThanLessThanEqualsToken:
    case TstsSyntax.KindGreaterThanGreaterThanEqualsToken:
    case TstsSyntax.KindGreaterThanGreaterThanGreaterThanEqualsToken:
    case TstsSyntax.KindAmpersandEqualsToken:
    case TstsSyntax.KindBarEqualsToken:
    case TstsSyntax.KindCaretEqualsToken:
    case TstsSyntax.KindBarBarEqualsToken:
    case TstsSyntax.KindAmpersandAmpersandEqualsToken:
    case TstsSyntax.KindQuestionQuestionEqualsToken:
      return true;
    default:
      return false;
  }
};

const markAssignmentTargetSymbols = (
  sourceSemantics: TstsSourceSemanticView,
  node: TstsNode,
  writes: Set<TstsSymbol>
): void => {
  if (TstsSyntax.IsIdentifier(node)) {
    const symbol = resolveSymbol(sourceSemantics, node);
    if (symbol) writes.add(symbol);
    return;
  }

  if (TstsSyntax.IsParenthesizedExpression(node)) {
    const expression = TstsSyntax.Node_Expression(node);
    if (expression) {
      markAssignmentTargetSymbols(sourceSemantics, expression, writes);
    }
    return;
  }

  if (TstsSyntax.IsArrayLiteralExpression(node)) {
    for (const element of TstsSyntax.Node_Elements(node) ?? []) {
      if (!element || TstsSyntax.IsOmittedExpression(element)) continue;
      const target = TstsSyntax.IsSpreadElement(element)
        ? TstsSyntax.Node_Expression(element)
        : element;
      if (target) {
        markAssignmentTargetSymbols(sourceSemantics, target, writes);
      }
    }
    return;
  }

  if (TstsSyntax.IsObjectLiteralExpression(node)) {
    for (const property of TstsSyntax.Node_Properties(node) ?? []) {
      if (!property) continue;
      if (TstsSyntax.IsShorthandPropertyAssignment(property)) {
        const name = TstsSyntax.Node_Name(property);
        if (name) markAssignmentTargetSymbols(sourceSemantics, name, writes);
        continue;
      }
      if (TstsSyntax.IsSpreadAssignment(property)) {
        const expression = TstsSyntax.Node_Expression(property);
        if (expression) {
          markAssignmentTargetSymbols(sourceSemantics, expression, writes);
        }
        continue;
      }
      if (TstsSyntax.IsPropertyAssignment(property)) {
        const initializer = TstsSyntax.Node_Initializer(property);
        if (initializer) {
          markAssignmentTargetSymbols(sourceSemantics, initializer, writes);
        }
      }
    }
    return;
  }

  if (TstsSyntax.IsBinaryExpression(node)) {
    const expression = TstsSyntax.AsBinaryExpression(node);
    if (
      expression?.OperatorToken?.Kind === TstsSyntax.KindEqualsToken &&
      expression.Left
    ) {
      markAssignmentTargetSymbols(sourceSemantics, expression.Left, writes);
    }
  }
};

export const collectWrittenSymbols = (
  sourceFile: TstsNode,
  sourceSemantics: TstsSourceSemanticView
): ReadonlySet<TstsSymbol> => {
  const writes = new Set<TstsSymbol>();

  const visit = (node: TstsNode): void => {
    if (TstsSyntax.IsBinaryExpression(node)) {
      const expression = TstsSyntax.AsBinaryExpression(node);
      const operatorKind = expression?.OperatorToken?.Kind;
      if (operatorKind !== undefined && isAssignmentOperator(operatorKind)) {
        if (expression?.Left) {
          markAssignmentTargetSymbols(sourceSemantics, expression.Left, writes);
        }
      }
    }

    if (TstsSyntax.IsPrefixUnaryExpression(node)) {
      const expression = TstsSyntax.AsPrefixUnaryExpression(node);
      if (
        (expression?.Operator === TstsSyntax.KindPlusPlusToken ||
          expression?.Operator === TstsSyntax.KindMinusMinusToken) &&
        expression.Operand
      ) {
        markAssignmentTargetSymbols(sourceSemantics, expression.Operand, writes);
      }
    }

    if (TstsSyntax.IsPostfixUnaryExpression(node)) {
      const expression = TstsSyntax.AsPostfixUnaryExpression(node);
      if (
        (expression?.Operator === TstsSyntax.KindPlusPlusToken ||
          expression?.Operator === TstsSyntax.KindMinusMinusToken) &&
        expression.Operand
      ) {
        markAssignmentTargetSymbols(sourceSemantics, expression.Operand, writes);
      }
    }

    if (TstsSyntax.IsForInStatement(node) || TstsSyntax.IsForOfStatement(node)) {
      const initializer = TstsSyntax.AsForInOrOfStatement(node)?.Initializer;
      if (initializer && !TstsSyntax.IsVariableDeclarationList(initializer)) {
        markAssignmentTargetSymbols(sourceSemantics, initializer, writes);
      }
    }

    forEachTstsChild(node, (child) => {
      if (child) visit(child);
    });
  };

  visit(sourceFile);
  return writes;
};

export const getSupportedGenericFunctionValueSymbol = (
  node: GenericFunctionValueNode,
  sourceSemantics: TstsSourceSemanticView,
  writtenSymbols: ReadonlySet<TstsSymbol>
): TstsSymbol | undefined => {
  const decl = node.Parent;
  if (!decl || !TstsSyntax.IsVariableDeclaration(decl)) return undefined;
  if (TstsSyntax.Node_Initializer(decl) !== node) return undefined;
  const name = TstsSyntax.Node_Name(decl);
  if (!name || !TstsSyntax.IsIdentifier(name)) return undefined;

  const kind = getConstLetKind(decl);
  if (!kind) return undefined;

  const list = getVariableDeclarationList(decl);
  if (!list) return undefined;
  const stmt = list.Parent;
  if (!stmt || !TstsSyntax.IsVariableStatement(stmt)) return undefined;

  const symbol = getVariableDeclarationSymbol(sourceSemantics, decl);
  if (!symbol) return undefined;
  if (kind.isConst) return symbol;
  if (!writtenSymbols.has(symbol)) return symbol;
  return undefined;
};

export const getSupportedGenericFunctionDeclarationSymbol = (
  node: TstsNode,
  sourceSemantics: TstsSourceSemanticView
): TstsSymbol | undefined => {
  if (!isGenericFunctionDeclarationNode(node)) return undefined;
  const name = TstsSyntax.Node_Name(node);
  if (!name) return undefined;
  return resolveSymbol(sourceSemantics, name);
};

const resolveAliasTargetSymbol = (
  declaration: TstsNode,
  sourceSemantics: TstsSourceSemanticView,
  supportedSymbols: ReadonlySet<TstsSymbol>
): TstsSymbol | undefined => {
  const name = TstsSyntax.Node_Name(declaration);
  if (!name || !TstsSyntax.IsIdentifier(name)) return undefined;
  const kind = getConstLetKind(declaration);
  if (!kind) return undefined;
  const initializer = TstsSyntax.Node_Initializer(declaration);
  if (!initializer || !TstsSyntax.IsIdentifier(initializer)) {
    return undefined;
  }

  const targetSymbol = resolveSymbol(sourceSemantics, initializer);
  if (!targetSymbol) return undefined;
  if (
    !isDeterministicGenericFunctionAliasTargetSymbol(
      targetSymbol,
      supportedSymbols,
      sourceSemantics
    )
  ) {
    return undefined;
  }
  return targetSymbol;
};

export const getSupportedGenericFunctionAliasSymbol = (
  declaration: TstsNode,
  sourceSemantics: TstsSourceSemanticView,
  writtenSymbols: ReadonlySet<TstsSymbol>,
  supportedSymbols: ReadonlySet<TstsSymbol>
): TstsSymbol | undefined => {
  const kind = getConstLetKind(declaration);
  if (!kind) return undefined;
  const targetSymbol = resolveAliasTargetSymbol(
    declaration,
    sourceSemantics,
    supportedSymbols
  );
  if (!targetSymbol) return undefined;

  const symbol = getVariableDeclarationSymbol(sourceSemantics, declaration);
  if (!symbol) return undefined;
  if (kind.isConst) return symbol;
  if (!writtenSymbols.has(symbol)) return symbol;
  return undefined;
};

export const collectSupportedGenericFunctionValueSymbols = (
  sourceFile: TstsNode,
  sourceSemantics: TstsSourceSemanticView,
  writtenSymbols: ReadonlySet<TstsSymbol>
): ReadonlySet<TstsSymbol> => {
  const symbols = new Set<TstsSymbol>();
  const declarations: TstsNode[] = [];

  const collect = (node: TstsNode): void => {
    if (isGenericFunctionValueNode(node)) {
      const symbol = getSupportedGenericFunctionValueSymbol(
        node,
        sourceSemantics,
        writtenSymbols
      );
      if (symbol) symbols.add(symbol);
    }

    if (isGenericFunctionDeclarationNode(node)) {
      const symbol = getSupportedGenericFunctionDeclarationSymbol(
        node,
        sourceSemantics
      );
      if (symbol) symbols.add(symbol);
    }

    if (TstsSyntax.IsImportSpecifier(node)) {
      const name = TstsSyntax.Node_Name(node);
      const symbol = name ? resolveSymbol(sourceSemantics, name) : undefined;
      if (symbol && isGenericFunctionDeclarationSymbol(symbol, sourceSemantics)) {
        symbols.add(symbol);
      }
    }

    if (TstsSyntax.IsVariableDeclaration(node)) {
      declarations.push(node);
    }

    forEachTstsChild(node, (child) => {
      if (child) collect(child);
    });
  };

  collect(sourceFile);

  let didChange = true;
  while (didChange) {
    didChange = false;
    for (const declaration of declarations) {
      const aliasSymbol = getSupportedGenericFunctionAliasSymbol(
        declaration,
        sourceSemantics,
        writtenSymbols,
        symbols
      );
      if (aliasSymbol && !symbols.has(aliasSymbol)) {
        symbols.add(aliasSymbol);
        didChange = true;
      }
    }
  }

  return symbols;
};
