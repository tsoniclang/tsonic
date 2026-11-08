import { sourceHostPresence } from "./queries.js";
const unread = Object.freeze({ null: false, undefined: false, complete: false, presence: undefined });
/** One reader per program adapter (its lifetime, I5). */
export function createSourceHostNullishComponents(semantics) {
    const read = new Map();
    // One constituent: an intrinsic null / undefined (factual flags), void, never, or a value type whose TS type facts
    // exclude both intrinsics (the checker's non-nullable form of it is the constituent itself, constraints included).
    const classify = (types, constituent, found) => {
        const flags = types.intrinsicNullishFlags(constituent);
        if (flags.null || flags.undefined) {
            found.null || (found.null = flags.null);
            found.undefined || (found.undefined = flags.undefined);
            return;
        }
        if (types.isVoidLike(constituent)) {
            found.undefined = true;
            return;
        }
        if (types.isNever(constituent))
            return;
        if (types.isAny(constituent) || types.isUnknown(constituent)) {
            found.complete = false;
            return;
        }
        const present = types.nonNullableType(constituent);
        if (present === undefined || !types.isIdentical(present, constituent))
            found.complete = false;
    };
    return (node) => {
        const existing = read.get(node);
        if (existing !== undefined)
            return existing;
        const types = semantics.forNode(node).types;
        const type = types.expressionType(node);
        let result = unread;
        if (type !== undefined) {
            const found = { null: false, undefined: false, complete: true };
            for (const constituent of types.isUnion(type) ? types.unionOrIntersectionTypes(type) : [type])
                classify(types, constituent, found);
            result = Object.freeze({ ...found, presence: sourceHostPresence(types, type) });
        }
        read.set(node, result);
        return result;
    };
}
//# sourceMappingURL=nullish-components.js.map