// host-input/semantics-program: the per-file checker views (SourceProgramSemantics) that the other host-input
// translators open (invariant I3). Built once per program by createHostSourceProgram; never part of HostSourceProgram,
// never reachable from source-semantics, source-navigation, object-facts or target-analysis.
// Moved from source-semantics/target-source-program.ts (B5) and pruned to the members host-input reads.
import type { CheckedSourceProgram, Node, Signature, SourceFile, Symbol, Type } from "@tsonic/tsts";
import type { SourceProgramNavigation } from "../source-navigation/types.js";
import type { SourceEnumConstantIndex } from "../source-semantics/enum-model.js";
import type { SourceFlowConditions } from "../source-semantics/value-flow-model.js";
import type { SourcePropertyNameIndex } from "../source-semantics/property-names-model.js";
import { selectSourceProviderSignature, type SourceProviderSignatureSelection } from "../source-semantics/provider-signature.js";
import { aliasedSymbol, referenceDeclarationForMeaning, symbolAtReferenceNode } from "./navigation-references.js";
import { createSourceDeclarationSymbolQuery, type ResolvedSourceCallInfo } from "./navigation-checker.js";
import { authoredSourceTypeFactDependencies } from "./semantics-authored-type-facts.js";
import { selectAuthoredSourceType } from "./semantics-authored-type-selection.js";
import { selectSourceCallResult } from "./semantics-call-result-selection.js";
import { selectSourceContextualType, selectSourceContextualValueType } from "./semantics-contextual-type-selection.js";
import { sourceSelectedFactSubjects, sourceTypeFactSubjects } from "./semantics-fact-subjects.js";
import { selectSourceCallableTypeEvidence } from "./semantics-callable-evidence.js";
import { getSourceTypeArgumentBindings } from "./semantics-type-arguments.js";
import { selectSourceTypeRefinement } from "./semantics-type-refinement.js";
import { selectRefinedSourcePropertyAccess } from "./semantics-property-refinement.js";
import { normalizeSourcePropertyAccessDeclarations } from "./semantics-selected-property-declarations.js";
import { sourceTypeRelationship } from "./semantics-type-relationship.js";
import { createSourceStructuralMemberQueries } from "./semantics-structural-members.js";
import { analyzeSourcePropertyNames } from "./semantics-property-names.js";
import type { SourceFileSemantics, SourceFinalTypeQueries, SourceProgramSemantics, SourceValueTypeRefinementSelection } from "./semantics-types.js";

export interface SourceSemanticsInputServices {
  readonly navigation: SourceProgramNavigation;
  /** The Host enum constant facts (source-semantics/enum-constants.ts); property names read enum member keys from them. */
  readonly enumConstants: SourceEnumConstantIndex;
}

/** The program's checker views plus the flow-condition witness translator. One instance per program (R4, I5). */
export interface SourceSemanticsInput {
  readonly semantics: SourceProgramSemantics;
  /** The checker's flow-condition witness at a reference, as a Node-only Host record (no retention applied). */
  flowConditions(reference: Node): SourceFlowConditions | undefined;
  /** The property-name facts of one checked file (checker-free records). */
  propertyNames(sourceFile: SourceFile): SourcePropertyNameIndex;
}

export function createSourceSemanticsInput(
  source: CheckedSourceProgram,
  services: SourceSemanticsInputServices,
): SourceSemanticsInput {
  const { navigation, enumConstants } = services;
  // One checked type identity per expression node for this program. The checker builds a new anonymous Type for an
  // object literal on every getTypeAtLocation call; every host-input consumer that keys or compares checked types by
  // identity (shape caches, member correspondence) needs the same Type object for the same node.
  const expressionTypes = new WeakMap<Node, Type>();
  const sourceFileSet = new Set(source.sourceFiles.filter((file): file is SourceFile => file !== undefined));
  const declarationSymbol = createSourceDeclarationSymbolQuery(source, navigation.referencesToDeclaration);
  const cache = new WeakMap<SourceFile, SourceFileSemantics>();
  const providerSignatures = new WeakMap<Node, SourceProviderSignatureSelection | null>();
  const providerSignature = (declaration: Node | undefined): SourceProviderSignatureSelection | undefined => {
    if (declaration === undefined) return undefined;
    const existing = providerSignatures.get(declaration);
    if (existing !== undefined) return existing ?? undefined;
    const selected = selectSourceProviderSignature(source.sourceFacts, declaration);
    providerSignatures.set(declaration, selected ?? null);
    return selected;
  };

  function createFileView(sourceFile: SourceFile) {
    const queries = source.getSourceFileQueries(sourceFile);
    const operations = Object.freeze({
      call: queries.checker.getResolvedCallInfo,
      propertyName: queries.checker.getEffectivePropertyName,
      propertyAccess(node: Node) {
        const checked = queries.checker.getResolvedPropertyAccessInfo(node);
        const selected = checked === undefined ? undefined :
          normalizeSourcePropertyAccessDeclarations(source.ast, forFile(sourceFile), checked);
        return selected === undefined || selected.selectedDeclaration !== undefined || selected.accessMode !== "read"
          ? selected
          : selectRefinedSourcePropertyAccess(selected,
            selectValueTypeRefinement(selected.receiver.expression), queries.checker, queries.typeShape, source.sourceFacts, source.ast);
      },
      elementAccess: queries.checker.getResolvedElementAccessInfo,
      iteration: queries.checker.getResolvedIterationInfo,
      objectLiteralElement: queries.checker.getResolvedObjectLiteralElementInfo,
      storage: queries.checker.getResolvedStorageInfo,
      callableCompletion: queries.checker.getResolvedCallableCompletionInfo,
      generator: queries.checker.getResolvedGeneratorInfo,
      wellKnownSymbol: queries.checker.getResolvedWellKnownSymbolInfo,
      resourceManagement: queries.checker.getResolvedResourceManagementInfo,
      yield: queries.checker.getResolvedYieldInfo,
      callResult(call: ResolvedSourceCallInfo) {
        return selectSourceCallResult(source.ast, queries.checker, call, providerSignature);
      },
    });
    const declarations = Object.freeze({
      authoredTypeDeclaration(node: Node) {
        const reference = source.ast.is.IsTypeReferenceNode(node) ? source.ast.as.AsTypeReferenceNode(node)?.TypeName
          : source.ast.is.IsImportTypeNode(node) ? source.ast.as.AsImportTypeNode(node)?.Qualifier : undefined;
        const symbol = reference === undefined ? undefined : symbolAtReferenceNode(source.ast, queries.checker, reference);
        return referenceDeclarationForMeaning(source.ast, queries.checker,
          aliasedSymbol(source.ast, queries.checker, symbol) ?? symbol, "type");
      },
      isDefaultLibraryDeclaration: queries.checker.isDefaultLibraryDeclaration,
      declaredValueType(declaration: Node) {
        if (source.ast.is.IsClassExpression(declaration)) return queries.checker.getTypeAtLocation(declaration);
        return queries.checker.getTypeOfSymbol(declarationSymbol(declaration, sourceFile));
      },
      declaredType(declaration: Node) {
        const symbol = source.ast.is.IsClassExpression(declaration)
          ? queries.checker.getTypeSymbol(queries.checker.getTypeAtLocation(declaration))
          : declarationSymbol(declaration, sourceFile);
        return queries.checker.getDeclaredTypeOfSymbol(symbol);
      },
      typeSymbol: queries.checker.getTypeSymbol,
      typeAliasSymbol: queries.checker.getTypeAliasSymbol,
      aliasedSymbol: queries.checker.getAliasedSymbol,
      symbolDeclarations(symbol: Symbol) {
        return definedValues(queries.checker.getSymbolDeclarations(symbol));
      },
      primarySymbolDeclaration: queries.checker.getPrimarySymbolDeclaration,
      rootSymbols(symbol: Symbol) {
        return definedValues(queries.checker.getRootSymbols(symbol));
      },
      declarationSignature: queries.checker.getSignatureFromDeclaration,
      signatureDeclaration: queries.checker.getSignatureDeclaration,
      signatureParameters(signature: Signature) {
        return definedValues(queries.checker.getSignatureParameters(signature));
      },
    });
    const facts = Object.freeze({
      authoredTypeSubjects(node: Node) {
        return authoredSourceTypeFactDependencies(source.ast, navigation, source.sourceFacts, queries.checker, node);
      },
      selectedSubjects(symbol: Symbol | undefined, declaration: Node | undefined) {
        return sourceSelectedFactSubjects(queries.checker, symbol, declaration);
      },
      typeSubjects(type: Type) {
        return sourceTypeFactSubjects(queries.checker, type);
      },
    });
    const types: SourceFinalTypeQueries = Object.freeze({
      expressionType(node: Node): Type | undefined {
        const known = expressionTypes.get(node);
        if (known !== undefined) return known;
        const selected = queries.checker.getTypeAtLocation(node);
        if (selected !== undefined) expressionTypes.set(node, selected);
        return selected;
      },
      awaitedType: queries.checker.getAwaitedType,
      authoredType: queries.checker.getTypeFromTypeNode,
      contextualType(node: Node) {
        return selectSourceContextualType(source.ast, queries.checker, forFile(sourceFile), node);
      },
      typeArgumentBindings(type: Type) {
        return getSourceTypeArgumentBindings(source.ast, queries, type);
      },
      instantiatedBaseTypes: queries.typeShape.getInstantiatedBaseTypes,
      instantiateAlias: queries.typeShape.instantiateTypeAlias,
      aliasApplication: queries.typeShape.getTypeAliasApplication,
      typeArguments(type: Type) {
        return definedValues(queries.typeShape.getTypeArguments(type));
      },
      typeReferenceTarget: queries.typeShape.getTypeReferenceTarget,
      tupleElementTypes(type: Type) {
        return definedValues(queries.typeShape.getTupleElementTypes(type));
      },
      tupleElementInfos: queries.typeShape.getTupleElementInfos,
      unionOrIntersectionTypes(type: Type) {
        return definedValues(queries.typeShape.getUnionOrIntersectionTypes(type));
      },
      propertyInfos: queries.typeShape.getPropertyInfos,
      ...createSourceStructuralMemberQueries(source.ast, queries.checker, queries.typeShape),
      indexInfos: queries.typeShape.getIndexInfos,
      selectIndexedAccess: queries.typeShape.selectIndexedAccess,
      callSignatures(type: Type) {
        return definedValues(queries.typeShape.getCallSignatures(type));
      },
      constructSignatures(type: Type) {
        return definedValues(queries.typeShape.getConstructSignatures(type));
      },
      signatureInfos: queries.typeShape.getSignatureInfos,
      declarationSignatureInfo: queries.typeShape.getDeclarationSignatureInfo,
      literalBaseType: queries.typeShape.getBaseTypeOfLiteralType,
      nonNullableType: queries.typeShape.getNonNullableType,
      numericLiteralValue: queries.typeShape.getNumericLiteralTypeValue,
      stringLiteralValue: queries.typeShape.getStringLiteralTypeValue,
      booleanLiteralValue: queries.typeShape.getBooleanLiteralTypeValue,
      isAny: queries.typeShape.isAny,
      isUnknown: queries.typeShape.isUnknown,
      isNever: queries.typeShape.isNever,
      intrinsicNullishFlags: queries.typeShape.intrinsicNullishFlags,
      isNonPrimitive: queries.typeShape.isNonPrimitive,
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
        return selectAuthoredSourceType(source.ast, queries.typeShape, queries.checker, source.sourceFacts,
          authoredTypeNode, selectedType, forFile(sourceFile));
      },
      contextualValueSelection(node: Node) {
        return selectSourceContextualValueType(source.ast, queries.typeShape, queries.checker, forFile(sourceFile), node);
      },
      refinement(declaredType: Type, selectedType: Type) {
        return selectSourceTypeRefinement(queries.typeShape, queries.checker, source.sourceFacts, declaredType, selectedType);
      },
      relationship(left: Type, right: Type) {
        return sourceTypeRelationship(queries.typeShape, queries.checker, source.sourceFacts, left, right);
      },
      callable(type: Type) {
        return selectSourceCallableTypeEvidence(type,
          Object.freeze({ ...types, signatureDeclaration: declarations.signatureDeclaration }), source.ast);
      },
    });
    return Object.freeze({
      sourceFile,
      propertyNameOperations: Object.freeze({
        propertyName: queries.checker.getEffectivePropertyName,
        objectLiteralElement: queries.checker.getResolvedObjectLiteralElementInfo,
        propertyAccess: queries.checker.getResolvedPropertyAccessInfo,
        elementAccess: queries.checker.getResolvedElementAccessInfo,
        wellKnownSymbol: queries.checker.getResolvedWellKnownSymbolInfo,
        call: queries.checker.getResolvedCallInfo,
        callResult: operations.callResult,
      }),
      operations,
      types,
      declarations,
      facts,
    });
  }

  function publishFileViews(fileViews: readonly ReturnType<typeof createFileView>[]): void {
    const propertyNames = analyzeSourcePropertyNames(source.ast, fileViews.map(view => ({
      sourceFile: view.sourceFile,
      semantics: { operations: view.propertyNameOperations, types: view.types, declarations: view.declarations },
    })), navigation, enumConstants);
    for (const [index, view] of fileViews.entries()) {
      cache.set(view.sourceFile, Object.freeze({ sourceFile: view.sourceFile,
        propertyNames: propertyNames[index]!.propertyNames, operations: view.operations,
        types: view.types, declarations: view.declarations, facts: view.facts }));
    }
  }

  publishFileViews([...sourceFileSet].map(createFileView));

  function forFile(sourceFile: SourceFile): SourceFileSemantics {
    if (!source.containsSourceFile(sourceFile)) throw new Error("Source semantics require an exact source file from the checked program.");
    if (!cache.has(sourceFile)) publishFileViews([createFileView(sourceFile)]);
    return cache.get(sourceFile)!;
  }

  const forNode = (node: Node): SourceFileSemantics => {
    const sourceFile = source.ast.getSourceFile(node);
    if (sourceFile === undefined) throw new Error("Source semantics require every source node to belong to the checked program.");
    return forFile(sourceFile);
  };

  const selectValueTypeRefinement = (node: Node): SourceValueTypeRefinementSelection => {
    const reference = navigation.referenceFor(node);
    if (reference === undefined) return Object.freeze({ kind: "not-project-reference" });
    const selectedSemantics = forNode(node);
    const declaredType = selectedSemantics.declarations.declaredValueType(reference.declaration);
    if (declaredType === undefined) return Object.freeze({ kind: "unresolved", reference, missing: "declared-type" });
    const selectedType = selectedSemantics.types.expressionType(node);
    if (selectedType === undefined) return Object.freeze({ kind: "unresolved", reference, missing: "selected-type" });
    return Object.freeze({ kind: "resolved", reference, declaredType, selectedType,
      refinement: selectedSemantics.types.refinement(declaredType, selectedType) });
  };

  const semantics: SourceProgramSemantics = Object.freeze({
    includes: (sourceFile: SourceFile) => sourceFileSet.has(sourceFile),
    forFile,
    forNode,
    selectValueTypeRefinement,
  });

  const flowConditionWitnesses = new WeakMap<Node, SourceFlowConditions | null>();
  return Object.freeze({
    semantics,
    propertyNames: (sourceFile: SourceFile) => forFile(sourceFile).propertyNames,
    flowConditions(reference: Node): SourceFlowConditions | undefined {
      const known = flowConditionWitnesses.get(reference);
      if (known !== undefined) return known ?? undefined;
      const checked = source.getSourceFileQueries(source.ast.getSourceFile(reference)).checker.getResolvedFlowConditionInfo(reference);
      const witness = checked === undefined || checked.reference !== reference ? undefined : Object.freeze({
        reference,
        conditions: Object.freeze(checked.conditions.map(condition => Object.freeze({
          expression: condition.expression, assumed: condition.assumed,
          assignments: Object.freeze([...condition.assignments]),
        }))),
      });
      flowConditionWitnesses.set(reference, witness ?? null);
      return witness;
    },
  });
}

function definedValues<T>(values: readonly (T | undefined)[]): readonly T[] {
  return Object.freeze(values.filter((value): value is T => value !== undefined));
}
