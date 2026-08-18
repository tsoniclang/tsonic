import type {
  AstReader,
  ExtensionFactSubject,
  Node,
  ReadonlySourceFactResolver,
  SourceFile,
  Symbol,
  TypeCheckerQueries,
  TypeSignatureParameterInfo,
  TypeShapeQueries,
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

export type SourceFileSemantics = Readonly<
  & { readonly sourceFile: SourceFile }
  & {
    getEffectiveTypeArguments(type: Type): readonly Type[] | undefined;
    getAuthoredTypeFactSubjects(
      node: Node,
    ): readonly ExtensionFactSubject[];
    getAuthoredTypeFactNodes(node: Node): readonly Node[];
    getDeclaredValueType(declaration: Node): Type | undefined;
    selectCallResult(
      source: ResolvedSourceCallInfo,
    ): SourceCallResultSelection | undefined;
    selectCallParameterSlots(
      source: ResolvedSourceCallInfo,
    ): readonly SourceCallParameterSlot[] | undefined;
    selectAuthoredType(
      authoredTypeNode: Node,
      selectedType: Type,
    ): SourceAuthoredTypeSelection;
    selectContextualValueType(node: Node): SourceContextualValueTypeSelection;
    selectContextualTupleLiteral(
      node: Node,
      presentElementCount: number,
    ): SourceContextualTupleLiteralSelection;
    getSelectedFactSubjects(
      symbol: Symbol | undefined,
      declaration: Node | undefined,
    ): readonly ExtensionFactSubject[];
    getTypeFactSubjects(type: Type): readonly ExtensionFactSubject[];
    selectTypeRefinement(
      declaredType: Type,
      selectedType: Type,
    ): SourceTypeRefinement;
    getTypeRelationship(left: Type, right: Type): SourceTypeRelationship;
    selectStandardTypeTransformation(
      authoredTypeNode: Node,
      selectedType: Type,
    ): SourceStandardTypeTransformation | undefined;
    selectCallableType(type: Type): SourceCallableTypeEvidence | undefined;
  }
  & TypeCheckerQueries
  & TypeShapeQueries
>;

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
