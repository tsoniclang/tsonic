import type { TstsNode } from "@tsonic/tsts";
import { forEachTstsChild, TstsSyntax } from "@tsonic/tsts";
import type { TstsFrontendSourceSemanticView } from "../source-frontend/index.js";
import {
  getNodeExpression,
  getNodeInitializer,
  getNodeProperties,
  getNodeTypeParameters,
  getVariableDeclarationListKind,
  isAssignmentOperator,
  isIdentifier,
  type SourceSymbol,
} from "./tsts-helpers.js";

export type GenericFunctionValueNode = TstsNode;

export const isGenericFunctionValueNode = (node: TstsNode): boolean =>
  (node.Kind === TstsSyntax.KindArrowFunction ||
    node.Kind === TstsSyntax.KindFunctionExpression) &&
  getNodeTypeParameters(node).length > 0;

export const isGenericFunctionDeclarationNode = (node: TstsNode): boolean =>
  node.Kind === TstsSyntax.KindFunctionDeclaration &&
  TstsSyntax.Node_Name(node) !== undefined &&
  getNodeTypeParameters(node).length > 0;

const resolveSymbol = (
  sourceSemantics: TstsFrontendSourceSemanticView,
  node: TstsNode
): SourceSymbol | undefined => {
  const symbol = sourceSemantics.getSymbol(node);
  if (!symbol) return undefined;
  return sourceSemantics.resolveAlias(symbol);
};

const isGenericFunctionDeclarationSymbol = (
  symbol: SourceSymbol,
  sourceSemantics: TstsFrontendSourceSemanticView
): boolean => {
  const declarations = sourceSemantics.getSymbolDeclarations(symbol);
  if (declarations.length === 0) return false;
  return declarations.some((declaration) =>
    isGenericFunctionDeclarationNode(declaration)
  );
};

const getVariableDeclarationSymbol = (
  sourceSemantics: TstsFrontendSourceSemanticView,
  declaration: TstsNode
): SourceSymbol | undefined => {
  const name = TstsSyntax.Node_Name(declaration);
  if (!name || !isIdentifier(name)) return undefined;
  return resolveSymbol(sourceSemantics, name);
};

const markAssignmentTargetSymbols = (
  sourceSemantics: TstsFrontendSourceSemanticView,
  node: TstsNode | undefined,
  writes: Set<SourceSymbol>
): void => {
  if (!node) return;

  if (isIdentifier(node)) {
    const symbol = resolveSymbol(sourceSemantics, node);
    if (symbol) writes.add(symbol);
    return;
  }

  if (node.Kind === TstsSyntax.KindParenthesizedExpression) {
    markAssignmentTargetSymbols(sourceSemantics, getNodeExpression(node), writes);
    return;
  }

  if (node.Kind === TstsSyntax.KindArrayLiteralExpression) {
    for (const element of TstsSyntax.AsArrayLiteralExpression(node)?.Elements
      ?.Nodes ?? []) {
      if (!element || element.Kind === TstsSyntax.KindOmittedExpression) continue;
      if (element.Kind === TstsSyntax.KindSpreadElement) {
        markAssignmentTargetSymbols(
          sourceSemantics,
          getNodeExpression(element),
          writes
        );
        continue;
      }
      markAssignmentTargetSymbols(sourceSemantics, element, writes);
    }
    return;
  }

  if (node.Kind === TstsSyntax.KindObjectLiteralExpression) {
    for (const property of getNodeProperties(node)) {
      if (property.Kind === TstsSyntax.KindShorthandPropertyAssignment) {
        markAssignmentTargetSymbols(
          sourceSemantics,
          TstsSyntax.Node_Name(property),
          writes
        );
        continue;
      }
      if (property.Kind === TstsSyntax.KindSpreadAssignment) {
        markAssignmentTargetSymbols(
          sourceSemantics,
          getNodeExpression(property),
          writes
        );
        continue;
      }
      if (property.Kind === TstsSyntax.KindPropertyAssignment) {
        markAssignmentTargetSymbols(
          sourceSemantics,
          TstsSyntax.AsPropertyAssignment(property)?.Initializer,
          writes
        );
      }
    }
    return;
  }

  if (node.Kind === TstsSyntax.KindBinaryExpression) {
    const binary = TstsSyntax.AsBinaryExpression(node);
    if (binary?.OperatorToken?.Kind === TstsSyntax.KindEqualsToken) {
      markAssignmentTargetSymbols(sourceSemantics, binary.Left, writes);
    }
  }
};

export const collectWrittenSymbols = (
  sourceFile: TstsNode,
  sourceSemantics: TstsFrontendSourceSemanticView
): ReadonlySet<SourceSymbol> => {
  const writes = new Set<SourceSymbol>();

  const visit = (node: TstsNode | undefined): void => {
    if (!node) return;
    if (node.Kind === TstsSyntax.KindBinaryExpression) {
      const binary = TstsSyntax.AsBinaryExpression(node);
      if (
        binary?.OperatorToken !== undefined &&
        isAssignmentOperator(binary.OperatorToken.Kind)
      ) {
        markAssignmentTargetSymbols(sourceSemantics, binary.Left, writes);
      }
    }

    if (
      node.Kind === TstsSyntax.KindPrefixUnaryExpression ||
      node.Kind === TstsSyntax.KindPostfixUnaryExpression
    ) {
      const unary =
        node.Kind === TstsSyntax.KindPrefixUnaryExpression
          ? TstsSyntax.AsPrefixUnaryExpression(node)
          : TstsSyntax.AsPostfixUnaryExpression(node);
      if (
        unary !== undefined &&
        (unary.Operator === TstsSyntax.KindPlusPlusToken ||
          unary.Operator === TstsSyntax.KindMinusMinusToken)
      ) {
        markAssignmentTargetSymbols(sourceSemantics, unary.Operand, writes);
      }
    }

    if (
      node.Kind === TstsSyntax.KindForInStatement ||
      node.Kind === TstsSyntax.KindForOfStatement
    ) {
      const initializer = TstsSyntax.AsForInOrOfStatement(node)?.Initializer;
      if (initializer?.Kind !== TstsSyntax.KindVariableDeclarationList) {
        markAssignmentTargetSymbols(sourceSemantics, initializer, writes);
      }
    }

    forEachTstsChild(node, visit);
  };

  visit(sourceFile);
  return writes;
};

export const getSupportedGenericFunctionValueSymbol = (
  node: GenericFunctionValueNode,
  sourceSemantics: TstsFrontendSourceSemanticView,
  writtenSymbols: ReadonlySet<SourceSymbol>
): SourceSymbol | undefined => {
  const declaration = node.Parent;
  if (declaration?.Kind !== TstsSyntax.KindVariableDeclaration) return undefined;
  if (getNodeInitializer(declaration) !== node) return undefined;
  if (!isIdentifier(TstsSyntax.Node_Name(declaration))) return undefined;

  const kind = getVariableDeclarationListKind(declaration);
  if (!kind) return undefined;

  const list = declaration.Parent;
  if (list?.Kind !== TstsSyntax.KindVariableDeclarationList) return undefined;
  const statement = list.Parent;
  if (statement?.Kind !== TstsSyntax.KindVariableStatement) return undefined;

  const symbol = getVariableDeclarationSymbol(sourceSemantics, declaration);
  if (!symbol) return undefined;
  if (kind.isConst) return symbol;
  if (!writtenSymbols.has(symbol)) return symbol;
  return undefined;
};

export const getSupportedGenericFunctionDeclarationSymbol = (
  node: TstsNode,
  sourceSemantics: TstsFrontendSourceSemanticView
): SourceSymbol | undefined => {
  if (!isGenericFunctionDeclarationNode(node)) return undefined;
  const name = TstsSyntax.Node_Name(node);
  return name ? resolveSymbol(sourceSemantics, name) : undefined;
};

const isDeterministicGenericFunctionAliasTargetSymbol = (
  symbol: SourceSymbol,
  supportedSymbols: ReadonlySet<SourceSymbol>,
  sourceSemantics: TstsFrontendSourceSemanticView
): boolean =>
  supportedSymbols.has(symbol) ||
  isGenericFunctionDeclarationSymbol(symbol, sourceSemantics);

const resolveAliasTargetSymbol = (
  declaration: TstsNode,
  sourceSemantics: TstsFrontendSourceSemanticView,
  supportedSymbols: ReadonlySet<SourceSymbol>
): SourceSymbol | undefined => {
  if (!isIdentifier(TstsSyntax.Node_Name(declaration))) return undefined;
  const kind = getVariableDeclarationListKind(declaration);
  if (!kind) return undefined;
  const initializer = getNodeInitializer(declaration);
  if (!initializer || !isIdentifier(initializer)) {
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

const getSupportedGenericFunctionAliasSymbol = (
  declaration: TstsNode,
  sourceSemantics: TstsFrontendSourceSemanticView,
  writtenSymbols: ReadonlySet<SourceSymbol>,
  supportedSymbols: ReadonlySet<SourceSymbol>
): SourceSymbol | undefined => {
  const kind = getVariableDeclarationListKind(declaration);
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
  sourceSemantics: TstsFrontendSourceSemanticView,
  writtenSymbols: ReadonlySet<SourceSymbol>
): ReadonlySet<SourceSymbol> => {
  const symbols = new Set<SourceSymbol>();
  const declarations: TstsNode[] = [];

  const collect = (node: TstsNode | undefined): void => {
    if (!node) return;
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

    if (node.Kind === TstsSyntax.KindImportSpecifier) {
      const name = TstsSyntax.Node_Name(node);
      const symbol = name ? resolveSymbol(sourceSemantics, name) : undefined;
      if (symbol && isGenericFunctionDeclarationSymbol(symbol, sourceSemantics)) {
        symbols.add(symbol);
      }
    }

    if (node.Kind === TstsSyntax.KindVariableDeclaration) {
      declarations.push(node);
    }

    forEachTstsChild(node, collect);
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
