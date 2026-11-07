import type { AstReader, Node, SourceFile } from "@tsonic/tsts";
import type { SourceNavigationInput } from "../source-model/navigation-records.js";
import { referenceQueryNode } from "../source-model/syntax.js";
import type { SourceDeclarationReference, SourceReferenceIndexStatistics } from "./types.js";

const noSourceReferences: readonly Node[] = Object.freeze([]);

export interface SourceReferenceIndexLimits {
  readonly sourceFiles: number;
  readonly nodesVisited: number;
  readonly referenceCandidates: number;
  readonly selectedReferences: number;
  readonly selectedDeclarations: number;
  readonly reverseEdges: number;
  readonly moduleExportsExamined: number;
}

export interface SourceDeclarationReferenceIndex {
  readonly statistics: SourceReferenceIndexStatistics;
  sourceReferenceFor(node: Node | undefined): SourceDeclarationReference | undefined;
  referencesToDeclaration(declaration: Node | undefined): readonly Node[];
}

interface BuiltSourceDeclarationReferenceIndex {
  readonly statistics: SourceReferenceIndexStatistics;
  readonly byReference: WeakMap<Node, SourceDeclarationReference>;
  readonly referencesByDeclaration: ReadonlyMap<Node, readonly Node[]>;
}

const defaultSourceReferenceIndexLimits: SourceReferenceIndexLimits =
  Object.freeze({
    sourceFiles: 65_536,
    nodesVisited: 16_777_216,
    referenceCandidates: 8_388_608,
    selectedReferences: 4_194_304,
    selectedDeclarations: 2_097_152,
    reverseEdges: 4_194_304,
    moduleExportsExamined: 4_194_304,
  });

/**
 * The reverse reference index, built in one pass over the project files. Each reference occurrence is keyed by the
 * declaration host-input selects for it (I3); one canonical reference record per declaration.
 */
export function createSourceDeclarationReferenceIndex(
  input: SourceNavigationInput,
  sourceFiles: readonly SourceFile[],
  isProjectDeclaration: (declaration: Node | undefined) => boolean,
  requestedLimits: SourceReferenceIndexLimits = defaultSourceReferenceIndexLimits,
): SourceDeclarationReferenceIndex {
  const limits = snapshotLimits(requestedLimits);
  if (sourceFiles.length > limits.sourceFiles) {
    throw sourceReferenceLimitError("source files", limits.sourceFiles);
  }
  const built = buildSourceDeclarationReferenceIndex(input, sourceFiles, isProjectDeclaration, limits);
  return sealSourceDeclarationReferenceIndex(input.ast, new Set(sourceFiles), built);
}

function buildSourceDeclarationReferenceIndex(
  input: SourceNavigationInput,
  sourceFiles: readonly SourceFile[],
  isProjectDeclaration: (declaration: Node | undefined) => boolean,
  limits: SourceReferenceIndexLimits,
): BuiltSourceDeclarationReferenceIndex {
  const { ast } = input;
  const byReference = new WeakMap<Node, SourceDeclarationReference>();
  const pendingByDeclaration = new Map<Node, Node[]>();
  const canonicalByDeclaration = new Map<Node, SourceDeclarationReference>();
  let nodesVisited = 0;
  let referenceCandidates = 0;
  let selectedReferences = 0;
  let reverseEdges = 0;
  let moduleExportsExamined = 0;
  const reserveModuleExports = (count: number): void => {
    moduleExportsExamined = reserveAmount(moduleExportsExamined, count, limits.moduleExportsExamined, "module exports examined");
  };

  const record = (referenceNode: Node, declaration: Node, sourceFile: SourceFile): void => {
    if (byReference.has(referenceNode)) {
      throw new Error(
        "One exact source occurrence was visited more than once while building the source reference index.",
      );
    }
    selectedReferences = reserveCount(selectedReferences, limits.selectedReferences, "selected references");
    let canonical = canonicalByDeclaration.get(declaration);
    if (canonical === undefined) {
      if (canonicalByDeclaration.size >= limits.selectedDeclarations) {
        throw sourceReferenceLimitError("selected declarations", limits.selectedDeclarations);
      }
      canonical = Object.freeze({ declaration, sourceFile, project: isProjectDeclaration(declaration) });
      canonicalByDeclaration.set(declaration, canonical);
    } else if (canonical.sourceFile !== sourceFile) {
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
    } else {
      declarationReferences.push(referenceNode);
    }
  };

  for (const sourceFile of sourceFiles) {
    const pending: Node[] = [sourceFile];
    while (pending.length > 0) {
      const node = pending.pop();
      if (node === undefined) {
        continue;
      }
      nodesVisited = reserveCount(nodesVisited, limits.nodesVisited, "visited nodes");
      if (referenceQueryNode(ast, node) === node) {
        referenceCandidates = reserveCount(referenceCandidates, limits.referenceCandidates, "reference candidates");
        const selected = input.reference(node, reserveModuleExports);
        if (selected !== undefined) {
          record(node, selected.declaration, selected.sourceFile);
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
  const statistics: SourceReferenceIndexStatistics = Object.freeze({
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
  });
}

function snapshotLimits(input: SourceReferenceIndexLimits): SourceReferenceIndexLimits {
  const fields = Object.keys(defaultSourceReferenceIndexLimits) as (keyof SourceReferenceIndexLimits)[];
  if (
    typeof input !== "object" || input === null ||
    Object.getPrototypeOf(input) !== Object.prototype && Object.getPrototypeOf(input) !== null ||
    Reflect.ownKeys(input).length !== fields.length
  ) {
    throw new Error("Source reference index limits require the complete plain data budget family.");
  }
  const limits = {} as Record<keyof SourceReferenceIndexLimits, number>;
  for (const name of fields) {
    const descriptor = Object.getOwnPropertyDescriptor(input, name);
    const value: unknown = descriptor !== undefined && "value" in descriptor ? descriptor.value : undefined;
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
      throw new Error(
        `Source reference index limit '${name}' must be a positive safe integer.`,
      );
    }
    limits[name] = value;
  }
  return Object.freeze(limits);
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
