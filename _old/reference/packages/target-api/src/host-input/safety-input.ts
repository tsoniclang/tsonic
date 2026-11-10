import type { Node } from "@tsonic/tsts";
import type { SourcePresence } from "../public/source/contracts.js";

export type SourceInputSafetyMemberKind = "indexer" | "method" | "property";
export type SourceInputSafetyPlacement = "declaration" | "constructor" | "getter" | "setter";
export type SourceInputSafetyContract = "requires-unsafe" | "safe";

export type SourceInputSafetyMemberSelection =
  | { readonly kind: "selected"; readonly expression: Node;
      readonly declaration: SourcePresence<Node>; readonly declarations: readonly Node[] }
  | { readonly kind: "unavailable"; readonly reason: "function-shape" | "receiver" | "member-evidence" };

export type SourceInputSafetyReceipt = {
  readonly occurrence: Node;
  readonly provider: {
    readonly providerId: string;
    readonly providerVersion: string;
    readonly providerModuleId: string;
    readonly signatureId: string;
  };
} & (
  | { readonly family: "unsafe-context"; readonly operation: "expression"; readonly expression: Node }
  | { readonly family: "unsafe-context"; readonly operation: "remaining-block";
      readonly firstDirectStatement: boolean }
  | { readonly family: "safety"; readonly operation: "root"; readonly form: "type" | "value";
      readonly target: SourcePresence<Node> }
  | { readonly family: "safety"; readonly operation: "select-member";
      readonly predecessor: SourcePresence<Node>; readonly memberKind: SourceInputSafetyMemberKind;
      readonly selection: SourceInputSafetyMemberSelection }
  | { readonly family: "safety"; readonly operation: "placement";
      readonly predecessor: SourcePresence<Node>; readonly placement: SourceInputSafetyPlacement }
  | { readonly family: "safety"; readonly operation: "apply";
      readonly predecessor: SourcePresence<Node>; readonly contract: SourceInputSafetyContract }
);

export interface SourceInputSafetyQueries {
  safety(occurrence: Node): SourcePresence<SourceInputSafetyReceipt>;
}
