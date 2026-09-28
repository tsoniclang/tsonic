import type {
  Node,
  SourceFile,
  SourceProgramQueries,
  Symbol as SourceSymbol,
} from "@tsonic/tsts";
import { createSourceDeclarationReferenceSelector } from "./reference-selection.js";
import { referenceQueryNode } from "./syntax.js";
import type { SourceDeclarationReference, SourceReferenceIndexStatistics } from "./types.js";

const noSourceReferences: readonly Node[] = Object.freeze([]);
const resolvingReference = Symbol("resolving-source-reference");

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
  referencesForSymbol(symbol: SourceSymbol): readonly Node[];
}

interface SourceReverseReferences {
  readonly statistics: SourceReferenceIndexStatistics;
  readonly byDeclaration: ReadonlyMap<Node, readonly Node[]>;
  readonly bySymbol: ReadonlyMap<SourceSymbol, readonly Node[]>;
}

const defaultSourceReferenceIndexLimits: SourceReferenceIndexLimits = Object.freeze({
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
  source: SourceProgramQueries,
  sourceFiles: readonly SourceFile[],
  isProjectDeclaration: (declaration: Node | undefined) => boolean,
  requestedLimits: SourceReferenceIndexLimits = defaultSourceReferenceIndexLimits,
): SourceDeclarationReferenceIndex {
  const limits = snapshotLimits(requestedLimits);
  if (sourceFiles.length > limits.sourceFiles) {
    throw sourceReferenceLimitError("source files", limits.sourceFiles);
  }
  const { ast } = source;
  const files = Object.freeze([...sourceFiles]);
  const fileSet = new Set(files);
  const byReference = new WeakMap<Node, SourceDeclarationReference | null | typeof resolvingReference>();
  const byDeclaration = new Map<Node, Map<SourceSymbol | undefined, SourceDeclarationReference>>();
  let referenceCandidates = 0;
  let selectedReferences = 0;
  let moduleExportsExamined = 0;
  let reverse: SourceReverseReferences | undefined;
  let buildingReverse = false;
  let failure: { readonly error: unknown } | undefined;
  const selectReference = createSourceDeclarationReferenceSelector(ast, isProjectDeclaration, count => {
    moduleExportsExamined = reserveAmount(moduleExportsExamined, count,
      limits.moduleExportsExamined, "module exports examined");
  });

  const assertActive = (): void => {
    if (failure !== undefined) throw failure.error;
    const first = files[0];
    if (first === undefined) source.getSourceFiles();
    else source.getSourceFileQueries(first);
  };

  const select = (node: Node): SourceDeclarationReference | undefined => {
    const cached = byReference.get(node);
    if (cached === resolvingReference) {
      throw new Error("Cyclic source reference selection for one exact source occurrence.");
    }
    if (cached !== undefined) return cached ?? undefined;
    referenceCandidates = reserveCount(referenceCandidates, limits.referenceCandidates, "reference candidates");
    byReference.set(node, resolvingReference);
    const file = ast.getSourceFile(node);
    if (file === undefined || !fileSet.has(file)) {
      throw new Error("Source reference selection requires an exact source file from its program.");
    }
    const selected = selectReference(source.getSourceFileQueries(file).checker, node);
    if (selected === undefined) {
      byReference.set(node, null);
      return undefined;
    }
    selectedReferences = reserveCount(selectedReferences, limits.selectedReferences, "selected references");
    let bySymbol = byDeclaration.get(selected.declaration);
    if (bySymbol === undefined) {
      if (byDeclaration.size >= limits.selectedDeclarations) {
        throw sourceReferenceLimitError("selected declarations", limits.selectedDeclarations);
      }
      bySymbol = new Map();
      byDeclaration.set(selected.declaration, bySymbol);
    }
    const existing = bySymbol.get(selected.symbol);
    if (existing !== undefined && (existing.declaration !== selected.declaration ||
        existing.sourceFile !== selected.sourceFile || existing.project !== selected.project)) {
      throw new Error("Source reference selection produced conflicting facts for one exact declaration and symbol.");
    }
    const canonical = existing ?? selected;
    if (existing === undefined) bySymbol.set(selected.symbol, canonical);
    byReference.set(node, canonical);
    return canonical;
  };

  const complete = (): SourceReverseReferences => {
    if (reverse !== undefined) return reverse;
    if (buildingReverse) throw new Error("Cyclic source reverse-reference index construction.");
    buildingReverse = true;
    const pendingByDeclaration = new Map<Node, Node[]>();
    const pendingDeclarationsBySymbol = new Map<SourceSymbol, Set<Node>>();
    const visitedReferences = new WeakSet<Node>();
    let nodesVisited = 0;
    let reverseEdges = 0;
    for (const file of files) {
      const pending: Node[] = [file];
      while (pending.length > 0) {
        const node = pending.pop();
        if (node === undefined) continue;
        nodesVisited = reserveCount(nodesVisited, limits.nodesVisited, "visited nodes");
        if (referenceQueryNode(ast, node) === node) {
          if (visitedReferences.has(node)) {
            throw new Error("One exact source occurrence was visited more than once while building the source reference index.");
          }
          visitedReferences.add(node);
          const selected = select(node);
          if (selected !== undefined && ast.name(selected.declaration) !== node) {
            reverseEdges = reserveCount(reverseEdges, limits.reverseEdges, "reverse reference edges");
            const references = pendingByDeclaration.get(selected.declaration);
            if (references === undefined) pendingByDeclaration.set(selected.declaration, [node]);
            else references.push(node);
            if (selected.symbol !== undefined) {
              let declarations = pendingDeclarationsBySymbol.get(selected.symbol);
              if (declarations === undefined) {
                if (pendingDeclarationsBySymbol.size >= limits.indexedSymbols) {
                  throw sourceReferenceLimitError("indexed symbols", limits.indexedSymbols);
                }
                declarations = new Set();
                pendingDeclarationsBySymbol.set(selected.symbol, declarations);
              }
              declarations.add(selected.declaration);
            }
          }
        }
        const children = ast.children(node);
        for (let index = children.length - 1; index >= 0; index -= 1) {
          const child = children[index];
          if (child !== undefined) pending.push(child);
        }
      }
    }
    for (const references of pendingByDeclaration.values()) Object.freeze(references);
    const bySymbol = new Map<SourceSymbol, readonly Node[]>();
    for (const [symbol, declarations] of pendingDeclarationsBySymbol) {
      const selected = [...declarations];
      const sole = selected.length === 1 ? selected[0] : undefined;
      bySymbol.set(symbol, sole === undefined
        ? Object.freeze(selected.flatMap(declaration => pendingByDeclaration.get(declaration) ?? noSourceReferences))
        : pendingByDeclaration.get(sole) ?? noSourceReferences);
    }
    reverse = Object.freeze({
      byDeclaration: pendingByDeclaration,
      bySymbol,
      statistics: Object.freeze({
        constructionPasses: 1,
        sourceFiles: files.length,
        nodesVisited,
        referenceCandidates,
        selectedReferences,
        selectedDeclarations: byDeclaration.size,
        reverseEdges,
        indexedSymbols: bySymbol.size,
        moduleExportsExamined,
      }),
    });
    buildingReverse = false;
    return reverse;
  };

  const query = <Result>(operation: () => Result): Result => {
    assertActive();
    try {
      return operation();
    } catch (error) {
      failure = { error };
      throw error;
    }
  };

  return Object.freeze({
    get statistics() { return query(() => complete().statistics); },
    sourceReferenceFor(node: Node | undefined) {
      return query(() => {
        if (node === undefined) return undefined;
        const file = ast.getSourceFile(node);
        if (file === undefined || !fileSet.has(file)) return undefined;
        const subject = referenceQueryNode(ast, node);
        return subject === undefined ? undefined : select(subject);
      });
    },
    referencesToDeclaration(declaration: Node | undefined) {
      return query(() => declaration === undefined
        ? noSourceReferences : complete().byDeclaration.get(declaration) ?? noSourceReferences);
    },
    referencesForSymbol(symbol: SourceSymbol) {
      return query(() => complete().bySymbol.get(symbol) ?? noSourceReferences);
    },
  });
}

function snapshotLimits(input: SourceReferenceIndexLimits): SourceReferenceIndexLimits {
  const fields = Object.keys(defaultSourceReferenceIndexLimits) as (keyof SourceReferenceIndexLimits)[];
  if (typeof input !== "object" || input === null ||
      Object.getPrototypeOf(input) !== Object.prototype && Object.getPrototypeOf(input) !== null ||
      Reflect.ownKeys(input).length !== fields.length) {
    throw new Error("Source reference index limits require the complete plain data budget family.");
  }
  const limits = {} as Record<keyof SourceReferenceIndexLimits, number>;
  for (const name of fields) {
    const descriptor = Object.getOwnPropertyDescriptor(input, name);
    const value: unknown = descriptor !== undefined && "value" in descriptor ? descriptor.value : undefined;
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
      throw new Error(`Source reference index limit '${name}' must be a positive safe integer.`);
    }
    limits[name] = value;
  }
  return Object.freeze(limits);
}

function reserveCount(current: number, limit: number, subject: string): number {
  if (!Number.isSafeInteger(current) || current < 0 || current >= limit) {
    throw sourceReferenceLimitError(subject, limit);
  }
  return current + 1;
}

function reserveAmount(current: number, amount: number, limit: number, subject: string): number {
  if (!Number.isSafeInteger(current) || current < 0 || !Number.isSafeInteger(amount) ||
      amount < 0 || current > limit - amount) {
    throw sourceReferenceLimitError(subject, limit);
  }
  return current + amount;
}

function sourceReferenceLimitError(subject: string, limit: number): Error {
  return new Error(`Source reference index exceeds the ${limit.toLocaleString("en-US")} ${subject} limit.`);
}
