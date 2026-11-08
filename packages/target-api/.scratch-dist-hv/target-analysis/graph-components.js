import { createTargetGraphComponentQuery } from "./graph-component-query.js";
import { failTargetCompilerResourceLimit } from "../artifacts.js";
export function targetStronglyConnectedComponents(vertices, neighbours, maximumSteps = 4194304) {
    if (typeof maximumSteps !== "function" && (!Number.isSafeInteger(maximumSteps) || maximumSteps <= 0)) {
        return Object.freeze({ kind: "unresolved", reason: "Graph component analysis requires a positive finite work budget." });
    }
    let steps = 0;
    const account = typeof maximumSteps === "function" ? maximumSteps : () => {
        if (++steps > maximumSteps)
            failTargetCompilerResourceLimit("tsonic", "Declared graph component analysis", "steps", maximumSteps);
        return true;
    };
    const components = [];
    const select = createTargetGraphComponentQuery(vertex => {
        const selected = new Set();
        for (const target of neighbours(vertex)) {
            if (!account())
                return undefined;
            if (vertices.has(target))
                selected.add(target);
        }
        return { data: undefined, neighbours: selected };
    }, members => {
        const component = Object.freeze(members.map(member => member.vertex));
        components.push(component);
        return component;
    }, {
        step: account,
        createRows: () => ({
            add(cost) {
                for (let index = 0; index < cost; index += 1)
                    if (!account())
                        return false;
                return true;
            },
            release() { },
        }),
    });
    for (const vertex of vertices) {
        if (select(vertex) === undefined) {
            return Object.freeze({ kind: "unresolved", reason: "Graph component analysis exceeds its finite work budget." });
        }
    }
    return Object.freeze({ kind: "resolved", components: Object.freeze(components) });
}
//# sourceMappingURL=graph-components.js.map