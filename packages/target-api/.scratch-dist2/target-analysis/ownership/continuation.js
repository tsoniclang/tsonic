export function createSourceContinuationTransfer(budget) {
    const rows = budget.createRows();
    const empty = new Set();
    const lattice = Object.freeze({
        empty: () => empty,
        join(left, right) {
            if (!budget.step())
                return undefined;
            if (left === right || right.size === 0)
                return left;
            if (left.size === 0)
                return right;
            let result;
            for (const witness of right) {
                if (!budget.step())
                    return undefined;
                if (left.has(witness))
                    continue;
                if (result === undefined) {
                    if (!rows.add(1 + left.size))
                        return undefined;
                    result = new Set(left);
                }
                if (!rows.add(1))
                    return undefined;
                result.add(witness);
            }
            return result ?? left;
        },
        equals(left, right) {
            if (left === right)
                return true;
            if (left.size !== right.size)
                return false;
            for (const witness of left) {
                if (!budget.step() || !right.has(witness))
                    return false;
            }
            return true;
        },
    });
    return Object.freeze({
        lattice,
        suspend(state, witness) {
            if (!budget.step())
                return undefined;
            if (state.has(witness))
                return state;
            if (!rows.add(1 + state.size + 1))
                return undefined;
            const selected = new Set(state);
            selected.add(witness);
            return selected;
        },
        read(state, reference, visit) {
            for (const pending of state) {
                if (!budget.step() || !visit(pending, reference))
                    return false;
            }
            return budget.failure() === undefined;
        },
        release() { rows.release(); },
    });
}
//# sourceMappingURL=continuation.js.map