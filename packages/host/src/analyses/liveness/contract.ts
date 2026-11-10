import type { Result } from "../../diag/contract.js";
import type { DataflowLimits } from "../../dataflow/contract.js";
import type { AnalysisLimits, LivenessFacts, Summary, SummaryKey } from "../../ir-facts/contract.js";
import type { MirBody } from "../../ir-mir/contract.js";

export interface LivenessDeps {
  readonly summaryOf: (key: SummaryKey) => Summary;
  readonly limits: AnalysisLimits;
  readonly flowLimits: DataflowLimits;
}

export type AnalyzeLiveness = (deps: LivenessDeps, body: MirBody) => Result<LivenessFacts>;
