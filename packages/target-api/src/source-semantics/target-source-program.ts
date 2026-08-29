import type {
  CheckedSourceProgram,
  Node,
  Signature,
  SourceFile,
  Symbol,
  Type,
} from "@tsonic/tsts";
import { createSourceProgramNavigation } from "../source-navigation/index.js";
import { authoredSourceTypeFactDependencies, authoredSourceTypeFactNodes } from "./authored-type-facts.js";
import { selectAuthoredSourceType } from "./authored-type-selection.js";
import { selectSourceCallParameterSlots } from "./call-parameter-slots.js";
import { selectSourceCallResult } from "./call-result-selection.js";
import { selectSourceContextualTupleLiteral } from "./contextual-tuple-literal.js";
import { selectSourceContextualValueType } from "./contextual-type-selection.js";
import { sourceSelectedFactSubjects, sourceTypeFactSubjects } from "./fact-subjects.js";
import { createSourceProgramDocuments } from "./source-documents.js";
import { selectSourceCallableTypeEvidence, selectStandardSourceTypeTransformation } from "./standard-type-transformations.js";
import { getEffectiveSourceTypeArguments } from "./type-arguments.js";
import { selectSourceTypeRefinement } from "./type-refinement.js";
import { sourceTypeRelationship } from "./type-relationship.js";
import type {
  ResolvedSourceCallInfo,
  SourceFileSemantics,
  SourceFinalTypeQueries,
  SourceProgramSemantics,
  SourceValueTypeRefinementSelection,
  TargetSourceProgram,
} from "./types.js";

export {
  sourceTypeSyntaxIsCompositional,
} from "./type-syntax.js";
export {
  orderEnumerableOwnStringProperties,
} from "./enumerable-own-properties.js";
export {
  selectSourceObjectLiteralAccessors,
} from "./object-literal-accessors.js";
export {
  sourceCallableUsesLexicalThis,
} from "./lexical-this.js";
export type {
  SourceObjectLiteralAccessorMember,
  SourceObjectLiteralAccessorOccurrence,
  SourceObjectLiteralAccessorSelection,
} from "./object-literal-accessors.js";
export type {
  SourceCallParameterSlot,
} from "./call-parameter-slots.js";
export {
  sourcePropertyTypeEvidenceNodes,
  sourceTransformedTypeFactEvidenceNodes,
  sourceTupleElementTypeEvidenceNodes,
} from "./type-component-evidence.js";

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
      throw new Error("Source semantics require an exact source file from the checked program.");
    }
    const existing = cache.get(sourceFile);
    if (existing !== undefined) {
      return existing;
    }
    const queries = source.getSourceFileQueries(sourceFile);
    const operations = Object.freeze({
      call: queries.checker.getResolvedCallInfo,
      propertyAccess: queries.checker.getResolvedPropertyAccessInfo,
      elementAccess: queries.checker.getResolvedElementAccessInfo,
      iteration: queries.checker.getResolvedIterationInfo,
      objectLiteralElement: queries.checker.getResolvedObjectLiteralElementInfo,
      storage: queries.checker.getResolvedStorageInfo,
      generator: queries.checker.getResolvedGeneratorInfo,
      yield: queries.checker.getResolvedYieldInfo,
      wellKnownSymbol: queries.checker.getResolvedWellKnownSymbolInfo,
      resourceManagement: queries.checker.getResolvedResourceManagementInfo,
      callResult(call: ResolvedSourceCallInfo) {
        return selectSourceCallResult(source.ast, queries.checker, call);
      },
      callParameterSlots(call: ResolvedSourceCallInfo) {
        return selectSourceCallParameterSlots(call, queries.typeShape);
      },
    });
    const declarations = Object.freeze({
      declaredValueType(declaration: Node) {
        const name = source.ast.name(declaration);
        const symbol = queries.checker.getSymbolAtLocation(name ?? declaration);
        return queries.checker.getTypeOfSymbol(symbol);
      },
      declaredType(declaration: Node) {
        const name = source.ast.name(declaration);
        const symbol = queries.checker.getSymbolAtLocation(name ?? declaration);
        return queries.checker.getDeclaredTypeOfSymbol(symbol);
      },
      typeSymbol: queries.checker.getTypeSymbol,
      typeAliasSymbol: queries.checker.getTypeAliasSymbol,
      symbolName: queries.checker.getSymbolName,
      symbolDeclarations(symbol: Symbol) {
        return definedValues(queries.checker.getSymbolDeclarations(symbol));
      },
      primarySymbolDeclaration: queries.checker.getPrimarySymbolDeclaration,
      rootSymbols(symbol: Symbol) {
        return definedValues(queries.checker.getRootSymbols(symbol));
      },
      signatureDeclaration: queries.checker.getSignatureDeclaration,
      signatureParameters(signature: Signature) {
        return definedValues(queries.checker.getSignatureParameters(signature));
      },
    });
    const facts = Object.freeze({
      authoredTypeSubjects(node: Node) {
        return authoredSourceTypeFactDependencies(
          source.ast,
          navigation,
          source.sourceFacts,
          queries.checker,
          node,
        );
      },
      authoredTypeNodes(node: Node) {
        return authoredSourceTypeFactNodes(
          source.ast,
          navigation,
          source.sourceFacts,
          queries.checker,
          node,
        );
      },
      selectedSubjects(symbol: Symbol | undefined, declaration: Node | undefined) {
        return sourceSelectedFactSubjects(queries.checker, symbol, declaration);
      },
      typeSubjects(type: Type) {
        return sourceTypeFactSubjects(queries.checker, type);
      },
    });
    const types: SourceFinalTypeQueries = Object.freeze({
      expressionType: queries.checker.getTypeAtLocation,
      authoredType: queries.checker.getTypeFromTypeNode,
      contextualType: queries.checker.getContextualType,
      typeOfSymbol: queries.checker.getTypeOfSymbol,
      declaredSymbolType: queries.checker.getDeclaredTypeOfSymbol,
      writeSymbolType: queries.checker.getWriteTypeOfSymbol,
      effectiveTypeArguments(type: Type) {
        return getEffectiveSourceTypeArguments(source.ast, queries, type);
      },
      typeArguments(type: Type) {
        return definedValues(queries.typeShape.getTypeArguments(type));
      },
      substitutionBaseType: queries.typeShape.getSubstitutionBaseType,
      typeReferenceTarget: queries.typeShape.getTypeReferenceTarget,
      tupleElementTypes(type: Type) {
        return definedValues(queries.typeShape.getTupleElementTypes(type));
      },
      tupleElementInfos: queries.typeShape.getTupleElementInfos,
      unionOrIntersectionTypes(type: Type) {
        return definedValues(queries.typeShape.getUnionOrIntersectionTypes(type));
      },
      propertyInfos: queries.typeShape.getPropertyInfos,
      indexInfos: queries.typeShape.getIndexInfos,
      callSignatures(type: Type) {
        return definedValues(queries.typeShape.getCallSignatures(type));
      },
      constructSignatures(type: Type) {
        return definedValues(queries.typeShape.getConstructSignatures(type));
      },
      returnType: queries.typeShape.getReturnTypeOfSignature,
      signatureParameterInfos: queries.typeShape.getSignatureParameterInfos,
      signatureThisParameterInfo: queries.typeShape.getSignatureThisParameterInfo,
      apparentType: queries.typeShape.getApparentType,
      widenedType: queries.typeShape.getWidenedType,
      withoutMissingOrUndefined: queries.typeShape.removeMissingOrUndefined,
      constantValue: queries.typeShape.getConstantValue,
      isAny: queries.typeShape.isAny,
      isUnknown: queries.typeShape.isUnknown,
      isNever: queries.typeShape.isNever,
      isVoidLike: queries.typeShape.isVoidLike,
      isNullish: queries.typeShape.isNullish,
      isStringLike: queries.typeShape.isStringLike,
      isNumberLike: queries.typeShape.isNumberLike,
      isBooleanLike: queries.typeShape.isBooleanLike,
      isBigIntLike: queries.typeShape.isBigIntLike,
      isSymbolLike: queries.typeShape.isSymbolLike,
      isUnion: queries.typeShape.isUnion,
      isIntersection: queries.typeShape.isIntersection,
      isTypeReference: queries.typeShape.isTypeReference,
      isTuple: queries.typeShape.isTuple,
      isArrayLike: queries.typeShape.isArrayLike,
      isIdentical: queries.typeShape.isTypeIdenticalTo,
      couldContainTypeVariables: queries.typeShape.couldContainTypeVariables,
      authoredSelection(authoredTypeNode: Node, selectedType: Type) {
        return selectAuthoredSourceType(
          source.ast,
          queries.typeShape,
          queries.checker,
          source.sourceFacts,
          authoredTypeNode,
          selectedType,
        );
      },
      contextualValueSelection(node: Node) {
        return selectSourceContextualValueType(
          queries.typeShape,
          queries.checker,
          node,
        );
      },
      contextualTupleSelection(node: Node, presentElementCount: number) {
        return selectSourceContextualTupleLiteral(types, node, presentElementCount);
      },
      refinement(declaredType: Type, selectedType: Type) {
        return selectSourceTypeRefinement(
          queries.typeShape,
          queries.checker,
          source.sourceFacts,
          declaredType,
          selectedType,
        );
      },
      relationship(left: Type, right: Type) {
        return sourceTypeRelationship(
          queries.typeShape,
          queries.checker,
          source.sourceFacts,
          left,
          right,
        );
      },
      standardTransformation(authoredTypeNode: Node, selectedType: Type) {
        return selectStandardSourceTypeTransformation(
          { ast: source.ast, navigation, semanticsFor: forNode },
          authoredTypeNode,
          selectedType,
        );
      },
      callable(type: Type) {
        return selectSourceCallableTypeEvidence(
          type,
          Object.freeze({
            ...types,
            signatureDeclaration: declarations.signatureDeclaration,
          }),
          source.ast,
        );
      },
    });
    const semantics: SourceFileSemantics = Object.freeze({
      sourceFile,
      operations,
      types,
      declarations,
      facts,
    });
    cache.set(sourceFile, semantics);
    return semantics;
  };

  const forNode = (node: Node): SourceFileSemantics => {
    const sourceFile = source.ast.getSourceFile(node);
    if (sourceFile === undefined) {
      throw new Error("Source semantics require every source node to belong to the checked program.");
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
      .declarations.declaredValueType(reference.declaration);
    if (declaredType === undefined) {
      return Object.freeze({
        kind: "unresolved",
        reference,
        missing: "declared-type",
      });
    }
    const selectedSemantics = forNode(node);
    const selectedType = selectedSemantics.types.expressionType(node);
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
      refinement: selectedSemantics.types.refinement(declaredType, selectedType),
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

function definedValues<T>(values: readonly (T | undefined)[]): readonly T[] {
  return Object.freeze(values.filter((value): value is T => value !== undefined));
}

export type {
  ResolvedSourceCallInfo,
  SourceCallResultSelection,
} from "./call-result-selection.js";
export type {
  SourceAuthoredTypeSelection,
  SourceContextualValueTypeSelection,
  SourceContextualTupleLiteralSelection,
  SourceAuthoredOccurrence,
  SourceDocument,
  SourceFactSubjectQueries,
  SourceFileSemantics,
  SourceFinalTypeQueries,
  SourceOccurrence,
  SourceOccurrenceLookup,
  SourceOperationEvidenceQueries,
  SourceProgramSemantics,
  SourceProgramDocuments,
  SourceSelectedDeclarationQueries,
  SourceSyntheticOccurrence,
  SourceTypeRelationship,
  SourceTypeRefinement,
  SourceCallableTypeEvidence,
  SourceCallableParameterEvidence,
  SourceStandardTypeTransformation,
  SourceTypeComponentEvidence,
  SourceValueTypeRefinementSelection,
  TargetSourceProgram,
} from "./types.js";
