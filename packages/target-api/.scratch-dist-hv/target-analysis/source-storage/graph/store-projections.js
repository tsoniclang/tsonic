export function createSourceStorageStoreProjections(budget, subject, storesFor, projectOrigin) {
    const selections = new Map();
    return (selected) => {
        if (!budget.step())
            return undefined;
        const cached = selections.get(selected);
        if (cached !== undefined)
            return cached ?? undefined;
        const rows = budget.createRows();
        const temporary = budget.createRows();
        let published = false;
        try {
            const result = [];
            const seen = new Map();
            let hasStores = false;
            const collect = (store, value) => {
                let values = seen.get(store);
                if (values?.has(value))
                    return;
                if (value !== undefined && value !== store.value && !budget.edge())
                    return;
                if (!temporary.add(values === undefined ? 2 : 1) || !rows.add(2))
                    return;
                values ?? (values = new Set());
                values.add(value);
                seen.set(store, values);
                result.push(Object.freeze({ store, value }));
            };
            for (let length = selected.projection.length; length >= 0; length -= 1) {
                if (!budget.step())
                    return undefined;
                const prefix = subject(selected.node, selected.kind, selected.projection.slice(0, length));
                if (prefix === undefined)
                    return undefined;
                for (const store of storesFor(prefix) ?? []) {
                    if (!budget.step())
                        return undefined;
                    hasStores = true;
                    if (store.destination === "pointer") {
                        collect(store, undefined);
                        continue;
                    }
                    if (store.birth !== undefined && selected !== prefix) {
                        for (const component of store.birth) {
                            if (!budget.step())
                                return undefined;
                            projectOrigin(component.origin, component.destination, selected, value => collect(store, value));
                        }
                    }
                    else if (store.value === undefined)
                        collect(store, undefined);
                    else
                        projectOrigin(store.value, prefix, selected, value => collect(store, value));
                }
            }
            if (budget.failure() !== undefined || !rows.add(1))
                return undefined;
            if (!hasStores) {
                selections.set(selected, null);
                published = true;
                return undefined;
            }
            const selection = Object.freeze(result);
            selections.set(selected, selection);
            published = true;
            return selection;
        }
        finally {
            temporary.release();
            if (!published)
                rows.release();
        }
    };
}
//# sourceMappingURL=store-projections.js.map