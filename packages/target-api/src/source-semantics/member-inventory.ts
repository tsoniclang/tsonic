import type { Node } from "@tsonic/tsts";
import type { SourcePresence, SourceTypeBinding, SourceTypeEvidence } from "../public/source/contracts.js";
import type { SourceProductionResult } from "./descriptor-contracts.js";
import type { SourceLiteralDomain } from "../source-model/literals/domain.js";
import type { SourceCorrespondenceIndex, SourceCorrespondenceMember } from "./member-correspondence.js";

export type SourceMemberInventoryRow = Omit<SourceCorrespondenceMember, "receiver" | "readType" | "writeType"> & {
  readType(): SourceProductionResult<SourcePresence<SourceTypeEvidence>>;
  writeType(): SourceProductionResult<SourcePresence<SourceTypeEvidence>>;
  readDomain(bindings: readonly SourceTypeBinding[]): SourceProductionResult<SourceLiteralDomain>;
};

export type SourceIndexInventoryRow = Omit<SourceCorrespondenceIndex, "receiver" | "keyType" | "readType" | "writeType"> & {
  keyType(): SourceProductionResult<SourceTypeEvidence>;
  readType(): SourceProductionResult<SourcePresence<SourceTypeEvidence>>;
  writeType(): SourceProductionResult<SourcePresence<SourceTypeEvidence>>;
};

export type SourceMemberInventory =
  | { readonly kind: "complete"; readonly members: readonly SourceMemberInventoryRow[];
      readonly indexes: readonly SourceIndexInventoryRow[] }
  | { readonly kind: "unavailable" };

export type SourceMemberInventoryProduction = SourceMemberInventory | { readonly kind: "definition" }
  | { readonly kind: "production";
      readonly produce: () => SourceProductionResult<SourceMemberInventory> };

export type SourceOriginSubjects =
  | { readonly kind: "complete"; readonly nodes: readonly Node[] }
  | { readonly kind: "unavailable" };

export interface SourceEvidenceDetails {
  readonly members: SourceMemberInventoryProduction;
  readonly origins: SourceOriginSubjects;
}

export interface SourceMemberInventoryQueries {
  members(evidence: SourceTypeEvidence): SourceProductionResult<SourceMemberInventory>;
  construction(occurrence: Node): SourceProductionResult<SourceMemberInventory>;
}

export type SourceMemberSubject =
  | { readonly kind: "evidence"; readonly value: SourceTypeEvidence }
  | { readonly kind: "construction"; readonly occurrence: Node };
