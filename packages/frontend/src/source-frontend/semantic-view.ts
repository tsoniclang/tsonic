import { ExtensionFacts } from "@tsonic/tsts";
import type { ExtensionFactKeyLike } from "@tsonic/tsts";

export type SourceSemanticFactKey<T> = ExtensionFactKeyLike<T>;

export type SourceSemanticFactStore<TNode extends object> = ExtensionFacts & {
  readonly __sourceNode?: (node: TNode) => TNode;
};

export type SourceSemanticEngine = "typescript";

export type SourceSemanticView<
  TNode extends object,
  TExpression extends TNode,
  TCallLikeExpression extends TExpression,
  TType,
  TSymbol,
  TSignature,
  TDeclaration extends TNode = TNode,
> = {
  readonly engine: SourceSemanticEngine;
  getExpressionType(expression: TExpression): TType;
  getContextualType(expression: TExpression): TType | undefined;
  getSymbol(node: TNode): TSymbol | undefined;
  getAliasedSymbol(symbol: TSymbol): TSymbol;
  getSymbolDeclarations(symbol: TSymbol): readonly TDeclaration[];
  getSymbolValueDeclaration(symbol: TSymbol): TDeclaration | undefined;
  getExportSpecifierLocalTargetSymbol(node: TNode): TSymbol | undefined;
  getExportsOfModule(symbol: TSymbol): readonly TSymbol[];
  getShorthandAssignmentValueSymbol(node: TNode): TSymbol | undefined;
  getDeclaredType(symbol: TSymbol): TType;
  getTypeFromTypeNode(node: TNode): TType | undefined;
  getTypeOfSymbolAtLocation(symbol: TSymbol, location: TNode): TType;
  getTypeArguments(type: TType): readonly TType[];
  getApparentType(type: TType): TType;
  getStringIndexType(type: TType): TType | undefined;
  getNumberIndexType(type: TType): TType | undefined;
  getPropertyOfType(type: TType, key: string): TSymbol | undefined;
  getProperties(type: TType): readonly TSymbol[];
  getCallSignatures(type: TType): readonly TSignature[];
  getConstructSignatures(type: TType): readonly TSignature[];
  isArrayType(type: TType): boolean;
  isTupleType(type: TType): boolean;
  getResolvedSignature(
    callExpression: TCallLikeExpression
  ): TSignature | undefined;
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
