import type { Diagnostic, TextParseResult, Violation } from "../diag/contract.js";
import type { BodyId, DefId, ModuleId, NodeId, PackageId, SigId } from "../ids/contract.js";
import type {
  ArtifactBindings, BindingVector, BodyInstance, ConstValue, TypeExpansionLimits, TypePublication, TypePublicationLimits, TypeTable,
} from "../ir-types/contract.js";
import type { SourceFile } from "../ir-hir/contract.js";
import type { TirBody, TirVerifierInput, TypedPhase } from "../ir-tir/contract.js";
import type { MirBody } from "../ir-mir/contract.js";
import type { BodyFacts, FactsVerificationContext, MetadataRecord, Summary } from "../ir-facts/contract.js";

export interface PackageExport {
  readonly specifier: string;
  readonly module: ModuleId;
}

export interface PackageRecord {
  readonly id: PackageId;
  readonly name: string | null;
  readonly packageRoot: string;
  readonly sourceRoot: string;
  readonly dependencies: readonly PackageId[];
  readonly exports: readonly PackageExport[];
}

export interface ModuleExport {
  readonly name: string;
  readonly definition: DefId;
}

export interface DefinitionNode {
  readonly definition: DefId;
  readonly node: NodeId;
}

export interface ModuleRecord {
  readonly module: ModuleId;
  readonly package: PackageId;
  readonly items: readonly DefinitionNode[];
  readonly exports: readonly ModuleExport[];
}

export type SignatureRecord = {
  readonly definition: DefId;
  readonly bindings: ArtifactBindings;
  readonly ordinal: number;
  readonly signature: SigId;
} & (
  | { readonly kind: "advertised" | "api-signature" }
  | { readonly kind: "api-body"; readonly body: BodyId | null }
);

export interface BodyRecord {
  readonly instance: BodyInstance;
  readonly module: ModuleId;
  readonly owner: DefId;
  readonly root: NodeId;
  readonly mirLocalCount: number;
  readonly mirConstantCount: number;
  readonly mirPlaceCount: number;
  readonly mirBlockCount: number;
}

export interface ConstantRecord {
  readonly initializer: BodyInstance;
  readonly value: ConstValue;
}

export type SupportedProgramSchema = 1;

export interface ProgramIndex {
  readonly schema: number;
  readonly rootPackage: PackageId;
  readonly packages: readonly PackageRecord[];
  readonly modules: readonly ModuleRecord[];
  readonly types: TypeTable;
  readonly signatures: readonly SignatureRecord[];
  readonly bodies: readonly BodyRecord[];
  readonly metadata: readonly MetadataRecord[];
  readonly summaries: readonly Summary[];
  readonly constants: readonly ConstantRecord[];
  readonly diagnostics: readonly Diagnostic[];
}

export interface PublishedBody {
  readonly instance: BodyInstance;
  readonly tir: TirBody;
  readonly mir: MirBody;
  readonly facts: BodyFacts;
}

export interface ModuleBodies {
  readonly module: ModuleId;
  readonly tree: SourceFile<TypedPhase>;
  readonly bodies: readonly PublishedBody[];
}

export interface HostProgram {
  readonly index: ProgramIndex;
  readonly modules: readonly ModuleBodies[];
}

export interface InstantiationLimits extends TypePublicationLimits {
  readonly maximumBindingVectorsPerArtifact: number;
  readonly typeExpansion: TypeExpansionLimits;
}

export type ArtifactReference =
  | { readonly kind: "tir" | "mir" | "facts"; readonly body: BodyId }
  | { readonly kind: "summary" | "metadata"; readonly definition: DefId };

export type InstantiatedArtifact =
  | { readonly kind: "tir"; readonly body: TirBody }
  | { readonly kind: "mir"; readonly body: MirBody }
  | { readonly kind: "facts"; readonly facts: BodyFacts }
  | { readonly kind: "summary"; readonly summary: Summary }
  | { readonly kind: "metadata"; readonly metadata: MetadataRecord };

export type InstantiationResult =
  | { readonly kind: "instantiated"; readonly artifact: InstantiatedArtifact; readonly types: TypeTable }
  | { readonly kind: "missing-binding-artifact"; readonly artifact: ArtifactReference;
      readonly bindings: BindingVector }
  | { readonly kind: "resource-limit";
      readonly dimension: "binding-vectors" | "work" | "created-records" | "type-depth"
        | "type-visits" | "union-members" | "intersection-members";
      readonly maximum: number };

export type ProgramRule =
  | "schema-supported" | "root-package-resolves" | "packages-order" | "package-dependencies-order"
  | "package-dependency-resolves" | "package-exports-order" | "package-export-resolves"
  | "modules-order" | "module-package-resolves" | "items-order" | "item-definition-resolves"
  | "definition-node-resolves" | "definition-node-owner-exact" | "module-node-id-dense"
  | "exports-order" | "export-definition-resolves" | "signatures-order" | "signature-reference-resolves"
  | "signature-endpoints-exact" | "body-index-order" | "body-owner-resolves" | "body-module-resolves"
  | "body-root-resolves" | "node-body-ownership" | "mir-counts-integral"
  | "metadata-order" | "metadata-key-unique" | "summaries-order"
  | "summary-key-unique" | "constants-order" | "constant-key-unique" | "constant-type-resolves"
  | "diagnostics-order" | "bindings-complete" | "binding-artifact-present" | "binding-vectors-bounded"
  | "shared-type-table" | "types-valid" | "metadata-valid" | "summary-valid"
  | "chunk-module-resolves" | "chunk-tree-module-exact" | "chunk-bodies-order" | "body-levels-total"
  | "body-instance-exact" | "mir-index-counts-exact" | "tir-valid" | "mir-valid"
  | "facts-valid" | "cross-owner-qualified" | "cross-owner-reference-resolves"
  | "metadata-constant-not-materialised"
  | "template-body-shared" | "nested-body-boundary" | "instance-node-ids-exact"
  | "instantiation-preserves-existing-ids";

export type ProgramSite =
  | { readonly kind: "index" }
  | { readonly kind: "package"; readonly package: PackageId }
  | { readonly kind: "module"; readonly module: ModuleId }
  | { readonly kind: "node"; readonly module: ModuleId; readonly node: NodeId }
  | { readonly kind: "definition"; readonly definition: DefId }
  | { readonly kind: "signature"; readonly signature: SigId }
  | { readonly kind: "body"; readonly instance: BodyInstance }
  | { readonly kind: "artifact"; readonly artifact: ArtifactReference; readonly bindings: ArtifactBindings };

export type CanonicalizeProgram = (program: HostProgram, publication: TypePublication) => HostProgram;
export type PrintProgramIndex = (index: ProgramIndex) => string;
export type ParseProgramIndex = (text: string) => TextParseResult<ProgramIndex>;
export type PrintModuleBodies = (index: ProgramIndex, module: ModuleBodies) => string;
export type ParseModuleBodies = (index: ProgramIndex, text: string) => TextParseResult<ModuleBodies>;
export interface ProgramVerificationContext {
  readonly facts: FactsVerificationContext;
  readonly limits: InstantiationLimits;
  readonly tirOf: (module: ModuleId) => TirVerifierInput | null;
}
export type VerifyProgramIndex = (
  index: ProgramIndex,
  context: ProgramVerificationContext,
) => readonly Violation<ProgramRule, ProgramSite>[];
export type VerifyModuleBodies = (
  index: ProgramIndex,
  module: ModuleBodies,
  context: ProgramVerificationContext,
) => readonly Violation<ProgramRule, ProgramSite>[];
export type Instantiate = (
  index: ProgramIndex,
  module: ModuleBodies,
  artifact: ArtifactReference,
  bindings: BindingVector,
  limits: InstantiationLimits,
) => InstantiationResult;
