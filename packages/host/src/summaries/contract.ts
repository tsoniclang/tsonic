import type { Result } from "../diag/contract.js";
import type { DataflowLimits } from "../dataflow/contract.js";
import type { DefId } from "../ids/contract.js";
import type { BodyInstance, SignatureOf, TypeOf } from "../ir-types/contract.js";
import type { CheckedPhase, Declaration } from "../ir-hir/contract.js";
import type { TirBody } from "../ir-tir/contract.js";
import type {
  AnalysisLimits, BodyFacts, CallComponent, CallGraph, Summary, SummaryKey,
} from "../ir-facts/contract.js";

export interface SummaryLimits {
  readonly maximumWork: number;
  readonly maximumIterationsPerComponent: number;
  readonly maximumComponentSize: number;
}

export interface CallGraphDeps {
  readonly itemOf: (definition: DefId) => Declaration<CheckedPhase>;
  readonly bodiesOf: (definition: DefId) => readonly BodyInstance[];
  readonly tirBody: (instance: BodyInstance) => TirBody;
  readonly signatureOf: SignatureOf;
  readonly typeOf: TypeOf;
  readonly limits: AnalysisLimits;
  readonly graphLimits: DataflowLimits;
  readonly summaryLimits: SummaryLimits;
}

export interface SummariesDeps {
  readonly bodiesOf: (key: SummaryKey) => readonly BodyInstance[];
  readonly signatureOf: SignatureOf;
  readonly summaryOf: (key: SummaryKey) => Summary;
  readonly analyzeBody: (
    instance: BodyInstance,
    approximations: readonly Summary[],
  ) => Result<BodyFacts>;
  readonly limits: AnalysisLimits;
  readonly summaryLimits: SummaryLimits;
}

export type BuildCallGraph = (
  deps: CallGraphDeps,
  roots: readonly DefId[],
) => Result<CallGraph>;

export type SummariesOf = (
  deps: SummariesDeps,
  component: CallComponent,
  instances: readonly SummaryKey[],
) => Result<readonly Summary[]>;
