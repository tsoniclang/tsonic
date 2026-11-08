import { createSourceStorageGraphQueries } from "../graph/graph-queries.js";
export function createSourceStorageDomainInputs(transport, witnesses, budget) {
    const queries = createSourceStorageGraphQueries(budget);
    const channels = new Map();
    const rows = budget.createRows();
    let presence;
    let sealed = false;
    const input = (subject, owner) => {
        const root = owner === undefined || owner.projection.length === 0 ? owner : transport.subject(owner.node, owner.kind);
        if (owner !== undefined && root === undefined)
            return undefined;
        const owners = channels.get(subject.kind);
        const existing = owners?.get(root);
        if (existing !== undefined)
            return { node: subject.node, kind: existing };
        if (!rows.add(owners === undefined ? 3 : 1))
            return undefined;
        const selected = owners ?? new Map();
        const channel = Symbol();
        selected.set(root, channel);
        channels.set(subject.kind, selected);
        return { node: subject.node, kind: channel };
    };
    const owners = function* (subject) {
        yield* witnesses.inputOwners(subject);
        for (let length = 0; length < subject.projection.length; length += 1) {
            if (!budget.step())
                return;
            const parent = transport.subject(subject.node, subject.kind, subject.projection.slice(0, length));
            if (parent !== undefined)
                yield* witnesses.inputOwners(parent);
        }
    };
    return Object.freeze({
        query: queries.query,
        owners,
        hasInputs: witnesses.hasInputs,
        readPresence(subject) {
            const hasInputs = witnesses.hasInputs();
            if (!sealed && !hasInputs) {
                if (presence === undefined) {
                    if (!rows.add(2))
                        return false;
                    presence = Object.freeze({ node: subject.node, kind: Symbol("source-storage-input-presence") });
                }
                queries.read(presence);
            }
            return hasInputs;
        },
        has(subject) {
            return owners(subject)[Symbol.iterator]().next().done !== true;
        },
        read(subject, owner) {
            if (sealed)
                return;
            const selected = input(subject, owner);
            if (selected !== undefined)
                queries.read(selected);
        },
        add(subject, kind, exposure, owner, creationBindings) {
            if (sealed) {
                budget.reject("Source storage domain inputs require a live construction owner.");
                return;
            }
            if (subject === undefined)
                return;
            const previous = witnesses.inputOwners(subject);
            const known = previous.has(owner);
            const present = previous.size !== 0;
            const hadInputs = witnesses.hasInputs();
            witnesses.add(subject, kind, exposure, owner, creationBindings);
            if (kind !== "external-input" || known || !witnesses.inputOwners(subject).has(owner))
                return;
            if (!hadInputs && presence !== undefined)
                queries.invalidate(presence);
            if (owner !== undefined) {
                const selected = input(subject, owner);
                if (selected !== undefined)
                    queries.invalidate(selected);
            }
            if (!present) {
                const selected = input(subject);
                if (selected !== undefined)
                    queries.invalidate(selected);
            }
        },
        seal() {
            queries.seal();
            sealed = true;
            channels.clear();
            presence = undefined;
            rows.release();
        },
    });
}
//# sourceMappingURL=domain-inputs.js.map