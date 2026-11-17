import type { DataflowAccount } from "../dataflow/contract.js";
import { accountFailure, chargeResultEntries, chargeWork } from "../dataflow/index.js";
import type { Violation } from "../diag/contract.js";
import type { BindingScope, BindingVerificationInput } from "../ir-types/contract.js";
import { verifyBindings } from "../ir-types/index.js";
import type { BindingVerificationContext, FactsBindingTarget, FactsRule, FactsSite, FactsVerification } from "./contract.js";
import type { BindingVisit } from "./binding-inputs.js";
import { validIndex } from "./verify-relations.js";
import { recordFinding } from "./verification.js";

export const verifyFactBindings = (
  entries: Generator<BindingVisit, void>,
  target: FactsBindingTarget,
  root: FactsSite,
  context: BindingVerificationContext,
  account: DataflowAccount,
): FactsVerification<FactsRule> => {
  const initial = chargeWork(account, 1) ?? chargeResultEntries(account, 3);
  if (initial !== null) return initial;
  const inputs: BindingVerificationInput[] = [];
  const checks: { readonly site: FactsSite; readonly first: number; readonly end: number }[] = [];
  const violations: Violation<FactsRule, FactsSite>[] = [];
  let scopes: readonly BindingScope[] | null = null;
  let index = 0;
  for (;;) {
    const step = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
    if (step !== null) return step;
    const visit = entries.next();
    if (visit.done) break;
    if (visit.value === null) continue;
    const entry = visit.value;
    const first = inputs.length;
    let invalidType = false;
    for (const family of [entry.vector.classBindings, entry.vector.methodBindings, entry.vector.capturedBindings, entry.vector.selfBindings]) {
      for (const binding of family) {
        const work = chargeWork(account, 1);
        if (work !== null) return work;
        if (binding !== undefined && binding.kind === "bound" &&
          (!validIndex(binding.type, context.types.terms.length) || context.types.terms[binding.type] === undefined)) invalidType = true;
      }
    }
    if (invalidType) {
      const stop = recordFinding(account, violations, "last", "type-resolves", entry.site,
        "Every bound type resolves in the actual supplied canonical type table.");
      if (stop !== null) return stop;
    }
    if (entry.definition !== null) {
      const work = chargeWork(account, 1);
      if (work !== null) return work;
      const scope = context.bindingScopeOf(entry.definition);
      if (scope === null) {
        const stop = recordFinding(account, violations, "last", "bindings-complete", entry.site,
          "The complete lexical binding scope must resolve in the supplied declaration inventory.");
        if (stop !== null) return stop;
      } else {
        const stop = chargeResultEntries(account, 1);
        if (stop !== null) return stop;
        inputs.push({ vector: entry.vector, scope });
      }
    } else {
      const lookup = chargeWork(account, 1);
      if (lookup !== null) return lookup;
      if (index === 0) {
        scopes = context.sourceBindingScopesOf(target);
        const stopped = accountFailure(account);
        if (stopped !== null) return stopped;
        if (scopes === null) {
          const stop = recordFinding(account, violations, "last", "bindings-complete", root,
            "The source-scope occurrence inventory must resolve for actual definition-null binding vectors.");
          if (stop !== null) return stop;
        }
      }
      if (scopes !== null) {
        const scope = scopes[index];
        if (scope === undefined) {
          const stop = recordFinding(account, violations, "last", "bindings-complete", entry.site,
            "Every definition-null binding-vector occurrence retains its actual source scope in declared field order.");
          if (stop !== null) return stop;
        } else {
          const stop = chargeResultEntries(account, 1);
          if (stop !== null) return stop;
          inputs.push({ vector: entry.vector, scope });
        }
      }
      index += 1;
    }
    checks.push({ site: entry.site, first, end: inputs.length });
  }
  if (scopes !== null && scopes.length > index) {
    const stop = recordFinding(account, violations, "first", "bindings-complete", root,
      "The source-scope inventory has no extra definition-null binding-vector occurrence.");
    if (stop !== null) return stop;
  }
  if (inputs.length !== 0) {
    const checked = verifyBindings(inputs, context.types.terms.length, (work, entries) =>
      chargeWork(account, work) ?? chargeResultEntries(account, entries));
    if (checked.kind === "resource-stop") return checked.stop;
    const initial = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
    if (initial !== null) return initial;
    const invalid = new Set<number>();
    for (const violation of checked.violations) {
      const step = chargeWork(account, 1);
      if (step !== null) return step;
      if (violation.site.kind === "binding" && violation.rule !== "type-reference") {
        const stop = chargeResultEntries(account, 1);
        if (stop !== null) return stop;
        invalid.add(violation.site.vector);
      }
    }
    for (const check of checks) {
      const step = chargeWork(account, 1);
      if (step !== null) return step;
      let failed = false;
      for (let index = check.first; index < check.end; index += 1) {
        const work = chargeWork(account, 1);
        if (work !== null) return work;
        if (invalid.has(index)) failed = true;
      }
      if (failed) {
        const stop = recordFinding(account, violations, "last", "bindings-complete", check.site,
          "A binding vector retains every expected class, method, captured and self binding in canonical owner order.");
        if (stop !== null) return stop;
      }
    }
  }
  return { kind: "complete", violations };
};
