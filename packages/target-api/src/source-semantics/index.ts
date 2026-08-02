import type {
  CheckedSourceProgram,
  Node,
  SourceFile,
} from "@tsonic/tsts";
import {
  createSourceProgramNavigation,
} from "../source-navigation/index.js";
import type {
  SourceFileSemantics,
  SourceProgramSemantics,
  TargetSourceProgram,
} from "./types.js";

export function createTargetSourceProgram(
  source: CheckedSourceProgram,
): TargetSourceProgram {
  const sourceFiles = Object.freeze(
    source.sourceFiles.filter(
      (sourceFile): sourceFile is SourceFile => sourceFile !== undefined,
    ),
  );
  const sourceFileSet = new Set(sourceFiles);
  const cache = new WeakMap<SourceFile, SourceFileSemantics>();

  const forFile = (sourceFile: SourceFile): SourceFileSemantics => {
    if (!sourceFileSet.has(sourceFile)) {
      throw new Error(
        "Source semantics require an exact source file from the checked program.",
      );
    }
    const existing = cache.get(sourceFile);
    if (existing !== undefined) {
      return existing;
    }
    const queries = source.getSourceFileQueries(sourceFile);
    const semantics = Object.freeze({
      sourceFile,
      ...queries.checker,
      ...queries.typeShape,
    }) satisfies SourceFileSemantics;
    cache.set(sourceFile, semantics);
    return semantics;
  };

  const forNode = (node: Node): SourceFileSemantics => {
    const sourceFile = source.ast.getSourceFile(node);
    if (sourceFile === undefined) {
      throw new Error(
        "Source semantics require every source node to belong to the checked program.",
      );
    }
    return forFile(sourceFile);
  };

  const semantics: SourceProgramSemantics = Object.freeze({
    forFile,
    forNode,
  });

  return Object.freeze({
    ast: source.ast,
    sourceFiles,
    sourceFacts: source.sourceFacts,
    navigation: createSourceProgramNavigation(source),
    semantics,
  });
}

export type {
  SourceFileSemantics,
  SourceProgramSemantics,
  TargetSourceProgram,
} from "./types.js";
