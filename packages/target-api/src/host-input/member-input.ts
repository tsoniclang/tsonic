import type { Node } from "@tsonic/tsts";
import type { SourceInputComponent } from "./identities.js";
import type { SourceInputMemberFacts } from "./descriptor-input.js";
import type { SourceIndexSelection } from "../source-model/member-use.js";

export interface SourceInputCorrespondenceMember extends SourceInputMemberFacts {
  readonly receiver: SourceInputComponent;
  readonly readKind: "property" | "accessor" | "method" | "unavailable";
}

export interface SourceInputPropertyUseArm {
  readonly kind: "member";
  readonly member: SourceInputCorrespondenceMember;
  readonly readDeclarations: readonly Node[];
  readonly writeDeclarations: readonly Node[];
}

export interface SourceInputIndexUseArm {
  readonly kind: "index";
  readonly receiver: SourceInputComponent;
  readonly selection: SourceIndexSelection;
  readonly key: SourceInputComponent;
  readonly read: SourceInputComponent | undefined;
  readonly write: SourceInputComponent | undefined;
  readonly readonly: boolean;
}

export type SourceInputMemberUseArm = SourceInputPropertyUseArm | SourceInputIndexUseArm;

export interface SourceInputMemberUse {
  readonly kind: "member";
  readonly occurrence: Node;
  readonly receiver: { readonly occurrence: Node; readonly value: SourceInputComponent };
  readonly access: "read" | "write" | "read-write" | "delete";
  readonly callCallee: boolean;
  readonly optionalChain: boolean;
  readonly selectedDeclaration: Node | undefined;
  readonly selectedDeclarations: readonly Node[];
  readonly readDeclarations: readonly Node[];
  readonly writeDeclarations: readonly Node[];
  readonly read: SourceInputComponent | undefined;
  readonly write: SourceInputComponent | undefined;
  readonly arms: readonly SourceInputMemberUseArm[];
}

export type SourceInputMemberUseSelection = SourceInputMemberUse | {
  readonly kind: "unavailable";
  readonly reason: "not-a-member-use" | "missing-selected-member" | "inconsistent-original-origins";
};
