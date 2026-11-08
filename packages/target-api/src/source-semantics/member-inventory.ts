import type { Node } from "@tsonic/tsts";
import type { SourceTypeEvidence } from "../public/source/contracts.js";
import type { SourceProductionResult } from "./descriptor-contracts.js";
import type { SourceCorrespondenceIndex, SourceCorrespondenceMember } from "./member-correspondence.js";

export type SourceMemberInventoryRow = Omit<SourceCorrespondenceMember, "receiver">;
export type SourceIndexInventoryRow = Omit<SourceCorrespondenceIndex, "receiver">;

export type SourceMemberInventory =
  | { readonly kind: "complete"; readonly members: readonly SourceMemberInventoryRow[];
      readonly indexes: readonly SourceIndexInventoryRow[] }
  | { readonly kind: "unavailable" };

export type SourceMemberInventoryProduction = SourceMemberInventory | { readonly kind: "definition" };

export type SourceOriginSubjects =
  | { readonly kind: "complete"; readonly nodes: readonly Node[] }
  | { readonly kind: "unavailable" };

export interface SourceEvidenceDetails {
  readonly members: SourceMemberInventoryProduction;
  readonly origins: SourceOriginSubjects;
}

export interface SourceMemberInventoryQueries {
  members(evidence: SourceTypeEvidence): SourceProductionResult<SourceMemberInventory>;
}
