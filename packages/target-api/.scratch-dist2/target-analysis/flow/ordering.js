import { createTargetGraphComponentQuery } from "../graph-component-query.js";
import { SourceFlowFailure } from "./resources.js";
export function sourceFlowOrder(graph, direction, step) {
    const reachable = new Set();
    const visit = (roots, reverse, admitted) => {
        const visited = new Set();
        const postorder = [];
        const edges = (point) => reverse ? graph.points[point].predecessors : graph.points[point].successors;
        for (const root of roots) {
            step();
            if (visited.has(root) || admitted !== undefined && !admitted.has(root))
                continue;
            if (graph.points[root]?.id !== root)
                throw new SourceFlowFailure("Source flow ordering requires valid graph point identities.", undefined);
            visited.add(root);
            const stack = [{ id: root, index: 0 }];
            while (stack.length > 0) {
                step();
                const current = stack[stack.length - 1];
                const edge = edges(current.id)[current.index++];
                if (edge === undefined) {
                    postorder.push(current.id);
                    stack.pop();
                    continue;
                }
                const target = reverse ? edge.from : edge.to;
                if (graph.points[target]?.id !== target || (reverse ? edge.to : edge.from) !== current.id) {
                    throw new SourceFlowFailure("Source flow ordering requires owned graph edges.", graph.points[current.id]?.source);
                }
                if (visited.has(target) || admitted !== undefined && !admitted.has(target))
                    continue;
                visited.add(target);
                stack.push({ id: target, index: 0 });
            }
        }
        return postorder.reverse();
    };
    const forward = visit([graph.entry], false);
    for (const id of forward)
        reachable.add(id);
    const reversePostorder = direction === "forward" ? forward
        : visit([graph.exit, graph.exceptionExit, ...forward], true, reachable);
    const rank = new Map(reversePostorder.map((id, index) => [id, index]));
    const components = [];
    const select = createTargetGraphComponentQuery(id => {
        const neighbours = new Set();
        for (const edge of graph.points[id].successors) {
            step();
            if (reachable.has(edge.to))
                neighbours.add(edge.to);
        }
        return { data: undefined, neighbours };
    }, members => {
        const index = components.length;
        components.push(members.map(member => member.vertex).sort((left, right) => rank.get(left) - rank.get(right)));
        return index;
    }, {
        step: () => { step(); return true; },
        createRows: () => ({ add: cost => { for (let index = 0; index < cost; index += 1)
                step(); return true; }, release: () => { } }),
    });
    for (const id of forward) {
        if (select(id) === undefined)
            throw new SourceFlowFailure("Source flow component ordering did not resolve.", graph.points[id]?.source);
    }
    if (direction === "forward")
        components.reverse();
    return { reachable, order: components.flat() };
}
//# sourceMappingURL=ordering.js.map