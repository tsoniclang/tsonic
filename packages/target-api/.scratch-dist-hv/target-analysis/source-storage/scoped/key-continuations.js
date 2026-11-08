export function completeSourceStorageKeyEncoding(budget, initial) {
    const pending = [];
    let current = initial;
    let value;
    try {
        while (true) {
            const next = current.next(value);
            if (next.done) {
                const parent = pending.pop();
                if (parent === undefined)
                    return next.value;
                parent.rows.release();
                current = parent.continuation;
                value = next.value;
            }
            else {
                const rows = budget.createRows();
                if (!rows.add(1)) {
                    rows.release();
                    return undefined;
                }
                pending.push({ continuation: current, rows });
                current = next.value;
                value = undefined;
            }
        }
    }
    finally {
        try {
            current.return(undefined);
        }
        finally {
            while (pending.length !== 0) {
                const parent = pending.pop();
                try {
                    parent.continuation.return(undefined);
                }
                finally {
                    parent.rows.release();
                }
            }
        }
    }
}
//# sourceMappingURL=key-continuations.js.map