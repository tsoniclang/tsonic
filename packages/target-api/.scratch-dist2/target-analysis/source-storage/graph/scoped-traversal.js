export function createSourceStorageScopedTraversal(budget) {
    return function* (scope, direction = "lexical") {
        const rows = budget.createRows();
        const frontier = budget.createRows();
        let maximumFrontier = 0;
        const paths = new Map();
        const pending = [];
        const visited = new Map();
        const schedule = (scope, path) => {
            if (!budget.step())
                return false;
            const retained = visited.get(path);
            if (retained?.has(scope))
                return true;
            if (!rows.add(retained === undefined ? 2 : 1))
                return false;
            if (pending.length === maximumFrontier) {
                if (!frontier.add(1))
                    return false;
                maximumFrontier += 1;
            }
            const selected = retained ?? new Set();
            selected.add(scope);
            visited.set(path, selected);
            pending.push({ scope, path });
            return true;
        };
        try {
            if (!schedule(scope, undefined))
                return;
            while (pending.length !== 0) {
                if (!budget.step())
                    return;
                const current = pending.pop();
                let replacementPath = current.path;
                while (replacementPath !== undefined) {
                    if (!budget.step())
                        return;
                    if (replacementPath.replacements.has(current.scope))
                        break;
                    replacementPath = replacementPath.parent;
                }
                if (replacementPath !== undefined) {
                    if (!schedule(replacementPath.replacements.get(current.scope), replacementPath.parent))
                        return;
                    continue;
                }
                if (current.scope.kind === "substitution") {
                    const selections = paths.get(current.scope.substitutions);
                    let path = selections?.get(current.path);
                    if (path === undefined) {
                        if (!rows.add(selections === undefined ? 3 : 2))
                            return;
                        path = Object.freeze({ replacements: current.scope.substitutions, parent: current.path });
                        const selected = selections ?? new Map();
                        selected.set(current.path, path);
                        paths.set(current.scope.substitutions, selected);
                    }
                    if (!schedule(current.scope.scope, path))
                        return;
                    continue;
                }
                yield { scope: current.scope, path: current.path };
                if (current.scope.kind === "variable") {
                    if (current.scope.capture === undefined && !schedule(current.scope.equation.initial, current.path))
                        return;
                }
                else if (direction === "caller") {
                    if (current.scope.caller !== undefined && !schedule(current.scope.caller, current.path))
                        return;
                }
                else
                    for (let index = current.scope.parents.length - 1; index >= 0; index -= 1) {
                        if (!schedule(current.scope.parents[index], current.path))
                            return;
                    }
            }
        }
        finally {
            pending.length = 0;
            paths.clear();
            visited.clear();
            frontier.release();
            rows.release();
        }
    };
}
//# sourceMappingURL=scoped-traversal.js.map