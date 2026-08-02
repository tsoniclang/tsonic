import { Program_GetTypeCheckerForFile } from "../internal/compiler/program.js";
import { Background } from "../go/context.js";
import { Checker_GetApparentType, Checker_GetIndexInfosOfType, Checker_GetPropertiesOfType, Checker_GetPropertyOfType, Checker_GetReturnTypeOfSignature, Checker_GetSignaturesOfType, Checker_GetTypeArguments, Checker_GetTypeFromTypeNode, Checker_GetTypeOfPropertyOfType, Checker_GetWidenedType, Checker_IsArrayLikeType, Checker_RemoveMissingOrUndefinedType, IsTupleType, } from "../internal/checker/exports.js";
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
        getUnionOrIntersectionTypes: (type) => Type_Types(type) ?? [],
        getTypeReferenceTarget: (type) => Type_Target(type),
        getTypeArguments: (type) => withCheckerForType(program, type, defaultOptions, (checker) => Checker_GetTypeArguments(checker, type)) ?? [],
        getTupleElementTypes: (type) => withCheckerForType(program, type, defaultOptions, (checker) => {
            if (!isTupleType(type)) {
                return [];
            }
            return Checker_GetTypeArguments(checker, type);
        }) ?? [],
        getProperties: (type) => withCheckerForType(program, type, defaultOptions, (checker) => Checker_GetPropertiesOfType(checker, type)) ?? [],
        getProperty: (type, name) => withCheckerForType(program, type, defaultOptions, (checker) => Checker_GetPropertyOfType(checker, type, name)),
        getPropertyType: (type, name) => withCheckerForType(program, type, defaultOptions, (checker) => Checker_GetTypeOfPropertyOfType(checker, type, name)),
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