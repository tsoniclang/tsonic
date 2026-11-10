import type { Result } from "../diag/contract.js";
import type { DefId, TyId } from "../ids/contract.js";
import type { ArtifactBindings, BodyInstance, ConstantContext, ConstValue, MemberTable, TypeOf } from "../ir-types/contract.js";
import type {
  CapturedFact, CheckedPhase, Declaration, HirBody, HirMemoryFieldCapture, HirMemoryLayoutCapture, HirObservationCapture,
} from "../ir-hir/contract.js";
import type {
  AnalysisLimits, BodyMetadataResult, MetadataKey, MetadataRecord, OriginsResult,
} from "../ir-facts/contract.js";

export interface MetadataLimits {
  readonly maximumWork: number;
  readonly maximumGeometryBits: number;
}

export interface MetadataDeps {
  readonly itemOf: (definition: DefId) => Declaration<CheckedPhase>;
  readonly capturedMetadataOf: (
    key: MetadataKey,
  ) => CapturedFact<HirMemoryLayoutCapture | HirMemoryFieldCapture | null>;
  readonly constValue: (initializer: BodyInstance, context: ConstantContext) => ConstValue;
  readonly membersOf: (type: TyId) => MemberTable;
  readonly typeOf: TypeOf;
  readonly limits: AnalysisLimits;
  readonly metadataLimits: MetadataLimits;
}

export interface BodyMetadataDeps {
  readonly capturedObservationsOf: (instance: BodyInstance) => readonly HirObservationCapture[];
  readonly originsOf: (instance: BodyInstance) => OriginsResult;
  readonly metadataOf: (key: MetadataKey) => MetadataRecord | null;
  readonly typeOf: TypeOf;
  readonly membersOf: (type: TyId) => MemberTable;
  readonly limits: AnalysisLimits;
  readonly metadataLimits: MetadataLimits;
}

export type MetadataOf = (
  deps: MetadataDeps,
  definition: DefId,
  bindings: ArtifactBindings,
) => Result<MetadataRecord | null>;

export type BodyMetadataOf = (
  deps: BodyMetadataDeps,
  body: HirBody,
  bindings: ArtifactBindings,
) => Result<BodyMetadataResult>;
