import type { DataflowLimits } from "../dataflow/contract.js";
import type { BodyId, DefId } from "../ids/contract.js";
import type { CheckedPhase, Declaration, HirBody, HirModuleBinding } from "../ir-hir/contract.js";
import type { InferDeps, InferenceLimits } from "../infer/contract.js";
import type { RulesDeps } from "../rules/contract.js";
import { pipelineWiring } from "./wiring.js";

export interface InferenceRun {
  readonly rules: RulesDeps;
  readonly hirBody: (body: BodyId) => HirBody;
  readonly itemOf: (definition: DefId) => Declaration<CheckedPhase>;
  readonly bindings: readonly (readonly HirModuleBinding[])[];
  readonly limits: InferenceLimits;
  readonly graph: DataflowLimits;
}

export function inferDepsOf(run: InferenceRun): InferDeps {
  return { hirBody: run.hirBody, itemOf: run.itemOf, bindings: run.bindings, rules: pipelineWiring.rules.createRuleTable(run.rules),
    types: run.rules.types, typeExpansion: run.rules.typeExpansion, limits: run.limits, graph: run.graph };
}
