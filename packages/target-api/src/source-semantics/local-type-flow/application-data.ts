import type { Node } from "@tsonic/tsts";
import type { SourceInputApplication, SourceInputBackingConstraint, SourceInputCallCandidate, SourceInputDiagnosticIdentity } from "../../host-input/call-input.js";
import type { SourceApplication, SourceArgumentPlace, SourceAuthoredArgument, SourceComponentSelector, SourceOmissionAction, SourceParameterOmission, SourceReceiverOrigin, SourceSignatureIdentity, SourceTypeEvidence, SourceValueOperand } from "../../public/source/contracts.js";

export type SourceCallCore = Omit<SourceApplication, "execution">;

export interface SourceProducedApplication {
  readonly application: SourceCallCore;
  readonly original: SourceInputApplication;
  readonly diagnostics: readonly SourceInputDiagnosticIdentity[];
}

export type SourceCallCandidateEvaluation =
  | { readonly kind: "not-applicable"; readonly candidate: SourceInputCallCandidate; readonly site: Node; readonly message: string }
  | { readonly kind: "applicable"; readonly candidate: SourceInputCallCandidate; readonly application: SourceCallCore;
      readonly proven: readonly SourceInputBackingConstraint[] };

export interface SourceCallParameter {
  readonly index: number;
  readonly declaration: Node | undefined;
  readonly kind: "required" | "optional" | "rest";
  readonly omission: SourceParameterOmission;
  readonly type: SourceTypeEvidence;
}

export interface SourceUnappliedArgumentPlace {
  readonly sourceArgument: Node;
  readonly sourceArgumentIndex: number;
  readonly effectiveArgument: Node;
  readonly effectiveArgumentIndex: number;
  readonly sourceForm: SourceArgumentPlace["sourceForm"];
  readonly spreadElementIndex: number | undefined;
  readonly source: SourceTypeEvidence;
  readonly parameter: SourceCallParameter;
  readonly parameterForm: SourceArgumentPlace["parameter"]["form"];
  readonly destination: SourceTypeEvidence;
  readonly parameterPath: readonly SourceComponentSelector[];
}

export interface SourceEffectiveArgument {
  readonly authored: SourceAuthoredArgument;
  readonly operand: SourceValueOperand;
  readonly sourceArgumentIndex: number;
  readonly sourceForm: SourceArgumentPlace["sourceForm"];
  readonly spreadElementIndex: number | undefined;
  readonly source: SourceTypeEvidence;
}

export type SourceArgumentPlacement =
  | { readonly kind: "placed"; readonly values: readonly SourceUnappliedArgumentPlace[]; readonly omitted: readonly {
      readonly parameter: SourceCallParameter; readonly path: readonly SourceComponentSelector[];
      readonly destination: SourceTypeEvidence; readonly action: SourceOmissionAction;
    }[] }
  | { readonly kind: "not-applicable"; readonly site: Node; readonly message: string };

export interface SourceProducedSignature {
  readonly identity: SourceSignatureIdentity;
  readonly receiver: { readonly declaration: Node | undefined; readonly origin: SourceReceiverOrigin; readonly value: SourceTypeEvidence } | undefined;
  readonly parameters: readonly SourceCallParameter[];
  readonly result: SourceTypeEvidence;
}
