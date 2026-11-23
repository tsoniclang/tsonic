import type { DataflowLimits } from "../dataflow/contract.js";
import type { Diagnostic } from "../diag/contract.js";
import type { BodyId, DefId, ModuleId, SourceNodeRef } from "../ids/contract.js";
import type { CheckedPhase, CheckedTypingCuts, Declaration, HirBindingViews, HirBody, HirModuleBinding, HirNode } from "../ir-hir/contract.js";
import type { InferDeps, InferenceLimits, StructuralTypingCuts } from "../infer/contract.js";
import type { MemberRuleContinuation, RulesDeps } from "../rules/contract.js";
import type { TypePublicationWork } from "../ir-types/contract.js";
import { pipelineWiring } from "./wiring.js";

export interface InferenceRun extends HirBindingViews {
  readonly structuralCuts: StructuralTypingCuts;
  readonly cuts: CheckedTypingCuts;
  readonly checkedNodeOf: (reference: SourceNodeRef) => HirNode | null;
  readonly checkerDiagnosticsOf: (module: ModuleId) => readonly Diagnostic[];
  readonly rules: RulesDeps;
  readonly hirBody: (body: BodyId) => HirBody;
  readonly itemOf: (definition: DefId) => Declaration<CheckedPhase>;
  readonly bindings: readonly (readonly HirModuleBinding[])[];
  readonly limits: InferenceLimits;
  readonly graph: DataflowLimits;
  readonly typeWork: TypePublicationWork;
}

export function inferDepsOf(run: InferenceRun): InferDeps<MemberRuleContinuation> {
  return { structuralCuts: run.structuralCuts, cuts: run.cuts, checkedNodeOf: run.checkedNodeOf, hirBody: run.hirBody, itemOf: run.itemOf, bindings: run.bindings, bindingOf: run.bindingOf, checkerDiagnosticsOf: run.checkerDiagnosticsOf, rules: pipelineWiring.rules.createRuleTable(run.rules),
    types: run.rules.types, typeWork: run.typeWork, typeExpansion: run.rules.typeExpansion, limits: run.limits, graph: run.graph };
}
