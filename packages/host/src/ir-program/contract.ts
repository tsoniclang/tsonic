import type { TextParseResult, Violation } from "../diag/contract.js";
import type { DefId, DefinitionPath, ItemNodeRef, ModuleId, ModulePath, SigId, TyId } from "../ids/contract.js";
import type {
  ArtifactBindings, BindingVector, BodyInstance, MemberInventory, SelectedNativeFacts, SignatureEndpoint, SignatureRequest, TypeInterner, TypePublication, TypeTable,
} from "../ir-types/contract.js";
import type { CheckedModuleImage, CheckedPhase, DefaultInitializerOwner, Expression, HirModule } from "../ir-hir/contract.js";
import type { CandidateInput, PlacedSignature } from "../ir-infer/contract.js";
import type { TirApplication, TirBody, TirChapterTree, TirMemberOccurrence, TirReadyReadAdmission, TirVerifierInput, TypedPhase } from "../ir-tir/contract.js";
import type { MirBody, MirVerificationLimits } from "../ir-mir/contract.js";
import type { BodyFacts, BodyObservations, FactsVerificationContext, MetadataRecord, Summary } from "../ir-facts/contract.js";
import type { InstantiationAllocationStop, InstantiationStop, ProgramWork } from "./work.js";
import type { CallerRefusal, DataflowAccount, DataflowResult, DataflowStop } from "../dataflow/contract.js";
import type { ArtifactReference, InstantiationLimits, ProgramRule, ProgramVerificationLimits, ProgramSite, ProgramVerificationStop } from "./work-data.js";
import type { ProgramIndex, ProgramInitialization } from "./data.js";
export type { ArtifactReference, InstantiationLimits, ProgramVerificationLimits, ProgramRule, ProgramSite, SummaryArtifactReference } from "./work-data.js";

export type {
  BodyRecord, ConstantRecord, DefinitionNode, ModuleRecord, PackageExport, PackageRecord, ProgramIndex, ProgramInitialization,
  ResolvedExternalEntry, SignatureRecord, SupportedProgramSchema,
} from "./data.js";

export type PublishedBody = {
  readonly instance: BodyInstance;
  readonly tir: TirBody;
} & (
  | { readonly kind: "template" }
  | { readonly kind: "selected"; readonly mir: MirBody; readonly observations: BodyObservations;
      readonly facts: readonly BodyFacts[] }
);

export interface ModuleBodies {
  readonly module: ModuleId;
  readonly tree: TirChapterTree;
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
  | DataflowStop
  | { readonly kind: "instantiated"; readonly artifact: InstantiatedArtifact; readonly types: TypeTable }
  | { readonly kind: "missing-binding-artifact"; readonly artifact: ArtifactReference;
      readonly bindings: BindingVector }
  | { readonly kind: "resource-limit";
      readonly dimension: "binding-vectors" | "work" | "created-records" | "type-depth"
        | "type-visits" | "union-members" | "intersection-members";
      readonly maximum: number };

export interface ProgramIdentityImage {
  readonly treeOf: (source: TirChapterTree) => TirChapterTree | null;
  readonly tirOf: (source: TirBody) => TirBody | null;
  readonly mirOf: (source: MirBody) => MirBody | null;
  readonly factsOf: (source: BodyFacts) => BodyFacts | null;
  readonly observationsOf: (source: BodyObservations) => BodyObservations | null;
  readonly summaryOf: (source: Summary) => Summary | null;
  readonly metadataOf: (source: MetadataRecord) => MetadataRecord | null;
  readonly initializationOf: (source: ProgramInitialization) => ProgramInitialization | null;
}
export type ProgramPublicationMode =
  | { readonly kind: "data-only" }
  | { readonly kind: "with-evidence"; readonly read: (account: DataflowAccount) => DataflowResult<ProgramEvidenceInput> };

export type CanonicalizeProgram = (
  program: HostProgram, publication: TypePublication, resources: ProgramVerificationWork, mode: ProgramPublicationMode,
) => InstantiationStop | { readonly kind: "evidence-input-stop"; readonly stop: DataflowStop }
  | { readonly kind: "complete"; readonly mode: "data-only"; readonly value: HostProgram; readonly image: ProgramIdentityImage }
  | { readonly kind: "complete"; readonly mode: "with-evidence"; readonly value: HostProgram; readonly image: ProgramIdentityImage;
      readonly evidence: ProgramEvidence };

export interface ProgramMemberEvidence {
  readonly instance: BodyInstance;
  readonly occurrence: TirMemberOccurrence;
  readonly inventory: MemberInventory | null;
}

export interface ProgramStaticStorageEvidence {
  readonly declaration: ItemNodeRef;
  readonly storage: TyId | null;
}

export interface ProgramLayoutOperand {
  readonly instance: BodyInstance;
  readonly root: Expression<TypedPhase>;
}

export interface ProgramLayoutOperandInput extends ProgramLayoutOperand {
  readonly tree: TirChapterTree;
}

export interface ProgramEvidenceInput {
  readonly checked: readonly HirModule[];
  readonly members: readonly ProgramMemberEvidence[];
  readonly signatures: readonly PlacedSignature[];
  readonly storage: readonly ProgramStaticStorageEvidence[];
  readonly layoutOperands: readonly ProgramLayoutOperandInput[] | null;
}

export interface ProgramEvidence {
  readonly checked: readonly CheckedModuleImage[];
  readonly members: readonly ProgramMemberEvidence[];
  readonly signatures: readonly { readonly request: SignatureRequest | null; readonly signature: SigId }[];
  readonly storage: readonly ProgramStaticStorageEvidence[];
  readonly layoutOperands: readonly ProgramLayoutOperand[] | null;
}

export type PrintProgramIndex = (index: ProgramIndex) => string;
export type ParseProgramIndex = (text: string) => TextParseResult<ProgramIndex>;
export type PrintModuleBodies = (index: ProgramIndex, module: ModuleBodies) => string;
export type ParseModuleBodies = (index: ProgramIndex, text: string) => TextParseResult<ModuleBodies>;
export type ProgramVerificationWork = ProgramWork;
export type TirSpecializationPlacement =
  | { readonly kind: "endpoint"; readonly template: PlacedSignature; readonly selected: PlacedSignature }
  | { readonly kind: "execution"; readonly template: PlacedSignature };
export type ReplayTirCandidate = (input: CandidateInput, result: TyId) => DataflowResult<TirApplication>;
export type TirDefaultOwner = DefaultInitializerOwner<TypedPhase>;
export type ReadSpecializationDefault = (owner: TirDefaultOwner) => DataflowResult<Expression<CheckedPhase>>;
export interface TirSpecializationEvidence {
  readonly replay: ReplayTirCandidate;
  readonly checkedDefaultOf: ReadSpecializationDefault;
}
export type SpecializeTir = (template: TirBody, instance: BodyInstance, placement: TirSpecializationPlacement,
  types: TypeInterner, resources: ProgramVerificationWork, evidence: TirSpecializationEvidence) =>
  { readonly kind: "complete"; readonly value: TirBody; readonly defaults: readonly TirDefaultOwner[] }
  | Extract<InstantiationResult, { readonly kind: "resource-limit" | "refused" }>;
export type CreateProgramVerificationWork = (limits: ProgramVerificationLimits, account: DataflowAccount) => ProgramVerificationWork;
export type AdmitProgramReadyRow = (resources: ProgramVerificationWork, work: number, records: number) => InstantiationAllocationStop | null;
export type CreateTirReadyReadAdmission = (account: DataflowAccount) => TirReadyReadAdmission<DataflowStop>;
export interface ProgramVerificationContext {
  readonly initialization: ProgramInitialization;
  readonly nativeFactsKey: string;
  readonly selectedNativeFacts: SelectedNativeFacts;
  readonly facts: FactsVerificationContext;
  readonly resources: ProgramVerificationWork;
  readonly conditionRefusal: CallerRefusal;
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
