import { sourceTypeRelationship } from "./semantics-type-relationship.js";
export function selectSourceTypeRefinement(types, checker, facts, declaredType, selectedType) {
    if (sourceTypeMemberRefines(types, checker, facts, declaredType, selectedType)) {
        return { kind: "exact", type: declaredType };
    }
    if (!types.isUnion(declaredType)) {
        return { kind: "unrelated" };
    }
    const rawDeclaredMembers = types.getUnionOrIntersectionTypes(declaredType);
    const rawSelectedMembers = types.isUnion(selectedType)
        ? types.getUnionOrIntersectionTypes(selectedType)
        : [selectedType];
    if (rawDeclaredMembers.some((member) => member === undefined) ||
        rawSelectedMembers.some((member) => member === undefined)) {
        return { kind: "unrelated" };
    }
    const declaredMembers = rawDeclaredMembers.filter((member) => member !== undefined);
    const selectedMembers = rawSelectedMembers.filter((member) => member !== undefined);
    const refined = [];
    for (const selectedMember of selectedMembers) {
        const candidates = declaredMembers.filter((declaredMember) => sourceTypeMemberRefines(types, checker, facts, declaredMember, selectedMember));
        if (candidates.length === 0) {
            return { kind: "unrelated" };
        }
        if (candidates.length !== 1) {
            return { kind: "ambiguous" };
        }
        if (!refined.includes(candidates[0])) {
            refined.push(candidates[0]);
        }
    }
    return { kind: "members", types: Object.freeze(refined) };
}
export function sourceTypeMemberRefines(types, checker, facts, declaredMember, selectedMember) {
    const pending = [selectedMember];
    const visited = new Set();
    let remaining = 2048;
    while (pending.length > 0) {
        if (--remaining < 0)
            return false;
        const member = pending.pop();
        if (visited.has(member))
            continue;
        visited.add(member);
        if (sourceTypeRelationship(types, checker, facts, declaredMember, member) !== "unrelated")
            return true;
        const base = types.getBaseTypeOfLiteralType(member);
        if (base !== undefined && base !== member &&
            sourceTypeRelationship(types, checker, facts, declaredMember, base) !== "unrelated")
            return true;
        if (types.getNumericLiteralTypeValue(member) !== undefined && types.getNumericLiteralTypeValue(declaredMember) === undefined &&
            (types.isNumberLike(member) && types.isNumberLike(declaredMember) || types.isBigIntLike(member) && types.isBigIntLike(declaredMember)))
            return true;
        if (types.isIntersection(member)) {
            const parts = types.getUnionOrIntersectionTypes(member);
            if (parts.some(part => part === undefined) || parts.length > remaining - pending.length)
                return false;
            pending.push(...parts);
        }
    }
    return false;
}
//# sourceMappingURL=semantics-type-refinement.js.map