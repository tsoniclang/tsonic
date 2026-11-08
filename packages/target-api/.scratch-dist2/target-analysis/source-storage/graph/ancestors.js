export function createSourceStorageAncestorQuery(budget, incoming) {
    return function* (selected, accepts) {
        const rows = budget.createRows();
        const visited = new Set();
        const pending = [];
        const admit = (subject) => {
            if (visited.has(subject))
                return true;
            if (!rows.add(2))
                return false;
            visited.add(subject);
            pending.push(subject);
            return true;
        };
        try {
            if (!admit(selected))
                return;
            for (let index = 0; index < pending.length; index += 1) {
                if (!budget.step())
                    return;
                const current = pending[index];
                const origins = incoming(current);
                if (accepts === undefined || accepts(current, origins))
                    yield current;
                for (const origin of origins) {
                    if (!budget.step() || !admit(origin))
                        return;
                }
            }
        }
        finally {
            visited.clear();
            pending.length = 0;
            rows.release();
        }
    };
}
//# sourceMappingURL=ancestors.js.map