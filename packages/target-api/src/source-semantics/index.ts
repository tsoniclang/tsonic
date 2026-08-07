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
  SourceValueTypeRefinementSelection,
  TargetSourceProgram,
} from "./types.js";
import {
  selectAuthoredSourceType,
} from "./authored-type-selection.js";
import {
  authoredSourceTypeFactDependencies,
} from "./authored-type-facts.js";
import {
  selectSourceContextualValueType,
} from "./contextual-type-selection.js";
import {
  selectSourceCallResult,
} from "./call-result-selection.js";
import type {
  ResolvedSourceCallInfo,
} from "./call-result-selection.js";
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
import {
  createSourceProgramDocuments,
} from "./source-documents.js";

export {
  sourceTypeSyntaxIsCompositional,
} from "./type-syntax.js";

export function createTargetSourceProgram(
  source: CheckedSourceProgram,
): TargetSourceProgram {
  const sourceFiles = Object.freeze(
    source.sourceFiles.filter(
      (sourceFile): sourceFile is SourceFile => sourceFile !== undefined,
    ),
  );
  const sourceFileSet = new Set(sourceFiles);
  const documents = createSourceProgramDocuments(source.ast, sourceFiles);
  const navigation = createSourceProgramNavigation(source);
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
      getAuthoredTypeFactSubjects(node: Node) {
        return authoredSourceTypeFactDependencies(
          source.ast,
          navigation,
          source.sourceFacts,
          node,
        );
      },
      getDeclaredValueType(declaration: Node) {
        const name = source.ast.name(declaration);
        const symbol = queries.checker.getSymbolAtLocation(name ?? declaration);
        return queries.checker.getTypeOfSymbol(symbol);
      },
      selectCallResult(call: ResolvedSourceCallInfo) {
        return selectSourceCallResult(source.ast, queries.checker, call);
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

  const selectValueTypeRefinement = (
    node: Node,
  ): SourceValueTypeRefinementSelection => {
    const reference = navigation.referenceFor(node);
    if (reference === undefined) {
      return Object.freeze({ kind: "not-project-reference" });
    }
    const declaredType = forFile(reference.sourceFile)
      .getDeclaredValueType(reference.declaration);
    if (declaredType === undefined) {
      return Object.freeze({
        kind: "unresolved",
        reference,
        missing: "declared-type",
      });
    }
    const selectedSemantics = forNode(node);
    const selectedType = selectedSemantics.getTypeAtLocation(node);
    if (selectedType === undefined) {
      return Object.freeze({
        kind: "unresolved",
        reference,
        missing: "selected-type",
      });
    }
    return Object.freeze({
      kind: "resolved",
      reference,
      declaredType,
      selectedType,
      refinement: selectedSemantics.selectTypeRefinement(
        declaredType,
        selectedType,
      ),
    });
  };

  const semantics: SourceProgramSemantics = Object.freeze({
    includes(sourceFile: SourceFile) {
      return sourceFileSet.has(sourceFile);
    },
    forFile,
    forNode,
    selectValueTypeRefinement,
  });

  return Object.freeze({
    ast: source.ast,
    sourceFiles,
    documents,
    sourceFacts: source.sourceFacts,
    navigation,
    semantics,
  });
}

export type {
  ResolvedSourceCallInfo,
  SourceCallResultSelection,
} from "./call-result-selection.js";
export type {
  SourceAuthoredTypeSelection,
  SourceContextualValueTypeSelection,
  SourceAuthoredOccurrence,
  SourceDocument,
  SourceFileSemantics,
  SourceOccurrence,
  SourceOccurrenceLookup,
  SourceProgramSemantics,
  SourceProgramDocuments,
  SourceSyntheticOccurrence,
  SourceTypeRelationship,
  SourceTypeRefinement,
  SourceValueTypeRefinementSelection,
  TargetSourceProgram,
} from "./types.js";
