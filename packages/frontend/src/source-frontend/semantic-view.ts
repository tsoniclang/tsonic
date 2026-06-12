export type SourceSemanticFactKey<T> = {
  readonly id: string;
  readonly description?: string;
  readonly __value?: (value: T) => T;
};

export type SourceSemanticFactStore<TNode extends object> = {
  set<T>(node: TNode, key: SourceSemanticFactKey<T>, value: T): void;
  get<T>(node: TNode, key: SourceSemanticFactKey<T>): T | undefined;
  has<T>(node: TNode, key: SourceSemanticFactKey<T>): boolean;
};

export type SourceSemanticEngine = "typescript";

export type SourceSemanticView<
  TNode extends object,
  TExpression extends TNode,
  TCallLikeExpression extends TExpression,
  TType,
  TSymbol,
  TSignature,
> = {
  readonly engine: SourceSemanticEngine;
  getExpressionType(expression: TExpression): TType;
  getContextualType(expression: TExpression): TType | undefined;
  getSymbol(node: TNode): TSymbol | undefined;
  getAliasedSymbol(symbol: TSymbol): TSymbol;
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
  getCallSignatures(type: TType): readonly TSignature[];
  isArrayType(type: TType): boolean;
  isTupleType(type: TType): boolean;
  getResolvedSignature(
    callExpression: TCallLikeExpression
  ): TSignature | undefined;
  getSignatureFromDeclaration(node: TNode): TSignature | undefined;
  getReturnTypeOfSignature(signature: TSignature): TType;
  getTypePredicateOfSignature(signature: TSignature): unknown;
  typeToTypeNode(type: TType, enclosingNode: TNode, flags: number): TNode | undefined;
  getFullyQualifiedName(symbol: TSymbol): string;
  getSymbolsInScope(location: TNode, meaning: number): readonly TSymbol[];
  typeToString(type: TType): string;
  getFact<T>(node: TNode, key: SourceSemanticFactKey<T>): T | undefined;
};

export const defineSourceSemanticFactKey = <T>(
  id: string,
  description?: string
): SourceSemanticFactKey<T> => ({
  id,
  description,
});

export const createSourceSemanticFactStore = <
  TNode extends object,
>(): SourceSemanticFactStore<TNode> => {
  const nodeFacts = new WeakMap<TNode, Map<string, unknown>>();

  const getNodeFacts = (node: TNode): Map<string, unknown> => {
    const existing = nodeFacts.get(node);
    if (existing) {
      return existing;
    }

    const facts = new Map<string, unknown>();
    nodeFacts.set(node, facts);
    return facts;
  };

  return {
    set: <T>(node: TNode, key: SourceSemanticFactKey<T>, value: T): void => {
      getNodeFacts(node).set(key.id, value);
    },
    get: <T>(node: TNode, key: SourceSemanticFactKey<T>): T | undefined => {
      return nodeFacts.get(node)?.get(key.id) as T | undefined;
    },
    has: <T>(node: TNode, key: SourceSemanticFactKey<T>): boolean => {
      return nodeFacts.get(node)?.has(key.id) ?? false;
    },
  };
};
