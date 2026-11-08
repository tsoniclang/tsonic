import type { ArgumentPassingMode, Node } from "@tsonic/tsts";
import type { SourceMemberOrigin, SourcePresence, SourceResult, SourceSignatureIdentity, SourceTypeBinding,
  SourceTypeEvidence, SourceValueOperand } from "../public/source/contracts.js";
import type { SourcePointerFacts } from "./source-pointers.js";
import type { SourceMarkerFacts } from "./source-markers.js";

export interface SourceIterationValues {
  readonly yielded: SourceTypeEvidence;
  readonly completed: SourceTypeEvidence;
  readonly resumed: SourceTypeEvidence;
}

export type SourceIterationProtocol = {
  readonly source: SourceTypeEvidence;
  readonly values: SourceIterationValues;
} & (
  | { readonly kind: "known-iterable-instantiation"; readonly declarations: readonly Node[]; readonly iterable: SourceTypeEvidence }
  | { readonly kind: "selected-iterator-member"; readonly declarations: readonly Node[]; readonly origins: readonly SourceMemberOrigin[];
      readonly member: SourceTypeEvidence; readonly iterator: SourceTypeEvidence }
);

export type SourceAtomicIterationMechanism = { readonly source: SourceTypeEvidence } & (
  | { readonly kind: "synchronous-iterator-protocol" | "asynchronous-iterator-protocol" | "synchronous-iterator-adapted-to-async";
      readonly protocol: SourceIterationProtocol }
  | { readonly kind: "array-like-index" | "array-like-index-adapted-to-async"; readonly index: SourceTypeEvidence }
  | { readonly kind: "string-code-unit-index" | "string-code-unit-index-adapted-to-async" | "untyped-dynamic-iteration" }
);

export type SourceIterationMechanism = SourceAtomicIterationMechanism
  | { readonly kind: "union"; readonly alternatives: readonly SourceAtomicIterationMechanism[] }
  | { readonly kind: "property-key-enumeration" };

export type SourceIteration = {
  readonly source: SourceValueOperand;
  readonly element: SourceTypeEvidence;
  readonly key: SourcePresence<SourceTypeEvidence>;
  readonly completion: SourcePresence<SourceTypeEvidence>;
} & (
  | { readonly subject: { readonly kind: "for-in"; readonly node: Node }; readonly iterationKind: "for-in";
      readonly mechanism: { readonly kind: "property-key-enumeration" } }
  | { readonly subject: { readonly kind: "for-of"; readonly node: Node }; readonly iterationKind: "for-of" | "for-await-of";
      readonly mechanism: SourceIterationMechanism }
  | { readonly subject: { readonly kind: "spread"; readonly node: Node }; readonly iterationKind: "spread";
      readonly mechanism: SourceIterationMechanism }
);

export interface SourceGenerator {
  readonly declaration: Node;
  readonly kind: "sync" | "async";
  readonly result: SourceTypeEvidence;
  readonly values: SourceIterationValues;
  readonly returnBinding: SourcePresence<SourceTypeBinding>;
}

export type SourceYield = {
  readonly occurrence: Node;
  readonly generator: SourceGenerator;
  readonly yielded: SourceTypeEvidence;
  readonly resumed: SourceTypeEvidence;
} & (
  | { readonly kind: "value"; readonly operand: SourcePresence<SourceValueOperand> }
  | { readonly kind: "delegate"; readonly operand: SourceValueOperand; readonly delegation: SourceIterationMechanism;
      readonly values: SourceIterationValues }
);

export interface SourceCallableCompletion {
  readonly declaration: Node;
  readonly canFallThrough: boolean;
}

export interface SourceDisposalAlternative {
  readonly resource: SourceTypeEvidence;
  readonly kind: "sync" | "async";
  readonly declarations: readonly Node[];
  readonly origins: readonly SourceMemberOrigin[];
  readonly member: SourceTypeEvidence;
  readonly signatures: readonly SourceSignatureIdentity[];
}

export interface SourceResourceManagement {
  readonly declaration: Node;
  readonly kind: "using" | "await using";
  readonly acquisition:
    | { readonly kind: "initializer"; readonly value: SourceValueOperand }
    | { readonly kind: "iteration"; readonly statement: Node; readonly value: SourceTypeEvidence };
  readonly resource: SourceTypeEvidence;
  readonly acceptsAbsence: true;
  readonly disposal:
    | { readonly kind: "selected"; readonly alternatives: readonly SourceDisposalAlternative[] }
    | { readonly kind: "untyped-dynamic"; readonly value: SourceTypeEvidence };
}

export type SourceStoragePlace = {
  readonly occurrence: Node;
  readonly value: SourceTypeEvidence;
  readonly storage: Node;
  readonly writable: boolean;
} & (
  | { readonly kind: "binding"; readonly declaration: Node }
  | { readonly kind: "member"; readonly declarations: readonly Node[]; readonly receiver: SourceValueOperand }
  | { readonly kind: "element"; readonly receiver: SourceValueOperand; readonly key: SourceValueOperand }
  | { readonly kind: "pointer"; readonly pointer: SourceValueOperand }
);

export type SourceArgumentPassing =
  | { readonly role: "declaration"; readonly mode: ArgumentPassingMode }
  | { readonly role: "argument"; readonly mode: ArgumentPassingMode; readonly storageExpression: Node };

export interface SourceAnalysisFacts extends SourcePointerFacts, SourceMarkerFacts {
  iteration(occurrence: Node): SourceResult<SourcePresence<SourceIteration>>;
  generator(declaration: Node): SourceResult<SourcePresence<SourceGenerator>>;
  yield(occurrence: Node): SourceResult<SourcePresence<SourceYield>>;
  resourceManagement(declaration: Node): SourceResult<SourcePresence<SourceResourceManagement>>;
  callableCompletion(declaration: Node): SourceResult<SourcePresence<SourceCallableCompletion>>;
  storage(occurrence: Node): SourceResult<SourcePresence<SourceStoragePlace>>;
  argumentPassing(occurrence: Node): SourcePresence<SourceArgumentPassing>;
}
