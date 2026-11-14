import type { BoundCheckOutcome, InferenceValue, VariableRule } from "../ir-infer/contract.js";
import type { RulesDeps } from "./contract.js";
import { decideEmbedding } from "./embed.js";
import { notDecidedYet } from "./frontier.js";
import { mergeErrors, validateValue } from "./errors.js";

export function localVariableRule(deps: RulesDeps): VariableRule {
  return {
    finalize: input => {
      const named = `the local variable ${input.variable.id}`;
      if (input.default !== null || input.declaredConstraint !== null || input.declaredDefault !== null)
        return notDecidedYet(`${named} with a default or a declared constraint`, null);
      const [demand] = input.demands;
      const [producer] = input.producers;
      let final: InferenceValue | undefined;
      if (demand !== undefined) {
        if (input.demands.some(other => other.value.type !== demand.value.type)) return notDecidedYet(`${named} with demands of different types`, null);
        final = { value: demand.value, error: mergeErrors(input.demands) };
      } else if (producer !== undefined && input.producers.length === 1) final = { value: producer.value, error: producer.error };
      if (final === undefined) return notDecidedYet(`${named} with ${input.producers.length} producers and no demand`, null);
      validateValue(deps, final);
      return { kind: "ok", value: final, diagnostics: [] };
    },
    check: input => {
      validateValue(deps, input.final);
      validateValue(deps, input.bound);
      const error = mergeErrors([input.final, input.bound]);
      if (error !== null) return { kind: "ok", value: { kind: "error", error }, diagnostics: [] };
      const value = input.bound.value.type;
      const final = input.final.value.type;
      const embedding = input.bound.kind === "producer"
        ? decideEmbedding(deps, value, final, "bound", input.variable.occurrence, null)
        : decideEmbedding(deps, final, value, "bound", input.variable.occurrence, null);
      const outcome: BoundCheckOutcome = { kind: "satisfied", embedding };
      return { kind: "ok", value: outcome, diagnostics: [] };
    },
  };
}

export function signatureVariableRule(deps: RulesDeps): VariableRule {
  return {
    finalize: input => {
      if (input.default !== null || input.declaredConstraint !== null || input.declaredDefault !== null)
        return notDecidedYet("a signature variable with a default or declared constraint", null);
      const first = input.producers[0];
      if (first === undefined) return notDecidedYet("the unseeded signature-variable default", null);
      const error = mergeErrors(input.producers);
      if (error !== null) {
        const producer = input.producers.find(producer => producer.error !== null);
        if (producer === undefined) return notDecidedYet("a missing actual error producer", null);
        const value = { value: producer.value, error };
        validateValue(deps, value);
        return { kind: "ok", value, diagnostics: [] };
      }
      if (input.producers.some(producer => producer.value.type !== first.value.type))
        return notDecidedYet("the native join of distinct signature producer types", null);
      const value = { value: first.value, error: null };
      validateValue(deps, value);
      return { kind: "ok", value, diagnostics: [] };
    },
    check: input => {
      validateValue(deps, input.final);
      validateValue(deps, input.bound);
      const error = mergeErrors([input.final, input.bound]);
      if (error !== null) return { kind: "ok", value: { kind: "error", error }, diagnostics: [] };
      if (input.bound.kind === "demand" && input.bound.value.type !== input.final.value.type)
        return { kind: "ok", value: { kind: "refused", reason: "signature-use-demand" }, diagnostics: [] };
      const embedding = input.bound.kind === "producer"
        ? decideEmbedding(deps, input.bound.value.type, input.final.value.type, "bound", input.variable.occurrence, null)
        : decideEmbedding(deps, input.final.value.type, input.bound.value.type, "bound", input.variable.occurrence, null);
      return { kind: "ok", value: { kind: "satisfied", embedding }, diagnostics: [] };
    },
  };
}
