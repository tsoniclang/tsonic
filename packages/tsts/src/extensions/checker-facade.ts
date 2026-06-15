import type { bool } from "@tsonic/core/types.js";
import type { GoMap, GoPtr } from "../go/compat.js";
import type { Node } from "../internal/ast/spine.js";
import type { Symbol } from "../internal/ast/symbol.js";
import { SymbolName } from "../internal/ast/symbol.js";
import { SymbolFlagsAlias } from "../internal/ast/symbolflags.js";
import type { Checker } from "../internal/checker/checker/state.js";
import {
  CheckModeNormal,
  isTupleType,
} from "../internal/checker/checker/state.js";
import {
  Checker_isArrayType,
  Checker_GetTypeAtLocation,
} from "../internal/checker/checker/types.js";
import {
  Checker_GetAliasedSymbol,
  Checker_getFullyQualifiedName,
  Checker_getIndexTypeOfType,
  Checker_GetTypeOfSymbolAtLocation,
  Checker_GetSymbolAtLocation,
} from "../internal/checker/checker/symbols.js";
import {
  Checker_getReturnTypeOfSignature,
  Checker_getResolvedSignature,
  Checker_getSignatureFromDeclaration,
  Checker_getSignaturesOfType,
  Checker_getTypeOfParameter,
  Checker_getTypeArguments,
} from "../internal/checker/checker/signatures.js";
import {
  Checker_GetContextualType,
  Checker_GetElementTypeOfArrayType,
  Checker_GetExportSpecifierLocalTargetSymbol,
  Checker_GetExportsOfModule,
  Checker_GetShorthandAssignmentValueSymbol,
  Checker_GetSymbolsInScope,
} from "../internal/checker/services.js";
import {
  Checker_GetApparentType,
  Checker_GetPropertiesOfType,
  Checker_GetPropertyOfType,
  Checker_GetTypeFromTypeNode,
  Checker_GetTypeOfSymbol,
} from "../internal/checker/exports.js";
import {
  Checker_SymbolToString,
  Checker_TypeToTypeNode,
  Checker_TypeToString,
} from "../internal/checker/printer.js";
import {
  Checker_getTypePredicateOfSignature,
  Checker_isTypeAssignableTo,
  Checker_isTypeIdenticalTo,
} from "../internal/checker/relater.js";
import type {
  ContextFlags,
  Signature,
  Type,
  TypePredicate,
} from "../internal/checker/types.js";
import {
  ContextFlagsNone,
  ObjectFlagsReference,
  SignatureKindCall,
  SignatureKindConstruct,
  Signature_Declaration,
  Signature_Parameters,
  Signature_TypeParameters,
  TypeAlias_Symbol,
  TypeAlias_TypeArguments,
  Type_Flags,
  Type_ObjectFlags,
  Type_Symbol,
  Type_Types,
  TypeFlagsAny,
  TypeFlagsBigIntLike,
  TypeFlagsBigIntLiteral,
  TypeFlagsBooleanLike,
  TypeFlagsBooleanLiteral,
  TypeFlagsIntersection,
  TypeFlagsNever,
  TypeFlagsNull,
  TypeFlagsNumberLike,
  TypeFlagsNumberLiteral,
  TypeFlagsObject,
  TypeFlagsString,
  TypeFlagsStringLike,
  TypeFlagsStringLiteral,
  TypeFlagsTypeParameter,
  TypeFlagsUndefined,
  TypeFlagsUnknown,
  TypeFlagsUnion,
  TypeFlagsVoid,
} from "../internal/checker/types.js";
import type {
  Expression,
  IdentifierNode,
  TypeNode,
} from "../internal/ast/generated/unions.js";
import type { Flags as NodeBuilderFlags } from "../internal/nodebuilder/types.js";

export type ExtensionTypeChecker = {
  getTypeAtLocation(node: GoPtr<Node>): GoPtr<Type>;
  getNarrowedTypeAtLocation(node: GoPtr<Node>): GoPtr<Type>;
  getSymbolAtLocation(node: GoPtr<Node>): GoPtr<Symbol>;
  resolveAlias(symbol: GoPtr<Symbol>): GoPtr<Symbol>;
  getSymbolDeclarations(symbol: GoPtr<Symbol>): readonly GoPtr<Node>[];
  getSymbolValueDeclaration(symbol: GoPtr<Symbol>): GoPtr<Node>;
  getSymbolName(symbol: GoPtr<Symbol>): string;
  getDeclaredTypeOfSymbol(symbol: GoPtr<Symbol>): GoPtr<Type>;
  getTypeFromTypeNode(node: GoPtr<Node>): GoPtr<Type>;
  getTypeOfSymbolAtLocation(symbol: GoPtr<Symbol>, location: GoPtr<Node>): GoPtr<Type>;
  getContextualType(node: GoPtr<Node>, contextFlags?: ContextFlags): GoPtr<Type>;
  getTypeAliasOrSymbol(type: GoPtr<Type>): GoPtr<Symbol>;
  getTypeSymbolName(type: GoPtr<Type>): string | undefined;
  getTypeAliasSymbolName(type: GoPtr<Type>): string | undefined;
  getExportSpecifierLocalTargetSymbol(node: GoPtr<Node>): GoPtr<Symbol>;
  getExportsOfModule(symbol: GoPtr<Symbol>): readonly GoPtr<Symbol>[];
  getShorthandAssignmentValueSymbol(node: GoPtr<Node>): GoPtr<Symbol>;
  getTypeArguments(type: GoPtr<Type>): readonly GoPtr<Type>[];
  getAliasTypeArguments(type: GoPtr<Type>): readonly GoPtr<Type>[];
  getReferenceTypeArguments(type: GoPtr<Type>): readonly GoPtr<Type>[];
  getApparentType(type: GoPtr<Type>): GoPtr<Type>;
  getUnionMembers(type: GoPtr<Type>): readonly GoPtr<Type>[] | undefined;
  getIntersectionMembers(type: GoPtr<Type>): readonly GoPtr<Type>[] | undefined;
  getUnionOrIntersectionMembers(type: GoPtr<Type>): readonly GoPtr<Type>[] | undefined;
  getNonNullishUnionMembers(type: GoPtr<Type>): readonly GoPtr<Type>[] | undefined;
  isNullishType(type: GoPtr<Type>): boolean;
  isNullishVoidOrNeverType(type: GoPtr<Type>): boolean;
  isAnyUnknownVoidNeverOrTypeParameter(type: GoPtr<Type>): boolean;
  isAnyUnknownOrTypeParameter(type: GoPtr<Type>): boolean;
  isAnyOrUnknownType(type: GoPtr<Type>): boolean;
  isAnyType(type: GoPtr<Type>): boolean;
  isUnknownType(type: GoPtr<Type>): boolean;
  isNeverType(type: GoPtr<Type>): boolean;
  isVoidType(type: GoPtr<Type>): boolean;
  isUndefinedType(type: GoPtr<Type>): boolean;
  isNullType(type: GoPtr<Type>): boolean;
  isTypeParameter(type: GoPtr<Type>): boolean;
  isSourceScalarLikeType(type: GoPtr<Type>): boolean;
  isStringLikeType(type: GoPtr<Type>): boolean;
  isNumberLikeType(type: GoPtr<Type>): boolean;
  isBooleanLikeType(type: GoPtr<Type>): boolean;
  isBigIntLikeType(type: GoPtr<Type>): boolean;
  isTypeAssignableTo(source: GoPtr<Type>, target: GoPtr<Type>): boolean;
  isTypeIdenticalTo(source: GoPtr<Type>, target: GoPtr<Type>): boolean;
  isStringLiteralType(type: GoPtr<Type>): boolean;
  isNumberLiteralType(type: GoPtr<Type>): boolean;
  isBooleanLiteralType(type: GoPtr<Type>): boolean;
  isBigIntLiteralType(type: GoPtr<Type>): boolean;
  getStringIndexType(type: GoPtr<Type>): GoPtr<Type>;
  getNumberIndexType(type: GoPtr<Type>): GoPtr<Type>;
  getElementTypeOfArrayType(type: GoPtr<Type>): GoPtr<Type>;
  getPropertyOfType(type: GoPtr<Type>, key: string): GoPtr<Symbol>;
  getProperties(type: GoPtr<Type>): readonly GoPtr<Symbol>[];
  getCallSignatures(type: GoPtr<Type>): readonly GoPtr<Signature>[];
  getConstructSignatures(type: GoPtr<Type>): readonly GoPtr<Signature>[];
  isArrayType(type: GoPtr<Type>): boolean;
  isTupleType(type: GoPtr<Type>): boolean;
  getResolvedSignature(node: GoPtr<Node>): GoPtr<Signature>;
  getSignatureDeclaration(signature: GoPtr<Signature>): GoPtr<Node>;
  getSignatureParameters(signature: GoPtr<Signature>): readonly GoPtr<Symbol>[];
  getTypeOfSignatureParameter(parameter: GoPtr<Symbol>): GoPtr<Type>;
  signatureHasTypeParameters(signature: GoPtr<Signature>): boolean;
  getSignatureFromDeclaration(node: GoPtr<Node>): GoPtr<Signature>;
  getReturnTypeOfSignature(signature: GoPtr<Signature>): GoPtr<Type>;
  getTypePredicateOfSignature(signature: GoPtr<Signature>): GoPtr<TypePredicate>;
  typeToTypeNode(
    type: GoPtr<Type>,
    enclosingNode: GoPtr<Node>,
    flags: NodeBuilderFlags,
  ): GoPtr<TypeNode>;
  getFullyQualifiedName(symbol: GoPtr<Symbol>, containingLocation?: GoPtr<Node>): string;
  getSymbolsInScope(location: GoPtr<Node>, meaning: number): readonly GoPtr<Symbol>[];
  symbolToString(symbol: GoPtr<Symbol>): string;
  typeToString(type: GoPtr<Type>): string;
};

export type ExtensionCheckerHandle = {
  readonly checker: GoPtr<Checker>;
  readonly facade: ExtensionTypeChecker;
};

const hasTypeFlags = (type: GoPtr<Type>, flags: number): boolean =>
  type !== undefined && (Type_Flags(type) & flags) !== 0;

const isReferenceType = (type: GoPtr<Type>): boolean =>
  type !== undefined &&
  hasTypeFlags(type, TypeFlagsObject) &&
  (Type_ObjectFlags(type) & ObjectFlagsReference) !== 0;

const typeMembers = (
  type: GoPtr<Type>,
  flags: number,
): readonly GoPtr<Type>[] | undefined =>
  hasTypeFlags(type, flags) ? Type_Types(type) : undefined;

const nonNullishType = (type: GoPtr<Type>): boolean =>
  !hasTypeFlags(type, TypeFlagsNull | TypeFlagsUndefined);

export const createExtensionTypeChecker = (
  checker: GoPtr<Checker>,
): ExtensionTypeChecker => ({
  getTypeAtLocation: (node: GoPtr<Node>): GoPtr<Type> =>
    Checker_GetTypeAtLocation(checker, node),
  getNarrowedTypeAtLocation: (node: GoPtr<Node>): GoPtr<Type> => {
    const symbol = Checker_GetSymbolAtLocation(checker, node);
    return symbol
      ? (Checker_GetTypeOfSymbolAtLocation(checker, symbol, node) ??
          Checker_GetTypeAtLocation(checker, node))
      : Checker_GetTypeAtLocation(checker, node);
  },
  getSymbolAtLocation: (node: GoPtr<Node>): GoPtr<Symbol> =>
    Checker_GetSymbolAtLocation(checker, node),
  resolveAlias: (symbol: GoPtr<Symbol>): GoPtr<Symbol> =>
    symbol !== undefined && (symbol.Flags & SymbolFlagsAlias) !== 0
      ? Checker_GetAliasedSymbol(checker, symbol)
      : symbol,
  getSymbolDeclarations: (symbol: GoPtr<Symbol>): readonly GoPtr<Node>[] =>
    symbol?.Declarations ?? [],
  getSymbolValueDeclaration: (symbol: GoPtr<Symbol>): GoPtr<Node> =>
    symbol?.ValueDeclaration ?? symbol?.Declarations?.[0],
  getSymbolName: (symbol: GoPtr<Symbol>): string =>
    symbol === undefined ? "" : SymbolName(symbol),
  getDeclaredTypeOfSymbol: (symbol: GoPtr<Symbol>): GoPtr<Type> =>
    Checker_GetTypeOfSymbol(checker, symbol),
  getTypeFromTypeNode: (node: GoPtr<Node>): GoPtr<Type> =>
    Checker_GetTypeFromTypeNode(checker, node),
  getTypeOfSymbolAtLocation: (
    symbol: GoPtr<Symbol>,
    location: GoPtr<Node>,
  ): GoPtr<Type> =>
    Checker_GetTypeOfSymbolAtLocation(checker, symbol, location),
  getContextualType: (
    node: GoPtr<Node>,
    contextFlags: ContextFlags = ContextFlagsNone,
  ): GoPtr<Type> =>
    Checker_GetContextualType(checker, node as GoPtr<Expression>, contextFlags),
  getTypeAliasOrSymbol: (type: GoPtr<Type>): GoPtr<Symbol> =>
    TypeAlias_Symbol(type?.alias) ?? Type_Symbol(type),
  getTypeSymbolName: (type: GoPtr<Type>): string | undefined => {
    const symbol = Type_Symbol(type);
    return symbol ? SymbolName(symbol) : undefined;
  },
  getTypeAliasSymbolName: (type: GoPtr<Type>): string | undefined => {
    const symbol = TypeAlias_Symbol(type?.alias);
    return symbol ? SymbolName(symbol) : undefined;
  },
  getExportSpecifierLocalTargetSymbol: (node: GoPtr<Node>): GoPtr<Symbol> =>
    Checker_GetExportSpecifierLocalTargetSymbol(checker, node),
  getExportsOfModule: (symbol: GoPtr<Symbol>): readonly GoPtr<Symbol>[] =>
    Checker_GetExportsOfModule(checker, symbol),
  getShorthandAssignmentValueSymbol: (node: GoPtr<Node>): GoPtr<Symbol> =>
    Checker_GetShorthandAssignmentValueSymbol(checker, node),
  getTypeArguments: (type: GoPtr<Type>): readonly GoPtr<Type>[] =>
    isReferenceType(type) ? Checker_getTypeArguments(checker, type) : [],
  getAliasTypeArguments: (type: GoPtr<Type>): readonly GoPtr<Type>[] =>
    TypeAlias_TypeArguments(type?.alias),
  getReferenceTypeArguments: (type: GoPtr<Type>): readonly GoPtr<Type>[] =>
    isReferenceType(type) ? Checker_getTypeArguments(checker, type) : [],
  getApparentType: (type: GoPtr<Type>): GoPtr<Type> =>
    Checker_GetApparentType(checker, type),
  getUnionMembers: (type: GoPtr<Type>): readonly GoPtr<Type>[] | undefined =>
    typeMembers(type, TypeFlagsUnion),
  getIntersectionMembers: (
    type: GoPtr<Type>,
  ): readonly GoPtr<Type>[] | undefined =>
    typeMembers(type, TypeFlagsIntersection),
  getUnionOrIntersectionMembers: (
    type: GoPtr<Type>,
  ): readonly GoPtr<Type>[] | undefined =>
    typeMembers(type, TypeFlagsUnion | TypeFlagsIntersection),
  getNonNullishUnionMembers: (
    type: GoPtr<Type>,
  ): readonly GoPtr<Type>[] | undefined =>
    hasTypeFlags(type, TypeFlagsUnion)
      ? Type_Types(type).filter(nonNullishType)
      : undefined,
  isNullishType: (type: GoPtr<Type>): boolean =>
    hasTypeFlags(type, TypeFlagsNull | TypeFlagsUndefined),
  isNullishVoidOrNeverType: (type: GoPtr<Type>): boolean =>
    hasTypeFlags(
      type,
      TypeFlagsNull | TypeFlagsUndefined | TypeFlagsVoid | TypeFlagsNever,
    ),
  isAnyUnknownVoidNeverOrTypeParameter: (type: GoPtr<Type>): boolean =>
    hasTypeFlags(
      type,
      TypeFlagsAny |
        TypeFlagsUnknown |
        TypeFlagsVoid |
        TypeFlagsNever |
        TypeFlagsTypeParameter,
    ),
  isAnyUnknownOrTypeParameter: (type: GoPtr<Type>): boolean =>
    hasTypeFlags(type, TypeFlagsAny | TypeFlagsUnknown | TypeFlagsTypeParameter),
  isAnyOrUnknownType: (type: GoPtr<Type>): boolean =>
    hasTypeFlags(type, TypeFlagsAny | TypeFlagsUnknown),
  isAnyType: (type: GoPtr<Type>): boolean =>
    hasTypeFlags(type, TypeFlagsAny),
  isUnknownType: (type: GoPtr<Type>): boolean =>
    hasTypeFlags(type, TypeFlagsUnknown),
  isNeverType: (type: GoPtr<Type>): boolean =>
    hasTypeFlags(type, TypeFlagsNever),
  isVoidType: (type: GoPtr<Type>): boolean =>
    hasTypeFlags(type, TypeFlagsVoid),
  isUndefinedType: (type: GoPtr<Type>): boolean =>
    hasTypeFlags(type, TypeFlagsUndefined),
  isNullType: (type: GoPtr<Type>): boolean =>
    hasTypeFlags(type, TypeFlagsNull),
  isTypeParameter: (type: GoPtr<Type>): boolean =>
    hasTypeFlags(type, TypeFlagsTypeParameter),
  isSourceScalarLikeType: (type: GoPtr<Type>): boolean =>
    hasTypeFlags(
      type,
      TypeFlagsStringLike |
        TypeFlagsNumberLike |
        TypeFlagsBooleanLike |
        TypeFlagsBigIntLike |
        TypeFlagsNull |
        TypeFlagsUndefined,
    ),
  isStringLikeType: (type: GoPtr<Type>): boolean =>
    hasTypeFlags(type, TypeFlagsStringLike),
  isNumberLikeType: (type: GoPtr<Type>): boolean =>
    hasTypeFlags(type, TypeFlagsNumberLike),
  isBooleanLikeType: (type: GoPtr<Type>): boolean =>
    hasTypeFlags(type, TypeFlagsBooleanLike),
  isBigIntLikeType: (type: GoPtr<Type>): boolean =>
    hasTypeFlags(type, TypeFlagsBigIntLike),
  isTypeAssignableTo: (source: GoPtr<Type>, target: GoPtr<Type>): boolean =>
    source !== undefined &&
    target !== undefined &&
    Checker_isTypeAssignableTo(checker, source, target) === true,
  isTypeIdenticalTo: (source: GoPtr<Type>, target: GoPtr<Type>): boolean =>
    source !== undefined &&
    target !== undefined &&
    Checker_isTypeIdenticalTo(checker, source, target) === true,
  isStringLiteralType: (type: GoPtr<Type>): boolean =>
    hasTypeFlags(type, TypeFlagsStringLiteral) &&
    !hasTypeFlags(type, TypeFlagsString),
  isNumberLiteralType: (type: GoPtr<Type>): boolean =>
    hasTypeFlags(type, TypeFlagsNumberLiteral),
  isBooleanLiteralType: (type: GoPtr<Type>): boolean =>
    hasTypeFlags(type, TypeFlagsBooleanLiteral),
  isBigIntLiteralType: (type: GoPtr<Type>): boolean =>
    hasTypeFlags(type, TypeFlagsBigIntLiteral),
  getStringIndexType: (type: GoPtr<Type>): GoPtr<Type> =>
    Checker_getIndexTypeOfType(checker, type, checker?.stringType),
  getNumberIndexType: (type: GoPtr<Type>): GoPtr<Type> =>
    Checker_getIndexTypeOfType(checker, type, checker?.numberType),
  getElementTypeOfArrayType: (type: GoPtr<Type>): GoPtr<Type> =>
    Checker_GetElementTypeOfArrayType(checker, type),
  getPropertyOfType: (type: GoPtr<Type>, key: string): GoPtr<Symbol> =>
    Checker_GetPropertyOfType(checker, type, key),
  getProperties: (type: GoPtr<Type>): readonly GoPtr<Symbol>[] =>
    Checker_GetPropertiesOfType(checker, type),
  getCallSignatures: (type: GoPtr<Type>): readonly GoPtr<Signature>[] =>
    Checker_getSignaturesOfType(checker, type, SignatureKindCall),
  getConstructSignatures: (type: GoPtr<Type>): readonly GoPtr<Signature>[] =>
    Checker_getSignaturesOfType(checker, type, SignatureKindConstruct),
  isArrayType: (type: GoPtr<Type>): boolean =>
    Checker_isArrayType(checker, type) === true,
  isTupleType: (type: GoPtr<Type>): boolean =>
    isTupleType(type) === true,
  getResolvedSignature: (node: GoPtr<Node>): GoPtr<Signature> =>
    Checker_getResolvedSignature(
      checker,
      node,
      undefined,
      CheckModeNormal,
    ),
  getSignatureDeclaration: (signature: GoPtr<Signature>): GoPtr<Node> =>
    Signature_Declaration(signature),
  getSignatureParameters: (
    signature: GoPtr<Signature>,
  ): readonly GoPtr<Symbol>[] =>
    Signature_Parameters(signature),
  getTypeOfSignatureParameter: (parameter: GoPtr<Symbol>): GoPtr<Type> =>
    Checker_getTypeOfParameter(checker, parameter),
  signatureHasTypeParameters: (signature: GoPtr<Signature>): boolean =>
    Signature_TypeParameters(signature).length > 0,
  getSignatureFromDeclaration: (node: GoPtr<Node>): GoPtr<Signature> =>
    Checker_getSignatureFromDeclaration(checker, node),
  getReturnTypeOfSignature: (signature: GoPtr<Signature>): GoPtr<Type> =>
    Checker_getReturnTypeOfSignature(checker, signature),
  getTypePredicateOfSignature: (
    signature: GoPtr<Signature>,
  ): GoPtr<TypePredicate> =>
    Checker_getTypePredicateOfSignature(checker, signature),
  typeToTypeNode: (
    type: GoPtr<Type>,
    enclosingNode: GoPtr<Node>,
    flags: NodeBuilderFlags,
  ): GoPtr<TypeNode> => {
    const idToSymbol: GoMap<GoPtr<IdentifierNode>, GoPtr<Symbol>> = new Map();
    return Checker_TypeToTypeNode(checker, type, enclosingNode, flags, idToSymbol);
  },
  getFullyQualifiedName: (
    symbol: GoPtr<Symbol>,
    containingLocation?: GoPtr<Node>,
  ): string => Checker_getFullyQualifiedName(checker, symbol, containingLocation),
  getSymbolsInScope: (
    location: GoPtr<Node>,
    meaning: number,
  ): readonly GoPtr<Symbol>[] =>
    Checker_GetSymbolsInScope(checker, location, meaning),
  symbolToString: (symbol: GoPtr<Symbol>): string =>
    Checker_SymbolToString(checker, symbol),
  typeToString: (type: GoPtr<Type>): string =>
    Checker_TypeToString(checker, type),
});

export const createExtensionCheckerHandle = (
  checker: GoPtr<Checker>,
): ExtensionCheckerHandle => ({
  checker,
  facade: createExtensionTypeChecker(checker),
});

export const hasTstsChecker = (
  handle: ExtensionCheckerHandle | undefined,
): handle is ExtensionCheckerHandle =>
  (handle !== undefined) as bool;
