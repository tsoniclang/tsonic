import * as ts from "typescript";

export type GenericFunctionValueNode = ts.ArrowFunction | ts.FunctionExpression;

export const isGenericFunctionValueNode = (
  node: ts.Node
): node is GenericFunctionValueNode =>
  (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) &&
  !!node.typeParameters &&
  node.typeParameters.length > 0;

export const isGenericFunctionDeclarationNode = (
  node: ts.Node
): node is ts.FunctionDeclaration =>
  ts.isFunctionDeclaration(node) &&
  !!node.name &&
  !!node.typeParameters &&
  node.typeParameters.length > 0;

const isGenericFunctionDeclarationSymbol = (symbol: ts.Symbol): boolean => {
  const declarations = symbol.declarations;
  if (!declarations || declarations.length === 0) return false;
  for (const declaration of declarations) {
    if (
      ts.isFunctionDeclaration(declaration) &&
      isGenericFunctionDeclarationNode(declaration)
    ) {
      return true;
    }
  }
  return false;
};

export const isDeterministicGenericFunctionAliasTargetSymbol = (
  symbol: ts.Symbol,
  supportedSymbols: ReadonlySet<ts.Symbol>
): boolean =>
  supportedSymbols.has(symbol) || isGenericFunctionDeclarationSymbol(symbol);

const resolveSymbol = (
  checker: ts.TypeChecker,
  node: ts.Node
): ts.Symbol | undefined => {
  const symbol = checker.getSymbolAtLocation(node);
  if (!symbol) return undefined;
  if (symbol.flags & ts.SymbolFlags.Alias) {
    return checker.getAliasedSymbol(symbol);
  }
  return symbol;
};

const getVariableDeclarationList = (
  declaration: ts.VariableDeclaration
): ts.VariableDeclarationList | undefined => {
  const list = declaration.parent;
  if (!ts.isVariableDeclarationList(list)) {
    return undefined;
  }
  return list;
};

const getConstLetKind = (
  declaration: ts.VariableDeclaration
): { readonly isConst: boolean; readonly isLet: boolean } | undefined => {
  const list = getVariableDeclarationList(declaration);
  if (!list) return undefined;

  const isConst = (list.flags & ts.NodeFlags.Const) !== 0;
  const isLet = (list.flags & ts.NodeFlags.Let) !== 0;
  if (!isConst && !isLet) return undefined;
  return { isConst, isLet };
};

const getVariableDeclarationSymbol = (
  checker: ts.TypeChecker,
  declaration: ts.VariableDeclaration
): ts.Symbol | undefined => {
  if (!ts.isIdentifier(declaration.name)) return undefined;
  return resolveSymbol(checker, declaration.name);
};

const isAssignmentOperator = (kind: ts.SyntaxKind): boolean => {
  switch (kind) {
    case ts.SyntaxKind.EqualsToken:
    case ts.SyntaxKind.PlusEqualsToken:
    case ts.SyntaxKind.MinusEqualsToken:
    case ts.SyntaxKind.AsteriskEqualsToken:
    case ts.SyntaxKind.AsteriskAsteriskEqualsToken:
    case ts.SyntaxKind.SlashEqualsToken:
    case ts.SyntaxKind.PercentEqualsToken:
    case ts.SyntaxKind.LessThanLessThanEqualsToken:
    case ts.SyntaxKind.GreaterThanGreaterThanEqualsToken:
    case ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken:
    case ts.SyntaxKind.AmpersandEqualsToken:
    case ts.SyntaxKind.BarEqualsToken:
    case ts.SyntaxKind.CaretEqualsToken:
    case ts.SyntaxKind.BarBarEqualsToken:
    case ts.SyntaxKind.AmpersandAmpersandEqualsToken:
    case ts.SyntaxKind.QuestionQuestionEqualsToken:
      return true;
    default:
      return false;
  }
};

const markAssignmentTargetSymbols = (
  checker: ts.TypeChecker,
  node: ts.Node,
  writes: Set<ts.Symbol>
): void => {
  if (ts.isIdentifier(node)) {
    const symbol = resolveSymbol(checker, node);
    if (symbol) writes.add(symbol);
    return;
  }

  if (ts.isParenthesizedExpression(node)) {
    markAssignmentTargetSymbols(checker, node.expression, writes);
    return;
  }

  if (ts.isArrayLiteralExpression(node)) {
    for (const element of node.elements) {
      if (ts.isOmittedExpression(element)) continue;
      if (ts.isSpreadElement(element)) {
        markAssignmentTargetSymbols(checker, element.expression, writes);
        continue;
      }
      markAssignmentTargetSymbols(checker, element, writes);
    }
    return;
  }

  if (ts.isObjectLiteralExpression(node)) {
    for (const property of node.properties) {
      if (ts.isShorthandPropertyAssignment(property)) {
        markAssignmentTargetSymbols(checker, property.name, writes);
        continue;
      }
      if (ts.isSpreadAssignment(property)) {
        markAssignmentTargetSymbols(checker, property.expression, writes);
        continue;
      }
      if (ts.isPropertyAssignment(property)) {
        markAssignmentTargetSymbols(checker, property.initializer, writes);
      }
    }
    return;
  }

  if (
    ts.isBinaryExpression(node) &&
    node.operatorToken.kind === ts.SyntaxKind.EqualsToken
  ) {
    markAssignmentTargetSymbols(checker, node.left, writes);
  }
};

export const collectWrittenSymbols = (
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker
): ReadonlySet<ts.Symbol> => {
  const writes = new Set<ts.Symbol>();

  const visit = (node: ts.Node): void => {
    if (
      ts.isBinaryExpression(node) &&
      isAssignmentOperator(node.operatorToken.kind)
    ) {
      markAssignmentTargetSymbols(checker, node.left, writes);
    }

    if (
      (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
      (node.operator === ts.SyntaxKind.PlusPlusToken ||
        node.operator === ts.SyntaxKind.MinusMinusToken)
    ) {
      markAssignmentTargetSymbols(checker, node.operand, writes);
    }

    if (ts.isForInStatement(node) || ts.isForOfStatement(node)) {
      if (!ts.isVariableDeclarationList(node.initializer)) {
        markAssignmentTargetSymbols(checker, node.initializer, writes);
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return writes;
};

export const getSupportedGenericFunctionValueSymbol = (
  node: GenericFunctionValueNode,
  checker: ts.TypeChecker,
  writtenSymbols: ReadonlySet<ts.Symbol>
): ts.Symbol | undefined => {
  const decl = node.parent;
  if (!ts.isVariableDeclaration(decl)) return undefined;
  if (decl.initializer !== node) return undefined;
  if (!ts.isIdentifier(decl.name)) return undefined;

  const kind = getConstLetKind(decl);
  if (!kind) return undefined;

  const list = decl.parent;
  const stmt = list.parent;
  if (!ts.isVariableStatement(stmt)) return undefined;

  const symbol = getVariableDeclarationSymbol(checker, decl);
  if (!symbol) return undefined;
  if (kind.isConst) return symbol;
  if (!writtenSymbols.has(symbol)) return symbol;
  return undefined;
};

export const getSupportedGenericFunctionDeclarationSymbol = (
  node: ts.FunctionDeclaration,
  checker: ts.TypeChecker
): ts.Symbol | undefined => {
  if (!isGenericFunctionDeclarationNode(node) || !node.name) return undefined;
  return resolveSymbol(checker, node.name);
};

const resolveAliasTargetSymbol = (
  declaration: ts.VariableDeclaration,
  checker: ts.TypeChecker,
  supportedSymbols: ReadonlySet<ts.Symbol>
): ts.Symbol | undefined => {
  if (!ts.isIdentifier(declaration.name)) return undefined;
  const kind = getConstLetKind(declaration);
  if (!kind) return undefined;
  if (!declaration.initializer || !ts.isIdentifier(declaration.initializer)) {
    return undefined;
  }

  const targetSymbol = resolveSymbol(checker, declaration.initializer);
  if (!targetSymbol) return undefined;
  if (
    !isDeterministicGenericFunctionAliasTargetSymbol(
      targetSymbol,
      supportedSymbols
    )
  ) {
    return undefined;
  }
  return targetSymbol;
};

export const getSupportedGenericFunctionAliasSymbol = (
  declaration: ts.VariableDeclaration,
  checker: ts.TypeChecker,
  writtenSymbols: ReadonlySet<ts.Symbol>,
  supportedSymbols: ReadonlySet<ts.Symbol>
): ts.Symbol | undefined => {
  const kind = getConstLetKind(declaration);
  if (!kind) return undefined;
  const targetSymbol = resolveAliasTargetSymbol(
    declaration,
    checker,
    supportedSymbols
  );
  if (!targetSymbol) return undefined;

  const symbol = getVariableDeclarationSymbol(checker, declaration);
  if (!symbol) return undefined;
  if (kind.isConst) return symbol;
  if (!writtenSymbols.has(symbol)) return symbol;
  return undefined;
};

export const collectSupportedGenericFunctionValueSymbols = (
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker,
  writtenSymbols: ReadonlySet<ts.Symbol>
): ReadonlySet<ts.Symbol> => {
  const symbols = new Set<ts.Symbol>();
  const declarations: ts.VariableDeclaration[] = [];

  const collect = (node: ts.Node): void => {
    if (isGenericFunctionValueNode(node)) {
      const symbol = getSupportedGenericFunctionValueSymbol(
        node,
        checker,
        writtenSymbols
      );
      if (symbol) symbols.add(symbol);
    }

    if (isGenericFunctionDeclarationNode(node)) {
      const symbol = getSupportedGenericFunctionDeclarationSymbol(
        node,
        checker
      );
      if (symbol) symbols.add(symbol);
    }

    if (ts.isImportSpecifier(node)) {
      const symbol = resolveSymbol(checker, node.name);
      if (symbol && isGenericFunctionDeclarationSymbol(symbol)) {
        symbols.add(symbol);
      }
    }

    if (ts.isVariableDeclaration(node)) {
      declarations.push(node);
    }

    ts.forEachChild(node, collect);
  };

  collect(sourceFile);

  let didChange = true;
  while (didChange) {
    didChange = false;
    for (const declaration of declarations) {
      const aliasSymbol = getSupportedGenericFunctionAliasSymbol(
        declaration,
        checker,
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
