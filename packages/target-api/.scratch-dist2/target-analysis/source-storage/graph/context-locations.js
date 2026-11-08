import { sourceStorageObjectRestOwner } from "../model/subjects.js";
export function createSourceStorageContextLocations(source, budget, storesFor, callEffectFor) {
    return (subject) => {
        if (subject.kind === "value") {
            const effect = callEffectFor(subject);
            if (source.ast.is.IsObjectLiteralExpression(subject.node) || source.ast.is.IsArrayLiteralExpression(subject.node) ||
                sourceStorageObjectRestOwner(subject.node, source.ast) !== undefined ||
                source.ast.is.IsNewExpression(subject.node) && effect?.resultAlias === undefined ||
                effect?.resultAllocation === subject.node)
                return "allocation";
        }
        for (const store of storesFor(subject) ?? []) {
            if (!budget.step())
                return undefined;
            if (store.destination === "binding" && store.kind === "mutation")
                return "binding";
        }
        return undefined;
    };
}
//# sourceMappingURL=context-locations.js.map