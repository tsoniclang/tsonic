import type { AstReader, Node, ReadonlySourceFactResolver, SourceFile } from "@tsonic/tsts";
import type { SourceProgramNavigation } from "../source-navigation/types.js";
import type { SourceProgramFacts } from "../public/source/facts.js";
import type { SourceEnumConstantIndex } from "./enum-model.js";
import type { SourcePropertyNameIndex } from "./property-names-model.js";
import type { SourceFlowConditions } from "./value-flow-model.js";

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


/**
 * The Host-internal program (I1/I3): navigation, the published facts and the Host analyses that other Host packages
 * (target-analysis, source-core) read. It carries no checker service: the checker views live only inside host-input
 * (host-input/semantics-program.ts), built once by createHostSourceProgram and shared by every host-input translator.
 * Never handed to a target. Targets receive TargetSourceProgramFacts (public/source/index.ts), built from this owner.
 * Every per-program table lives under this object (I5).
 */
export interface HostSourceProgram {
  readonly ast: AstReader;
  readonly sourceFiles: readonly SourceFile[];
  readonly documents: SourceProgramDocuments;
  readonly sourceFacts: ReadonlySourceFactResolver;
  readonly navigation: SourceProgramNavigation;
  readonly facts: SourceProgramFacts;
  /**
   * Enum constant facts: exact member values, integer widths, and admission issues (merged declarations, plus the
   * enum-use issues of enum-numeric-uses.ts over the value model, computed on first read of `issues`).
   */
  readonly enums: SourceEnumConstantIndex;
  /** Property-name facts of one program file (computed keys, literal keys, element-access keys). */
  propertyNames(sourceFile: SourceFile): SourcePropertyNameIndex;
  /** The flow conditions at a reference: checker flow witness plus Host-retained guards (flow-conditions.ts). */
  flowConditions(reference: Node): SourceFlowConditions | undefined;
}
