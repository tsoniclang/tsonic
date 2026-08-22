import type {
  CheckedSourceProgram,
  Node,
  SourceFile,
  Symbol,
} from "@tsonic/tsts";
import {
  createSourceDeclarationReferenceIndex,
} from "./reference-index.js";
import {
  projectDeclarationForType,
} from "./reference-selection.js";
import {
  semanticTypeForNode,
} from "./syntax.js";
import type {
  SourceDeclarationReference,
  SourceProjectReference,
  SourceReferenceIndexStatistics,
} from "./types.js";

export interface SourceReferenceNavigation {
  readonly referenceIndexStatistics: SourceReferenceIndexStatistics;
  sourceReferenceFor(node: Node | undefined): SourceDeclarationReference | undefined;
  referenceFor(node: Node | undefined): SourceProjectReference | undefined;
  declarationFor(node: Node | undefined): Node | undefined;
  referencesToDeclaration(declaration: Node | undefined): readonly Node[];
  referencesForSymbol(symbol: Symbol): readonly Node[];
  isProjectDeclaration(node: Node | undefined): boolean;
}

export function createSourceReferenceNavigation(
  source: CheckedSourceProgram,
  sourceFiles: readonly SourceFile[],
): SourceReferenceNavigation {
  const { ast } = source;
  const sourceFileSet = new Set(sourceFiles);
  const projectDeclarationsByNode = new WeakMap<Node, Node>();
  const projectReferencesByDeclaration = new WeakMap<
    Node,
    WeakMap<Symbol, SourceProjectReference>
  >();

  const isProjectSourceFile = (
    sourceFile: SourceFile | undefined,
  ): sourceFile is SourceFile =>
    sourceFile !== undefined &&
    !sourceFile.IsDeclarationFile &&
    sourceFileSet.has(sourceFile);

  const isProjectDeclaration = (declaration: Node | undefined): boolean =>
    declaration !== undefined &&
    isProjectSourceFile(ast.getSourceFile(declaration));

  const referenceIndex = createSourceDeclarationReferenceIndex(
    source,
    sourceFiles,
    isProjectDeclaration,
  );

  const declarationFor = (node: Node | undefined): Node | undefined => {
    if (node === undefined || !isProjectSourceFile(ast.getSourceFile(node))) {
      return undefined;
    }
    const selected = referenceIndex.sourceReferenceFor(node);
    if (selected !== undefined) {
      return selected.project ? selected.declaration : undefined;
    }
    const cached = projectDeclarationsByNode.get(node);
    if (cached !== undefined) {
      return cached;
    }
    const sourceFile = ast.getSourceFile(node);
    if (sourceFile === undefined) {
      return undefined;
    }
    const queries = source.getSourceFileQueries(sourceFile);
    const declaration = projectDeclarationForType(
      queries.checker,
      queries.typeShape,
      semanticTypeForNode(ast, queries.checker, node),
      isProjectDeclaration,
    );
    if (declaration !== undefined) {
      projectDeclarationsByNode.set(node, declaration);
    }
    return declaration;
  };

  const referenceFor = (
    node: Node | undefined,
  ): SourceProjectReference | undefined => {
    if (node === undefined || !isProjectSourceFile(ast.getSourceFile(node))) {
      return undefined;
    }
    const selected = referenceIndex.sourceReferenceFor(node);
    if (selected !== undefined) {
      return selected.project && selected.symbol !== undefined
        ? projectReferenceForDeclaration(
            selected.symbol,
            selected.declaration,
            selected.sourceFile,
            projectReferencesByDeclaration,
          )
        : undefined;
    }
    const declaration = declarationFor(node);
    if (declaration === undefined) {
      return undefined;
    }
    const declarationFile = ast.getSourceFile(declaration);
    if (!isProjectSourceFile(declarationFile)) {
      return undefined;
    }
    const symbol = source.getSourceFileQueries(declarationFile).checker
      .getSymbolAtLocation(declaration);
    return symbol === undefined
      ? undefined
      : projectReferenceForDeclaration(
          symbol,
          declaration,
          declarationFile,
          projectReferencesByDeclaration,
        );
  };

  return Object.freeze({
    referenceIndexStatistics: referenceIndex.statistics,
    sourceReferenceFor: referenceIndex.sourceReferenceFor,
    referenceFor,
    declarationFor,
    referencesToDeclaration: referenceIndex.referencesToDeclaration,
    referencesForSymbol: referenceIndex.referencesForSymbol,
    isProjectDeclaration,
  });
}

function projectReferenceForDeclaration(
  symbol: Symbol,
  declaration: Node,
  sourceFile: SourceFile,
  cache: WeakMap<Node, WeakMap<Symbol, SourceProjectReference>>,
): SourceProjectReference {
  let referencesBySymbol = cache.get(declaration);
  if (referencesBySymbol === undefined) {
    referencesBySymbol = new WeakMap();
    cache.set(declaration, referencesBySymbol);
  }
  const existing = referencesBySymbol.get(symbol);
  if (existing !== undefined) {
    if (existing.sourceFile !== sourceFile) {
      throw new Error(
        "One project declaration-symbol pair produced conflicting source-file evidence.",
      );
    }
    return existing;
  }
  const reference = Object.freeze({ symbol, declaration, sourceFile });
  referencesBySymbol.set(symbol, reference);
  return reference;
}
