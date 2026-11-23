import type { BodyId, DefId, ModuleId, NodeId, PackageId, SigId } from "../ids/contract.js";
import type { ArtifactBindings, BodyInstance, SignatureEndpoint, TypeExpansionLimits } from "../ir-types/contract.js";
import type { DataflowStop } from "../dataflow/contract.js";
import type { Violation } from "../diag/contract.js";

export type ProgramRule =
  | "schema-supported" | "root-package-resolves" | "packages-order" | "package-dependencies-order"
  | "package-dependency-resolves" | "package-exports-order" | "package-export-resolves"
  | "modules-order" | "module-package-resolves" | "identity-path-exact" | "items-order" | "item-definition-resolves"
  | "definition-node-resolves" | "definition-node-owner-exact" | "module-node-id-dense"
  | "exports-order" | "export-target-resolves" | "binding-capture-owner" | "binding-target-resolves" | "binding-diagnostic-resolves"
  | "signatures-order" | "signature-reference-resolves"
  | "signature-endpoints-exact" | "body-index-order" | "body-owner-resolves" | "body-module-resolves"
  | "body-root-resolves" | "node-body-ownership" | "mir-counts-integral"
  | "metadata-order" | "metadata-key-unique" | "summaries-order"
  | "summary-key-unique" | "constants-order" | "constant-key-unique" | "constant-type-resolves" | "constant-floating-value"
  | "diagnostics-order" | "bindings-complete" | "binding-artifact-present" | "binding-vectors-bounded"
  | "shared-type-table" | "native-facts-identity" | "types-valid" | "metadata-valid" | "summary-valid"
  | "chunk-module-resolves" | "chunk-tree-module-exact" | "chunk-bodies-order" | "body-levels-total"
  | "body-instance-exact" | "mir-index-counts-exact" | "tir-valid" | "mir-valid"
  | "facts-valid" | "cross-owner-qualified" | "cross-owner-reference-resolves"
  | "metadata-constant-not-materialised"
  | "template-body-shared" | "nested-body-boundary" | "instance-node-ids-exact"
  | "dependency-inventory-valid" | "execution-body-resolves" | "execution-entry-resolves"
  | "facts-execution-total" | "facts-execution-order"
  | "initialization-entry-exact" | "initialization-exposure-exact" | "initialization-executions-exact" | "plan-initialized";

export type ProgramViolation = Violation<ProgramRule, ProgramSite>;

export interface ProgramVerificationLimits {
  readonly maximumCreatedRecords: number;
  readonly maximumBindingVectorsPerArtifact: number;
  readonly typeExpansion: TypeExpansionLimits;
}

export interface InstantiationLimits extends ProgramVerificationLimits {
  readonly maximumWork: number;
}

export type SummaryArtifactReference = { readonly kind: "summary"; readonly provided: number } & (
  | { readonly target: "body"; readonly body: BodyId }
  | { readonly target: "declared"; readonly definition: DefId; readonly endpoint: SignatureEndpoint; readonly ordinal: number }
);

export type ArtifactReference =
  | { readonly kind: "tir" | "mir"; readonly body: BodyId }
  | { readonly kind: "facts"; readonly body: BodyId; readonly provided: number }
  | SummaryArtifactReference
  | { readonly kind: "metadata"; readonly definition: DefId };

export type ProgramSite =
  | { readonly kind: "index" }
  | { readonly kind: "package"; readonly package: PackageId }
  | { readonly kind: "module"; readonly module: ModuleId }
  | { readonly kind: "node"; readonly module: ModuleId; readonly node: NodeId }
  | { readonly kind: "definition"; readonly definition: DefId }
  | { readonly kind: "signature"; readonly signature: SigId }
  | { readonly kind: "body"; readonly instance: BodyInstance }
  | { readonly kind: "artifact"; readonly artifact: ArtifactReference; readonly bindings: ArtifactBindings };

export type ProgramVerificationStop =
  | DataflowStop
  | { readonly kind: "resource-limit"; readonly body: BodyInstance; readonly dimension: "work"; readonly maximum: number }
  | { readonly kind: "resource-limit"; readonly site: ProgramSite;
      readonly dimension: "work" | "created-records" | "depth" | "visits" | "union-members" | "intersection-members";
      readonly maximum: number };
