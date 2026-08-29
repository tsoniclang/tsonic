import type {
  AstReader,
  ExtensionFactSubject,
  Node,
  ReadonlySourceFactResolver,
  ResolvedSourceElementAccessInfo,
  ResolvedSourceGeneratorInfo,
  ResolvedSourceIterationInfo,
  ResolvedSourceObjectLiteralElementInfo,
  ResolvedSourcePropertyAccessInfo,
  ResolvedSourceResourceManagementInfo,
  ResolvedSourceStorageInfo,
  ResolvedSourceWellKnownSymbolInfo,
  ResolvedSourceYieldInfo,
  Signature,
  SourceFile,
  Symbol,
  TypeSignatureParameterInfo,
  TypeTupleElementInfo,
  Type,
} from "@tsonic/tsts";
import type {
  SourceProgramNavigation,
  SourceProjectReference,
} from "../source-navigation/index.js";
import type {
  SourceAuthoredTypeSelection,
} from "./authored-type-selection.js";
import type {
  SourceContextualValueTypeSelection,
} from "./contextual-type-selection.js";
import type {
  SourceTypeRelationship,
} from "./type-relationship.js";
import type {
  SourceTypeRefinement,
} from "./type-refinement.js";
import type {
  ResolvedSourceCallInfo,
  SourceCallResultSelection,
} from "./call-result-selection.js";
import type {
  SourceCallParameterSlot,
} from "./call-parameter-slots.js";

export interface SourceOperationEvidenceQueries {
  call(node: Node): ResolvedSourceCallInfo | undefined;
  propertyAccess(node: Node): ResolvedSourcePropertyAccessInfo | undefined;
  elementAccess(node: Node): ResolvedSourceElementAccessInfo | undefined;
  iteration(node: Node): ResolvedSourceIterationInfo | undefined;
  objectLiteralElement(node: Node): ResolvedSourceObjectLiteralElementInfo | undefined;
  storage(node: Node): ResolvedSourceStorageInfo | undefined;
  generator(node: Node): ResolvedSourceGeneratorInfo | undefined;
  yield(node: Node): ResolvedSourceYieldInfo | undefined;
  wellKnownSymbol(node: Node): ResolvedSourceWellKnownSymbolInfo | undefined;
  resourceManagement(node: Node): ResolvedSourceResourceManagementInfo | undefined;
  callResult(source: ResolvedSourceCallInfo): SourceCallResultSelection | undefined;
  callParameterSlots(source: ResolvedSourceCallInfo): readonly SourceCallParameterSlot[] | undefined;
}

export interface SourceFinalTypeQueries {
  expressionType(node: Node): Type | undefined;
  authoredType(node: Node): Type | undefined;
  contextualType(node: Node): Type | undefined;
  typeOfSymbol(symbol: Symbol | undefined): Type | undefined;
  declaredSymbolType(symbol: Symbol | undefined): Type | undefined;
  writeSymbolType(symbol: Symbol | undefined): Type | undefined;
  effectiveTypeArguments(type: Type): readonly Type[] | undefined;
  typeArguments(type: Type): readonly Type[];
  substitutionBaseType(type: Type): Type | undefined;
  typeReferenceTarget(type: Type): Type | undefined;
  tupleElementTypes(type: Type): readonly Type[];
  tupleElementInfos(type: Type): readonly TypeTupleElementInfo[];
  unionOrIntersectionTypes(type: Type): readonly Type[];
  propertyInfos(type: Type): readonly import("@tsonic/tsts").TypePropertyInfo[];
  indexInfos(type: Type): readonly import("@tsonic/tsts").TypeIndexInfo[];
  callSignatures(type: Type): readonly Signature[];
  constructSignatures(type: Type): readonly Signature[];
  returnType(signature: Signature): Type | undefined;
  signatureParameterInfos(signature: Signature): readonly TypeSignatureParameterInfo[];
  signatureThisParameterInfo(
    signature: Signature,
  ): import("@tsonic/tsts").TypeSignatureThisParameterInfo | undefined;
  apparentType(type: Type): Type | undefined;
  widenedType(type: Type): Type | undefined;
  withoutMissingOrUndefined(type: Type): Type | undefined;
  constantValue(node: Node): unknown;
  isAny(type: Type): boolean;
  isUnknown(type: Type): boolean;
  isNever(type: Type): boolean;
  isVoidLike(type: Type): boolean;
  isNullish(type: Type): boolean;
  isStringLike(type: Type): boolean;
  isNumberLike(type: Type): boolean;
  isBooleanLike(type: Type): boolean;
  isBigIntLike(type: Type): boolean;
  isSymbolLike(type: Type): boolean;
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
  contextualTupleSelection(
    node: Node,
    presentElementCount: number,
  ): SourceContextualTupleLiteralSelection;
  refinement(declaredType: Type, selectedType: Type): SourceTypeRefinement;
  relationship(left: Type, right: Type): SourceTypeRelationship;
  standardTransformation(
    authoredTypeNode: Node,
    selectedType: Type,
  ): SourceStandardTypeTransformation | undefined;
  callable(type: Type): SourceCallableTypeEvidence | undefined;
}

export interface SourceSelectedDeclarationQueries {
  declaredValueType(declaration: Node): Type | undefined;
  declaredType(declaration: Node): Type | undefined;
  typeSymbol(type: Type): Symbol | undefined;
  typeAliasSymbol(type: Type): Symbol | undefined;
  symbolName(symbol: Symbol): string;
  symbolDeclarations(symbol: Symbol): readonly Node[];
  primarySymbolDeclaration(symbol: Symbol): Node | undefined;
  rootSymbols(symbol: Symbol): readonly Symbol[];
  signatureDeclaration(signature: Signature): Node | undefined;
  signatureParameters(signature: Signature): readonly Symbol[];
}

export interface SourceFactSubjectQueries {
  authoredTypeSubjects(node: Node): readonly ExtensionFactSubject[];
  authoredTypeNodes(node: Node): readonly Node[];
  selectedSubjects(
    symbol: Symbol | undefined,
    declaration: Node | undefined,
  ): readonly ExtensionFactSubject[];
  typeSubjects(type: Type): readonly ExtensionFactSubject[];
}

export interface SourceFileSemantics {
  readonly sourceFile: SourceFile;
  readonly operations: SourceOperationEvidenceQueries;
  readonly types: SourceFinalTypeQueries;
  readonly declarations: SourceSelectedDeclarationQueries;
  readonly facts: SourceFactSubjectQueries;
}

export interface SourceTypeComponentEvidence {
  readonly selectedType: Type;
  readonly declaration?: Node;
  readonly authoredTypeNode?: Node;
}

export interface SourceCallableParameterEvidence extends TypeSignatureParameterInfo {
  readonly omissionKind: "required" | "undefined" | "initializer" | "rest";
}

export interface SourceCallableTypeEvidence {
  readonly parameters: readonly SourceCallableParameterEvidence[];
  readonly result: SourceTypeComponentEvidence;
}

export type SourceStandardTypeTransformation =
  | {
      readonly kind: "component";
      readonly component: SourceTypeComponentEvidence;
    }
  | {
      readonly kind: "parameter-list";
      readonly parameters: readonly SourceCallableParameterEvidence[];
    }
  | {
      readonly kind: "callable";
      readonly callable: SourceCallableTypeEvidence;
    }
  | { readonly kind: "structural" }
  | { readonly kind: "unresolved" };

export type SourceContextualTupleLiteralSelection =
  | {
      readonly kind: "selected";
      readonly type: Type;
      readonly elements: readonly TypeTupleElementInfo[];
      readonly omittedOptionalElementIndexes: readonly number[];
    }
  | { readonly kind: "unavailable" };

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

export interface SourceDocument {
  readonly identity: string;
  readonly fileName: string;
  readonly text: string;
  readonly sourceFile: SourceFile;
}

export interface SourceAuthoredOccurrence {
  readonly kind: "authored";
  readonly document: SourceDocument;
  readonly start: number;
  readonly end: number;
  readonly syntaxKind: string;
}

export interface SourceSyntheticOccurrence {
  readonly kind: "synthetic";
  readonly syntaxKind: string;
}

export type SourceOccurrence =
  | SourceAuthoredOccurrence
  | SourceSyntheticOccurrence;

export type SourceOccurrenceLookup =
  | { readonly kind: "available"; readonly node: Node }
  | { readonly kind: "foreign-document" }
  | { readonly kind: "missing" }
  | { readonly kind: "ambiguous"; readonly matchCount: number };

export interface SourceProgramDocuments {
  readonly all: readonly SourceDocument[];
  includes(document: SourceDocument): boolean;
  forFile(sourceFile: SourceFile): SourceDocument;
  forNode(node: Node): SourceDocument;
  occurrenceFor(node: Node): SourceOccurrence;
  lookupAuthored(occurrence: SourceAuthoredOccurrence): SourceOccurrenceLookup;
}

export type {
  ResolvedSourceCallInfo,
  SourceCallResultSelection,
} from "./call-result-selection.js";
export type {
  SourceAuthoredTypeSelection,
} from "./authored-type-selection.js";
export type {
  SourceContextualValueTypeSelection,
} from "./contextual-type-selection.js";
export type {
  SourceTypeRelationship,
} from "./type-relationship.js";
export type {
  SourceTypeRefinement,
} from "./type-refinement.js";

export interface TargetSourceProgram {
  readonly ast: AstReader;
  readonly sourceFiles: readonly SourceFile[];
  readonly documents: SourceProgramDocuments;
  readonly sourceFacts: ReadonlySourceFactResolver;
  readonly navigation: SourceProgramNavigation;
  readonly semantics: SourceProgramSemantics;
}
