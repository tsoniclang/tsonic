import type { Result } from "../../diag/contract.js";
import type { BodyInstance, TypeOf } from "../../ir-types/contract.js";
import type { TirBody } from "../../ir-tir/contract.js";
import type { MirBody } from "../../ir-mir/contract.js";
import type { AnalysisLimits, OriginsResult, PointerBackingFacts } from "../../ir-facts/contract.js";

export interface PointerBackingDeps {
  readonly originsOf: (instance: BodyInstance) => OriginsResult;
  readonly tirBody: (instance: BodyInstance) => TirBody;
  readonly typeOf: TypeOf;
  readonly limits: AnalysisLimits;
}

export type AnalyzePointerBacking = (
  deps: PointerBackingDeps,
  body: MirBody,
) => Result<PointerBackingFacts>;
