import type { Result } from "../../diag/contract.js";
import type { BodyInstance } from "../../ir-types/contract.js";
import type { MirBody } from "../../ir-mir/contract.js";
import type { AnalysisLimits, OriginsResult, LivenessFacts, SuspensionFacts } from "../../ir-facts/contract.js";

export interface SuspensionDeps {
  readonly livenessOf: (instance: BodyInstance) => LivenessFacts;
  readonly originsOf: (instance: BodyInstance) => OriginsResult;
  readonly limits: AnalysisLimits;
}

export type AnalyzeSuspension = (deps: SuspensionDeps, body: MirBody) => Result<SuspensionFacts>;
