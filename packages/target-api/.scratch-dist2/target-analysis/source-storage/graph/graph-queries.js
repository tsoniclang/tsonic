function readonlyValues(values, validate) {
    const checked = (entries) => {
        const iterator = Object.freeze({
            next() { validate(); return entries.next(); },
            [Symbol.iterator]() { validate(); return iterator; },
            [Symbol.dispose]() { validate(); },
        });
        return iterator;
    };
    const view = Object.freeze({
        get size() { validate?.(); return values.size; },
        has: (value) => { validate?.(); return values.has(value); },
        entries: () => { validate?.(); return validate === undefined ? values.entries() : checked(values.entries()); },
        keys: () => { validate?.(); return validate === undefined ? values.keys() : checked(values.keys()); },
        values: () => { validate?.(); return validate === undefined ? values.values() : checked(values.values()); },
        [Symbol.iterator]: () => { validate?.(); return validate === undefined ? values[Symbol.iterator]() : checked(values[Symbol.iterator]()); },
        forEach(callback, receiver) {
            validate?.();
            for (const value of values) {
                validate?.();
                callback.call(receiver, value, value, view);
            }
        },
    });
    return view;
}
export function createSourceStorageGraphQueries(budget) {
    const reads = new Map();
    const readRows = budget.createRows();
    let sealed = false;
    let active;
    const inheritsRead = (entry, dependency) => {
        const only = entry.children.size === 1 ? entry.children.values().next().value : undefined;
        return only !== undefined && (only.reads.has(dependency) || only.inheritedReads?.has(dependency) === true);
    };
    const depend = (parent, child) => {
        if (sealed || parent === undefined || !parent.live || parent.children.has(child) || child.reads.size === 0 && child.children.size === 0)
            return true;
        if (!parent.dependencyRows.add(2))
            return false;
        parent.children.add(child);
        child.parents.add(parent);
        return true;
    };
    const discard = (entry) => {
        entry.live = false;
        entry.remove();
        for (const read of entry.reads)
            read.entries.delete(entry);
        for (const child of entry.children)
            child.parents.delete(entry);
        for (const parent of entry.parents)
            parent.children.delete(entry);
        entry.reads.clear();
        entry.children.clear();
        entry.parents.clear();
        entry.inheritedReads = undefined;
        entry.dependencyRows.release();
        entry.rows.release();
    };
    return Object.freeze({
        seal() {
            if (sealed || budget.failure() !== undefined)
                return;
            if (active !== undefined) {
                budget.reject("Source storage graph queries cannot seal an unfinished selection.");
                return;
            }
            sealed = true;
            budget.withRows(rows => {
                const pending = [];
                for (const kinds of reads.values())
                    for (const dependency of kinds.values()) {
                        for (const entry of dependency.entries) {
                            let selected = entry;
                            while (selected !== undefined || pending.length !== 0) {
                                if (!budget.step())
                                    return;
                                if (selected !== undefined && (selected.reads.size !== 0 || selected.children.size !== 0)) {
                                    for (const read of selected.reads) {
                                        if (!budget.step())
                                            return;
                                        read.entries.delete(selected);
                                    }
                                    for (const child of selected.children) {
                                        if (!budget.step())
                                            return;
                                        child.parents.delete(selected);
                                    }
                                    selected.reads.clear();
                                    selected.children.clear();
                                    selected.inheritedReads = undefined;
                                    selected.dependencyRows.release();
                                    if (selected.parents.size !== 0) {
                                        if (!rows.add(1))
                                            return;
                                        pending.push({ owner: selected, parents: selected.parents.values() });
                                    }
                                }
                                const frame = pending[pending.length - 1];
                                const next = frame?.parents.next();
                                if (frame !== undefined && next?.done === true) {
                                    frame.owner.parents.clear();
                                    pending.pop();
                                }
                                selected = next?.done === false ? next.value : undefined;
                            }
                        }
                    }
            });
            reads.clear();
            readRows.release();
        },
        read(subject) {
            if (active === undefined || !budget.step())
                return;
            if (sealed || !active.live)
                return;
            const kinds = reads.get(subject.node) ?? new Map();
            let dependency = kinds.get(subject.kind);
            if (dependency === undefined) {
                if (!readRows.add(1))
                    return;
                dependency = { entries: new Set() };
                kinds.set(subject.kind, dependency);
                reads.set(subject.node, kinds);
            }
            if (active.reads.has(dependency) || inheritsRead(active, dependency) || !active.dependencyRows.add(2))
                return;
            dependency.entries.add(active);
            active.reads.add(dependency);
        },
        invalidate(subject) {
            if (sealed) {
                budget.reject("Source storage graph queries cannot invalidate sealed inputs.");
                return;
            }
            const pending = [...reads.get(subject.node)?.get(subject.kind)?.entries ?? []];
            while (pending.length !== 0 && budget.step()) {
                const entry = pending.pop();
                if (!entry.live)
                    continue;
                pending.push(...entry.parents);
                discard(entry);
            }
        },
        reconcile(operations) {
            if (sealed || active !== undefined) {
                budget.reject("Source storage graph reconciliation requires an idle mutable graph.");
                return;
            }
            budget.withRows(rows => {
                const reactions = new Set();
                const pending = new Set();
                let closed = false;
                try {
                    for (const operation of operations) {
                        if (!budget.step() || !rows.add(3))
                            return;
                        const reaction = { operation, applied: new Set(), entry: undefined };
                        reactions.add(reaction);
                        pending.add(reaction);
                    }
                    while (pending.size !== 0 && budget.step()) {
                        const reaction = pending.values().next().value;
                        pending.delete(reaction);
                        const retained = budget.createRows();
                        if (!retained.add(1))
                            return;
                        const entry = { live: true, rows: retained, dependencyRows: budget.createRows(),
                            remove: () => { if (!closed && budget.step())
                                pending.add(reaction); },
                            reads: new Set(), parents: new Set(), children: new Set(), inheritedReads: undefined };
                        reaction.entry = entry;
                        active = entry;
                        try {
                            reaction.operation(key => {
                                if (!budget.step() || reaction.applied.has(key) || !rows.add(1))
                                    return false;
                                reaction.applied.add(key);
                                return true;
                            });
                        }
                        finally {
                            active = undefined;
                        }
                    }
                }
                finally {
                    closed = true;
                    for (const reaction of reactions) {
                        budget.step();
                        if (reaction.entry?.live)
                            discard(reaction.entry);
                        reaction.applied.clear();
                    }
                    pending.clear();
                    reactions.clear();
                }
            });
        },
        query(collect) {
            const selections = new Map();
            return key => {
                if (!budget.step())
                    return undefined;
                const parent = active;
                const cached = selections.get(key);
                if (cached !== undefined) {
                    if (cached.values === undefined) {
                        budget.reject("Source storage graph queries cannot recursively select an unfinished result.");
                        return undefined;
                    }
                    return depend(parent, cached.entry) ? cached.values : undefined;
                }
                const rows = budget.createRows();
                if (!rows.add(1))
                    return undefined;
                const entry = { live: true, rows, dependencyRows: budget.createRows(), remove: () => { selections.delete(key); },
                    reads: new Set(), parents: new Set(), children: new Set(), inheritedReads: undefined };
                selections.set(key, { entry });
                let values;
                active = entry;
                try {
                    values = collect(key, rows.add);
                }
                catch (error) {
                    discard(entry);
                    throw error;
                }
                finally {
                    active = parent;
                }
                if (!entry.live)
                    budget.reject("Source storage graph inputs changed during query selection.");
                if (values !== undefined && values.size !== 0)
                    rows.add(values.size);
                if (values === undefined || budget.failure() !== undefined || !depend(parent, entry)) {
                    discard(entry);
                    return undefined;
                }
                if (!sealed && entry.children.size === 1) {
                    const child = entry.children.values().next().value;
                    entry.inheritedReads = child.children.size === 0 ? child.reads : child.inheritedReads;
                }
                selections.set(key, { entry, values });
                return values;
            };
        },
        fixedPoint(collect, family) {
            const selections = new Map();
            let released = false;
            const assertLive = () => {
                if (released)
                    throw new Error("Source storage fixed-point values require their live query owner.");
            };
            const completed = (cell) => typeof cell.complete === "boolean" ? cell.complete : cell.complete.complete === true;
            const settled = (cell) => cell.settled || completed(cell);
            let running = false;
            const query = (key) => {
                assertLive();
                if (!budget.step())
                    return undefined;
                if (!sealed || running) {
                    budget.reject("Source storage fixed-point queries require a sealed graph and cannot expose an unfinished family.");
                    return undefined;
                }
                const cached = selections.get(key);
                if (cached !== undefined && completed(cached))
                    return cached.view;
                return (() => {
                    let wave;
                    const pending = new Set();
                    const frontierRows = budget.createRows();
                    const deltaRows = budget.createRows();
                    const deltas = [];
                    let maximumFrontier = 0;
                    let maximumDeltas = 0;
                    let current;
                    let publication;
                    const schedule = (cell, dirty) => {
                        cell.dirty || (cell.dirty = dirty);
                        if (pending.has(cell))
                            return true;
                        if (pending.size === maximumFrontier) {
                            if (!frontierRows.add(1))
                                return false;
                            maximumFrontier += 1;
                        }
                        pending.add(cell);
                        return true;
                    };
                    const readyToSettle = (cell) => cell.evaluated && cell.pendingInputs === 0 && cell.pendingDeltas === 0 && !cell.dirty && !cell.settled &&
                        (cell.parents.size !== 0 || cell.forwardParents.size !== 0);
                    const scheduleSettlement = (cell) => !readyToSettle(cell) || schedule(cell, false);
                    const publish = (cell, value) => {
                        if (!budget.step())
                            return false;
                        if (cell.values.has(value))
                            return true;
                        if (!cell.rows.add(1))
                            return false;
                        cell.values.add(value);
                        for (const parent of cell.parents)
                            if (!budget.step() || !schedule(parent, true))
                                return false;
                        if (cell.forwardParents.size !== 0) {
                            if (deltas.length === maximumDeltas) {
                                if (!deltaRows.add(1))
                                    return false;
                                maximumDeltas += 1;
                            }
                            cell.pendingDeltas += 1;
                            deltas.push({ cell, value });
                        }
                        return true;
                    };
                    const project = (parent, value, projection, emit) => {
                        if (projection === undefined)
                            return emit(value);
                        if (!budget.step())
                            return false;
                        const selected = projection(value);
                        if (selected === undefined) {
                            budget.reject("Source storage fixed-point projections require an exact positive result.");
                            return false;
                        }
                        for (const result of selected) {
                            if (result.kind === "value" ? !emit(result.value) : !forward(parent, result.key, undefined, emit))
                                return false;
                        }
                        return budget.failure() === undefined;
                    };
                    const admit = (input) => {
                        if (!budget.step())
                            return undefined;
                        const selected = selections.get(input);
                        if (selected !== undefined)
                            return selected;
                        const rows = budget.createRows();
                        if (!rows.add(2)) {
                            rows.release();
                            return undefined;
                        }
                        const values = new Set();
                        const cell = { key: input, values, view: readonlyValues(values, assertLive), rows,
                            dependencyRows: budget.createRows(), parents: new Set(), forwardParents: new Map(), forwards: new Map(),
                            pendingInputs: 0, pendingDeltas: 0, evaluated: false, dirty: false, settled: false,
                            complete: publication ?? false, previousInWave: wave };
                        if (!schedule(cell, true)) {
                            rows.release();
                            return undefined;
                        }
                        selections.set(input, cell);
                        publication ?? (publication = cell);
                        wave = cell;
                        return cell;
                    };
                    const retire = (cell) => {
                        for (const [input, transfer] of cell.forwards) {
                            if (input.forwardParents.delete(cell))
                                cell.pendingInputs -= 1;
                            transfer.rows.release();
                        }
                        cell.forwards.clear();
                    };
                    const forward = (parent, input, projection, emit) => {
                        const selected = admit(input);
                        if (selected === undefined)
                            return false;
                        let transfer = parent.forwards.get(selected);
                        if (transfer?.projections.has(projection))
                            return true;
                        if (transfer === undefined) {
                            const rows = budget.createRows();
                            if (!rows.add(settled(selected) ? 1 : 2)) {
                                rows.release();
                                return false;
                            }
                            transfer = { projections: new Set(), rows };
                            parent.forwards.set(selected, transfer);
                            if (!settled(selected)) {
                                selected.forwardParents.set(parent, transfer);
                                parent.pendingInputs += 1;
                                if (!scheduleSettlement(selected))
                                    return false;
                            }
                        }
                        if (!transfer.rows.add(1))
                            return false;
                        transfer.projections.add(projection);
                        for (const value of selected.values)
                            if (!project(parent, value, projection, emit))
                                return false;
                        return budget.failure() === undefined;
                    };
                    const evaluate = (cell) => budget.withRows(resultRows => {
                        current = cell;
                        cell.evaluated = false;
                        retire(cell);
                        let reading = true;
                        let retainedValues = 0;
                        const values = new Set();
                        const borrowed = new Map();
                        const borrowRows = budget.createRows();
                        const validate = () => {
                            if (reading && current === cell && budget.failure() === undefined)
                                return;
                            const reason = "Source storage fixed-point values require their active collector.";
                            budget.reject(reason);
                            throw new Error(reason);
                        };
                        const add = (value) => {
                            if (!budget.step())
                                return false;
                            if (!reading || current !== cell) {
                                budget.reject("Source storage fixed-point writes require their active collector.");
                                return false;
                            }
                            if (values.has(value))
                                return true;
                            if (!resultRows.add(1))
                                return false;
                            if (cell.values.has(value))
                                retainedValues += 1;
                            values.add(value);
                            return true;
                        };
                        let collected;
                        try {
                            collected = collect(cell.key, input => {
                                if (!budget.step())
                                    return undefined;
                                if (!reading || current !== cell) {
                                    budget.reject("Source storage fixed-point reads require their active collector.");
                                    return undefined;
                                }
                                const selected = admit(input);
                                if (selected === undefined)
                                    return undefined;
                                if (completed(selected))
                                    return selected.view;
                                if (!selected.settled && !selected.parents.has(cell)) {
                                    if (!selected.dependencyRows.add(1))
                                        return undefined;
                                    selected.parents.add(cell);
                                    cell.pendingInputs += 1;
                                    if (!scheduleSettlement(selected))
                                        return undefined;
                                }
                                const existing = borrowed.get(selected);
                                if (existing !== undefined)
                                    return existing;
                                if (!borrowRows.add(2))
                                    return undefined;
                                const view = readonlyValues(selected.values, validate);
                                borrowed.set(selected, view);
                                return view;
                            }, add, (input, projection) => {
                                if (!budget.step())
                                    return false;
                                if (!reading || current !== cell) {
                                    budget.reject("Source storage fixed-point forwards require their active collector.");
                                    return false;
                                }
                                return forward(cell, input, projection, add);
                            });
                        }
                        finally {
                            reading = false;
                            current = undefined;
                            borrowed.clear();
                            borrowRows.release();
                        }
                        if (!collected || budget.failure() !== undefined) {
                            budget.reject(`Source storage fixed-point collectors require an exact positive result (${family}).`);
                            return false;
                        }
                        if (retainedValues !== cell.values.size) {
                            budget.reject("Source storage fixed-point collectors cannot retract a proved result.");
                            return false;
                        }
                        for (const value of values) {
                            if (!publish(cell, value))
                                return false;
                        }
                        cell.evaluated = budget.failure() === undefined;
                        return budget.failure() === undefined;
                    });
                    const retireForward = (cell, parent, transfer) => {
                        parent.forwards.delete(cell);
                        transfer.rows.release();
                        parent.pendingInputs -= 1;
                        return scheduleSettlement(parent);
                    };
                    const settle = (cell) => {
                        if (!budget.step())
                            return false;
                        cell.settled = true;
                        retire(cell);
                        const released = (parent) => {
                            parent.pendingInputs -= 1;
                            return scheduleSettlement(parent);
                        };
                        for (const parent of cell.parents)
                            if (!budget.step() || !released(parent))
                                return false;
                        cell.parents.clear();
                        cell.dependencyRows.release();
                        for (const [parent, transfer] of cell.forwardParents) {
                            if (!budget.step() || !retireForward(cell, parent, transfer))
                                return false;
                        }
                        cell.forwardParents.clear();
                        return true;
                    };
                    running = true;
                    try {
                        const root = admit(key);
                        if (root === undefined)
                            return undefined;
                        while (pending.size !== 0 || deltas.length !== 0) {
                            if (!budget.step())
                                return undefined;
                            if (deltas.length !== 0) {
                                const delta = deltas.pop();
                                delta.cell.pendingDeltas -= 1;
                                const finalDelta = readyToSettle(delta.cell);
                                for (const [parent, transfer] of delta.cell.forwardParents) {
                                    if (parent.dirty && pending.has(parent)) {
                                        if (!budget.step())
                                            return undefined;
                                    }
                                    else
                                        for (const projection of transfer.projections)
                                            if (!project(parent, delta.value, projection, value => publish(parent, value)))
                                                return undefined;
                                    if (finalDelta && !retireForward(delta.cell, parent, transfer))
                                        return undefined;
                                }
                                if (finalDelta) {
                                    delta.cell.forwardParents.clear();
                                    if (!settle(delta.cell))
                                        return undefined;
                                }
                                continue;
                            }
                            const cell = pending.values().next().value;
                            pending.delete(cell);
                            if (cell.dirty) {
                                cell.dirty = false;
                                if (!evaluate(cell))
                                    return undefined;
                            }
                            if (readyToSettle(cell) && !settle(cell))
                                return undefined;
                        }
                        if (budget.failure() !== undefined)
                            return undefined;
                        root.complete = true;
                        return root.view;
                    }
                    finally {
                        running = false;
                        current = undefined;
                        pending.clear();
                        deltas.length = 0;
                        while (wave !== undefined) {
                            const cell = wave;
                            wave = cell.previousInWave;
                            cell.previousInWave = undefined;
                            cell.parents.clear();
                            retire(cell);
                            cell.forwardParents.clear();
                            cell.dependencyRows.release();
                            cell.pendingInputs = 0;
                            cell.pendingDeltas = 0;
                            cell.dirty = false;
                            if (publication?.complete !== true) {
                                selections.delete(cell.key);
                                cell.values.clear();
                                cell.rows.release();
                            }
                        }
                        frontierRows.release();
                        deltaRows.release();
                    }
                })();
            };
            return Object.assign(query, {
                release() {
                    if (running)
                        throw new Error("Source storage fixed-point queries release only after their active wave drains.");
                    if (released)
                        return;
                    released = true;
                    for (const cell of selections.values()) {
                        for (const transfer of cell.forwards.values())
                            transfer.rows.release();
                        cell.forwards.clear();
                        cell.forwardParents.clear();
                        cell.parents.clear();
                        cell.values.clear();
                        cell.rows.release();
                        cell.dependencyRows.release();
                    }
                    selections.clear();
                },
            });
        },
    });
}
//# sourceMappingURL=graph-queries.js.map