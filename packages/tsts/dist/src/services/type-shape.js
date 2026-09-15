import { readTypeIndexInfo, readTypePropertyInfo } from "./type-members.js";
import { readTypeIndexedAccessComponents, selectTypeIndexedAccess } from "./type-indexed-access.js";
import { readTypeAliasApplication, resolveTypeAliasApplication } from "./type-applications.js";
import { CheckFlagsOptionalParameter, CheckFlagsRestParameter, } from "../internal/ast/checkflags.js";
import { Program_GetTypeCheckerForFile } from "../internal/compiler/program.js";
import { Background } from "../go/context.js";
import { Checker_GetApparentType, Checker_GetExpandedParameters, Checker_GetIndexInfosOfType, Checker_GetPropertiesOfType, Checker_GetReturnTypeOfSignature, Checker_GetSignaturesOfType, Checker_GetTypeArguments, Checker_GetTypeFromTypeNode, Checker_GetWidenedType, Checker_IsArrayLikeType, Checker_RemoveMissingOrUndefinedType, IsTupleType, } from "../internal/checker/exports.js";
import { Checker_getTypeOfSymbol, } from "../internal/checker/checker/symbols.js";
import { Checker_isOptionalParameter } from "../internal/checker/utilities.js";
import { getBigIntLiteralValue, getNumberLiteralValue, signatureHasRestParameter, } from "../internal/checker/checker/state.js";
import { PseudoBigInt_String } from "../internal/jsnum/pseudobigint.js";
import { Checker_isTypeIdenticalTo } from "../internal/checker/relater.js";
import { Checker_GetConstantValue, } from "../internal/checker/services.js";
import { Checker_TypeToString } from "../internal/checker/printer.js";
import { ElementFlagsOptional, ElementFlagsRest, ElementFlagsVariadic, ObjectFlagsReference, ObjectFlagsClassOrInterface, SignatureKindCall, SignatureKindConstruct, TypeFlagsAny, TypeFlagsBigIntLike, TypeFlagsBigIntLiteral, TypeFlagsBooleanLike, TypeFlagsESSymbolLike, TypeFlagsIntersection, TypeFlagsNever, TypeFlagsNull, TypeFlagsNumberLike, TypeFlagsNumberLiteral, TypeFlagsObject, TypeFlagsStringLike, TypeFlagsSubstitution, TypeFlagsUnion, TypeFlagsUnknown, TypeFlagsVoidLike, TypeFlagsUndefined, TypeFlagsVoid, Type_Target, Type_TargetTupleType, Type_AsSubstitutionType, Type_AsInterfaceType, InterfaceType_TypeParameters, Type_Types, Signature_ThisParameter, } from "../internal/checker/types.js";
export function createTypeShapeQueries(program, defaultOptions) {
    if (program === undefined || defaultOptions.sourceFile === undefined) {
        throw new Error("Type-shape queries require one source file from the compiler program.");
    }
    const queries = {
        typeToString: (type) => withCheckerForType(program, type, defaultOptions, (checker) => Checker_TypeToString(checker, type)) ?? "",
        getTypeFromTypeNode: (node) => withCheckerForNode(program, node, defaultOptions, (checker) => Checker_GetTypeFromTypeNode(checker, node)),
        instantiateTypeAlias: (declaration, arguments_) => withCheckerForNode(program, declaration, defaultOptions, checker => resolveTypeAliasApplication(checker, declaration, arguments_)),
        getTypeAliasApplication: (type) => withCheckerForSourceFile(program, defaultOptions.sourceFile, defaultOptions, checker => readTypeAliasApplication(checker, type)),
        getIndexedAccessComponents: (type) => withCheckerForSourceFile(program, defaultOptions.sourceFile, defaultOptions, checker => readTypeIndexedAccessComponents(checker, type)),
        selectIndexedAccess: (objectType, indexType) => withCheckerForSourceFile(program, defaultOptions.sourceFile, defaultOptions, checker => selectTypeIndexedAccess(checker, objectType, indexType)),
        getConstantValue: (node) => withCheckerForNode(program, node, defaultOptions, (checker) => Checker_GetConstantValue(checker, node)),
        getNumericLiteralTypeValue: (type) => withCheckerForType(program, type, defaultOptions, () => {
            if (hasFlags(type, TypeFlagsNumberLiteral))
                return getNumberLiteralValue(type);
            if (hasFlags(type, TypeFlagsBigIntLiteral))
                return BigInt(PseudoBigInt_String(getBigIntLiteralValue(type)));
            return undefined;
        }),
        isAny: (type) => hasFlags(type, TypeFlagsAny),
        isUnknown: (type) => hasFlags(type, TypeFlagsUnknown),
        isNever: (type) => hasFlags(type, TypeFlagsNever),
        isVoidLike: (type) => hasFlags(type, TypeFlagsVoidLike) || hasFlags(type, TypeFlagsVoid),
        isNullish: (type) => hasFlags(type, TypeFlagsNull) || hasFlags(type, TypeFlagsUndefined),
        isStringLike: (type) => hasFlags(type, TypeFlagsStringLike),
        isNumberLike: (type) => hasFlags(type, TypeFlagsNumberLike),
        isBooleanLike: (type) => hasFlags(type, TypeFlagsBooleanLike),
        isBigIntLike: (type) => hasFlags(type, TypeFlagsBigIntLike),
        isSymbolLike: (type) => hasFlags(type, TypeFlagsESSymbolLike),
        isUnion: (type) => hasFlags(type, TypeFlagsUnion),
        isIntersection: (type) => hasFlags(type, TypeFlagsIntersection),
        isTypeReference: (type) => type !== undefined && (type.objectFlags & ObjectFlagsReference) !== 0,
        isTuple: isTupleType,
        isArrayLike: (type) => withCheckerForType(program, type, defaultOptions, (checker) => Checker_IsArrayLikeType(checker, type)) === true,
        isTypeIdenticalTo: (left, right) => withCheckerForType(program, left, defaultOptions, (checker) => Checker_isTypeIdenticalTo(checker, left, right)) === true,
        couldContainTypeVariables: (type) => withCheckerForType(program, type, defaultOptions, (checker) => {
            if (checker === undefined) {
                throw new Error("The source type has no owning checker for genericity analysis.");
            }
            return checker.couldContainTypeVariables(type);
        }) === true,
        getUnionOrIntersectionTypes: (type) => Type_Types(type) ?? [],
        getTypeReferenceTarget: (type) => Type_Target(type),
        getTypeArguments: (type) => withCheckerForType(program, type, defaultOptions, (checker) => Checker_GetTypeArguments(checker, type)) ?? [],
        getTypeReferenceArgumentInfos: (type) => withCheckerForType(program, type, defaultOptions, (checker) => {
            if (type === undefined || checker === undefined || !hasFlags(type, TypeFlagsObject))
                return undefined;
            const target = Type_Target(type) ?? type;
            if ((target.objectFlags & ObjectFlagsClassOrInterface) === 0)
                return undefined;
            const definition = Type_AsInterfaceType(target);
            if (definition === undefined)
                return undefined;
            const parameters = InterfaceType_TypeParameters(definition);
            if ((type.objectFlags & ObjectFlagsReference) === 0) {
                return parameters.length === 0 && definition.outerTypeParameterCount === 0
                    ? Object.freeze([])
                    : undefined;
            }
            const arguments_ = Checker_GetTypeArguments(checker, type);
            if (!Number.isSafeInteger(definition.outerTypeParameterCount) ||
                definition.outerTypeParameterCount < 0 || definition.outerTypeParameterCount > parameters.length ||
                arguments_.length < parameters.length ||
                arguments_.length > parameters.length + (definition.thisType === undefined ? 0 : 1))
                return undefined;
            const result = [];
            for (const [index, parameter] of parameters.entries()) {
                const argument = arguments_[index];
                if (parameter === undefined || argument === undefined)
                    return undefined;
                result.push(Object.freeze({ parameter, argument,
                    scope: index < definition.outerTypeParameterCount ? "outer" : "local" }));
            }
            return Object.freeze(result);
        }),
        getSubstitutionBaseType: (type) => hasFlags(type, TypeFlagsSubstitution)
            ? Type_AsSubstitutionType(type)?.baseType
            : undefined,
        getTupleElementTypes: (type) => withCheckerForType(program, type, defaultOptions, (checker) => {
            if (!isTupleType(type)) {
                return [];
            }
            return Checker_GetTypeArguments(checker, type);
        }) ?? [],
        getTupleElementInfos: (type) => withCheckerForType(program, type, defaultOptions, (checker) => getTypeTupleElementInfos(checker, type)) ?? [],
        getPropertyInfos: (type) => withCheckerForType(program, type, defaultOptions, (checker) => getTypePropertyInfos(checker, type)) ?? [],
        getCallSignatures: (type) => withCheckerForType(program, type, defaultOptions, (checker) => Checker_GetSignaturesOfType(checker, type, SignatureKindCall)) ?? [],
        getConstructSignatures: (type) => withCheckerForType(program, type, defaultOptions, (checker) => Checker_GetSignaturesOfType(checker, type, SignatureKindConstruct)) ?? [],
        getSignatureParameterInfos: (signature) => withCheckerForSignature(program, signature, defaultOptions, (checker) => getTypeSignatureParameterInfos(checker, signature)) ?? [],
        getSignatureThisParameterInfo: (signature) => withCheckerForSignature(program, signature, defaultOptions, (checker) => getTypeSignatureThisParameterInfo(checker, signature)),
        getReturnTypeOfSignature: (signature) => withCheckerForSignature(program, signature, defaultOptions, (checker) => Checker_GetReturnTypeOfSignature(checker, signature)),
        getIndexInfos: (type) => withCheckerForType(program, type, defaultOptions, (checker) => (Checker_GetIndexInfosOfType(checker, type) ?? []).map((info) => readTypeIndexInfo(checker, type, info))) ?? [],
        getApparentType: (type) => withCheckerForType(program, type, defaultOptions, (checker) => Checker_GetApparentType(checker, type)),
        getWidenedType: (type) => withCheckerForType(program, type, defaultOptions, (checker) => Checker_GetWidenedType(checker, type)),
        removeMissingOrUndefined: (type) => withCheckerForType(program, type, defaultOptions, (checker) => Checker_RemoveMissingOrUndefinedType(checker, type)),
    };
    return Object.freeze(queries);
}
function hasFlags(type, flags) {
    return type !== undefined && (type.flags & flags) !== 0;
}
function getTypePropertyInfos(checker, type) {
    if (checker === undefined) {
        throw new Error("The source type has no owning checker for property analysis.");
    }
    const properties = Checker_GetPropertiesOfType(checker, type) ?? [];
    return properties.map((symbol) => readTypePropertyInfo(checker, type, symbol));
}
function getTypeTupleElementInfos(checker, type) {
    if (checker === undefined || type === undefined || !isTupleType(type)) {
        return [];
    }
    const elementTypes = Checker_GetTypeArguments(checker, type);
    const elementInfos = Type_TargetTupleType(type)?.elementInfos ?? [];
    if (elementTypes.length !== elementInfos.length ||
        elementTypes.some((element) => element === undefined)) {
        throw new Error("The checker returned tuple element types without matching tuple element evidence.");
    }
    return Object.freeze(elementTypes.map((element, index) => {
        const info = elementInfos[index];
        const elementKind = (info.flags & ElementFlagsVariadic) !== 0
            ? "variadic"
            : (info.flags & ElementFlagsRest) !== 0
                ? "rest"
                : (info.flags & ElementFlagsOptional) !== 0
                    ? "optional"
                    : "required";
        return Object.freeze({
            type: element,
            elementKind,
            ...(info.labeledDeclaration === undefined
                ? {}
                : { declaration: info.labeledDeclaration }),
        });
    }));
}
function getTypeSignatureParameterInfos(checker, signature) {
    if (checker === undefined || signature === undefined) {
        return [];
    }
    const sourceParameters = signature.parameters ?? [];
    const expandedGroups = Checker_GetExpandedParameters(checker, signature, true);
    if (expandedGroups.length !== 1) {
        throw new Error("The checker returned more than one effective parameter group while union expansion was disabled.");
    }
    const effectiveParameters = expandedGroups[0] ?? [];
    const restIndex = signatureHasRestParameter(signature)
        ? sourceParameters.length - 1
        : -1;
    const restSymbol = restIndex < 0 ? undefined : sourceParameters[restIndex];
    const restType = restSymbol === undefined
        ? undefined
        : Checker_getTypeOfSymbol(checker, restSymbol);
    const tupleElements = restType === undefined
        ? []
        : getTypeTupleElementInfos(checker, restType);
    const tupleExpanded = restIndex >= 0 && tupleElements.length > 0 &&
        effectiveParameters.length === restIndex + tupleElements.length;
    return Object.freeze(effectiveParameters.map((parameter, index) => {
        if (parameter === undefined) {
            throw new Error("The checker returned an absent effective signature parameter.");
        }
        const tupleElement = tupleExpanded && index >= restIndex
            ? tupleElements[index - restIndex]
            : undefined;
        const unexpandedRest = restIndex >= 0 && !tupleExpanded &&
            index === restIndex;
        const sourceSymbol = tupleElement === undefined
            ? unexpandedRest
                ? restSymbol
                : parameter
            : restSymbol;
        const type = unexpandedRest
            ? restType
            : Checker_getTypeOfSymbol(checker, parameter);
        if (sourceSymbol === undefined || type === undefined) {
            throw new Error("The checker returned an effective signature parameter without exact source ownership or type evidence.");
        }
        const declaration = tupleElement?.declaration ??
            sourceSymbol.ValueDeclaration ?? sourceSymbol.Declarations?.[0];
        const parameterKind = tupleElement?.elementKind === "optional" ||
            (declaration !== undefined &&
                Checker_isOptionalParameter(checker, declaration)) ||
            (parameter.CheckFlags & CheckFlagsOptionalParameter) !== 0
            ? "optional"
            : unexpandedRest || tupleElement?.elementKind === "rest" ||
                tupleElement?.elementKind === "variadic" ||
                (parameter.CheckFlags & CheckFlagsRestParameter) !== 0
                ? "rest"
                : "required";
        return Object.freeze({
            sourceSymbol,
            type,
            parameterKind,
            ...(declaration === undefined ? {} : { declaration }),
        });
    }));
}
function getTypeSignatureThisParameterInfo(checker, signature) {
    if (checker === undefined || signature === undefined) {
        return undefined;
    }
    const symbol = Signature_ThisParameter(signature);
    if (symbol === undefined) {
        return undefined;
    }
    const type = Checker_getTypeOfSymbol(checker, symbol);
    if (type === undefined) {
        throw new Error("The checker returned an explicit this parameter without its selected source type.");
    }
    const declaration = symbol.ValueDeclaration ?? symbol.Declarations?.[0];
    return Object.freeze({
        symbol,
        type,
        ...(declaration === undefined ? {} : { declaration }),
    });
}
function isTupleType(type) {
    return type !== undefined && IsTupleType(type);
}
function withCheckerForNode(program, node, defaultOptions, callback) {
    if (node === undefined) {
        return undefined;
    }
    return withCheckerForSourceFile(program, defaultOptions.sourceFile, defaultOptions, callback);
}
function withCheckerForType(program, type, defaultOptions, callback) {
    if (program === undefined || type === undefined) {
        return undefined;
    }
    if (type.checker !== undefined) {
        return callback(type.checker);
    }
    return withCheckerForSourceFile(program, defaultOptions.sourceFile, defaultOptions, callback);
}
function withCheckerForSignature(program, signature, defaultOptions, callback) {
    if (program === undefined || signature === undefined) {
        return undefined;
    }
    return withCheckerForSourceFile(program, defaultOptions.sourceFile, defaultOptions, callback);
}
function withCheckerForSourceFile(program, sourceFile, defaultOptions, callback) {
    if (sourceFile === undefined) {
        return undefined;
    }
    const [checker, done] = Program_GetTypeCheckerForFile(program, defaultOptions.context ?? Background(), sourceFile);
    try {
        return callback(checker);
    }
    finally {
        done();
    }
}
//# sourceMappingURL=type-shape.js.map