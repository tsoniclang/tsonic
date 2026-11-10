import type { Violation } from "../diag/contract.js";
import type { DefId } from "../ids/contract.js";
import type { BindingVector, BindingVerificationInput, TypeRule } from "../ir-types/contract.js";
import { verifyTypes } from "../ir-types/index.js";
import type { HirRule, HirSite, HirVerificationContext } from "./contract.js";

export interface HirBindingRequest {
  readonly definition: DefId;
  readonly vector: BindingVector;
  readonly site: HirSite;
}

interface BindingFailure {
  readonly rule: TypeRule;
  readonly family: string;
  readonly position: number | null;
  readonly detail: Violation<TypeRule, never>["detail"];
}

function bindingRule(rule: TypeRule): HirRule {
  switch (rule) {
    case "type-reference": return "type-reference";
    case "signature-reference": return "signature-reference";
    case "cross-owner-qualified": return "cross-owner-qualified";
    default: return "binding-vector-complete";
  }
}

export function verifyBindingVectors(
  requests: readonly HirBindingRequest[],
  context: HirVerificationContext,
): readonly Violation<HirRule, HirSite>[] {
  const selected: HirBindingRequest[] = [];
  const inputs: BindingVerificationInput[] = [];
  const results = new Map<HirBindingRequest, Violation<HirRule, HirSite>[]>();
  for (const request of requests) {
    const scope = context.bindingScopeOf(request.definition);
    if (scope === null) {
      results.set(request, [{ rule: "binding-vector-complete", site: request.site,
        detail: [{ kind: "text", value: "bindingScopeOf" }, { kind: "text", value: request.definition }] }]);
    } else {
      selected.push(request);
      inputs.push({ vector: request.vector, scope });
    }
  }
  if (inputs.length > 0) {
    const grouped = new Map<number, BindingFailure[]>();
    for (const violation of verifyTypes({ table: context.types, bindings: inputs, evidence: [] })) {
      if (violation.site.kind !== "binding") continue;
      const failure: BindingFailure = { rule: violation.rule, family: violation.site.family,
        position: violation.site.position, detail: violation.detail };
      const previous = grouped.get(violation.site.vector);
      if (previous === undefined) grouped.set(violation.site.vector, [failure]);
      else previous.push(failure);
    }
    selected.forEach((request, ordinal) => {
      const violations: Violation<HirRule, HirSite>[] = [];
      for (const violation of grouped.get(ordinal) ?? []) {
        violations.push({ rule: bindingRule(violation.rule), site: request.site,
          detail: [{ kind: "text", value: violation.family },
            { kind: "text", value: violation.position === null ? "complete" : String(violation.position) },
            ...violation.detail] });
      }
      results.set(request, violations);
    });
  }
  return Object.freeze(requests.flatMap(request => results.get(request) ?? []));
}
