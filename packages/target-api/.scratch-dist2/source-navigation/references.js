import { createSourceDeclarationReferenceIndex } from "./reference-index.js";
/**
 * Reference navigation over the reference index. A reference is the declaration the occurrence selects; there is no
 * fallback through the checked type of the node (R3): a node that selects no declaration has no reference.
 */
export function createSourceReferenceNavigation(input, sourceFiles, ambientFiles = []) {
    const { ast } = input;
    const sourceFileSet = new Set(sourceFiles);
    const projectReferences = new WeakMap();
    const entityReferences = new WeakMap();
    const isProjectSourceFile = (sourceFile) => sourceFile !== undefined && !sourceFile.IsDeclarationFile && sourceFileSet.has(sourceFile);
    const isProjectDeclaration = (declaration) => declaration !== undefined && isProjectSourceFile(ast.getSourceFile(declaration));
    const referenceIndex = createSourceDeclarationReferenceIndex(input, sourceFiles, isProjectDeclaration, undefined, ambientFiles);
    const projectReferenceFor = (node) => {
        if (node === undefined || !isProjectSourceFile(ast.getSourceFile(node)) || ast.is.IsTypeQueryNode(node))
            return undefined;
        const selected = referenceIndex.sourceReferenceFor(node);
        return selected?.project === true ? selected : undefined;
    };
    const referenceFor = (node) => {
        const selected = projectReferenceFor(node);
        if (selected === undefined)
            return undefined;
        const known = projectReferences.get(selected.declaration);
        if (known !== undefined)
            return known;
        const reference = Object.freeze({ declaration: selected.declaration, sourceFile: selected.sourceFile });
        projectReferences.set(selected.declaration, reference);
        return reference;
    };
    const referencesToEntity = (declaration) => {
        const known = entityReferences.get(declaration);
        if (known !== undefined)
            return known;
        const declarations = input.mergedDeclarations(declaration);
        const references = declarations.length === 1
            ? referenceIndex.referencesToDeclaration(declarations[0])
            : Object.freeze(declarations.flatMap(entry => referenceIndex.referencesToDeclaration(entry)));
        entityReferences.set(declaration, references);
        return references;
    };
    return Object.freeze({
        referenceIndexStatistics: referenceIndex.statistics,
        sourceReferenceFor: referenceIndex.sourceReferenceFor,
        referenceFor,
        declarationFor: (node) => projectReferenceFor(node)?.declaration,
        referencesToDeclaration: referenceIndex.referencesToDeclaration,
        referencesToEntity,
        isProjectDeclaration,
    });
}
//# sourceMappingURL=references.js.map