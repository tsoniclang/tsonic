import type { Result } from "../../diag/contract.js";
import type { SourceNodeRef } from "../../ids/contract.js";
import type { DataflowLimits } from "../../dataflow/contract.js";
import type { BodyInstance, TypeOf } from "../../ir-types/contract.js";
import type { HirNode } from "../../ir-hir/contract.js";
import type { TirBody } from "../../ir-tir/contract.js";
import type { MirBody } from "../../ir-mir/contract.js";
import type { AnalysisLimits, OriginsResult, RefinementFacts, Summary, SummaryKey } from "../../ir-facts/contract.js";

export interface RefinementsDeps {
  readonly tirBody: (instance: BodyInstance) => TirBody;
  readonly syntaxOf: (source: SourceNodeRef) => HirNode;
  readonly originsOf: (instance: BodyInstance) => OriginsResult;
  readonly summaryOf: (key: SummaryKey) => Summary;
  readonly typeOf: TypeOf;
  readonly limits: AnalysisLimits;
  readonly flowLimits: DataflowLimits;
}

export type AnalyzeRefinements = (
  deps: RefinementsDeps,
  body: MirBody,
) => Result<RefinementFacts>;
