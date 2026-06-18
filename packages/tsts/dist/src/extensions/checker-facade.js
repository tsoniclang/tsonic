import { SymbolName } from "../internal/ast/symbol.js";
import { SymbolFlagsAlias } from "../internal/ast/symbolflags.js";
import { CheckModeNormal, isTupleType, } from "../internal/checker/checker/state.js";
import { Checker_isArrayType, Checker_getApparentTypeOfContextualType, Checker_GetNonNullableType, Checker_GetTypeAtLocation, Checker_instantiateType, } from "../internal/checker/checker/types.js";
import { Checker_GetAliasedSymbol, Checker_getFullyQualifiedName, Checker_getIndexTypeOfType, Checker_GetTypeOfSymbolAtLocation, Checker_GetSymbolAtLocation, } from "../internal/checker/checker/symbols.js";
import { Checker_getReturnTypeOfSignature, Checker_getResolvedSignature, Checker_getSignatureFromDeclaration, Checker_getSingleSignature, Checker_getSignaturesOfType, Checker_getTypeOfParameter, Checker_getTypeArguments, Checker_instantiateSignatureInContextOf, } from "../internal/checker/checker/signatures.js";
import { Checker_getInferenceContext } from "../internal/checker/checker/inference.js";
import { Checker_GetContextualType, Checker_GetElementTypeOfArrayType, Checker_GetExportSpecifierLocalTargetSymbol, Checker_GetExportsOfModule, Checker_GetShorthandAssignmentValueSymbol, Checker_GetSymbolsInScope, } from "../internal/checker/services.js";
import { Checker_GetApparentType, Checker_GetContextualTypeForArgumentAtIndex, Checker_GetPropertiesOfType, Checker_GetPropertyOfType, Checker_GetTypeFromTypeNode, Checker_GetTypeOfSymbol, } from "../internal/checker/exports.js";
import { Checker_SymbolToString, Checker_TypeToTypeNode, Checker_TypeToString, } from "../internal/checker/printer.js";
import { Checker_getTypePredicateOfSignature, Checker_getTypeAtPosition, Checker_isTypeAssignableTo, Checker_isTypeIdenticalTo, } from "../internal/checker/relater.js";
import { ContextFlagsNone, ContextFlagsNoConstraints, ObjectFlagsReference, SignatureKindCall, SignatureKindConstruct, Signature_Declaration, Signature_Parameters, Signature_Target, Signature_TypeParameters, TypeAlias_Symbol, TypeAlias_TypeArguments, Type_Flags, Type_ObjectFlags, Type_Symbol, Type_Types, TypeFlagsAny, TypeFlagsBigIntLike, TypeFlagsBigIntLiteral, TypeFlagsBooleanLike, TypeFlagsBooleanLiteral, TypeFlagsIntersection, TypeFlagsNever, TypeFlagsNull, TypeFlagsNumberLike, TypeFlagsNumberLiteral, TypeFlagsObject, TypeFlagsString, TypeFlagsStringLike, TypeFlagsStringLiteral, TypeFlagsTypeParameter, TypeFlagsUndefined, TypeFlagsUnknown, TypeFlagsUnion, TypeFlagsVoid, } from "../internal/checker/types.js";
const hasTypeFlags = (type, flags) => type !== undefined && (Type_Flags(type) & flags) !== 0;
const isReferenceType = (type) => type !== undefined &&
    hasTypeFlags(type, TypeFlagsObject) &&
    (Type_ObjectFlags(type) & ObjectFlagsReference) !== 0;
const typeMembers = (type, flags) => hasTypeFlags(type, flags) ? Type_Types(type) : undefined;
const nonNullishType = (type) => !hasTypeFlags(type, TypeFlagsNull | TypeFlagsUndefined);
export const createExtensionTypeChecker = (checker) => ({
    getTypeAtLocation: (node) => Checker_GetTypeAtLocation(checker, node),
    getNarrowedTypeAtLocation: (node) => {
        const symbol = Checker_GetSymbolAtLocation(checker, node);
        return symbol
            ? (Checker_GetTypeOfSymbolAtLocation(checker, symbol, node) ??
                Checker_GetTypeAtLocation(checker, node))
            : Checker_GetTypeAtLocation(checker, node);
    },
    getSymbolAtLocation: (node) => Checker_GetSymbolAtLocation(checker, node),
    resolveAlias: (symbol) => symbol !== undefined && (symbol.Flags & SymbolFlagsAlias) !== 0
        ? Checker_GetAliasedSymbol(checker, symbol)
        : symbol,
    getSymbolDeclarations: (symbol) => symbol?.Declarations ?? [],
    getSymbolValueDeclaration: (symbol) => symbol?.ValueDeclaration ?? symbol?.Declarations?.[0],
    getSymbolName: (symbol) => symbol === undefined ? "" : SymbolName(symbol),
    getDeclaredTypeOfSymbol: (symbol) => Checker_GetTypeOfSymbol(checker, symbol),
    getTypeFromTypeNode: (node) => Checker_GetTypeFromTypeNode(checker, node),
    getTypeOfSymbolAtLocation: (symbol, location) => Checker_GetTypeOfSymbolAtLocation(checker, symbol, location),
    getContextualType: (node, contextFlags = ContextFlagsNone) => Checker_GetContextualType(checker, node, contextFlags),
    getContextualTypeForArgumentAtIndex: (node, argIndex) => Checker_GetContextualTypeForArgumentAtIndex(checker, node, argIndex),
    getTypeAliasOrSymbol: (type) => TypeAlias_Symbol(type?.alias) ?? Type_Symbol(type),
    getTypeSymbolName: (type) => {
        const symbol = Type_Symbol(type);
        return symbol ? SymbolName(symbol) : undefined;
    },
    getTypeAliasSymbolName: (type) => {
        const symbol = TypeAlias_Symbol(type?.alias);
        return symbol ? SymbolName(symbol) : undefined;
    },
    getExportSpecifierLocalTargetSymbol: (node) => Checker_GetExportSpecifierLocalTargetSymbol(checker, node),
    getExportsOfModule: (symbol) => Checker_GetExportsOfModule(checker, symbol),
    getShorthandAssignmentValueSymbol: (node) => Checker_GetShorthandAssignmentValueSymbol(checker, node),
    getTypeArguments: (type) => isReferenceType(type) ? Checker_getTypeArguments(checker, type) : [],
    getAliasTypeArguments: (type) => TypeAlias_TypeArguments(type?.alias),
    getReferenceTypeArguments: (type) => isReferenceType(type) ? Checker_getTypeArguments(checker, type) : [],
    getApparentType: (type) => Checker_GetApparentType(checker, type),
    getUnionMembers: (type) => typeMembers(type, TypeFlagsUnion),
    getIntersectionMembers: (type) => typeMembers(type, TypeFlagsIntersection),
    getUnionOrIntersectionMembers: (type) => typeMembers(type, TypeFlagsUnion | TypeFlagsIntersection),
    getNonNullishUnionMembers: (type) => hasTypeFlags(type, TypeFlagsUnion)
        ? Type_Types(type).filter(nonNullishType)
        : undefined,
    isNullishType: (type) => hasTypeFlags(type, TypeFlagsNull | TypeFlagsUndefined),
    isNullishVoidOrNeverType: (type) => hasTypeFlags(type, TypeFlagsNull | TypeFlagsUndefined | TypeFlagsVoid | TypeFlagsNever),
    isAnyUnknownVoidNeverOrTypeParameter: (type) => hasTypeFlags(type, TypeFlagsAny |
        TypeFlagsUnknown |
        TypeFlagsVoid |
        TypeFlagsNever |
        TypeFlagsTypeParameter),
    isAnyUnknownOrTypeParameter: (type) => hasTypeFlags(type, TypeFlagsAny | TypeFlagsUnknown | TypeFlagsTypeParameter),
    isAnyOrUnknownType: (type) => hasTypeFlags(type, TypeFlagsAny | TypeFlagsUnknown),
    isAnyType: (type) => hasTypeFlags(type, TypeFlagsAny),
    isUnknownType: (type) => hasTypeFlags(type, TypeFlagsUnknown),
    isNeverType: (type) => hasTypeFlags(type, TypeFlagsNever),
    isVoidType: (type) => hasTypeFlags(type, TypeFlagsVoid),
    isUndefinedType: (type) => hasTypeFlags(type, TypeFlagsUndefined),
    isNullType: (type) => hasTypeFlags(type, TypeFlagsNull),
    isTypeParameter: (type) => hasTypeFlags(type, TypeFlagsTypeParameter),
    isSourceScalarLikeType: (type) => hasTypeFlags(type, TypeFlagsStringLike |
        TypeFlagsNumberLike |
        TypeFlagsBooleanLike |
        TypeFlagsBigIntLike |
        TypeFlagsNull |
        TypeFlagsUndefined),
    isStringLikeType: (type) => hasTypeFlags(type, TypeFlagsStringLike),
    isNumberLikeType: (type) => hasTypeFlags(type, TypeFlagsNumberLike),
    isBooleanLikeType: (type) => hasTypeFlags(type, TypeFlagsBooleanLike),
    isBigIntLikeType: (type) => hasTypeFlags(type, TypeFlagsBigIntLike),
    isTypeAssignableTo: (source, target) => source !== undefined &&
        target !== undefined &&
        Checker_isTypeAssignableTo(checker, source, target) === true,
    isTypeIdenticalTo: (source, target) => source !== undefined &&
        target !== undefined &&
        Checker_isTypeIdenticalTo(checker, source, target) === true,
    isStringLiteralType: (type) => hasTypeFlags(type, TypeFlagsStringLiteral) &&
        !hasTypeFlags(type, TypeFlagsString),
    isNumberLiteralType: (type) => hasTypeFlags(type, TypeFlagsNumberLiteral),
    isBooleanLiteralType: (type) => hasTypeFlags(type, TypeFlagsBooleanLiteral),
    isBigIntLiteralType: (type) => hasTypeFlags(type, TypeFlagsBigIntLiteral),
    getStringIndexType: (type) => Checker_getIndexTypeOfType(checker, type, checker?.stringType),
    getNumberIndexType: (type) => Checker_getIndexTypeOfType(checker, type, checker?.numberType),
    getElementTypeOfArrayType: (type) => Checker_GetElementTypeOfArrayType(checker, type),
    getPropertyOfType: (type, key) => Checker_GetPropertyOfType(checker, type, key),
    getProperties: (type) => Checker_GetPropertiesOfType(checker, type),
    getCallSignatures: (type) => Checker_getSignaturesOfType(checker, type, SignatureKindCall),
    getConstructSignatures: (type) => Checker_getSignaturesOfType(checker, type, SignatureKindConstruct),
    isArrayType: (type) => Checker_isArrayType(checker, type) === true,
    isTupleType: (type) => isTupleType(type) === true,
    getResolvedSignature: (node) => Checker_getResolvedSignature(checker, node, undefined, CheckModeNormal),
    getSignatureDeclaration: (signature) => Signature_Declaration(signature),
    getSignatureParameters: (signature) => Signature_Parameters(signature),
    getTypeOfSignatureParameter: (parameter) => Checker_getTypeOfParameter(checker, parameter),
    getTypeAtSignaturePosition: (signature, position) => {
        const type = Checker_getTypeAtPosition(checker, signature, position);
        return signature?.mapper
            ? Checker_instantiateType(checker, type, signature.mapper)
            : type;
    },
    getSignatureTypeArguments: (signature) => {
        const target = Signature_Target(signature) ?? signature;
        const typeParameters = Signature_TypeParameters(target);
        return signature?.mapper
            ? typeParameters.map((typeParameter) => Checker_instantiateType(checker, typeParameter, signature.mapper))
            : [];
    },
    getContextualGenericFunctionTypeArguments: (node) => {
        const sourceType = Checker_GetTypeAtLocation(checker, node);
        if (sourceType === undefined) {
            return [];
        }
        const sourceSignature = Checker_getSingleSignature(checker, sourceType, SignatureKindCall, true);
        if (sourceSignature === undefined ||
            Signature_TypeParameters(sourceSignature).length === 0) {
            return [];
        }
        const contextualType = Checker_getApparentTypeOfContextualType(checker, node, ContextFlagsNoConstraints);
        if (contextualType === undefined) {
            return [];
        }
        const contextualSignature = Checker_getSingleSignature(checker, Checker_GetNonNullableType(checker, contextualType), SignatureKindCall, false);
        if (contextualSignature === undefined ||
            Signature_TypeParameters(contextualSignature).length !== 0) {
            return [];
        }
        const instantiatedSignature = Checker_instantiateSignatureInContextOf(checker, sourceSignature, contextualSignature, Checker_getInferenceContext(checker, node), undefined);
        const target = Signature_Target(instantiatedSignature) ?? instantiatedSignature;
        const typeParameters = Signature_TypeParameters(target);
        return instantiatedSignature?.mapper
            ? typeParameters.map((typeParameter) => Checker_instantiateType(checker, typeParameter, instantiatedSignature.mapper))
            : [];
    },
    signatureHasTypeParameters: (signature) => Signature_TypeParameters(signature).length > 0,
    getSignatureFromDeclaration: (node) => Checker_getSignatureFromDeclaration(checker, node),
    getReturnTypeOfSignature: (signature) => Checker_getReturnTypeOfSignature(checker, signature),
    getTypePredicateOfSignature: (signature) => Checker_getTypePredicateOfSignature(checker, signature),
    typeToTypeNode: (type, enclosingNode, flags) => {
        const idToSymbol = new Map();
        return Checker_TypeToTypeNode(checker, type, enclosingNode, flags, idToSymbol);
    },
    getFullyQualifiedName: (symbol, containingLocation) => Checker_getFullyQualifiedName(checker, symbol, containingLocation),
    getSymbolsInScope: (location, meaning) => Checker_GetSymbolsInScope(checker, location, meaning),
    symbolToString: (symbol) => Checker_SymbolToString(checker, symbol),
    typeToString: (type) => Checker_TypeToString(checker, type),
});
export const createExtensionCheckerHandle = (checker) => ({
    checker,
    facade: createExtensionTypeChecker(checker),
});
export const hasTstsChecker = (handle) => (handle !== undefined);
//# sourceMappingURL=checker-facade.js.map