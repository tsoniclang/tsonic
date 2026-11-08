import type { AstReader, Node, SourceFile } from "@tsonic/tsts";
import type { SourceAdmissionFacts, SourceApplicationFacts, SourceDescriptorView, SourceEnumFacts, SourceIntegerFacts, SourceNavigationFacts, SourcePresence, SourcePropertyName, SourceRefusal, SourceResult, SourceValueFacts } from "../public/source/contracts.js";
import type { SourceNodeNavigationFacts } from "../source-model/navigation.js";
import type { SourceJsApiFacts } from "../source-model/profile.js";
import type { SourceAnalysisFacts } from "../source-model/protocols.js";
import type { SourceMemberCorrespondenceQueries } from "../source-model/members.js";
import type { SourceMemberUse } from "./member-use.js";

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

export type SourceOccurrence = SourceAuthoredOccurrence | SourceSyntheticOccurrence;

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

export interface SourceObjectFacts extends SourceMemberCorrespondenceQueries {
  use(occurrence: Node): SourceResult<SourceMemberUse>;
  propertyName(name: Node): SourceResult<SourcePropertyName>;
}

export interface SourceProgramFacts {
  readonly admission: SourceAdmissionFacts;
  readonly descriptors: SourceDescriptorView;
  readonly values: SourceValueFacts;
  readonly applications: SourceApplicationFacts;
  readonly integers: SourceIntegerFacts;
  readonly enums: SourceEnumFacts;
  readonly navigation: SourceNavigationFacts & SourceNodeNavigationFacts;
  readonly objects: SourceObjectFacts;
  readonly profile: SourcePresence<SourceJsApiFacts>;
  readonly protocols: SourceAnalysisFacts;
  refusals(): readonly SourceRefusal[];
}

export interface TargetSourceProgram {
  readonly ast: AstReader;
  readonly sourceFiles: readonly SourceFile[];
  readonly documents: SourceProgramDocuments;
  readonly facts: SourceProgramFacts;
}
