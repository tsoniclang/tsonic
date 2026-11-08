import type { Node, ResolvedSourceFlowConditionInfo } from "@tsonic/tsts";
import type { SourcePresence } from "../public/source/contracts.js";
import type { SourceInputComponent, SourceInputSignature } from "./identities.js";
import type { SourceInputCorrespondenceMember } from "./member-input.js";

export interface SourceInputIteratorWitness {
  readonly declarations: readonly Node[];
  readonly iterator: SourceInputCorrespondenceMember;
  readonly calls: readonly SourceInputSignature[];
}

export type SourceInputAtomicIteration = {
  readonly source: SourceInputComponent;
} & (
  | { readonly kind: "synchronous-iterator-protocol" | "asynchronous-iterator-protocol" | "synchronous-iterator-adapted-to-async";
      readonly protocol: SourceInputIteratorWitness }
  | { readonly kind: "array-like-index" | "array-like-index-adapted-to-async"; readonly declarations: readonly Node[] }
  | { readonly kind: "string-code-unit-index" | "string-code-unit-index-adapted-to-async" | "untyped-dynamic-iteration" }
);

export type SourceInputIterationMechanism = SourceInputAtomicIteration
  | { readonly kind: "union"; readonly alternatives: readonly SourceInputAtomicIteration[] }
  | { readonly kind: "property-key-enumeration" };

export interface SourceInputIteration {
  readonly occurrence: Node;
  readonly operand: Node;
  readonly kind: "for-in" | "for-of" | "for-await-of" | "spread";
  readonly mechanism: SourcePresence<SourceInputIterationMechanism>;
}

export interface SourceInputGenerator {
  readonly declaration: Node;
  readonly kind: "sync" | "async";
  readonly signature: SourceInputSignature;
  readonly returnTypeBinding: SourcePresence<Node>;
}

export interface SourceInputYield {
  readonly occurrence: Node;
  readonly generator: Node;
  readonly kind: "value" | "delegate";
  readonly operand: SourcePresence<Node>;
  readonly mechanism: SourcePresence<SourceInputIterationMechanism>;
}

export interface SourceInputProtocolQueries {
  iteration(occurrence: Node): SourcePresence<SourceInputIteration>;
  generator(declaration: Node): SourcePresence<SourceInputGenerator>;
  yield(occurrence: Node): SourcePresence<SourceInputYield>;
  flowConditions(reference: Node): SourcePresence<ResolvedSourceFlowConditionInfo>;
}
