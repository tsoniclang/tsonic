import { Program_GetTypeCheckerForFile } from "../internal/compiler/program.js";
import { GetSourceFileOfNode } from "../internal/ast/utilities.js";
import { Background } from "../go/context.js";
import { Checker_GetApparentType, Checker_GetIndexInfosOfType, Checker_GetPropertiesOfType, Checker_GetPropertyOfType, Checker_GetReturnTypeOfSignature, Checker_GetSignaturesOfType, Checker_GetTypeArguments, Checker_GetTypeFromTypeNode, Checker_GetTypeOfPropertyOfType, Checker_GetWidenedType, Checker_IsArrayLikeType, Checker_RemoveMissingOrUndefinedType, } from "../internal/checker/exports.js";
import { Checker_GetConstantValue } from "../internal/checker/services.js";
import { Checker_TypeToString } from "../internal/checker/printer.js";
import { extensionHostAllowsCompilerQuery, lookupAttachedExtensionHost } from "../extensions/host-attachment.js";
import { ObjectFlagsReference, ObjectFlagsTuple, SignatureKindCall, SignatureKindConstruct, TypeFlagsAny, TypeFlagsBigIntLike, TypeFlagsBooleanLike, TypeFlagsIntersection, TypeFlagsNever, TypeFlagsNull, TypeFlagsNumberLike, TypeFlagsStringLike, TypeFlagsUnion, TypeFlagsUnknown, TypeFlagsVoidLike, TypeFlagsUndefined, TypeFlagsVoid, Type_Target, Type_Types, } from "../internal/checker/types.js";
export function createTypeShapeQueries(program, defaultOptions = {}) {
    return {
        typeToString: (type, options = {}) => withChecker(program, type, defaultOptions, options, (checker) => Checker_TypeToString(checker, type)) ?? "",
        getTypeFromTypeNode: (node, options = {}) => withCheckerForNode(program, node, defaultOptions, options, (checker) => Checker_GetTypeFromTypeNode(checker, node)),
        getConstantValue: (node, options = {}) => withCheckerForNode(program, node, defaultOptions, options, (checker) => Checker_GetConstantValue(checker, node)),
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
        isArrayLike: (type, options = {}) => withChecker(program, type, defaultOptions, options, (checker) => Checker_IsArrayLikeType(checker, type)) === true,
        getUnionOrIntersectionTypes: (type) => Type_Types(type) ?? [],
        getTypeReferenceTarget: (type) => Type_Target(type),
        getTypeArguments: (type, options = {}) => withChecker(program, type, defaultOptions, options, (checker) => Checker_GetTypeArguments(checker, type)) ?? [],
        getTupleElementTypes: (type, options = {}) => withChecker(program, type, defaultOptions, options, (checker) => {
            if (!isTupleType(type)) {
                return [];
            }
            return Checker_GetTypeArguments(checker, type);
        }) ?? [],
        getProperties: (type, options = {}) => withChecker(program, type, defaultOptions, options, (checker) => Checker_GetPropertiesOfType(checker, type)) ?? [],
        getProperty: (type, name, options = {}) => withChecker(program, type, defaultOptions, options, (checker) => Checker_GetPropertyOfType(checker, type, name)),
        getPropertyType: (type, name, options = {}) => withChecker(program, type, defaultOptions, options, (checker) => Checker_GetTypeOfPropertyOfType(checker, type, name)),
        getCallSignatures: (type, options = {}) => withChecker(program, type, defaultOptions, options, (checker) => Checker_GetSignaturesOfType(checker, type, SignatureKindCall)) ?? [],
        getConstructSignatures: (type, options = {}) => withChecker(program, type, defaultOptions, options, (checker) => Checker_GetSignaturesOfType(checker, type, SignatureKindConstruct)) ?? [],
        getReturnTypeOfSignature: (signature, options = {}) => withChecker(program, signature, defaultOptions, options, (checker) => Checker_GetReturnTypeOfSignature(checker, signature)),
        getIndexInfos: (type, options = {}) => withChecker(program, type, defaultOptions, options, (checker) => (Checker_GetIndexInfosOfType(checker, type) ?? []).map((info) => ({
            keyType: info?.keyType,
            valueType: info?.valueType,
            readonly: info?.isReadonly === true,
            declaration: info?.declaration,
            symbol: info?.indexSymbol,
            components: info?.components ?? [],
        }))) ?? [],
        getApparentType: (type, options = {}) => withChecker(program, type, defaultOptions, options, (checker) => Checker_GetApparentType(checker, type)),
        getWidenedType: (type, options = {}) => withChecker(program, type, defaultOptions, options, (checker) => Checker_GetWidenedType(checker, type)),
        removeMissingOrUndefined: (type, options = {}) => withChecker(program, type, defaultOptions, options, (checker) => Checker_RemoveMissingOrUndefinedType(checker, type)),
    };
}
function hasFlags(type, flags) {
    return type !== undefined && (type.flags & flags) !== 0;
}
function isTupleType(type) {
    if (type === undefined) {
        return false;
    }
    if ((type.objectFlags & ObjectFlagsTuple) !== 0) {
        return true;
    }
    const target = Type_Target(type);
    return target !== undefined && (target.objectFlags & ObjectFlagsTuple) !== 0;
}
function withCheckerForNode(program, node, defaultOptions, options, callback) {
    if (node === undefined) {
        return undefined;
    }
    return withChecker(program, node, defaultOptions, options, callback);
}
function withChecker(program, subject, defaultOptions, options, callback) {
    if (program === undefined || subject === undefined) {
        return undefined;
    }
    const extensionHost = lookupAttachedExtensionHost(program);
    if (extensionHost !== undefined && !extensionHost[extensionHostAllowsCompilerQuery]()) {
        throw new Error("Compiler type-shape queries are unavailable inside checked source-call producers.");
    }
    const sourceFile = options.sourceFile
        ?? defaultOptions.sourceFile
        ?? (isNode(subject) ? GetSourceFileOfNode(subject) : undefined);
    if (sourceFile === undefined) {
        return undefined;
    }
    const [checker, done] = Program_GetTypeCheckerForFile(program, options.context ?? defaultOptions.context ?? Background(), sourceFile);
    try {
        return callback(checker);
    }
    finally {
        done();
    }
}
function isNode(subject) {
    return subject !== undefined && "Kind" in subject && "Loc" in subject;
}
//# sourceMappingURL=type-shape.js.map