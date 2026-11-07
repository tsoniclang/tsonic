// Source documents and occurrences: the checker-free document records of a program view (I1). Node and SourceFile
// are site keys only. Built by source-documents.ts; published as SourceProgramFacts.documents.
import type { Node, SourceFile } from "@tsonic/tsts";

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
