import { sourceLexicalEnvironment } from "../../source-navigation/lexical-environments.js";
import { forEachSourceImmediateEvaluationChild } from "../../source-navigation/immediate-evaluation.js";
import { SourceFlowFailure } from "./resources.js";
export function createSourceFlowCaptureQuery(source, step, domain) {
    const completed = new WeakMap();
    const includes = (node) => domain === "source" || domain.has(node);
    return (node) => {
        if (!includes(node))
            return Object.freeze([]);
        step(node);
        const existing = completed.get(node);
        if (existing !== undefined)
            return existing;
        const selected = sourceLexicalEnvironment(node, [node], source.ast, source.navigation, domain, () => true, step);
        if (selected.kind === "unresolved")
            throw new SourceFlowFailure(selected.reason, node);
        const eager = new Set();
        forEachSourceImmediateEvaluationChild(source.ast, node, child => { step(child); eager.add(child); });
        const roots = new Set(selected.callableRoots);
        const captures = Object.freeze(selected.captures.flatMap(capture => {
            const references = Object.freeze(capture.references.filter(reference => {
                for (let current = reference; current !== undefined; current = source.ast.parent(current)) {
                    step(current);
                    if (eager.has(current))
                        return false;
                    if (roots.has(current))
                        return true;
                }
                return false;
            }));
            return references.length === 0 ? [] : [Object.freeze({ declaration: capture.declaration, references })];
        }));
        completed.set(node, captures);
        return captures;
    };
}
//# sourceMappingURL=captures.js.map