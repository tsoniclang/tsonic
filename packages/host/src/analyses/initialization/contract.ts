import type { Result } from "../../diag/contract.js";
import type { DataflowLimits } from "../../dataflow/contract.js";
import type { PlaceId } from "../../ids/contract.js";
import type { BodyInstance, SignatureOf } from "../../ir-types/contract.js";
import type { AnalysisLimits, InitializationFacts, Summary, SummaryKey } from "../../ir-facts/contract.js";
import type { MirBody } from "../../ir-mir/contract.js";

export interface InitializationDeps {
  readonly initializedOnEntry: (instance: BodyInstance) => readonly PlaceId[];
  readonly signatureOf: SignatureOf;
  readonly summaryOf: (key: SummaryKey) => Summary;
  readonly limits: AnalysisLimits;
  readonly flowLimits: DataflowLimits;
}

export type AnalyzeInitialization = (
  deps: InitializationDeps,
  body: MirBody,
) => Result<InitializationFacts>;
