import type { AstReader, Node, ResolvedSourceElementAccessInfo, ResolvedSourcePropertyAccessInfo,
  Signature, Symbol, Type } from "@tsonic/tsts";
import type { ResolvedSourceCallInfo } from "./call-info.js";
import type { SourceProgramNavigation } from "./types.js";

export interface SourceNavigationTypeQueries {
  expressionType(node: Node): Type | undefined;
  numericLiteralValue(type: Type): number | bigint | undefined;
  callSignatures(type: Type): readonly Signature[];
  constructSignatures(type: Type): readonly Signature[];
  isNullish(type: Type): boolean;
  isVoidLike(type: Type): boolean;
  isNumberLike(type: Type): boolean;
  isBooleanLike(type: Type): boolean;
  isStringLike(type: Type): boolean;
  isBigIntLike(type: Type): boolean;
  isSymbolLike(type: Type): boolean;
}

export interface SourceNavigationDeclarationQueries {
  rootSymbols(symbol: Symbol): readonly Symbol[];
  symbolDeclarations(symbol: Symbol): readonly Node[];
  signatureDeclaration(signature: Signature): Node | undefined;
  declarationSignature(declaration: Node): Signature | undefined;
  primarySymbolDeclaration(symbol: Symbol): Node | undefined;
  declaredValueType(declaration: Node): Type | undefined;
  signatureParameters(signature: Signature): readonly Symbol[];
}

export interface SourceNavigationOperationQueries {
  call(node: Node): ResolvedSourceCallInfo | undefined;
  propertyAccess(node: Node): ResolvedSourcePropertyAccessInfo | undefined;
  elementAccess(node: Node): ResolvedSourceElementAccessInfo | undefined;
}

export interface SourceNavigationFileQueries {
  readonly types: SourceNavigationTypeQueries;
  readonly declarations: SourceNavigationDeclarationQueries;
  readonly operations: SourceNavigationOperationQueries;
}

export interface SourceNavigationQueryContext {
  readonly ast: AstReader;
  readonly navigation: SourceProgramNavigation;
  readonly semantics: {
    forNode(node: Node): SourceNavigationFileQueries;
  };
}
