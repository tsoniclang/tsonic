import { sourceBindingWriteAtReference } from "../source-navigation/index.js";
import { isSourceCallableBodyBoundary } from "../source-model/callable-boundaries.js";
export function snapshotTargetPlanningSourceNavigation(source) {
    const projectReferences = new WeakMap();
    const declarations = new WeakMap();
    const memberDispatch = new WeakMap();
    const memberContracts = new WeakMap();
    const callableImplementations = new WeakMap();
    const declaredHeritage = new WeakMap();
    const declarationUses = new WeakMap();
    const countedLoops = new WeakMap();
    const effects = new WeakMap();
    const projectConstructibleObjects = new WeakSet();
    const projectNodes = new WeakSet();
    const writesByDeclaration = new Map();
    const rememberDeclaration = (declaration) => {
        if (declaration === undefined ||
            declarationUses.has(declaration) ||
            !source.navigation.isProjectDeclaration(declaration)) {
            return;
        }
        declarationUses.set(declaration, source.navigation.declarationUseSummary(declaration));
    };
    const visit = (node) => {
        if (source.ast.is.IsVariableDeclaration(node) || source.ast.is.IsBindingElement(node))
            rememberDeclaration(node);
        if (isReferenceQueryCandidate(source.ast, node)) {
            const sourceReference = source.navigation.sourceReferenceFor(node);
            if (sourceReference !== undefined) {
                rememberDeclaration(sourceReference.declaration);
                const write = sourceBindingWriteAtReference(source.ast, node);
                if (write !== undefined && write.kind !== "initialization") {
                    const writes = writesByDeclaration.get(sourceReference.declaration) ?? [];
                    writes.push(write);
                    writesByDeclaration.set(sourceReference.declaration, writes);
                }
            }
            const projectReference = source.navigation.referenceFor(node);
            if (projectReference !== undefined) {
                projectReferences.set(node, projectReference);
                rememberDeclaration(projectReference.declaration);
            }
            const declaration = source.navigation.declarationFor(node);
            if (declaration !== undefined) {
                declarations.set(node, declaration);
                rememberDeclaration(declaration);
            }
            if (isValueReadCandidate(source.ast, node) && source.facts.navigation.identity.isProjectConstructibleObject(node)) {
                projectConstructibleObjects.add(node);
            }
        }
        if (isSourceCallableBodyBoundary(source.ast, node)) {
            callableImplementations.set(node, source.navigation.callableImplementation(node));
            rememberDeclaration(node);
        }
        if (isMemberDeclaration(source.ast, node)) {
            const dispatch = source.navigation.memberDispatch(node);
            if (dispatch !== undefined)
                memberDispatch.set(node, dispatch);
            memberContracts.set(node, source.navigation.memberContracts(node));
            rememberDeclaration(node);
        }
        if (isTypeLiteralMember(source.ast, node)) {
            rememberDeclaration(node);
        }
        const kind = source.ast.kindName(node);
        if (kind === "KindClassDeclaration" || kind === "KindClassExpression" || kind === "KindInterfaceDeclaration") {
            declaredHeritage.set(node, source.navigation.declaredHeritage(node));
            rememberDeclaration(node);
        }
        if (source.navigation.isProjectDeclaration(node)) {
            projectNodes.add(node);
        }
        if (kind === "KindForStatement") {
            const counted = source.navigation.countedLoop(node);
            if (counted !== undefined)
                countedLoops.set(node, counted);
        }
        effects.set(node, source.facts.navigation.expressions.effects(node));
        source.ast.forEachChild(node, (child) => {
            if (child !== undefined)
                visit(child);
        });
    };
    for (const sourceFile of source.navigation.sourceFiles)
        visit(sourceFile);
    const moduleDependencies = new Map(source.navigation.sourceFiles.map((sourceFile) => [
        sourceFile,
        Object.freeze([...source.navigation.moduleDependencies(sourceFile)]),
    ]));
    const moduleReferences = new Map(source.navigation.sourceFiles.map((sourceFile) => [
        sourceFile,
        Object.freeze([...source.navigation.moduleReferences(sourceFile)]),
    ]));
    const moduleExports = new Map(source.navigation.sourceFiles.map((sourceFile) => [
        sourceFile,
        Object.freeze([...source.navigation.moduleExports(sourceFile)]),
    ]));
    const topLevelAwait = new Map(source.navigation.sourceFiles.map((sourceFile) => [
        sourceFile,
        source.navigation.moduleHasTopLevelAwait(sourceFile),
    ]));
    const noDependencies = Object.freeze([]);
    const noExports = Object.freeze([]);
    const snapshot = {
        sourceFiles: Object.freeze([...source.navigation.sourceFiles]),
        sourceReferenceFor: source.navigation.sourceReferenceFor,
        referenceFor: (node) => node === undefined ? undefined : projectReferences.get(node),
        declarationFor: (node) => node === undefined ? undefined : declarations.get(node),
        moduleDependencies: (sourceFile) => moduleDependencies.get(sourceFile) ?? noDependencies,
        moduleReferences: (sourceFile) => moduleReferences.get(sourceFile) ?? noDependencies,
        moduleExports: (sourceFile) => moduleExports.get(sourceFile) ?? noExports,
        moduleHasTopLevelAwait: (sourceFile) => topLevelAwait.get(sourceFile) === true,
        memberDispatch: (node) => node === undefined ? undefined : memberDispatch.get(node),
        memberContracts: (node) => memberContracts.get(node) ?? Object.freeze({
            kind: "unresolved",
            declaration: node,
            reason: "The declaration was not classified as a source member before target planning.",
        }),
        callableImplementation: (node) => callableImplementations.get(node) ?? Object.freeze({
            kind: "unresolved",
            reason: "The callable was not classified before target planning.",
        }),
        declaredHeritage: (node) => declaredHeritage.get(node) ?? Object.freeze({
            kind: "unresolved",
            heritage: node,
            reason: "The declaration heritage was not classified before target planning.",
        }),
        bindingWritesWithin(declaration, root) {
            return Object.freeze(source.navigation.mergedDeclarations(declaration).flatMap(entry => writesByDeclaration.get(entry) ?? []).filter((write) => sourceNodeIsWithin(source.ast, write.operation, root)));
        },
        declarationUseSummary(node) {
            const summary = declarationUses.get(node);
            if (summary === undefined) {
                throw new Error("Target planning requested an unclassified source declaration-use summary.");
            }
            return summary;
        },
        countedLoop: (node) => countedLoops.get(node),
        expressionEffects(node) {
            const result = effects.get(node);
            if (result === undefined) {
                throw new Error("Target planning requested unclassified source expression effects.");
            }
            return result;
        },
        isProjectConstructibleObject: (node) => node !== undefined && projectConstructibleObjects.has(node),
        isProjectDeclaration: (node) => node !== undefined && projectNodes.has(node),
    };
    return Object.freeze(snapshot);
}
function isReferenceQueryCandidate(ast, node) {
    switch (ast.kindName(node)) {
        case "KindIdentifier":
        case "KindPrivateIdentifier":
        case "KindPropertyAccessExpression":
        case "KindElementAccessExpression":
        case "KindQualifiedName":
        case "KindTypeReference":
        case "KindExpressionWithTypeArguments":
            return true;
        default:
            return false;
    }
}
// A value read (identifier, property or element access in expression position): the role model answers project
// constructibility from the Host value type, which exists only for value nodes.
function isValueReadCandidate(ast, node) {
    if (!ast.is.IsIdentifier(node) && !ast.is.IsPropertyAccessExpression(node) && !ast.is.IsElementAccessExpression(node))
        return false;
    const parent = ast.parent(node);
    if (parent === undefined)
        return false;
    const kind = ast.kindName(parent);
    if (kind === "KindTypeReference" || kind === "KindQualifiedName" || kind === "KindExpressionWithTypeArguments" ||
        kind === "KindTypeQuery" || kind === "KindImportSpecifier" || kind === "KindExportSpecifier" || kind === "KindImportClause" ||
        kind === "KindNamespaceImport" || kind === "KindLabeledStatement" || kind === "KindBreakStatement" || kind === "KindContinueStatement")
        return false;
    return ast.name(parent) !== node;
}
function sourceNodeIsWithin(ast, node, root) {
    let current = node;
    while (current !== undefined) {
        if (current === root)
            return true;
        current = ast.parent(current);
    }
    return false;
}
function isMemberDeclaration(ast, node) {
    const parent = ast.parent(node);
    if (parent === undefined)
        return false;
    const kind = ast.kindName(parent);
    return kind === "KindClassDeclaration" || kind === "KindClassExpression" || kind === "KindInterfaceDeclaration";
}
function isTypeLiteralMember(ast, node) {
    const parent = ast.parent(node);
    return parent !== undefined && ast.kindName(parent) === "KindTypeLiteral";
}
//# sourceMappingURL=source-navigation-snapshot.js.map