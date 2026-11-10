import type { Result } from "../../diag/contract.js";
import type { DataflowLimits } from "../../dataflow/contract.js";
import type { DefId } from "../../ids/contract.js";
import type { BodyInstance, SignatureOf, TypeOf } from "../../ir-types/contract.js";
import type { CheckedPhase, Declaration } from "../../ir-hir/contract.js";
import type { TirBody } from "../../ir-tir/contract.js";
import type { MirBody } from "../../ir-mir/contract.js";
import type { AnalysisLimits, OriginsResult, Summary, SummaryKey } from "../../ir-facts/contract.js";

export interface OriginsDeps {
  readonly itemOf: (definition: DefId) => Declaration<CheckedPhase>;
  readonly tirBody: (instance: BodyInstance) => TirBody;
  readonly summaryOf: (key: SummaryKey) => Summary;
  readonly typeOf: TypeOf;
  readonly signatureOf: SignatureOf;
  readonly limits: AnalysisLimits;
  readonly flowLimits: DataflowLimits;
}

export type AnalyzeOrigins = (
  deps: OriginsDeps,
  body: MirBody,
) => Result<OriginsResult>;
