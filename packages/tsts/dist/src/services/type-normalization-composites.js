import { getIntersectionKey, getUnionKey, insertType, IntersectionFlagsNone, IntersectionFlagsNoConstraintReduction, UnionReductionNone } from "../internal/checker/checker/state.js";
import { Checker_getIntersectionTypeEx, Checker_getUnionTypeEx, Checker_newIntersectionType, Checker_newUnionType } from "../internal/checker/checker/types.js";
import { ObjectFlagsNone, TypeFlagsIntersection, TypeFlagsUnion, Type_AsUnionType, Type_Types } from "../internal/checker/types.js";
function normalizeMembers(source, producer, type, normalize) {
    const selected = [];
    for (const member of Type_Types(type)) {
        if (member === undefined || member.checker !== source)
            throw new TypeError("A native composite type retains its actual member producers");
        const value = normalize(member);
        if (value.checker !== producer)
            throw new TypeError("A native composite type requires normalized member producers");
        selected.push(value);
    }
    return selected;
}
function normalizeOrigin(source, producer, origin, normalize) {
    if (origin.checker !== source)
        throw new TypeError("A native union origin retains its actual source producer");
    if ((origin.flags & (TypeFlagsUnion | TypeFlagsIntersection)) === 0)
        return normalize(origin);
    const members = normalizeMembers(source, producer, origin, normalize);
    const union = (origin.flags & TypeFlagsUnion) !== 0;
    let selected = members;
    if (union) {
        selected = [];
        for (const member of members)
            [selected] = insertType(selected, member);
    }
    const result = union ? Checker_newUnionType(producer, ObjectFlagsNone, selected)
        : Checker_newIntersectionType(producer, ObjectFlagsNone, selected);
    if (result === undefined || result.checker !== producer)
        throw new Error("The native union-origin constructor retains its actual result producer");
    return result;
}
export function cachedCompositeConstruction(source, type) {
    if (type.alias !== undefined || (type.flags & (TypeFlagsUnion | TypeFlagsIntersection)) === 0)
        return undefined;
    if (type.checker !== source)
        throw new TypeError("A native composite type retains its actual producing checker");
    const members = Type_Types(type);
    const union = (type.flags & TypeFlagsUnion) !== 0;
    const origin = union ? Type_AsUnionType(type)?.origin : undefined;
    let intersectionFlags = IntersectionFlagsNone;
    if (union) {
        if (source.unionTypes.get(getUnionKey(members, origin, undefined)) !== type)
            return undefined;
    }
    else if (source.intersectionTypes.get(getIntersectionKey(members, intersectionFlags, undefined)) !== type) {
        intersectionFlags = IntersectionFlagsNoConstraintReduction;
        if (source.intersectionTypes.get(getIntersectionKey(members, intersectionFlags, undefined)) !== type)
            return undefined;
    }
    return { members, union, origin, intersectionFlags };
}
export function reacquireCompositeType(producer, type, normalize) {
    if (type.alias !== undefined || (type.flags & (TypeFlagsUnion | TypeFlagsIntersection)) === 0)
        return undefined;
    const source = type.checker;
    if (source === undefined || source.program.SourceFiles() !== producer.program.SourceFiles())
        throw new TypeError("A native composite type retains its actual Program and producer");
    const construction = cachedCompositeConstruction(source, type);
    if (construction === undefined)
        return undefined;
    const { union, origin, intersectionFlags } = construction;
    const selected = normalizeMembers(source, producer, type, normalize);
    const selectedOrigin = origin === undefined ? undefined : normalizeOrigin(source, producer, origin, normalize);
    if (selectedOrigin !== undefined && selectedOrigin.checker !== producer)
        throw new TypeError("A native union origin requires its normalized producer");
    const result = union ? Checker_getUnionTypeEx(producer, selected, UnionReductionNone, undefined, selectedOrigin)
        : Checker_getIntersectionTypeEx(producer, selected, intersectionFlags, undefined);
    if (result === undefined || result.checker !== producer)
        throw new Error("The native composite constructor retains its actual result producer");
    return result;
}
//# sourceMappingURL=type-normalization-composites.js.map