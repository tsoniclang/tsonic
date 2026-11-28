import type { DataflowLimits } from "../dataflow/contract.js";
import type { Diagnostic } from "../diag/contract.js";
import type { BodyId, DefId, ModuleId, SourceNodeRef } from "../ids/contract.js";
import type { CheckedPhase, CheckedSourceObjectFields, CheckedTypingCuts, Declaration, HirBindingViews, HirBody, HirModuleBinding, HirNode } from "../ir-hir/contract.js";
import { checkedSourceObjectFieldsOf } from "../ir-hir/index.js";
import type { InferDeps, InferenceLimits, StructuralTypingCuts } from "../infer/contract.js";
import type { MemberRuleContinuation, RulesDeps } from "../rules/contract.js";
import type { BindingScope, TypePublicationWork } from "../ir-types/contract.js";
import { admitTypePublicationStep, readType } from "../ir-types/index.js";
import { pipelineWiring } from "./wiring.js";

export interface InferenceRun extends HirBindingViews {
  readonly structuralCuts: StructuralTypingCuts;
  readonly cuts: CheckedTypingCuts;
  readonly checkedNodeOf: (reference: SourceNodeRef) => HirNode | null;
  readonly checkerDiagnosticsOf: (module: ModuleId) => readonly Diagnostic[];
  readonly rules: RulesDeps;
  readonly hirBody: (body: BodyId) => HirBody;
  readonly itemOf: (definition: DefId) => Declaration<CheckedPhase>;
  readonly bindingScopeOf: (definition: DefId) => BindingScope;
  readonly bindings: readonly (readonly HirModuleBinding[])[];
  readonly limits: InferenceLimits;
  readonly graph: DataflowLimits;
  readonly typeWork: TypePublicationWork;
}

export function inferDepsOf(run: InferenceRun): InferDeps<MemberRuleContinuation> {
  let readers: Map<BodyId, CheckedSourceObjectFields> | null = null;
  const sourceFields: InferDeps<MemberRuleContinuation>["sourceFields"] = body => {
    if (admitTypePublicationStep(run.typeWork) !== null) return null;
    const previous = readers?.get(body);
    if (previous !== undefined) return previous;
    if (admitTypePublicationStep(run.typeWork, 0, readers === null ? 5 : 4) !== null) return null;
    const selected = checkedSourceObjectFieldsOf(run.hirBody(body), {
      bodyOf: run.hirBody, nodeOf: run.checkedNodeOf, itemOf: run.itemOf, bindingOf: run.bindingOf,
      typeOf: type => readType(run.rules.types, type), admit: (work, records) => admitTypePublicationStep(run.typeWork, work, records) === null,
    });
    (readers ??= new Map()).set(body, selected);
    return selected;
  };
  return { structuralCuts: run.structuralCuts, cuts: run.cuts, checkedNodeOf: run.checkedNodeOf, hirBody: run.hirBody, itemOf: run.itemOf, bindings: run.bindings, bindingOf: run.bindingOf, checkerDiagnosticsOf: run.checkerDiagnosticsOf, rules: pipelineWiring.rules.createRuleTable(run.rules),
    sourceFields, readySourceField: occurrence => readers?.get(occurrence.body)?.ready(occurrence.node) ?? null,
    bindingScopeOf: run.bindingScopeOf, types: run.rules.types, typeWork: run.typeWork, typeExpansion: run.rules.typeExpansion,
    limits: run.limits, graph: run.graph };
}
