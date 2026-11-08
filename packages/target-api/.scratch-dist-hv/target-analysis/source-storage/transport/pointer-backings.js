import { sourceStoragePointerOperation } from "../model/host-reads.js";
export function createSourceStoragePointerBackings(source, budget, queries) {
    const backingsFor = (expression) => budget.withRows(rows => {
        const selected = queries.subjectFor(expression);
        if (selected === undefined)
            return undefined;
        const pending = [selected];
        const visited = new Set();
        const result = new Set();
        while (pending.length !== 0) {
            if (!budget.step())
                return undefined;
            const current = pending.pop();
            if (visited.has(current))
                continue;
            if (!rows.add(1))
                return undefined;
            visited.add(current);
            const origins = queries.originsFor(current);
            if (origins === undefined)
                return undefined;
            for (const origin of origins) {
                if (!budget.step())
                    return undefined;
                if (origin.kind !== "value" || origin.projection.length !== 0)
                    continue;
                const operation = sourceStoragePointerOperation(source, origin.node);
                if (operation?.operation === "address-of") {
                    const location = queries.locationFor(operation.storageExpression);
                    if (location !== undefined && !result.has(location) && rows.add(1))
                        result.add(location);
                }
                else if (operation?.operation === "project-pointer") {
                    const next = queries.subjectFor(operation.pointerExpression);
                    if (next !== undefined && rows.add(1))
                        pending.push(next);
                }
            }
        }
        return budget.failure() === undefined ? result : undefined;
    });
    const accessorsFor = (invocation) => budget.withRows(rows => {
        const operation = sourceStoragePointerOperation(source, invocation);
        const result = new Set();
        if (operation?.operation !== "load" && operation?.operation !== "store")
            return result;
        const pointer = queries.subjectFor(operation.pointerExpression);
        if (pointer === undefined)
            return undefined;
        const pending = [pointer];
        const visited = new Set();
        const accessor = (expression) => {
            const subject = queries.subjectFor(expression);
            const values = subject === undefined ? undefined : queries.originsFor(subject);
            if (values === undefined)
                return false;
            for (const value of values) {
                if (!budget.step())
                    return false;
                const selected = source.navigation.callableImplementation(value.node);
                if (value.kind !== "value" || value.projection.length !== 0 || selected.kind !== "resolved" ||
                    source.ast.body(selected.implementation.declaration) === undefined)
                    continue;
                const owner = selected.implementation.declaration;
                if (!result.has(owner) && rows.add(1))
                    result.add(owner);
            }
            return budget.failure() === undefined;
        };
        while (pending.length !== 0) {
            if (!budget.step())
                return undefined;
            const subject = pending.pop();
            if (visited.has(subject))
                continue;
            if (!rows.add(1))
                return undefined;
            visited.add(subject);
            const values = queries.originsFor(subject);
            if (values === undefined)
                return undefined;
            for (const value of values) {
                if (!budget.step())
                    return undefined;
                if (value.kind !== "value" || value.projection.length !== 0)
                    continue;
                const selected = sourceStoragePointerOperation(source, value.node);
                if (selected?.operation === "bind-pointer") {
                    if (!accessor(operation.operation === "load" ? selected.readExpression : selected.writeExpression))
                        return undefined;
                }
                else if (selected?.operation === "project-pointer") {
                    if (!accessor(operation.operation === "load" ? selected.fromSourceExpression : selected.toSourceExpression))
                        return undefined;
                    const pointer = queries.subjectFor(selected.pointerExpression);
                    if (pointer !== undefined && rows.add(1))
                        pending.push(pointer);
                }
            }
        }
        return result;
    });
    return Object.freeze({ backingsFor, accessorsFor });
}
//# sourceMappingURL=pointer-backings.js.map