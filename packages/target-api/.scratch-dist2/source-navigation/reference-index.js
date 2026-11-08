import { referenceQueryNode } from "../source-model/syntax.js";
const noSourceReferences = Object.freeze([]);
const defaultSourceReferenceIndexLimits = Object.freeze({
    sourceFiles: 65536,
    nodesVisited: 16777216,
    referenceCandidates: 8388608,
    selectedReferences: 4194304,
    selectedDeclarations: 2097152,
    reverseEdges: 4194304,
    moduleExportsExamined: 4194304,
});
/**
 * The reverse reference index, built in one pass over the project files. Each reference occurrence is keyed by the
 * declaration host-input selects for it (I3); one canonical reference record per declaration.
 *
 * `ambientFiles` (the program's declaration files and provider modules) are indexed only at their ambient value
 * positions (Q113(1)): the expression of a computed property name (`[Symbol.iterator]`), an enum member initializer and
 * an export assignment's expression. Every other position of a declaration file stays unindexed.
 */
export function createSourceDeclarationReferenceIndex(input, sourceFiles, isProjectDeclaration, requestedLimits = defaultSourceReferenceIndexLimits, ambientFiles = []) {
    const limits = snapshotLimits(requestedLimits);
    if (sourceFiles.length + ambientFiles.length > limits.sourceFiles) {
        throw sourceReferenceLimitError("source files", limits.sourceFiles);
    }
    const built = buildSourceDeclarationReferenceIndex(input, sourceFiles, ambientFiles, isProjectDeclaration, limits);
    return sealSourceDeclarationReferenceIndex(input.ast, new Set([...sourceFiles, ...ambientFiles]), built);
}
/** The ambient value expression a declaration-file node owns (computed name, enum initializer, export assignment). */
function ambientValuePosition(ast, node) {
    if (ast.is.IsComputedPropertyName(node))
        return ast.as.AsComputedPropertyName(node)?.Expression;
    if (ast.is.IsEnumMember(node))
        return ast.as.AsEnumMember(node)?.Initializer;
    if (ast.is.IsExportAssignment(node))
        return ast.as.AsExportAssignment(node)?.Expression;
    return undefined;
}
function buildSourceDeclarationReferenceIndex(input, sourceFiles, ambientFiles, isProjectDeclaration, limits) {
    const { ast } = input;
    const byReference = new WeakMap();
    const pendingByDeclaration = new Map();
    const canonicalByDeclaration = new Map();
    let nodesVisited = 0;
    let referenceCandidates = 0;
    let selectedReferences = 0;
    let reverseEdges = 0;
    let moduleExportsExamined = 0;
    const reserveModuleExports = (count) => {
        moduleExportsExamined = reserveAmount(moduleExportsExamined, count, limits.moduleExportsExamined, "module exports examined");
    };
    const record = (referenceNode, declaration, sourceFile) => {
        if (byReference.has(referenceNode)) {
            throw new Error("One exact source occurrence was visited more than once while building the source reference index.");
        }
        selectedReferences = reserveCount(selectedReferences, limits.selectedReferences, "selected references");
        let canonical = canonicalByDeclaration.get(declaration);
        if (canonical === undefined) {
            if (canonicalByDeclaration.size >= limits.selectedDeclarations) {
                throw sourceReferenceLimitError("selected declarations", limits.selectedDeclarations);
            }
            canonical = Object.freeze({ declaration, sourceFile, project: isProjectDeclaration(declaration) });
            canonicalByDeclaration.set(declaration, canonical);
        }
        else if (canonical.sourceFile !== sourceFile) {
            throw new Error("Source reference selection produced conflicting facts for one exact declaration.");
        }
        byReference.set(referenceNode, canonical);
        // A declaration's own name is not a reference to it.
        const owner = ast.parent(referenceNode);
        if (owner !== undefined && ast.name(owner) === referenceNode &&
            input.mergedDeclarations(canonical.declaration).includes(owner)) {
            return;
        }
        reverseEdges = reserveCount(reverseEdges, limits.reverseEdges, "reverse reference edges");
        const declarationReferences = pendingByDeclaration.get(canonical.declaration);
        if (declarationReferences === undefined) {
            pendingByDeclaration.set(canonical.declaration, [referenceNode]);
        }
        else {
            declarationReferences.push(referenceNode);
        }
    };
    // A project file is indexed at every reference position; an ambient file only inside its ambient value positions.
    const files = [
        ...sourceFiles.map(file => [file, true]), ...ambientFiles.map(file => [file, false])
    ];
    for (const [sourceFile, everywhere] of files) {
        const pending = [[sourceFile, everywhere]];
        while (pending.length > 0) {
            const entry = pending.pop();
            if (entry === undefined) {
                continue;
            }
            const [node, indexed] = entry;
            nodesVisited = reserveCount(nodesVisited, limits.nodesVisited, "visited nodes");
            const ambientValue = indexed ? undefined : ambientValuePosition(ast, node);
            if (ambientValue !== undefined) {
                pending.push([ambientValue, true]);
            }
            if (indexed && referenceQueryNode(ast, node) === node) {
                referenceCandidates = reserveCount(referenceCandidates, limits.referenceCandidates, "reference candidates");
                const selected = input.reference(node, reserveModuleExports);
                if (selected !== undefined) {
                    record(node, selected.declaration, selected.sourceFile);
                }
            }
            const children = ast.children(node);
            for (let index = children.length - 1; index >= 0; index -= 1) {
                const child = children[index];
                if (child !== undefined && (indexed || child !== ambientValue)) {
                    pending.push([child, indexed]);
                }
            }
        }
    }
    for (const references of pendingByDeclaration.values()) {
        Object.freeze(references);
    }
    const statistics = Object.freeze({
        constructionPasses: 1,
        sourceFiles: sourceFiles.length,
        nodesVisited,
        referenceCandidates,
        selectedReferences,
        selectedDeclarations: canonicalByDeclaration.size,
        reverseEdges,
        moduleExportsExamined,
    });
    return Object.freeze({
        statistics,
        byReference,
        referencesByDeclaration: pendingByDeclaration,
    });
}
function sealSourceDeclarationReferenceIndex(ast, sourceFileSet, built) {
    const isProjectNode = (node) => {
        const sourceFile = node === undefined ? undefined : ast.getSourceFile(node);
        return sourceFile !== undefined && sourceFileSet.has(sourceFile);
    };
    return Object.freeze({
        statistics: built.statistics,
        sourceReferenceFor(node) {
            if (!isProjectNode(node)) {
                return undefined;
            }
            const queryNode = referenceQueryNode(ast, node);
            return queryNode === undefined || !isProjectNode(queryNode)
                ? undefined
                : built.byReference.get(queryNode);
        },
        referencesToDeclaration(declaration) {
            return declaration === undefined
                ? noSourceReferences
                : built.referencesByDeclaration.get(declaration) ?? noSourceReferences;
        },
    });
}
function snapshotLimits(input) {
    const fields = Object.keys(defaultSourceReferenceIndexLimits);
    if (typeof input !== "object" || input === null ||
        Object.getPrototypeOf(input) !== Object.prototype && Object.getPrototypeOf(input) !== null ||
        Reflect.ownKeys(input).length !== fields.length) {
        throw new Error("Source reference index limits require the complete plain data budget family.");
    }
    const limits = {};
    for (const name of fields) {
        const descriptor = Object.getOwnPropertyDescriptor(input, name);
        const value = descriptor !== undefined && "value" in descriptor ? descriptor.value : undefined;
        if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
            throw new Error(`Source reference index limit '${name}' must be a positive safe integer.`);
        }
        limits[name] = value;
    }
    return Object.freeze(limits);
}
function reserveCount(current, limit, subject) {
    if (!Number.isSafeInteger(current) || current < 0 || current >= limit) {
        throw sourceReferenceLimitError(subject, limit);
    }
    return current + 1;
}
function reserveAmount(current, amount, limit, subject) {
    if (!Number.isSafeInteger(current) ||
        current < 0 ||
        !Number.isSafeInteger(amount) ||
        amount < 0 ||
        current > limit - amount) {
        throw sourceReferenceLimitError(subject, limit);
    }
    return current + amount;
}
function sourceReferenceLimitError(subject, limit) {
    return new Error(`Source reference index exceeds the ${limit.toLocaleString("en-US")} ${subject} limit.`);
}
//# sourceMappingURL=reference-index.js.map