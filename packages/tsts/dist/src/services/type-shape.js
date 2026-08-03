import { SymbolName } from "../internal/ast/symbol.js";
import { SymbolFlagsOptional } from "../internal/ast/symbolflags.js";
import { Program_GetTypeCheckerForFile } from "../internal/compiler/program.js";
import { Background } from "../go/context.js";
import { Checker_GetApparentType, Checker_GetIndexInfosOfType, Checker_GetPropertiesOfType, Checker_GetReturnTypeOfSignature, Checker_GetSignaturesOfType, Checker_GetTypeArguments, Checker_GetTypeFromTypeNode, Checker_GetTypeOfPropertyOfType, Checker_GetWidenedType, Checker_IsArrayLikeType, Checker_RemoveMissingOrUndefinedType, IsTupleType, } from "../internal/checker/exports.js";
import { Checker_isReadonlySymbol } from "../internal/checker/checker/symbols.js";
import { Checker_GetConstantValue } from "../internal/checker/services.js";
import { Checker_TypeToString } from "../internal/checker/printer.js";
import { ObjectFlagsReference, SignatureKindCall, SignatureKindConstruct, TypeFlagsAny, TypeFlagsBigIntLike, TypeFlagsBooleanLike, TypeFlagsIntersection, TypeFlagsNever, TypeFlagsNull, TypeFlagsNumberLike, TypeFlagsStringLike, TypeFlagsUnion, TypeFlagsUnknown, TypeFlagsVoidLike, TypeFlagsUndefined, TypeFlagsVoid, Type_Target, Type_Types, } from "../internal/checker/types.js";
export function createTypeShapeQueries(program, defaultOptions) {
    if (program === undefined || defaultOptions.sourceFile === undefined) {
        throw new Error("Type-shape queries require one source file from the compiler program.");
    }
    const queries = {
        typeToString: (type) => withCheckerForType(program, type, defaultOptions, (checker) => Checker_TypeToString(checker, type)) ?? "",
        getTypeFromTypeNode: (node) => withCheckerForNode(program, node, defaultOptions, (checker) => Checker_GetTypeFromTypeNode(checker, node)),
        getConstantValue: (node) => withCheckerForNode(program, node, defaultOptions, (checker) => Checker_GetConstantValue(checker, node)),
        isAny: (type) => hasFlags(type, TypeFlagsAny),
        isUnknown: (type) => hasFlags(type, TypeFlagsUnknown),
        isNever: (type) => hasFlags(type, TypeFlagsNever),
        isVoidLike: (type) => hasFlags(type, TypeFlagsVoidLike) || hasFlags(type, TypeFlagsVoid),
        isNullish: (type) => hasFlags(type, TypeFlagsNull) || hasFlags(type, TypeFlagsUndefined),
        isStringLike: (type) => hasFlags(type, TypeFlagsStringLike),
        isNumberLike: (type) => hasFlags(type, TypeFlagsNumberLike),
        isBooleanLike: (type) => hasFlags(type, TypeFlagsBooleanLike),
        isBigIntLike: (type) => hasFlags(type, TypeFlagsBigIntLike),
        isUnion: (type) => hasFlags(type, TypeFlagsUnion),
        isIntersection: (type) => hasFlags(type, TypeFlagsIntersection),
        isTypeReference: (type) => type !== undefined && (type.objectFlags & ObjectFlagsReference) !== 0,
        isTuple: isTupleType,
        isArrayLike: (type) => withCheckerForType(program, type, defaultOptions, (checker) => Checker_IsArrayLikeType(checker, type)) === true,
        couldContainTypeVariables: (type) => withCheckerForType(program, type, defaultOptions, (checker) => {
            if (checker === undefined) {
                throw new Error("The source type has no owning checker for genericity analysis.");
            }
            return checker.couldContainTypeVariables(type);
        }) === true,
        getUnionOrIntersectionTypes: (type) => Type_Types(type) ?? [],
        getTypeReferenceTarget: (type) => Type_Target(type),
        getTypeArguments: (type) => withCheckerForType(program, type, defaultOptions, (checker) => Checker_GetTypeArguments(checker, type)) ?? [],
        getTupleElementTypes: (type) => withCheckerForType(program, type, defaultOptions, (checker) => {
            if (!isTupleType(type)) {
                return [];
            }
            return Checker_GetTypeArguments(checker, type);
        }) ?? [],
        getPropertyInfos: (type) => withCheckerForType(program, type, defaultOptions, (checker) => getTypePropertyInfos(checker, type)) ?? [],
        getCallSignatures: (type) => withCheckerForType(program, type, defaultOptions, (checker) => Checker_GetSignaturesOfType(checker, type, SignatureKindCall)) ?? [],
        getConstructSignatures: (type) => withCheckerForType(program, type, defaultOptions, (checker) => Checker_GetSignaturesOfType(checker, type, SignatureKindConstruct)) ?? [],
        getReturnTypeOfSignature: (signature) => withCheckerForSignature(program, signature, defaultOptions, (checker) => Checker_GetReturnTypeOfSignature(checker, signature)),
        getIndexInfos: (type) => withCheckerForType(program, type, defaultOptions, (checker) => (Checker_GetIndexInfosOfType(checker, type) ?? []).map((info) => ({
            keyType: info?.keyType,
            valueType: info?.valueType,
            readonly: info?.isReadonly === true,
            declaration: info?.declaration,
            symbol: info?.indexSymbol,
            components: info?.components ?? [],
        }))) ?? [],
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
    return properties.map((symbol) => {
        if (symbol === undefined) {
            throw new Error("The checker returned an absent property symbol for a source type.");
        }
        const name = SymbolName(symbol);
        const propertyType = Checker_GetTypeOfPropertyOfType(checker, type, symbol.Name);
        if (propertyType === undefined) {
            throw new Error(`The checker returned property '${name}' without its effective source type.`);
        }
        return {
            symbol,
            name,
            type: propertyType,
            optional: (symbol.Flags & SymbolFlagsOptional) !== 0,
            readonly: Checker_isReadonlySymbol(checker, symbol) === true,
        };
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