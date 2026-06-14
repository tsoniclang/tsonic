import { ExtensionFacts } from "@tsonic/tsts";
import type { ExtensionFactKeyLike } from "@tsonic/tsts";

export type SourceSemanticFactKey<T> = ExtensionFactKeyLike<T>;

export type SourceSemanticFactStore<TNode extends object> = ExtensionFacts & {
  readonly __sourceNode?: (node: TNode) => TNode;
};

export type SourceSemanticEngine = "tsts";

export type SourceSemanticView<
  TNode extends object,
  TExpression extends TNode,
  TCallLikeExpression extends TExpression,
  TType,
  TSymbol,
  TSignature,
  TDeclaration extends TNode = TNode,
  TSignatureDeclaration extends TDeclaration = TDeclaration,
> = {
  readonly engine: SourceSemanticEngine;
  getExpressionType(expression: TExpression): TType;
  getContextualType(expression: TExpression): TType | undefined;
  getSymbol(node: TNode): TSymbol | undefined;
  resolveAlias(symbol: TSymbol): TSymbol;
  getSymbolDeclarations(symbol: TSymbol): readonly TDeclaration[];
  getSymbolValueDeclaration(symbol: TSymbol): TDeclaration | undefined;
  getTypeAliasOrSymbol(type: TType): TSymbol | undefined;
  getTypeSymbolName(type: TType): string | undefined;
  getTypeAliasSymbolName(type: TType): string | undefined;
  getExportSpecifierLocalTargetSymbol(node: TNode): TSymbol | undefined;
  getExportedDeclaration(
    sourceFile: TNode,
    exportedName: string
  ): TDeclaration | undefined;
  getExportsOfModule(symbol: TSymbol): readonly TSymbol[];
  getShorthandAssignmentValueSymbol(node: TNode): TSymbol | undefined;
  getDeclaredType(symbol: TSymbol): TType;
  getTypeFromTypeNode(node: TNode): TType | undefined;
  getTypeOfSymbolAtLocation(symbol: TSymbol, location: TNode): TType;
  getTypeArguments(type: TType): readonly TType[];
  getAliasTypeArguments(type: TType): readonly TType[];
  getReferenceTypeArguments(type: TType): readonly TType[];
  getApparentType(type: TType): TType;
  getUnionMembers(type: TType): readonly TType[] | undefined;
  getIntersectionMembers(type: TType): readonly TType[] | undefined;
  getUnionOrIntersectionMembers(type: TType): readonly TType[] | undefined;
  getNonNullishUnionMembers(type: TType): readonly TType[] | undefined;
  isNullishType(type: TType): boolean;
  isNullishVoidOrNeverType(type: TType): boolean;
  isAnyUnknownVoidNeverOrTypeParameter(type: TType): boolean;
  isAnyUnknownOrTypeParameter(type: TType): boolean;
  isAnyOrUnknownType(type: TType): boolean;
  isAnyType(type: TType): boolean;
  isUnknownType(type: TType): boolean;
  isNeverType(type: TType): boolean;
  isVoidType(type: TType): boolean;
  isUndefinedType(type: TType): boolean;
  isNullType(type: TType): boolean;
  isTypeParameter(type: TType): boolean;
  isSourceScalarLikeType(type: TType): boolean;
  isStringLikeType(type: TType): boolean;
  isNumberLikeType(type: TType): boolean;
  isBooleanLikeType(type: TType): boolean;
  isBigIntLikeType(type: TType): boolean;
  isStringLiteralType(type: TType): boolean;
  isNumberLiteralType(type: TType): boolean;
  isBooleanLiteralType(type: TType): boolean;
  isBigIntLiteralType(type: TType): boolean;
  getStringIndexType(type: TType): TType | undefined;
  getNumberIndexType(type: TType): TType | undefined;
  getElementTypeOfArrayType(type: TType): TType | undefined;
  getPropertyOfType(type: TType, key: string): TSymbol | undefined;
  getProperties(type: TType): readonly TSymbol[];
  getCallSignatures(type: TType): readonly TSignature[];
  getConstructSignatures(type: TType): readonly TSignature[];
  isArrayType(type: TType): boolean;
  isTupleType(type: TType): boolean;
  getResolvedSignature(
    callExpression: TCallLikeExpression
  ): TSignature | undefined;
  getSignatureDeclaration(
    signature: TSignature
  ): TSignatureDeclaration | undefined;
  getSignatureParameters(signature: TSignature): readonly TSymbol[];
  signatureHasTypeParameters(signature: TSignature): boolean;
  getSignatureFromDeclaration(node: TNode): TSignature | undefined;
  getReturnTypeOfSignature(signature: TSignature): TType;
  getTypePredicateOfSignature(signature: TSignature): unknown;
  typeToTypeNode(
    type: TType,
    enclosingNode: TNode,
    flags: number
  ): TNode | undefined;
  getFullyQualifiedName(symbol: TSymbol): string;
  getSymbolsInScope(location: TNode, meaning: number): readonly TSymbol[];
  typeToString(type: TType): string;
  getFact<T>(node: TNode, key: SourceSemanticFactKey<T>): T | undefined;
};

export const createSourceSemanticFactStore = <
  TNode extends object,
>(): SourceSemanticFactStore<TNode> => new ExtensionFacts();
