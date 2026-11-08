import { sourceLexicalCaptures } from "./lexical-captures.js";
import { failTargetCompilerResourceLimit } from "../artifacts.js";
export function sourceLexicalFunctionValueOrder(declarations, ast, navigation, domain, isRuntimeUse = () => true) {
    if (domain !== "source" && (domain === null || typeof domain !== "object" || typeof domain.has !== "function")) {
        throw new Error("Lexical value ordering requires an explicit source-node domain.");
    }
    if (domain !== "source" && declarations.some(declaration => !domain.has(declaration)))
        return {
            kind: "unresolved", reason: "Lexical value ordering requires every declaration in its explicit source-node domain.",
        };
    const remaining = new Map();
    const dependants = new Map();
    const members = new Set(declarations);
    if (members.size !== declarations.length) {
        return { kind: "unresolved", reason: "Lexical value ordering requires bounded, unique checked declarations." };
    }
    if (declarations.length > 65536)
        failTargetCompilerResourceLimit("tsonic", "Lexical callable ordering", "declarations", 65536, declarations[0]);
    let steps = 0;
    for (const declaration of declarations) {
        const captures = sourceLexicalCaptures(declaration, [declaration], ast, navigation, domain).captures;
        const dependencies = new Set();
        for (const capture of captures) {
            if (++steps > 262144)
                failTargetCompilerResourceLimit("tsonic", "Lexical callable ordering", "steps", 262144, declaration);
            if (!members.has(capture.declaration))
                continue;
            const references = new Set(capture.references);
            if (navigation.declarationUseSummary(capture.declaration).uses.some(use => use.kind === "first-class" && isRuntimeUse(use, capture.declaration) && references.has(use.reference)))
                dependencies.add(capture.declaration);
        }
        remaining.set(declaration, dependencies);
        for (const dependency of dependencies) {
            const values = dependants.get(dependency) ?? [];
            values.push(declaration);
            dependants.set(dependency, values);
        }
    }
    const ordered = [];
    const ready = declarations.filter(declaration => remaining.get(declaration)?.size === 0);
    for (let index = 0; index < ready.length; index++) {
        const declaration = ready[index];
        ordered.push(declaration);
        remaining.delete(declaration);
        for (const dependant of dependants.get(declaration) ?? []) {
            if (++steps > 262144)
                failTargetCompilerResourceLimit("tsonic", "Lexical callable ordering", "steps", 262144, declaration);
            const dependencies = remaining.get(dependant);
            if (dependencies === undefined)
                continue;
            dependencies.delete(declaration);
            if (dependencies.size === 0)
                ready.push(dependant);
        }
    }
    if (remaining.size > 0)
        return { kind: "unresolved", reason: "Cyclic lexical callable values require an exact shared retained environment." };
    return { kind: "resolved", declarations: Object.freeze(ordered) };
}
//# sourceMappingURL=lexical-value-creation.js.map