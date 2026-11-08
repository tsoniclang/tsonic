import type { Node } from "@tsonic/tsts";
import type { SourcePresence, SourceTypeBinding, SourceTypeEvidence } from "../public/source/contracts.js";
import type { SourceProductionResult } from "../source-model/production.js";
import type { SourceLiteralDomain } from "../source-model/literals/domain.js";
import type { SourceLiteralKey } from "../source-model/literals/key.js";
import type { SourceCorrespondenceIndex, SourceCorrespondenceMember } from "../source-model/members.js";

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

export type SourceConstructionMemberStep =
  | { readonly kind: "own"; readonly evaluation: Node; readonly member: SourceMemberInventoryRow }
  | { readonly kind: "spread" | "rest"; readonly evaluation: Node; readonly operand: Node;
      readonly excluded: readonly SourceLiteralKey[];
      source(): SourceProductionResult<SourceTypeEvidence> };

export interface SourceConstructionMemberHistory {
  readonly occurrence: Node;
  readonly steps: readonly SourceConstructionMemberStep[];
}

export type SourceConstructionMemberContribution =
  | { readonly kind: "own"; readonly evaluation: Node; readonly declarations: readonly Node[] }
  | { readonly kind: "copy"; readonly evaluation: Node; readonly operand: Node;
      readonly receiver: SourceTypeEvidence; readonly member: SourceMemberInventoryRow;
      readonly definite: boolean };

export type SourceConstructionMembers =
  | { readonly kind: "complete"; readonly inventory: Extract<SourceMemberInventory, { readonly kind: "complete" }>;
      readonly members: readonly { readonly member: SourceMemberInventoryRow;
        readonly contributions: readonly SourceConstructionMemberContribution[] }[] }
  | { readonly kind: "unavailable" };

export interface SourceConstructionMemberReducers {
  read(original: Node, values: readonly SourceTypeEvidence[]): SourceProductionResult<SourceTypeEvidence>;
  domain(values: readonly SourceLiteralDomain[]): SourceLiteralDomain;
}

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
  constructionHistory(occurrence: Node): SourceProductionResult<SourceConstructionMemberHistory>;
}

export type SourceMemberSubject =
  | { readonly kind: "evidence"; readonly value: SourceTypeEvidence }
  | { readonly kind: "construction"; readonly occurrence: Node };
