// host-input/semantics-types: the checker-typed per-file query interfaces (moved from source-semantics/types.ts, I3).
// Host-internal to host-input only.
import type {
  ExtensionFactSubject, Node, ResolvedSourceCallableCompletionInfo,
  ResolvedSourceGeneratorInfo,
  ResolvedSourceIterationInfo, ResolvedSourceObjectLiteralElementInfo,
  ResolvedSourcePropertyNameInfo, ResolvedSourceResourceManagementInfo, ResolvedSourceStorageInfo,
  ResolvedSourceWellKnownSymbolInfo, ResolvedSourceYieldInfo, SourceFile, Symbol,
  TypeSignatureParameterInfo, TypeTupleElementInfo, Type,
} from "@tsonic/tsts";
import type { SourceProjectReference } from "../source-navigation/types.js";
import type { SourceNavigationDeclarationQueries, SourceNavigationOperationQueries,
  SourceNavigationTypeQueries } from "./navigation-checker.js";
import type { SourceAuthoredTypeSelection } from "./semantics-authored-type-selection.js";
import type { SourceContextualValueTypeSelection } from "./semantics-contextual-type-selection.js";
import type { SourceTypeRelationship } from "./semantics-type-relationship.js";
import type { SourceTypeRefinement } from "./semantics-type-refinement.js";
import type { ResolvedSourceCallInfo, SourceCallResultSelection } from "./semantics-call-result-selection.js";

export interface SourceOperationEvidenceQueries extends SourceNavigationOperationQueries {
  propertyName(node: Node): ResolvedSourcePropertyNameInfo | undefined;
  iteration(node: Node): ResolvedSourceIterationInfo | undefined;
  objectLiteralElement(node: Node): ResolvedSourceObjectLiteralElementInfo | undefined;
  storage(node: Node): ResolvedSourceStorageInfo | undefined;
  callableCompletion(node: Node): ResolvedSourceCallableCompletionInfo | undefined;
  generator(node: Node): ResolvedSourceGeneratorInfo | undefined;
  wellKnownSymbol(node: Node): ResolvedSourceWellKnownSymbolInfo | undefined;
  resourceManagement(node: Node): ResolvedSourceResourceManagementInfo | undefined;
  yield(node: Node): ResolvedSourceYieldInfo | undefined;
  callResult(source: ResolvedSourceCallInfo): SourceCallResultSelection | undefined;
}

export interface SourceFinalTypeQueries extends SourceNavigationTypeQueries {
  awaitedType(type: Type): Type | undefined;
  authoredType(node: Node): Type | undefined;
  contextualType(node: Node): SourceTypeComponentEvidence | undefined;
  typeArgumentBindings(type: Type): readonly import("./semantics-type-arguments.js").SourceTypeArgumentBinding[] | undefined;
  instantiatedBaseTypes(type: Type): readonly Type[] | undefined;
  instantiateAlias(declaration: Node, arguments_: readonly Type[]): import("@tsonic/tsts").TypeAliasApplicationInfo | undefined;
  aliasApplication(type: Type): import("@tsonic/tsts").TypeAliasApplicationInfo | undefined;
  typeArguments(type: Type): readonly Type[];
  typeReferenceTarget(type: Type): Type | undefined;
  tupleElementTypes(type: Type): readonly Type[];
  tupleElementInfos(type: Type): readonly TypeTupleElementInfo[];
  unionOrIntersectionTypes(type: Type): readonly Type[];
  propertyInfos(type: Type): readonly import("@tsonic/tsts").TypePropertyInfo[];
  indexInfos(type: Type): readonly import("@tsonic/tsts").TypeIndexInfo[];
  selectIndexedAccess(objectType: Type, indexType: Type): import("@tsonic/tsts").TypeIndexedAccessSelection | undefined;
  signatureInfos(type: Type, kind: "call" | "construct"): readonly import("@tsonic/tsts").TypeSignatureInfo[];
  declarationSignatureInfo(declaration: Node): import("@tsonic/tsts").TypeSignatureInfo | undefined;
  literalBaseType(type: Type): Type | undefined;
  nonNullableType(type: Type): Type | undefined;
  stringLiteralValue(type: Type): string | undefined;
  booleanLiteralValue(type: Type): boolean | undefined;
  isAny(type: Type): boolean;
  isUnknown(type: Type): boolean;
  isNever(type: Type): boolean;
  /** E9 Legacy input: the exact intrinsic null / undefined flags of one constituent (no union classification). */
  intrinsicNullishFlags(type: Type): import("@tsonic/tsts").TypeIntrinsicNullishFlags;
  isNonPrimitive(type: Type): boolean;
  isUnion(type: Type): boolean;
  isIntersection(type: Type): boolean;
  isTypeReference(type: Type): boolean;
  isTuple(type: Type): boolean;
  isArrayLike(type: Type): boolean;
  isIdentical(left: Type, right: Type): boolean;
  couldContainTypeVariables(type: Type): boolean;
  authoredSelection(
    authoredTypeNode: Node,
    selectedType: Type,
  ): SourceAuthoredTypeSelection;
  contextualValueSelection(node: Node): SourceContextualValueTypeSelection;
  refinement(declaredType: Type, selectedType: Type): SourceTypeRefinement;
  relationship(left: Type, right: Type): SourceTypeRelationship;
  structuralMembers(source: Type, destination: Type,
    purpose: "correspondence" | "read"): import("./semantics-structural-members.js").SourceStructuralMemberCorrespondence;
  structuralMember(source: Type, destination: Type, selectedDeclaration: Node,
    purpose: "correspondence" | "read"): import("./semantics-structural-members.js").SourceStructuralMemberPair | undefined;
  callable(type: Type): SourceCallableTypeEvidence | undefined;
}

export interface SourceSelectedDeclarationQueries extends SourceNavigationDeclarationQueries {
  aliasedSymbol(symbol: Symbol): Symbol | undefined;
  authoredTypeDeclaration(node: Node): Node | undefined;
  isDefaultLibraryDeclaration(node: Node): boolean;
  declaredType(declaration: Node): Type | undefined;
  typeSymbol(type: Type): Symbol | undefined;
  typeAliasSymbol(type: Type): Symbol | undefined;
}

export interface SourceFactSubjectQueries {
  authoredTypeSubjects(node: Node): readonly ExtensionFactSubject[];
  selectedSubjects(
    symbol: Symbol | undefined,
    declaration: Node | undefined,
  ): readonly ExtensionFactSubject[];
  typeSubjects(type: Type): readonly ExtensionFactSubject[];
}

export interface SourceFileSemantics {
  readonly sourceFile: SourceFile;
  readonly propertyNames: import("../source-semantics/property-names-model.js").SourcePropertyNameIndex;
  readonly operations: SourceOperationEvidenceQueries;
  readonly types: SourceFinalTypeQueries;
  readonly declarations: SourceSelectedDeclarationQueries;
  readonly facts: SourceFactSubjectQueries;
}

export interface SourceTypeComponentEvidence {
  readonly selectedType: Type;
  readonly declaration?: Node;
  readonly authoredTypeNode?: Node;
  readonly contextualCall?: ResolvedSourceCallInfo;
}

export interface SourceCallableParameterEvidence extends TypeSignatureParameterInfo {
  readonly omissionKind: "required" | "undefined" | "initializer" | "rest";
}

export interface SourceCallableTypeEvidence {
  readonly parameters: readonly SourceCallableParameterEvidence[];
  readonly result: SourceTypeComponentEvidence;
}

export type SourceValueTypeRefinementSelection =
  | { readonly kind: "not-project-reference" }
  | {
      readonly kind: "unresolved";
      readonly reference: SourceProjectReference;
      readonly missing: "declared-type" | "selected-type";
    }
  | {
      readonly kind: "resolved";
      readonly reference: SourceProjectReference;
      readonly declaredType: Type;
      readonly selectedType: Type;
      readonly refinement: SourceTypeRefinement;
    };

export interface SourceProgramSemantics {
  includes(sourceFile: SourceFile): boolean;
  forFile(sourceFile: SourceFile): SourceFileSemantics;
  forNode(node: Node): SourceFileSemantics;
  selectValueTypeRefinement(node: Node): SourceValueTypeRefinementSelection;
}

