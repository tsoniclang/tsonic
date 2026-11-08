export function createSourceStorageKeyEncoder(budget) {
    const signatures = new Map();
    let running = false;
    const intern = (value) => {
        if (!budget.step())
            return undefined;
        if (running) {
            budget.reject("Source storage keys cannot expose a reentrant unfinished encoding.");
            return undefined;
        }
        const retained = budget.createRows();
        const entries = new Map();
        let complete = false;
        running = true;
        try {
            return budget.withRows(rows => {
                const additions = new Map();
                const select = (signature, reference) => {
                    const known = signatures.get(signature) ?? additions.get(signature);
                    if (known !== undefined)
                        return known;
                    if (!retained.add(1 + Math.floor(signature.length * 6 / 1024)))
                        return undefined;
                    const identity = signatures.size + additions.size;
                    const result = Object.freeze({ kind: "key", identity, signature, reference: reference ?? identity });
                    additions.set(signature, result);
                    return result;
                };
                const atom = (input) => {
                    if (input !== null && typeof input === "object") {
                        if (!Array.isArray(input) && input.kind === "key") {
                            const key = input;
                            if (signatures.get(key.signature) !== key) {
                                budget.reject("Source storage keys belong to a different exact query owner.");
                                return undefined;
                            }
                            return key.reference;
                        }
                        return undefined;
                    }
                    if (typeof input === "number" && !Number.isFinite(input)) {
                        budget.reject("Source storage key numbers must be finite.");
                        return undefined;
                    }
                    if (typeof input === "string" && input.length >= 128 && !rows.add(Math.ceil(input.length * 6 / 1024)))
                        return undefined;
                    return JSON.stringify([typeof input, input]);
                };
                const enter = (input, parent) => {
                    const children = Array.isArray(input) ? input : input.values;
                    const length = children.length;
                    for (let index = parent === undefined ? 32 : 0; index < Math.max(1, length); index += 32)
                        if (!budget.step())
                            return undefined;
                    const childRows = budget.createRows();
                    if (!rows.add(2) || length !== 0 && !childRows.add(length)) {
                        childRows.release();
                        return undefined;
                    }
                    const entry = { children, length, parent, unordered: !Array.isArray(input), next: 0, references: [], rows: childRows, result: undefined };
                    entries.set(input, entry);
                    return entry;
                };
                const atomic = atom(value);
                if (budget.failure() !== undefined)
                    return undefined;
                let result;
                if (atomic !== undefined) {
                    result = typeof value === "object" && value !== null ? value
                        : typeof atomic === "string" ? select(JSON.stringify(["atom", atomic]), atomic) : undefined;
                }
                else {
                    const root = enter(value);
                    if (root === undefined)
                        return undefined;
                    let current = root;
                    while (current !== undefined) {
                        if (current.next === current.length) {
                            if (current.length !== 0 && !budget.step())
                                return undefined;
                            const references = current.unordered ? [...new Set(current.references)].sort((left, right) => typeof left === "number" && typeof right === "number" ? left - right : typeof left === "number" ? -1
                                : typeof right === "number" ? 1 : left < right ? -1 : left > right ? 1 : 0) : current.references;
                            const signature = JSON.stringify([current.unordered ? "set" : "sequence", references]);
                            current.references.length = 0;
                            current.rows.release();
                            current.result = select(signature);
                            if (current.result === undefined)
                                return undefined;
                            current = current.parent;
                            continue;
                        }
                        const child = current.children[current.next];
                        let selected = atom(child);
                        if (budget.failure() !== undefined)
                            return undefined;
                        if (selected === undefined) {
                            const known = entries.get(child);
                            if (known === undefined) {
                                current = enter(child, current);
                                if (current === undefined)
                                    return undefined;
                                continue;
                            }
                            if (known.result === undefined) {
                                budget.reject("Source storage keys require an acyclic exact value.");
                                return undefined;
                            }
                            selected = known.result.reference;
                        }
                        current.references.push(selected);
                        current.next += 1;
                    }
                    result = root.result;
                }
                if (result === undefined || budget.failure() !== undefined)
                    return undefined;
                for (const [signature, key] of additions) {
                    signatures.set(signature, key);
                }
                complete = true;
                return result;
            });
        }
        finally {
            running = false;
            for (const entry of entries.values())
                entry.rows.release();
            if (!complete)
                retained.release();
        }
    };
    return Object.freeze({ intern, encode(value) {
            const selected = intern(value);
            return selected === undefined ? undefined : String(selected.identity);
        } });
}
//# sourceMappingURL=key-encoding.js.map