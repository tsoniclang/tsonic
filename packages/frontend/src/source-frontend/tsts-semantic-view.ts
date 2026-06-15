import type {
  ExtensionTypeChecker,
  GoPtr,
  TstsNode,
  TstsSignature,
  TstsSymbol,
  TstsType,
} from "@tsonic/tsts";
import type {
  SourceSemanticFactKey,
  SourceSemanticFactStore,
  SourceSemanticView,
} from "./semantic-view.js";
import { createSourceSemanticFactStore } from "./semantic-view.js";

type TstsSemanticType = GoPtr<TstsType>;
type TstsSemanticSymbol = GoPtr<TstsSymbol>;
type TstsSemanticSignature = GoPtr<TstsSignature>;

export type TstsSourceCallLikeExpression = TstsNode;

export type TstsSourceSemanticView = SourceSemanticView<
  TstsNode,
  TstsNode,
  TstsNode,
  TstsSemanticType,
  TstsSemanticSymbol,
  TstsSemanticSignature,
  TstsNode,
  TstsNode
>;

const getSymbolDeclarations = (
  checker: ExtensionTypeChecker,
  symbol: TstsSemanticSymbol
): readonly TstsNode[] => {
  return checker.getSymbolDeclarations(symbol).filter(
    (node): node is TstsNode => node !== undefined
  );
};

const getExportedDeclarationFromChecker = (
  checker: ExtensionTypeChecker,
  sourceFile: TstsNode,
  exportedName: string
): TstsNode | undefined => {
  const symbol = checker.getSymbolAtLocation(sourceFile);
  if (!symbol) {
    return undefined;
  }
  const exported = checker
    .getExportsOfModule(symbol)
    .find((candidate) => checker.getSymbolName(candidate) === exportedName);
  const declarations =
    exported === undefined ? [] : checker.getSymbolDeclarations(exported);
  return declarations.find((node): node is TstsNode => node !== undefined);
};

const getExpressionType = (
  checker: ExtensionTypeChecker,
  expression: TstsNode
): TstsSemanticType => {
  return (
    checker.getNarrowedTypeAtLocation(expression) ??
    checker.getTypeAtLocation(expression)
  );
};

export const createTstsSemanticView = (
  checker: ExtensionTypeChecker,
  facts: SourceSemanticFactStore<TstsNode> = createSourceSemanticFactStore()
): TstsSourceSemanticView => ({
  engine: "tsts",
  getExpressionType: (expression: TstsNode): TstsSemanticType =>
    getExpressionType(checker, expression),
  getContextualType: (expression: TstsNode): TstsSemanticType =>
    checker.getContextualType(expression),
  getSymbol: (node: TstsNode): TstsSemanticSymbol =>
    checker.getSymbolAtLocation(node),
  resolveAlias: (symbol: TstsSemanticSymbol): TstsSemanticSymbol => {
    const resolved = checker.resolveAlias(symbol);
    return resolved ?? symbol;
  },
  getSymbolDeclarations: (symbol: TstsSemanticSymbol): readonly TstsNode[] =>
    getSymbolDeclarations(checker, symbol),
  getSymbolValueDeclaration: (symbol: TstsSemanticSymbol): TstsNode | undefined =>
    checker.getSymbolValueDeclaration(symbol),
  getTypeAliasOrSymbol: (type: TstsSemanticType): TstsSemanticSymbol =>
    checker.getTypeAliasOrSymbol(type),
  getTypeSymbolName: (type: TstsSemanticType): string | undefined =>
    checker.getTypeSymbolName(type),
  getTypeAliasSymbolName: (type: TstsSemanticType): string | undefined =>
    checker.getTypeAliasSymbolName(type),
  getExportSpecifierLocalTargetSymbol: (
    node: TstsNode
  ): TstsSemanticSymbol =>
    checker.getExportSpecifierLocalTargetSymbol(node),
  getExportedDeclaration: (
    sourceFile: TstsNode,
    exportedName: string
  ): TstsNode | undefined =>
    getExportedDeclarationFromChecker(checker, sourceFile, exportedName),
  getExportsOfModule: (
    symbol: TstsSemanticSymbol
  ): readonly TstsSemanticSymbol[] =>
    checker.getExportsOfModule(symbol).filter(
      (exported): exported is TstsSymbol => exported !== undefined
    ),
  getShorthandAssignmentValueSymbol: (node: TstsNode): TstsSemanticSymbol =>
    checker.getShorthandAssignmentValueSymbol(node),
  getDeclaredType: (symbol: TstsSemanticSymbol): TstsSemanticType =>
    checker.getDeclaredTypeOfSymbol(symbol),
  getTypeFromTypeNode: (node: TstsNode): TstsSemanticType =>
    checker.getTypeFromTypeNode(node),
  getTypeOfSymbolAtLocation: (
    symbol: TstsSemanticSymbol,
    location: TstsNode
  ): TstsSemanticType =>
    checker.getTypeOfSymbolAtLocation(symbol, location),
  getTypeArguments: (type: TstsSemanticType): readonly TstsSemanticType[] =>
    checker.getTypeArguments(type).filter(
      (argument): argument is TstsType => argument !== undefined
    ),
  getAliasTypeArguments: (
    type: TstsSemanticType
  ): readonly TstsSemanticType[] =>
    checker.getAliasTypeArguments(type).filter(
      (argument): argument is TstsType => argument !== undefined
    ),
  getReferenceTypeArguments: (
    type: TstsSemanticType
  ): readonly TstsSemanticType[] =>
    checker.getReferenceTypeArguments(type).filter(
      (argument): argument is TstsType => argument !== undefined
    ),
  getApparentType: (type: TstsSemanticType): TstsSemanticType =>
    checker.getApparentType(type),
  getUnionMembers: (
    type: TstsSemanticType
  ): readonly TstsSemanticType[] | undefined =>
    checker
      .getUnionMembers(type)
      ?.filter((member): member is TstsType => member !== undefined),
  getIntersectionMembers: (
    type: TstsSemanticType
  ): readonly TstsSemanticType[] | undefined =>
    checker
      .getIntersectionMembers(type)
      ?.filter((member): member is TstsType => member !== undefined),
  getUnionOrIntersectionMembers: (
    type: TstsSemanticType
  ): readonly TstsSemanticType[] | undefined =>
    checker
      .getUnionOrIntersectionMembers(type)
      ?.filter((member): member is TstsType => member !== undefined),
  getNonNullishUnionMembers: (
    type: TstsSemanticType
  ): readonly TstsSemanticType[] | undefined =>
    checker
      .getNonNullishUnionMembers(type)
      ?.filter((member): member is TstsType => member !== undefined),
  isNullishType: (type: TstsSemanticType): boolean => checker.isNullishType(type),
  isNullishVoidOrNeverType: (type: TstsSemanticType): boolean =>
    checker.isNullishVoidOrNeverType(type),
  isAnyUnknownVoidNeverOrTypeParameter: (type: TstsSemanticType): boolean =>
    checker.isAnyUnknownVoidNeverOrTypeParameter(type),
  isAnyUnknownOrTypeParameter: (type: TstsSemanticType): boolean =>
    checker.isAnyUnknownOrTypeParameter(type),
  isAnyOrUnknownType: (type: TstsSemanticType): boolean =>
    checker.isAnyOrUnknownType(type),
  isAnyType: (type: TstsSemanticType): boolean => checker.isAnyType(type),
  isUnknownType: (type: TstsSemanticType): boolean =>
    checker.isUnknownType(type),
  isNeverType: (type: TstsSemanticType): boolean => checker.isNeverType(type),
  isVoidType: (type: TstsSemanticType): boolean => checker.isVoidType(type),
  isUndefinedType: (type: TstsSemanticType): boolean =>
    checker.isUndefinedType(type),
  isNullType: (type: TstsSemanticType): boolean => checker.isNullType(type),
  isTypeParameter: (type: TstsSemanticType): boolean =>
    checker.isTypeParameter(type),
  isSourceScalarLikeType: (type: TstsSemanticType): boolean =>
    checker.isSourceScalarLikeType(type),
  isStringLikeType: (type: TstsSemanticType): boolean =>
    checker.isStringLikeType(type),
  isNumberLikeType: (type: TstsSemanticType): boolean =>
    checker.isNumberLikeType(type),
  isBooleanLikeType: (type: TstsSemanticType): boolean =>
    checker.isBooleanLikeType(type),
  isBigIntLikeType: (type: TstsSemanticType): boolean =>
    checker.isBigIntLikeType(type),
  isStringLiteralType: (type: TstsSemanticType): boolean =>
    checker.isStringLiteralType(type),
  isNumberLiteralType: (type: TstsSemanticType): boolean =>
    checker.isNumberLiteralType(type),
  isBooleanLiteralType: (type: TstsSemanticType): boolean =>
    checker.isBooleanLiteralType(type),
  isBigIntLiteralType: (type: TstsSemanticType): boolean =>
    checker.isBigIntLiteralType(type),
  getStringIndexType: (type: TstsSemanticType): TstsSemanticType =>
    checker.getStringIndexType(type),
  getNumberIndexType: (type: TstsSemanticType): TstsSemanticType =>
    checker.getNumberIndexType(type),
  getElementTypeOfArrayType: (type: TstsSemanticType): TstsSemanticType =>
    checker.getElementTypeOfArrayType(type),
  getPropertyOfType: (
    type: TstsSemanticType,
    key: string
  ): TstsSemanticSymbol =>
    checker.getPropertyOfType(type, key),
  getProperties: (type: TstsSemanticType): readonly TstsSemanticSymbol[] =>
    checker.getProperties(type).filter(
      (symbol): symbol is TstsSymbol => symbol !== undefined
    ),
  getCallSignatures: (
    type: TstsSemanticType
  ): readonly TstsSemanticSignature[] =>
    checker.getCallSignatures(type).filter(
      (signature): signature is TstsSignature => signature !== undefined
    ),
  getConstructSignatures: (
    type: TstsSemanticType
  ): readonly TstsSemanticSignature[] =>
    checker.getConstructSignatures(type).filter(
      (signature): signature is TstsSignature => signature !== undefined
    ),
  isArrayType: (type: TstsSemanticType): boolean => checker.isArrayType(type),
  isTupleType: (type: TstsSemanticType): boolean => checker.isTupleType(type),
  getResolvedSignature: (callExpression: TstsNode): TstsSemanticSignature =>
    checker.getResolvedSignature(callExpression),
  getSignatureDeclaration: (
    signature: TstsSemanticSignature
  ): TstsNode | undefined =>
    checker.getSignatureDeclaration(signature),
  getSignatureParameters: (
    signature: TstsSemanticSignature
  ): readonly TstsSemanticSymbol[] =>
    checker.getSignatureParameters(signature).filter(
      (symbol): symbol is TstsSymbol => symbol !== undefined
    ),
  signatureHasTypeParameters: (signature: TstsSemanticSignature): boolean =>
    checker.signatureHasTypeParameters(signature),
  getSignatureFromDeclaration: (node: TstsNode): TstsSemanticSignature =>
    checker.getSignatureFromDeclaration(node),
  getReturnTypeOfSignature: (signature: TstsSemanticSignature): TstsSemanticType =>
    checker.getReturnTypeOfSignature(signature),
  getTypePredicateOfSignature: (signature: TstsSemanticSignature): unknown =>
    checker.getTypePredicateOfSignature(signature),
  typeToTypeNode: (
    type: TstsSemanticType,
    enclosingNode: TstsNode,
    flags: number
  ): TstsNode | undefined =>
    checker.typeToTypeNode(type, enclosingNode, flags),
  getFullyQualifiedName: (symbol: TstsSemanticSymbol): string =>
    checker.getFullyQualifiedName(symbol),
  getSymbolsInScope: (
    location: TstsNode,
    meaning: number
  ): readonly TstsSemanticSymbol[] =>
    checker.getSymbolsInScope(location, meaning).filter(
      (symbol): symbol is TstsSymbol => symbol !== undefined
    ),
  typeToString: (type: TstsSemanticType): string => checker.typeToString(type),
  getFact: <T>(
    node: TstsNode,
    key: SourceSemanticFactKey<T>
  ): T | undefined => facts.get(key, node),
});
