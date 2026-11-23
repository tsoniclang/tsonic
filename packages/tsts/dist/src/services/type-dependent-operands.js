import { Type_AsIndexType, Type_AsSubstitutionType, TypeFlagsIndex, TypeFlagsSubstitution } from "../internal/checker/types.js";
function owns(checker, type, family) {
    return checker !== undefined && type?.checker === checker && (type.flags & family) !== 0 && type.data.AsType() === type;
}
export function readTypeKeyOfComponents(checker, type) {
    if (!owns(checker, type, TypeFlagsIndex))
        return undefined;
    const index = Type_AsIndexType(type);
    const target = index?.target;
    if (index === undefined || target === undefined || target.checker !== checker)
        return undefined;
    return Object.freeze({ target, indexFlags: index.indexFlags });
}
export function readTypeSubstitutionComponents(checker, type) {
    if (!owns(checker, type, TypeFlagsSubstitution))
        return undefined;
    const substitution = Type_AsSubstitutionType(type);
    const base = substitution?.baseType;
    const constraint = substitution?.constraint;
    if (base === undefined || constraint === undefined || base.checker !== checker || constraint.checker !== checker)
        return undefined;
    return Object.freeze({ base, constraint });
}
//# sourceMappingURL=type-dependent-operands.js.map