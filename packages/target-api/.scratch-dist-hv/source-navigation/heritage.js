import { sourceNodeIdentity } from "./identity.js";
const maximumHeritageDepth = 512;
/**
 * Declared heritage: each clause element, the declaration it names (host-input heritage target) and its authored type
 * argument nodes. Type arguments are syntax; their Source meaning is the Host value model's (object facts).
 */
export function createSourceHeritageNavigation(source, isProjectDeclaration) {
    const cache = new Map();
    const declaredHeritage = (declaration) => {
        const identity = sourceNodeIdentity(source.ast, declaration);
        const cached = identity === undefined ? undefined : cache.get(identity);
        if (cached !== undefined) {
            return cached;
        }
        const clauses = [
            ...source.ast.extendsHeritageElements(declaration).map((heritage) => ({
                kind: "extends",
                heritage,
            })),
            ...source.ast.implementsHeritageElements(declaration).map((heritage) => ({
                kind: "implements",
                heritage,
            })),
        ].filter((entry) => entry.heritage !== undefined);
        const edges = [];
        for (const clause of clauses) {
            const target = heritageTarget(source, clause.heritage, isProjectDeclaration);
            if (target === undefined) {
                const unresolved = Object.freeze({
                    kind: "unresolved",
                    heritage: clause.heritage,
                    reason: "The checked source program did not provide one exact declaration for a declared heritage type.",
                });
                if (identity !== undefined) {
                    cache.set(identity, unresolved);
                }
                return unresolved;
            }
            edges.push(Object.freeze({
                kind: clause.kind,
                sourceDeclaration: declaration,
                heritage: clause.heritage,
                target,
                typeArguments: Object.freeze(source.ast.typeArguments(clause.heritage).filter((argument) => argument !== undefined)),
            }));
        }
        const resolved = Object.freeze({
            kind: "resolved",
            edges: Object.freeze(edges),
        });
        if (identity !== undefined) {
            cache.set(identity, resolved);
        }
        return resolved;
    };
    const declaredHeritagePath = (sourceDeclaration, targetDeclaration) => {
        if (sameDeclaration(source, sourceDeclaration, targetDeclaration)) {
            return { kind: "related", edges: Object.freeze([]) };
        }
        return findHeritagePath(source, declaredHeritage, sourceDeclaration, targetDeclaration, new Set(), 0);
    };
    return Object.freeze({ declaredHeritage, declaredHeritagePath });
}
function heritageTarget(source, heritage, isProjectDeclaration) {
    const declaration = source.heritageTarget(heritage);
    const sourceFile = source.ast.getSourceFile(declaration);
    return declaration === undefined || sourceFile === undefined ? undefined
        : Object.freeze({ declaration, sourceFile, project: isProjectDeclaration(declaration) });
}
function findHeritagePath(source, declaredHeritage, current, target, path, depth) {
    if (depth > maximumHeritageDepth) {
        return {
            kind: "unresolved",
            heritage: current,
            reason: `Declared source heritage exceeds its finite ${maximumHeritageDepth}-edge traversal depth.`,
        };
    }
    const currentIdentity = sourceNodeIdentity(source.ast, current);
    if (currentIdentity === undefined || path.has(currentIdentity)) {
        return { kind: "unrelated" };
    }
    const nextPath = new Set(path);
    nextPath.add(currentIdentity);
    const result = declaredHeritage(current);
    if (result.kind === "unresolved") {
        return result;
    }
    let unresolved;
    for (const edge of result.edges) {
        if (sameDeclaration(source, edge.target.declaration, target)) {
            return { kind: "related", edges: Object.freeze([edge]) };
        }
        const nested = findHeritagePath(source, declaredHeritage, edge.target.declaration, target, nextPath, depth + 1);
        if (nested.kind === "related") {
            return {
                kind: "related",
                edges: Object.freeze([edge, ...nested.edges]),
            };
        }
        if (nested.kind === "unresolved") {
            unresolved ?? (unresolved = nested);
        }
    }
    return unresolved ?? { kind: "unrelated" };
}
function sameDeclaration(source, left, right) {
    const leftIdentity = sourceNodeIdentity(source.ast, left);
    return leftIdentity !== undefined &&
        leftIdentity === sourceNodeIdentity(source.ast, right);
}
//# sourceMappingURL=heritage.js.map