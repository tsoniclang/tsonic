export function sourceTypeFlowLinkAdjacency(links) {
    const adjacency = new Map();
    for (const { source, target } of links) {
        for (const [from, to] of [[source, target], [target, source]]) {
            let adjacent = adjacency.get(from);
            if (adjacent === undefined)
                adjacency.set(from, adjacent = []);
            adjacent.push(to);
        }
    }
    return adjacency;
}
export function sourceTypeFlowReachableVariables(seeds, adjacency) {
    const reached = new Set();
    const pending = [...seeds];
    while (pending.length > 0) {
        const variable = pending.pop();
        if (reached.has(variable))
            continue;
        reached.add(variable);
        pending.push(...adjacency.get(variable) ?? []);
    }
    return reached;
}
//# sourceMappingURL=links.js.map