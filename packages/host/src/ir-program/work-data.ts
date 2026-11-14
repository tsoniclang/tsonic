import type { BodyId, DefId, ModuleId, NodeId, PackageId, SigId } from "../ids/contract.js";
import type { ArtifactBindings, BodyInstance, SignatureEndpoint, TypeExpansionLimits, TypePublicationLimits } from "../ir-types/contract.js";

export interface InstantiationLimits extends TypePublicationLimits {
  readonly maximumBindingVectorsPerArtifact: number;
  readonly typeExpansion: TypeExpansionLimits;
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
  | { readonly kind: "resource-limit"; readonly body: BodyInstance; readonly dimension: "work"; readonly maximum: number }
  | { readonly kind: "resource-limit"; readonly site: ProgramSite;
      readonly dimension: "work" | "created-records" | "depth" | "visits" | "union-members" | "intersection-members";
      readonly maximum: number };
