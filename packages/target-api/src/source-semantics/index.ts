import type {
  CheckedSourceProgram,
  Node,
  SourceFile,
  Symbol,
  Type,
} from "@tsonic/tsts";
import {
  createSourceProgramNavigation,
} from "../source-navigation/index.js";
import type {
  SourceFileSemantics,
  SourceProgramSemantics,
  TargetSourceProgram,
} from "./types.js";
import {
  selectAuthoredSourceType,
} from "./authored-type-selection.js";
import {
  selectSourceContextualValueType,
} from "./contextual-type-selection.js";
import {
  getEffectiveSourceTypeArguments,
} from "./type-arguments.js";
import {
  sourceSelectedFactSubjects,
  sourceTypeFactSubjects,
} from "./fact-subjects.js";
import {
  sourceTypeRelationship,
} from "./type-relationship.js";
import {
  selectSourceTypeRefinement,
} from "./type-refinement.js";

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
      getEffectiveTypeArguments(type: Type) {
        return getEffectiveSourceTypeArguments(source.ast, queries, type);
      },
      getDeclaredValueType(declaration: Node) {
        const name = source.ast.name(declaration);
        const symbol = queries.checker.getSymbolAtLocation(name ?? declaration);
        return queries.checker.getTypeOfSymbol(symbol);
      },
      selectAuthoredType(authoredTypeNode: Node, selectedType: Type) {
        return selectAuthoredSourceType(
          source.ast,
          queries.typeShape,
          queries.checker,
          source.sourceFacts,
          authoredTypeNode,
          selectedType,
        );
      },
      selectContextualValueType(node: Node) {
        return selectSourceContextualValueType(
          queries.typeShape,
          queries.checker,
          node,
        );
      },
      getSelectedFactSubjects(
        symbol: Symbol | undefined,
        declaration: Node | undefined,
      ) {
        return sourceSelectedFactSubjects(
          queries.checker,
          symbol,
          declaration,
        );
      },
      getTypeFactSubjects(type: Type) {
        return sourceTypeFactSubjects(queries.checker, type);
      },
      selectTypeRefinement(declaredType: Type, selectedType: Type) {
        return selectSourceTypeRefinement(
          queries.typeShape,
          queries.checker,
          source.sourceFacts,
          declaredType,
          selectedType,
        );
      },
      getTypeRelationship(left: Type, right: Type) {
        return sourceTypeRelationship(
          queries.typeShape,
          queries.checker,
          source.sourceFacts,
          left,
          right,
        );
      },
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
    includes(sourceFile: SourceFile) {
      return sourceFileSet.has(sourceFile);
    },
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
  SourceAuthoredTypeSelection,
  SourceContextualValueTypeSelection,
  SourceFileSemantics,
  SourceProgramSemantics,
  SourceTypeRelationship,
  SourceTypeRefinement,
  TargetSourceProgram,
} from "./types.js";
