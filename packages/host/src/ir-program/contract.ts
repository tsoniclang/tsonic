import type { Diagnostic, TextParseResult, Violation } from "../diag/contract.js";
import type { BodyId, DefId, DefinitionPath, ModuleId, ModulePath, NodeId, PackageId, SigId } from "../ids/contract.js";
import type {
  ArtifactBindings, BindingVector, BodyInstance, ConstantReference, ConstValue, Execution, SelectedNativeFacts, SignatureEndpoint, TypePublication, TypeTable,
} from "../ir-types/contract.js";
import type { SourceFile } from "../ir-hir/contract.js";
import type { TirBody, TirVerifierInput, TypedPhase } from "../ir-tir/contract.js";
import type { MirBody, MirVerificationLimits } from "../ir-mir/contract.js";
import type { BodyFacts, BodyObservations, FactsVerificationContext, MetadataRecord, Summary } from "../ir-facts/contract.js";
import type { ProgramWork } from "./work.js";
import type { ArtifactReference, InstantiationLimits, ProgramSite, ProgramVerificationStop } from "./work-data.js";
export type { ArtifactReference, InstantiationLimits, ProgramSite, SummaryArtifactReference } from "./work-data.js";

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
  // Position among endpoints of this kind, in declaration endpoint-vector order.
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
  readonly reference: ConstantReference;
  readonly value: ConstValue;
}

export type SupportedProgramSchema = 1;

export interface ProgramIndex {
  readonly schema: number;
  readonly nativeFactsKey: string;
  readonly rootPackage: PackageId;
  readonly packages: readonly PackageRecord[];
  readonly modules: readonly ModuleRecord[];
  readonly types: TypeTable;
  readonly signatures: readonly SignatureRecord[];
  readonly bodies: readonly BodyRecord[];
  readonly executions: readonly Execution[];
  readonly metadata: readonly MetadataRecord[];
  readonly summaries: readonly Summary[];
  readonly constants: readonly ConstantRecord[];
  readonly diagnostics: readonly Diagnostic[];
}

export interface PublishedBody {
  readonly instance: BodyInstance;
  readonly tir: TirBody;
  readonly mir: MirBody;
  readonly observations: BodyObservations;
  readonly facts: readonly BodyFacts[];
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

export type InstantiatedArtifact =
  | { readonly kind: "tir"; readonly body: TirBody }
  | { readonly kind: "mir"; readonly body: MirBody }
  | { readonly kind: "facts"; readonly facts: BodyFacts }
  | { readonly kind: "summary"; readonly summary: Summary }
  | { readonly kind: "metadata"; readonly metadata: MetadataRecord };

// The complete table retains both input row prefixes; newly published rows follow them.
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
  | "modules-order" | "module-package-resolves" | "identity-path-exact" | "items-order" | "item-definition-resolves"
  | "definition-node-resolves" | "definition-node-owner-exact" | "module-node-id-dense"
  | "exports-order" | "export-definition-resolves" | "signatures-order" | "signature-reference-resolves"
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
  | "executions-order" | "execution-key-unique" | "execution-body-resolves" | "execution-entry-resolves"
  | "facts-execution-total" | "facts-execution-order";

export type CanonicalizeProgram = (program: HostProgram, publication: TypePublication) => HostProgram;
export type PrintProgramIndex = (index: ProgramIndex) => string;
export type ParseProgramIndex = (text: string) => TextParseResult<ProgramIndex>;
export type PrintModuleBodies = (index: ProgramIndex, module: ModuleBodies) => string;
export type ParseModuleBodies = (index: ProgramIndex, text: string) => TextParseResult<ModuleBodies>;
export type ProgramVerificationWork = ProgramWork;
export type CreateProgramVerificationWork = (limits: InstantiationLimits) => ProgramVerificationWork;
export interface ProgramVerificationContext {
  readonly nativeFactsKey: string;
  readonly selectedNativeFacts: SelectedNativeFacts;
  readonly facts: FactsVerificationContext;
  readonly resources: ProgramVerificationWork;
  /** The limit of each body's MIR verification, as the limit setter gave it. Each body has its own account. */
  readonly mirVerification: MirVerificationLimits;
  readonly modulePathOf: (module: ModuleId) => ModulePath | null;
  readonly definitionPathOf: (definition: DefId) => DefinitionPath | null;
  readonly tirOf: (module: ModuleId) => TirVerifierInput | null;
  readonly signatureIdOf: (
    definition: DefId, kind: SignatureEndpoint, ordinal: number, bindings: ArtifactBindings,
  ) => SigId | null;
}
export type VerifyProgramIndex = (
  index: ProgramIndex,
  context: ProgramVerificationContext,
) => ProgramVerificationResult;
export type ProgramVerificationResult =
  | { readonly kind: "complete"; readonly violations: readonly Violation<ProgramRule, ProgramSite>[] }
  | ProgramVerificationStop;
export type VerifyModuleBodies = (
  index: ProgramIndex,
  module: ModuleBodies,
  context: ProgramVerificationContext,
) => ProgramVerificationResult;
export type Instantiate = (
  index: ProgramIndex,
  module: ModuleBodies,
  artifact: ArtifactReference,
  bindings: BindingVector,
  limits: InstantiationLimits,
) => InstantiationResult;
