import type { Node } from "@tsonic/tsts";
import type { SourceMemberOrigin, SourceSignatureIdentity, SourceTypeEvidence, SourceValueOperand } from "../public/source/contracts.js";

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
