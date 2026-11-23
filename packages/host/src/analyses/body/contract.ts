import type { CallerRefusal, DataflowAccount, DataflowResult } from "../../dataflow/contract.js";
import type { ErrorValue, UnitRef, UnitRequest, UnitResult } from "../../diag/contract.js";
import type { DefId, LocalRef, ModuleId, Origin, SigId, SourceNodeRef, TyId } from "../../ids/contract.js";
import type { AnalysisLimits, BodyFacts, LivenessFacts, ModuleStaticCellRef, Summary, SummaryAnswer, SummaryKey, SummaryPosition } from "../../ir-facts/contract.js";
import type { MirBody, MirEntry } from "../../ir-mir/contract.js";
import type { TirBody } from "../../ir-tir/contract.js";
import type { ArtifactBindings, Execution, SignatureOf, TypeOf, TypeTable } from "../../ir-types/contract.js";

export interface BodyRoundEnvironment {
  readonly types: TypeTable;
  readonly typeOf: TypeOf;
  readonly signatureOf: SignatureOf;
  readonly staticModuleBindingsOf: (module: ModuleId) => ArtifactBindings | null;
  readonly staticTypeOf: (declaration: SourceNodeRef) => TyId | null;
  readonly sourceObjectFormal: (account: DataflowAccount, local: LocalRef, storage: TyId) => DataflowResult<boolean>;
  readonly limits: AnalysisLimits;
}

export interface RoundLeast {
  readonly kind: "least";
  readonly execution: Execution;
  readonly signature: SigId;
  readonly entry: MirEntry;
}

export type RoundCallRead = SummaryAnswer | RoundLeast
  | { readonly kind: "prior-summary"; readonly summary: Summary }
  | { readonly kind: "prior-error"; readonly grounds: readonly [UnitRef, ...UnitRef[]] };

export interface BodyRoundDeps extends BodyRoundEnvironment {
  readonly summaryOf: (key: SummaryKey, admittedKey: string) => RoundCallRead;
  readonly account: DataflowAccount;
  readonly unit: UnitRequest;
}

export interface BodyRoundInput {
  readonly execution: Execution;
  readonly mir: MirBody;
  readonly tir: TirBody;
  readonly liveness: LivenessFacts;
}

export interface BodyRoundValue {
  readonly facts: BodyFacts;
  readonly summary: Summary;
}

export type BodyRoundResult = DataflowResult<UnitResult<BodyRoundValue | ErrorValue>>;
export type AnalyzeBodyRound = (deps: BodyRoundDeps, input: BodyRoundInput) => BodyRoundResult;

export interface InitializationProofDeps {
  readonly summaryOf: (key: SummaryKey) => SummaryAnswer;
  readonly originOf: (reference: SourceNodeRef) => Origin | null;
  readonly originAt: (position: SummaryPosition) => Origin | null;
  readonly declarationOriginOf: (definition: DefId) => Origin | null;
  readonly maximumConditionAlternatives: number;
  readonly conditionRefusal: CallerRefusal;
  readonly account: DataflowAccount;
  readonly unit: UnitRequest;
}

export interface InitializationProofInput {
  readonly modules: readonly Execution[];
  readonly entries: readonly Execution[];
  readonly storage: readonly ModuleStaticCellRef[];
}

export interface InitializationProof {
  readonly modules: readonly Execution[];
  readonly entries: readonly Execution[];
}

export type ProveInitialization = (deps: InitializationProofDeps, input: InitializationProofInput) =>
  DataflowResult<UnitResult<InitializationProof | ErrorValue>>;
