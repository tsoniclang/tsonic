import * as ts from "typescript";
import type {
  SourceSemanticFactKey,
  SourceSemanticFactStore,
} from "./semantic-view.js";
import { createSourceSemanticFactStore } from "./semantic-view.js";
import type {
  FrontendSourceCallLikeExpression,
  FrontendSourceSemanticView,
} from "./frontend-source-semantic-view.js";

const isSignatureDeclarationNode = (
  node: ts.Node
): node is ts.SignatureDeclaration =>
  ts.isCallSignatureDeclaration(node) ||
  ts.isConstructSignatureDeclaration(node) ||
  ts.isConstructorDeclaration(node) ||
  ts.isFunctionDeclaration(node) ||
  ts.isFunctionExpression(node) ||
  ts.isFunctionTypeNode(node) ||
  ts.isMethodDeclaration(node) ||
  ts.isMethodSignature(node) ||
  ts.isArrowFunction(node);

export const createTypeScriptSemanticView = (
  checker: ts.TypeChecker,
  facts: SourceSemanticFactStore<ts.Node> = createSourceSemanticFactStore()
): FrontendSourceSemanticView => ({
  engine: "typescript",
  getExpressionType: (expression: ts.Expression): ts.Type =>
    checker.getTypeAtLocation(expression),
  getContextualType: (expression: ts.Expression): ts.Type | undefined =>
    checker.getContextualType(expression) ?? undefined,
  getSymbol: (node: ts.Node): ts.Symbol | undefined =>
    checker.getSymbolAtLocation(node),
  getAliasedSymbol: (symbol: ts.Symbol): ts.Symbol =>
    checker.getAliasedSymbol(symbol),
  getExportSpecifierLocalTargetSymbol: (
    node: ts.Node
  ): ts.Symbol | undefined =>
    ts.isExportSpecifier(node)
      ? checker.getExportSpecifierLocalTargetSymbol(node)
      : undefined,
  getExportsOfModule: (symbol: ts.Symbol): readonly ts.Symbol[] =>
    checker.getExportsOfModule(symbol),
  getShorthandAssignmentValueSymbol: (node: ts.Node): ts.Symbol | undefined =>
    ts.isShorthandPropertyAssignment(node)
      ? checker.getShorthandAssignmentValueSymbol(node)
      : undefined,
  getDeclaredType: (symbol: ts.Symbol): ts.Type =>
    checker.getDeclaredTypeOfSymbol(symbol),
  getTypeFromTypeNode: (node: ts.Node): ts.Type | undefined =>
    ts.isTypeNode(node) ? checker.getTypeFromTypeNode(node) : undefined,
  getTypeOfSymbolAtLocation: (
    symbol: ts.Symbol,
    location: ts.Node
  ): ts.Type => checker.getTypeOfSymbolAtLocation(symbol, location),
  getTypeArguments: (type: ts.Type): readonly ts.Type[] =>
    checker.getTypeArguments(type as ts.TypeReference),
  getApparentType: (type: ts.Type): ts.Type => checker.getApparentType(type),
  getStringIndexType: (type: ts.Type): ts.Type | undefined =>
    type.getStringIndexType(),
  getNumberIndexType: (type: ts.Type): ts.Type | undefined =>
    type.getNumberIndexType(),
  getPropertyOfType: (type: ts.Type, key: string): ts.Symbol | undefined =>
    checker.getPropertyOfType(type, key),
  getCallSignatures: (type: ts.Type): readonly ts.Signature[] =>
    checker.getSignaturesOfType(type, ts.SignatureKind.Call),
  isArrayType: (type: ts.Type): boolean => checker.isArrayType(type),
  isTupleType: (type: ts.Type): boolean => checker.isTupleType(type),
  getResolvedSignature: (
    callExpression: FrontendSourceCallLikeExpression
  ): ts.Signature | undefined => checker.getResolvedSignature(callExpression),
  getSignatureFromDeclaration: (node: ts.Node): ts.Signature | undefined =>
    isSignatureDeclarationNode(node)
      ? checker.getSignatureFromDeclaration(node)
      : undefined,
  getReturnTypeOfSignature: (signature: ts.Signature): ts.Type =>
    checker.getReturnTypeOfSignature(signature),
  getTypePredicateOfSignature: (signature: ts.Signature): unknown =>
    checker.getTypePredicateOfSignature(signature),
  typeToTypeNode: (
    type: ts.Type,
    enclosingNode: ts.Node,
    flags: number
  ): ts.Node | undefined =>
    checker.typeToTypeNode(
      type,
      enclosingNode,
      flags as ts.NodeBuilderFlags
    ) ?? undefined,
  getFullyQualifiedName: (symbol: ts.Symbol): string =>
    checker.getFullyQualifiedName(symbol),
  getSymbolsInScope: (location: ts.Node, meaning: number): readonly ts.Symbol[] =>
    checker.getSymbolsInScope(location, meaning as ts.SymbolFlags),
  typeToString: (type: ts.Type): string => checker.typeToString(type),
  getFact: <T>(node: ts.Node, key: SourceSemanticFactKey<T>): T | undefined =>
    facts.get(node, key),
});
