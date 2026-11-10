import type { Node } from "@tsonic/tsts";
import type { SourceMemberOrigin, SourcePresence, SourceResult, SourceTypeEvidence, SourceUseDestination, SourceValueOperand } from "../public/source/contracts.js";

export type SourceIndexSelection =
  | { readonly kind: "array-element" | "string-character"; readonly declarations: readonly Node[] }
  | { readonly kind: "tuple-element"; readonly index: number; readonly declarations: readonly Node[] }
  | { readonly kind: "index-signature"; readonly declarations: readonly Node[] };

export interface SourcePropertyUseArm {
  readonly kind: "member";
  readonly receiver: SourceTypeEvidence;
  readonly origins: readonly SourceMemberOrigin[];
  readonly readOrigins: readonly SourceMemberOrigin[];
  readonly writeOrigins: readonly SourceMemberOrigin[];
  readonly declarations: readonly Node[];
  readonly readDeclarations: readonly Node[];
  readonly writeDeclarations: readonly Node[];
  readonly readType: SourceTypeEvidence | undefined;
  readonly writeType: SourceTypeEvidence | undefined;
  readonly writeDestination: SourceUseDestination | undefined;
}

export interface SourceIndexUseArm {
  readonly kind: "index";
  readonly receiver: SourceTypeEvidence;
  readonly selection: SourceIndexSelection;
  readonly key: SourceTypeEvidence;
  readonly readType: SourceTypeEvidence | undefined;
  readonly writeType: SourceTypeEvidence | undefined;
  readonly readonly: boolean;
}

export type SourceMemberUseArm = SourcePropertyUseArm | SourceIndexUseArm;

export interface SourceMemberUse {
  readonly occurrence: Node;
  readonly receiver: { readonly occurrence: Node; readonly value: SourceTypeEvidence };
  readonly key: SourcePresence<SourceResult<SourceValueOperand>>;
  readonly disposition: "skip" | "evaluate" | "dynamic";
  readonly access: "read" | "write" | "read-write" | "delete";
  readonly callCallee: boolean;
  readonly optionalChain: boolean;
  readonly chainContinuation: boolean;
  readonly selectedDeclaration: SourcePresence<Node>;
  readonly selectedDeclarations: readonly Node[];
  readonly readDeclarations: readonly Node[];
  readonly writeDeclarations: readonly Node[];
  readonly readType: SourceTypeEvidence | undefined;
  readonly writeType: SourceTypeEvidence | undefined;
  readonly arms: readonly SourceMemberUseArm[];
}
