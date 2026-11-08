import { sourceStorageMemberSubject } from "./subjects.js";
import { sourcePresentStorageArms, sourceStorageComponents, sourceStorageComponentType, sourceStorageOriginalComponents, sourceStorageSubjectType, sourceStorageTypesEqual } from "./components.js";
// Structural flow over Host descriptors: a value edge `from` → `to` also connects the components (elements, members)
// of the two Host types. Member pairs come from the Host member correspondence (facts.objects, joined by name).
export function createSourceStorageStructuralFlow(source, step, subject, connect, sourceFileFor, retainCheckedContext) {
    const visited = new Map();
    const pending = [];
    let draining = false;
    return (origin, destination, types) => {
        const fromFile = sourceFileFor(origin);
        const toFile = sourceFileFor(destination);
        const from = types === undefined ? sourceStorageSubjectType(source, origin, fromFile) : types.from;
        const to = types === undefined ? sourceStorageSubjectType(source, destination, toFile) : types.to;
        if (from === undefined || to === undefined || fromFile === undefined)
            return;
        pending.push({ from, to, sourceFile: fromFile });
        if (draining)
            return;
        draining = true;
        while (pending.length !== 0 && step()) {
            const selected = pending.pop();
            const { from, to, sourceFile } = selected;
            if (sourceStorageTypesEqual(from, to))
                continue;
            const targets = visited.get(from) ?? new Set();
            if (targets.has(to))
                continue;
            targets.add(to);
            visited.set(from, targets);
            if (sourcePresentStorageArms(from).length === 0 || sourcePresentStorageArms(to).length === 0)
                continue;
            for (const component of sourceStorageComponents(to)) {
                if (!step())
                    break;
                const toComponent = sourceStorageComponentType(source, to, component);
                if (toComponent === undefined)
                    continue;
                const components = sourceStorageOriginalComponents(source, from, to, component);
                for (const originalComponent of components) {
                    if (!step())
                        break;
                    const fromComponent = sourceStorageComponentType(source, from, originalComponent);
                    if (fromComponent === undefined)
                        continue;
                    pending.push({ from: fromComponent, to: toComponent, sourceFile });
                }
            }
            const relation = source.facts.objects.correspondence(from, to, "read");
            if (relation.kind !== "available")
                continue;
            for (const member of relation.members) {
                if (!step())
                    break;
                if (member.kind !== "present" || member.destination.read === "accessor")
                    continue;
                const originals = member.source.read === "accessor" ? member.source.getters : member.source.declarations;
                for (const original of originals) {
                    if (!step() || !retainCheckedContext(original, sourceFile))
                        break;
                    const origin = sourceStorageMemberSubject(original, source.ast, subject);
                    for (const target of member.destination.declarations) {
                        if (!step() || !retainCheckedContext(target, sourceFile))
                            break;
                        const destination = sourceStorageMemberSubject(target, source.ast, subject);
                        const types = member.source.type === undefined || member.destination.type === undefined ? undefined
                            : { from: member.source.type, to: member.destination.type };
                        connect(origin, destination, types);
                        if (origin !== undefined && destination !== undefined && types !== undefined)
                            pending.push({ ...types, sourceFile });
                    }
                }
            }
        }
        draining = false;
    };
}
//# sourceMappingURL=structural-flow.js.map