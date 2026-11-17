import type { Diagnostic, Result } from "../diag/contract.js";
import type { DefId, SourceNodeRef, TyId } from "../ids/contract.js";
import type { ArtifactBindings, BodyInstance, ConstantContext, ConstValue, MemberTable, TypeOf, TypeTable } from "../ir-types/contract.js";
import type {
  CapturedFact, CheckedPhase, Declaration, HirMemoryFieldCapture, HirMemoryLayoutCapture, HirObservationCapture,
} from "../ir-hir/contract.js";
import type {
  AnalysisLimits, BodyObservations, MetadataKey, MetadataRecord,
} from "../ir-facts/contract.js";
import type { Step } from "../step/contract.js";

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

export interface ObservationDeclaration {
  readonly source: SourceNodeRef;
  readonly definition: DefId;
}

export interface ObservationsInput {
  readonly instance: BodyInstance;
  readonly captures: readonly HirObservationCapture[];
  readonly declarations: readonly ObservationDeclaration[];
  readonly types: TypeTable;
  readonly limits: MetadataLimits;
}

export type MetadataOf = (
  deps: MetadataDeps,
  definition: DefId,
  bindings: ArtifactBindings,
) => Result<MetadataRecord | null>;

export type ObservationsOf = (input: ObservationsInput) => Step<Result<BodyObservations>, MetadataKey, ObservationsInput, Diagnostic>;

export type ResumeObservations = (input: ObservationsInput,
  answers: readonly Result<MetadataRecord | null>[]) => Result<BodyObservations>;
