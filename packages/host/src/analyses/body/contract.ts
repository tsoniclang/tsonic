import type { DataflowAccount, DataflowResult } from "../../dataflow/contract.js";
import type { ErrorValue, UnitRequest, UnitResult } from "../../diag/contract.js";
import type { AnalysisLimits, BodyFacts, LivenessFacts, LogicalCellRef, Summary, SummaryAnswer, SummaryKey } from "../../ir-facts/contract.js";
import type { MirBody } from "../../ir-mir/contract.js";
import type { TirBody } from "../../ir-tir/contract.js";
import type { Execution, SignatureOf, TypeOf, TypeTable } from "../../ir-types/contract.js";

export interface BodyRoundEnvironment {
  readonly types: TypeTable;
  readonly typeOf: TypeOf;
  readonly signatureOf: SignatureOf;
  readonly limits: AnalysisLimits;
}

export interface BodyRoundDeps extends BodyRoundEnvironment {
  readonly summaryOf: (key: SummaryKey) => SummaryAnswer;
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
  readonly account: DataflowAccount;
  readonly unit: UnitRequest;
}

export interface InitializationProofInput {
  readonly modules: readonly Execution[];
  readonly entries: readonly Execution[];
  readonly storage: readonly LogicalCellRef[];
}

export interface InitializationProof {
  readonly modules: readonly Execution[];
  readonly entries: readonly Execution[];
}

export type ProveInitialization = (deps: InitializationProofDeps, input: InitializationProofInput) =>
  DataflowResult<UnitResult<InitializationProof | ErrorValue>>;
