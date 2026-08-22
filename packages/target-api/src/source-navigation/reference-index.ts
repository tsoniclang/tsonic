import type {
  AstReader,
  CheckedSourceProgram,
  Node,
  SourceFile,
  Symbol,
  TypeCheckerQueries,
} from "@tsonic/tsts";
import {
  createSourceDeclarationReferenceSelector,
} from "./reference-selection.js";
import {
  referenceQueryNode,
} from "./syntax.js";
import type {
  SourceDeclarationReference,
  SourceReferenceIndexStatistics,
} from "./types.js";

const noSourceReferences: readonly Node[] = Object.freeze([]);

export interface SourceReferenceIndexLimits {
  readonly sourceFiles: number;
  readonly nodesVisited: number;
  readonly referenceCandidates: number;
  readonly selectedReferences: number;
  readonly selectedDeclarations: number;
  readonly reverseEdges: number;
  readonly indexedSymbols: number;
  readonly moduleExportsExamined: number;
}

export interface SourceDeclarationReferenceIndex {
  readonly statistics: SourceReferenceIndexStatistics;
  sourceReferenceFor(node: Node | undefined): SourceDeclarationReference | undefined;
  referencesToDeclaration(declaration: Node | undefined): readonly Node[];
  referencesForSymbol(symbol: Symbol): readonly Node[];
}

interface BuiltSourceDeclarationReferenceIndex {
  readonly statistics: SourceReferenceIndexStatistics;
  readonly byReference: WeakMap<Node, SourceDeclarationReference>;
  readonly referencesByDeclaration: ReadonlyMap<Node, readonly Node[]>;
  readonly referencesBySymbol: ReadonlyMap<Symbol, readonly Node[]>;
}

const defaultSourceReferenceIndexLimits: SourceReferenceIndexLimits =
  Object.freeze({
    sourceFiles: 65_536,
    nodesVisited: 16_777_216,
    referenceCandidates: 8_388_608,
    selectedReferences: 4_194_304,
    selectedDeclarations: 2_097_152,
    reverseEdges: 4_194_304,
    indexedSymbols: 2_097_152,
    moduleExportsExamined: 4_194_304,
  });

export function createSourceDeclarationReferenceIndex(
  source: CheckedSourceProgram,
  sourceFiles: readonly SourceFile[],
  isProjectDeclaration: (declaration: Node | undefined) => boolean,
  limits: SourceReferenceIndexLimits = defaultSourceReferenceIndexLimits,
): SourceDeclarationReferenceIndex {
  validateLimits(limits);
  if (sourceFiles.length > limits.sourceFiles) {
    throw sourceReferenceLimitError("source files", limits.sourceFiles);
  }
  const built = buildSourceDeclarationReferenceIndex(
    source,
    sourceFiles,
    isProjectDeclaration,
    limits,
  );
  return sealSourceDeclarationReferenceIndex(
    source.ast,
    new Set(sourceFiles),
    built,
  );
}

function buildSourceDeclarationReferenceIndex(
  source: CheckedSourceProgram,
  sourceFiles: readonly SourceFile[],
  isProjectDeclaration: (declaration: Node | undefined) => boolean,
  limits: SourceReferenceIndexLimits,
): BuiltSourceDeclarationReferenceIndex {
  const { ast } = source;
  const byReference = new WeakMap<Node, SourceDeclarationReference>();
  const pendingByDeclaration = new Map<Node, Node[]>();
  const pendingDeclarationsBySymbol = new Map<Symbol, Set<Node>>();
  const factsByDeclaration = new Map<
    Node,
    Map<Symbol | undefined, SourceDeclarationReference>
  >();
  let nodesVisited = 0;
  let referenceCandidates = 0;
  let selectedReferences = 0;
  let reverseEdges = 0;
  let moduleExportsExamined = 0;
  const selectReference = createSourceDeclarationReferenceSelector(
    ast,
    isProjectDeclaration,
    (count) => {
      moduleExportsExamined = reserveAmount(
        moduleExportsExamined,
        count,
        limits.moduleExportsExamined,
        "module exports examined",
      );
    },
  );

  const record = (
    referenceNode: Node,
    selected: SourceDeclarationReference,
  ): void => {
    if (byReference.has(referenceNode)) {
      throw new Error(
        "One exact source occurrence was visited more than once while building the source reference index.",
      );
    }
    selectedReferences = reserveCount(
      selectedReferences,
      limits.selectedReferences,
      "selected references",
    );
    let factsBySymbol = factsByDeclaration.get(selected.declaration);
    if (factsBySymbol === undefined) {
      if (factsByDeclaration.size >= limits.selectedDeclarations) {
        throw sourceReferenceLimitError(
          "selected declarations",
          limits.selectedDeclarations,
        );
      }
      factsBySymbol = new Map();
      factsByDeclaration.set(selected.declaration, factsBySymbol);
    }
    const existing = factsBySymbol.get(selected.symbol);
    if (
      existing !== undefined &&
      (
        existing.declaration !== selected.declaration ||
        existing.sourceFile !== selected.sourceFile ||
        existing.project !== selected.project
      )
    ) {
      throw new Error(
        "Source reference selection produced conflicting facts for one exact declaration and symbol.",
      );
    }
    const canonical = existing ?? selected;
    if (existing === undefined) {
      factsBySymbol.set(selected.symbol, canonical);
    }
    byReference.set(referenceNode, canonical);

    if (ast.name(canonical.declaration) === referenceNode) {
      return;
    }
    reverseEdges = reserveCount(
      reverseEdges,
      limits.reverseEdges,
      "reverse reference edges",
    );
    const declarationReferences = pendingByDeclaration.get(
      canonical.declaration,
    );
    if (declarationReferences === undefined) {
      pendingByDeclaration.set(canonical.declaration, [referenceNode]);
    } else {
      declarationReferences.push(referenceNode);
    }
    if (canonical.symbol === undefined) {
      return;
    }
    let symbolDeclarations = pendingDeclarationsBySymbol.get(canonical.symbol);
    if (symbolDeclarations === undefined) {
      if (pendingDeclarationsBySymbol.size >= limits.indexedSymbols) {
        throw sourceReferenceLimitError(
          "indexed symbols",
          limits.indexedSymbols,
        );
      }
      symbolDeclarations = new Set();
      pendingDeclarationsBySymbol.set(canonical.symbol, symbolDeclarations);
    }
    symbolDeclarations.add(canonical.declaration);
  };

  for (const sourceFile of sourceFiles) {
    let checker: TypeCheckerQueries | undefined;
    const pending: Node[] = [sourceFile];
    while (pending.length > 0) {
      const node = pending.pop();
      if (node === undefined) {
        continue;
      }
      nodesVisited = reserveCount(
        nodesVisited,
        limits.nodesVisited,
        "visited nodes",
      );
      const queryNode = referenceQueryNode(ast, node);
      if (queryNode === node) {
        checker ??= source.getSourceFileQueries(sourceFile).checker;
        referenceCandidates = reserveCount(
          referenceCandidates,
          limits.referenceCandidates,
          "reference candidates",
        );
        const selected = selectReference(checker, node);
        if (selected !== undefined) {
          record(node, selected);
        }
      }
      const children = ast.children(node);
      for (let index = children.length - 1; index >= 0; index -= 1) {
        const child = children[index];
        if (child !== undefined) {
          pending.push(child);
        }
      }
    }
  }

  for (const references of pendingByDeclaration.values()) {
    Object.freeze(references);
  }
  const referencesBySymbol = new Map<Symbol, readonly Node[]>();
  for (const [symbol, declarations] of pendingDeclarationsBySymbol) {
    const selected = [...declarations];
    if (selected.length === 1) {
      const declaration = selected[0];
      if (declaration === undefined) {
        throw new Error(
          "A source reference symbol index lost its selected declaration.",
        );
      }
      referencesBySymbol.set(
        symbol,
        pendingByDeclaration.get(declaration) ?? noSourceReferences,
      );
      continue;
    }
    referencesBySymbol.set(
      symbol,
      Object.freeze(selected.flatMap((declaration) =>
        pendingByDeclaration.get(declaration) ?? noSourceReferences)),
    );
  }
  const statistics: SourceReferenceIndexStatistics = Object.freeze({
    constructionPasses: 1,
    sourceFiles: sourceFiles.length,
    nodesVisited,
    referenceCandidates,
    selectedReferences,
    selectedDeclarations: factsByDeclaration.size,
    reverseEdges,
    indexedSymbols: referencesBySymbol.size,
    moduleExportsExamined,
  });

  return Object.freeze({
    statistics,
    byReference,
    referencesByDeclaration: pendingByDeclaration,
    referencesBySymbol,
  });
}

function sealSourceDeclarationReferenceIndex(
  ast: AstReader,
  sourceFileSet: ReadonlySet<SourceFile>,
  built: BuiltSourceDeclarationReferenceIndex,
): SourceDeclarationReferenceIndex {
  const isProjectNode = (node: Node | undefined): node is Node => {
    const sourceFile = node === undefined ? undefined : ast.getSourceFile(node);
    return sourceFile !== undefined && sourceFileSet.has(sourceFile);
  };
  return Object.freeze({
    statistics: built.statistics,
    sourceReferenceFor(node: Node | undefined) {
      if (!isProjectNode(node)) {
        return undefined;
      }
      const queryNode = referenceQueryNode(ast, node);
      return queryNode === undefined || !isProjectNode(queryNode)
        ? undefined
        : built.byReference.get(queryNode);
    },
    referencesToDeclaration(declaration: Node | undefined) {
      return declaration === undefined
        ? noSourceReferences
        : built.referencesByDeclaration.get(declaration) ?? noSourceReferences;
    },
    referencesForSymbol(symbol: Symbol) {
      return built.referencesBySymbol.get(symbol) ?? noSourceReferences;
    },
  });
}

function validateLimits(limits: SourceReferenceIndexLimits): void {
  for (const [name, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new Error(
        `Source reference index limit '${name}' must be a positive safe integer.`,
      );
    }
  }
}

function reserveCount(
  current: number,
  limit: number,
  subject: string,
): number {
  if (!Number.isSafeInteger(current) || current < 0 || current >= limit) {
    throw sourceReferenceLimitError(subject, limit);
  }
  return current + 1;
}

function reserveAmount(
  current: number,
  amount: number,
  limit: number,
  subject: string,
): number {
  if (
    !Number.isSafeInteger(current) ||
    current < 0 ||
    !Number.isSafeInteger(amount) ||
    amount < 0 ||
    current > limit - amount
  ) {
    throw sourceReferenceLimitError(subject, limit);
  }
  return current + amount;
}

function sourceReferenceLimitError(subject: string, limit: number): Error {
  return new Error(
    `Source reference index exceeds the ${limit.toLocaleString("en-US")} ${subject} limit.`,
  );
}
