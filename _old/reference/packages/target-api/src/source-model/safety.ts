import type { Node } from "@tsonic/tsts";
import type { SourcePresence, SourceResult } from "../public/source/contracts.js";

export type SourceSafetyContract = "requires-unsafe" | "safe";
export type SourceSafetyMemberKind = "indexer" | "method" | "property";
export type SourceSafetyPlacement = "declaration" | "constructor" | "getter" | "setter";

export type SourceUnsafeContext =
  | { readonly kind: "expression"; readonly expression: Node }
  | { readonly kind: "remaining-block" };

export type SourceSafetyBuilder = {
  readonly applicationTarget: Node;
  readonly selectedDeclaration: SourcePresence<Node>;
  readonly selectedDeclarations: readonly Node[];
  readonly memberKind: SourcePresence<SourceSafetyMemberKind>;
  readonly placement: SourceSafetyPlacement;
} & (
  | { readonly kind: "builder-state" }
  | { readonly kind: "application"; readonly contract: SourceSafetyContract }
);

export type SourceSafetyOperation =
  | { readonly kind: "unsafe-context"; readonly fact: SourceUnsafeContext }
  | { readonly kind: "safety-builder"; readonly fact: SourceSafetyBuilder };

export interface SourceSafetyFacts {
  safety(occurrence: Node): SourceResult<SourcePresence<SourceSafetyOperation>>;
}
