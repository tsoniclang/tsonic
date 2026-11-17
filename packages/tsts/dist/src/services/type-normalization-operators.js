import { Checker_getIndexTypeEx, Checker_getIndexedAccessTypeEx } from "../internal/checker/checker/symbols.js";
import { Checker_getTemplateLiteralType } from "../internal/checker/checker/types.js";
import { Checker_getOrCreateSubstitutionType, Checker_getStringMappingType } from "../internal/checker/checker/inference.js";
import { Checker_inferTypeForHomomorphicMappedType } from "../internal/checker/inference.js";
import { TypeFlagsIndex, TypeFlagsIndexedAccess, TypeFlagsTemplateLiteral, TypeFlagsStringMapping, TypeFlagsSubstitution, Type_AsIndexType, Type_AsIndexedAccessType, Type_AsTemplateLiteralType, Type_AsStringMappingType, Type_AsSubstitutionType } from "../internal/checker/types.js";
import { ObjectFlagsReverseMapped, TypeFlagsObject, Type_AsReverseMappedType } from "../internal/checker/types.js";
function normalizedOperand(producer, normalize, value) {
    const selected = normalize(value);
    if (selected.checker !== producer)
        throw new TypeError("A native type operator requires its normalized input producer");
    return selected;
}
export function reacquireTypeOperator(producer, type, normalize) {
    if (type.alias !== undefined)
        return undefined;
    let result;
    if ((type.flags & TypeFlagsIndex) !== 0) {
        const data = Type_AsIndexType(type);
        if (data?.target === undefined)
            throw new TypeError("A native index type requires its actual target");
        result = Checker_getIndexTypeEx(producer, normalizedOperand(producer, normalize, data.target), data.indexFlags);
    }
    else if ((type.flags & TypeFlagsIndexedAccess) !== 0) {
        const data = Type_AsIndexedAccessType(type);
        if (data?.objectType === undefined || data.indexType === undefined)
            throw new TypeError("A native indexed access requires its actual operands");
        result = Checker_getIndexedAccessTypeEx(producer, normalizedOperand(producer, normalize, data.objectType), normalizedOperand(producer, normalize, data.indexType), data.accessFlags, undefined, undefined);
    }
    else if ((type.flags & TypeFlagsTemplateLiteral) !== 0) {
        const data = Type_AsTemplateLiteralType(type);
        if (data === undefined || data.texts.length !== data.types.length + 1)
            throw new TypeError("A native template type requires its actual spans");
        const types = [];
        for (const value of data.types) {
            if (value === undefined)
                throw new TypeError("A native template type requires its actual operand");
            types.push(normalizedOperand(producer, normalize, value));
        }
        result = Checker_getTemplateLiteralType(producer, data.texts, types);
    }
    else if ((type.flags & TypeFlagsStringMapping) !== 0) {
        const data = Type_AsStringMappingType(type);
        if (data?.target === undefined || type.symbol === undefined)
            throw new TypeError("A native string mapping requires its actual symbol and operand");
        result = Checker_getStringMappingType(producer, type.symbol, normalizedOperand(producer, normalize, data.target));
    }
    else if ((type.flags & TypeFlagsSubstitution) !== 0) {
        const data = Type_AsSubstitutionType(type);
        if (data?.baseType === undefined || data.constraint === undefined)
            throw new TypeError("A native substitution requires its actual operands");
        const owner = type.checker;
        if (owner === undefined)
            throw new TypeError("A native substitution requires its actual producer");
        if (owner.substitutionTypes.get({ baseId: data.baseType.id, constraintId: data.constraint.id }) !== type)
            return undefined;
        result = Checker_getOrCreateSubstitutionType(producer, normalizedOperand(producer, normalize, data.baseType), normalizedOperand(producer, normalize, data.constraint));
    }
    else if ((type.flags & TypeFlagsObject) !== 0 && (type.objectFlags & ObjectFlagsReverseMapped) !== 0) {
        const data = Type_AsReverseMappedType(type);
        const owner = type.checker;
        if (owner === undefined || data?.source === undefined || data.mappedType === undefined || data.constraintType === undefined) {
            throw new TypeError("A native reverse mapping requires its actual construction inputs");
        }
        if (owner.reverseHomomorphicMappedCache.get({ sourceId: data.source.id, targetId: data.mappedType.id,
            constraintId: data.constraintType.id }) !== type)
            return undefined;
        result = Checker_inferTypeForHomomorphicMappedType(producer, normalizedOperand(producer, normalize, data.source), normalizedOperand(producer, normalize, data.mappedType), normalizedOperand(producer, normalize, data.constraintType));
    }
    else
        return undefined;
    if (result === undefined)
        throw new Error("The native type operator constructor did not return its value");
    return result;
}
//# sourceMappingURL=type-normalization-operators.js.map