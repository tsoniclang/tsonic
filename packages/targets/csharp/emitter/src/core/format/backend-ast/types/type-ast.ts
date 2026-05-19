export type CSharpPredefinedTypeKeyword =
  | "bool"
  | "byte"
  | "sbyte"
  | "short"
  | "ushort"
  | "int"
  | "uint"
  | "long"
  | "ulong"
  | "nint"
  | "nuint"
  | "char"
  | "float"
  | "double"
  | "decimal"
  | "string"
  | "object"
  | "void";

export type CSharpPredefinedTypeAst = {
  readonly kind: "predefinedType";
  /** True C# predefined type keyword (for example "int", "string", "bool", "double", "void", "object"). */
  readonly keyword: CSharpPredefinedTypeKeyword;
};

export type CSharpIdentifierTypeAst = {
  readonly kind: "identifierType";
  /** Simple type name without qualification (e.g. "List", "Task", "MyType"). */
  readonly name: string;
  readonly typeArguments?: readonly CSharpTypeAst[];
};

export type CSharpQualifiedNameAst = {
  /** Optional alias qualifier like `global` in `global::System.String`. */
  readonly aliasQualifier?: string;
  /** Dot-separated identifier path segments. */
  readonly segments: readonly string[];
};

export type CSharpQualifiedIdentifierTypeAst = {
  readonly kind: "qualifiedIdentifierType";
  readonly name: CSharpQualifiedNameAst;
  readonly typeArguments?: readonly CSharpTypeAst[];
};

export type CSharpNullableTypeAst = {
  readonly kind: "nullableType";
  readonly underlyingType: CSharpTypeAst;
};

export type CSharpArrayTypeAst = {
  readonly kind: "arrayType";
  readonly elementType: CSharpTypeAst;
  /** Array rank: 1 for T[], 2 for T[,], etc. */
  readonly rank: number;
};

export type CSharpPointerTypeAst = {
  readonly kind: "pointerType";
  readonly elementType: CSharpTypeAst;
};

export type CSharpTupleElementAst = {
  readonly type: CSharpTypeAst;
  readonly name?: string;
};

export type CSharpTupleTypeAst = {
  readonly kind: "tupleType";
  readonly elements: readonly CSharpTupleElementAst[];
};

export type CSharpVarTypeAst = {
  readonly kind: "varType";
};

export type CSharpTypeAst =
  | CSharpPredefinedTypeAst
  | CSharpIdentifierTypeAst
  | CSharpQualifiedIdentifierTypeAst
  | CSharpNullableTypeAst
  | CSharpArrayTypeAst
  | CSharpPointerTypeAst
  | CSharpTupleTypeAst
  | CSharpVarTypeAst;
