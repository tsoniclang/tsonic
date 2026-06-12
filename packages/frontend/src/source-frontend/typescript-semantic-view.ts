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

const hasTypeFlags = (type: ts.Type, flags: ts.TypeFlags): boolean =>
  (type.flags & flags) !== 0;

const isNullishType = (type: ts.Type): boolean =>
  hasTypeFlags(type, ts.TypeFlags.Null | ts.TypeFlags.Undefined);

const isNullishVoidOrNeverType = (type: ts.Type): boolean =>
  hasTypeFlags(
    type,
    ts.TypeFlags.Null |
      ts.TypeFlags.Undefined |
      ts.TypeFlags.Void |
      ts.TypeFlags.Never
  );

const isAnyUnknownVoidNeverOrTypeParameter = (type: ts.Type): boolean =>
  hasTypeFlags(
    type,
    ts.TypeFlags.Any |
      ts.TypeFlags.Unknown |
      ts.TypeFlags.Void |
      ts.TypeFlags.Never |
      ts.TypeFlags.TypeParameter
  );

const isAnyUnknownOrTypeParameter = (type: ts.Type): boolean =>
  hasTypeFlags(
    type,
    ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.TypeParameter
  );

const isSourceScalarLikeType = (type: ts.Type): boolean =>
  hasTypeFlags(
    type,
    ts.TypeFlags.StringLike |
      ts.TypeFlags.NumberLike |
      ts.TypeFlags.BooleanLike |
      ts.TypeFlags.BigIntLike |
      ts.TypeFlags.Null |
      ts.TypeFlags.Undefined
  );

const isStringLikeType = (type: ts.Type): boolean =>
  hasTypeFlags(
    type,
    ts.TypeFlags.String | ts.TypeFlags.StringLiteral | ts.TypeFlags.StringLike
  );

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
  resolveAlias: (symbol: ts.Symbol): ts.Symbol =>
    symbol.flags & ts.SymbolFlags.Alias
      ? checker.getAliasedSymbol(symbol)
      : symbol,
  getSymbolDeclarations: (symbol: ts.Symbol): readonly ts.Declaration[] =>
    symbol.getDeclarations() ?? [],
  getSymbolValueDeclaration: (
    symbol: ts.Symbol
  ): ts.Declaration | undefined =>
    symbol.valueDeclaration ?? symbol.getDeclarations()?.[0],
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
  getTypeOfSymbolAtLocation: (symbol: ts.Symbol, location: ts.Node): ts.Type =>
    checker.getTypeOfSymbolAtLocation(symbol, location),
  getTypeArguments: (type: ts.Type): readonly ts.Type[] =>
    checker.getTypeArguments(type as ts.TypeReference),
  getApparentType: (type: ts.Type): ts.Type => checker.getApparentType(type),
  getUnionMembers: (type: ts.Type): readonly ts.Type[] | undefined =>
    type.isUnion() ? type.types : undefined,
  getIntersectionMembers: (type: ts.Type): readonly ts.Type[] | undefined =>
    type.isIntersection() ? type.types : undefined,
  getUnionOrIntersectionMembers: (
    type: ts.Type
  ): readonly ts.Type[] | undefined =>
    type.isUnionOrIntersection() ? type.types : undefined,
  getNonNullishUnionMembers: (
    type: ts.Type
  ): readonly ts.Type[] | undefined =>
    type.isUnion()
      ? type.types.filter((member) => !isNullishType(member))
      : undefined,
  isNullishType,
  isNullishVoidOrNeverType,
  isAnyUnknownVoidNeverOrTypeParameter,
  isAnyUnknownOrTypeParameter,
  isSourceScalarLikeType,
  isStringLikeType,
  getStringIndexType: (type: ts.Type): ts.Type | undefined =>
    type.getStringIndexType(),
  getNumberIndexType: (type: ts.Type): ts.Type | undefined =>
    type.getNumberIndexType(),
  getPropertyOfType: (type: ts.Type, key: string): ts.Symbol | undefined =>
    checker.getPropertyOfType(type, key),
  getProperties: (type: ts.Type): readonly ts.Symbol[] => type.getProperties(),
  getCallSignatures: (type: ts.Type): readonly ts.Signature[] =>
    checker.getSignaturesOfType(type, ts.SignatureKind.Call),
  getConstructSignatures: (type: ts.Type): readonly ts.Signature[] =>
    type.getConstructSignatures(),
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
    checker.typeToTypeNode(type, enclosingNode, flags as ts.NodeBuilderFlags) ??
    undefined,
  getFullyQualifiedName: (symbol: ts.Symbol): string =>
    checker.getFullyQualifiedName(symbol),
  getSymbolsInScope: (
    location: ts.Node,
    meaning: number
  ): readonly ts.Symbol[] =>
    checker.getSymbolsInScope(location, meaning as ts.SymbolFlags),
  typeToString: (type: ts.Type): string => checker.typeToString(type),
  getFact: <T>(node: ts.Node, key: SourceSemanticFactKey<T>): T | undefined =>
    facts.get(key, node),
});
