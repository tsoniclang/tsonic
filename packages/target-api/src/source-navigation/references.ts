import type { Node, SourceFile } from "@tsonic/tsts";
import type { SourceNavigationInput } from "../source-model/navigation-records.js";
import { createSourceDeclarationReferenceIndex } from "./reference-index.js";
import type { SourceDeclarationReference, SourceProjectReference, SourceReferenceIndexStatistics } from "./types.js";

export interface SourceReferenceNavigation {
  readonly referenceIndexStatistics: SourceReferenceIndexStatistics;
  sourceReferenceFor(node: Node | undefined): SourceDeclarationReference | undefined;
  referenceFor(node: Node | undefined): SourceProjectReference | undefined;
  declarationFor(node: Node | undefined): Node | undefined;
  referencesToDeclaration(declaration: Node | undefined): readonly Node[];
  /** References to every merged declaration of the entity `declaration` declares. */
  referencesToEntity(declaration: Node): readonly Node[];
  isProjectDeclaration(node: Node | undefined): boolean;
}

/**
 * Reference navigation over the reference index. A reference is the declaration the occurrence selects; there is no
 * fallback through the checked type of the node (R3): a node that selects no declaration has no reference.
 */
export function createSourceReferenceNavigation(
  input: SourceNavigationInput,
  sourceFiles: readonly SourceFile[],
  ambientFiles: readonly SourceFile[] = [],
): SourceReferenceNavigation {
  const { ast } = input;
  const sourceFileSet = new Set(sourceFiles);
  const projectReferences = new WeakMap<Node, SourceProjectReference>();
  const entityReferences = new WeakMap<Node, readonly Node[]>();

  const isProjectSourceFile = (sourceFile: SourceFile | undefined): sourceFile is SourceFile =>
    sourceFile !== undefined && !sourceFile.IsDeclarationFile && sourceFileSet.has(sourceFile);
  const isProjectDeclaration = (declaration: Node | undefined): boolean =>
    declaration !== undefined && isProjectSourceFile(ast.getSourceFile(declaration));

  const referenceIndex = createSourceDeclarationReferenceIndex(input, sourceFiles, isProjectDeclaration, undefined, ambientFiles);
  const projectReferenceFor = (node: Node | undefined): SourceDeclarationReference | undefined => {
    if (node === undefined || !isProjectSourceFile(ast.getSourceFile(node)) || ast.is.IsTypeQueryNode(node)) return undefined;
    const selected = referenceIndex.sourceReferenceFor(node);
    return selected?.project === true ? selected : undefined;
  };

  const referenceFor = (node: Node | undefined): SourceProjectReference | undefined => {
    const selected = projectReferenceFor(node);
    if (selected === undefined) return undefined;
    const known = projectReferences.get(selected.declaration);
    if (known !== undefined) return known;
    const reference = Object.freeze({ declaration: selected.declaration, sourceFile: selected.sourceFile });
    projectReferences.set(selected.declaration, reference);
    return reference;
  };

  const referencesToEntity = (declaration: Node): readonly Node[] => {
    const known = entityReferences.get(declaration);
    if (known !== undefined) return known;
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
    declarationFor: (node: Node | undefined) => projectReferenceFor(node)?.declaration,
    referencesToDeclaration: referenceIndex.referencesToDeclaration,
    referencesToEntity,
    isProjectDeclaration,
  });
}
