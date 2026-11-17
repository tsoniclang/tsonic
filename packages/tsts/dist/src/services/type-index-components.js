import { Checker_GetIndexInfosOfType } from "../internal/checker/exports.js";
import { Type_Types, TypeFlagsUnion, TypeFlagsIntersection } from "../internal/checker/types.js";
export function typeIndexComponents(checker, sourceType, index) {
    const keyType = index?.keyType;
    if (checker === undefined || sourceType === undefined || keyType === undefined)
        return Object.freeze([]);
    if ((sourceType.flags & (TypeFlagsUnion | TypeFlagsIntersection)) === 0)
        return Object.freeze([...(index?.components ?? [])]);
    const visited = new Set();
    const active = new Set();
    const declarations = new Set();
    const pending = [
        { type: sourceType, complete: false, required: true },
    ];
    let remaining = 4_096;
    while (pending.length !== 0) {
        if (--remaining < 0)
            return Object.freeze([]);
        const { type, complete, required } = pending.pop();
        if (complete) {
            active.delete(type);
            visited.add(type);
            continue;
        }
        if (active.has(type))
            return Object.freeze([]);
        if (visited.has(type))
            continue;
        const matches = Checker_GetIndexInfosOfType(checker, type).filter(info => info?.keyType === keyType);
        if (matches.length === 0 && !required)
            continue;
        const info = matches.length === 1 ? matches[0] : undefined;
        if (info === undefined)
            return Object.freeze([]);
        active.add(type);
        pending.push({ type, complete: true, required });
        if ((type.flags & (TypeFlagsUnion | TypeFlagsIntersection)) !== 0) {
            const members = Type_Types(type);
            if (members === undefined || members.length === 0 || members.some(member => member === undefined))
                return Object.freeze([]);
            if (pending.length + members.length > remaining)
                return Object.freeze([]);
            for (const member of members)
                pending.push({ type: member, complete: false, required: (type.flags & TypeFlagsUnion) !== 0 });
            continue;
        }
        const components = info.declaration === undefined ? info.components : [info.declaration];
        if (components === undefined || components.length === 0 || components.some(node => node === undefined))
            return Object.freeze([]);
        for (const declaration of components)
            declarations.add(declaration);
    }
    return Object.freeze([...declarations]);
}
//# sourceMappingURL=type-index-components.js.map