import { sourceStorageSubjectType } from "../model/components.js";
import { sourceStorageProjectComponents } from "./component-projections.js";
import { sourceStorageIsMemberProjection } from "../model/subjects.js";
export function createSourceStorageEdges(source, budget, subject, sourceFileFor) {
    const destinations = new Map();
    const selections = new Map();
    const empty = new Set();
    const add = (origin, destination, types) => {
        const kinds = destinations.get(destination.node) ?? new Map();
        const selected = kinds.get(destination.kind) ?? { components: new Map(), revision: 0 };
        const origins = selected.components.get(destination) ?? new Map();
        const previous = origins.get(origin);
        for (const existing of previous ?? []) {
            if (!budget.step())
                return false;
            if (existing?.from === types?.from && existing?.to === types?.to)
                return false;
        }
        if (!budget.edge())
            return false;
        origins.set(origin, new Set([...previous ?? [], types === undefined ? undefined : Object.freeze({ ...types })]));
        selected.components.set(destination, origins);
        selected.revision += 1;
        kinds.set(destination.kind, selected);
        destinations.set(destination.node, kinds);
        return true;
    };
    const projectOrigin = (origin, destination, selected, collect) => {
        if (destination.node !== selected.node || destination.kind !== selected.kind ||
            destination.projection.length > selected.projection.length || !destination.projection.every((component, index) => equalProjection(component, selected.projection[index])))
            return;
        const remaining = selected.projection.slice(destination.projection.length);
        if (remaining.length === 0) {
            collect(origin);
            return;
        }
        const fromFile = sourceFileFor(origin);
        const toFile = sourceFileFor(destination);
        const variants = destinations.get(destination.node)?.get(destination.kind)?.components.get(destination)?.get(origin);
        for (const types of variants ?? [undefined]) {
            if (!budget.step())
                return;
            const from = types?.from ?? sourceStorageSubjectType(source, origin, fromFile);
            const to = types?.to ?? sourceStorageSubjectType(source, destination, toFile);
            if (from === undefined || to === undefined || fromFile === undefined)
                continue;
            sourceStorageProjectComponents(origin.projection, from, to, remaining, source, source.ast, budget, projection => {
                const projected = subject(origin.node, origin.kind, projection);
                if (projected !== undefined)
                    collect(projected);
            });
        }
    };
    const incomingFor = selected => {
        const destinationEdges = destinations.get(selected.node)?.get(selected.kind);
        const revision = destinationEdges?.revision ?? 0;
        const cached = selections.get(selected);
        if (cached?.revision === revision)
            return cached.origins;
        cached?.release();
        const retained = budget.createRows();
        if (!retained.add(1))
            return empty;
        const result = new Set();
        let completed = false;
        try {
            for (const [destination, origins] of destinationEdges?.components ?? []) {
                if (!budget.step())
                    break;
                for (const origin of origins.keys()) {
                    if (!budget.step())
                        break;
                    projectOrigin(origin, destination, selected, projected => {
                        if (projected !== selected && !result.has(projected) &&
                            (projected === origin || budget.edge()) && retained.add(1))
                            result.add(projected);
                    });
                }
            }
            selections.set(selected, { revision, origins: result, release: retained.release });
            completed = true;
            return result;
        }
        finally {
            if (!completed)
                retained.release();
        }
    };
    return Object.freeze({ add, incomingFor, projectOrigin });
}
function equalProjection(left, right) {
    return left.kind === right.kind && (left.kind === "array-element" ||
        left.kind === "tuple-element" && right.kind === "tuple-element" && left.index === right.index ||
        sourceStorageIsMemberProjection(left) && sourceStorageIsMemberProjection(right) && left.declaration === right.declaration);
}
//# sourceMappingURL=edges.js.map