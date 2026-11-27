import type { BoundCheckOutcome, InferenceValue, VariableRule } from "../ir-infer/contract.js";
import { readType } from "../ir-types/index.js";
import type { RulesDeps } from "./contract.js";
import { decideEmbedding } from "./embed.js";
import { callerDefect, notDecidedYet } from "./frontier.js";
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
    check: (input, work) => {
      validateValue(deps, input.final);
      validateValue(deps, input.bound);
      const error = mergeErrors([input.final, input.bound]);
      if (error !== null) return { kind: "ok", value: { kind: "error", error }, diagnostics: [] };
      const value = input.bound.value;
      const final = input.final.value;
      const embedding = input.bound.kind === "producer"
        ? decideEmbedding(deps, value, final, "bound", input.variable.occurrence, input.origin, work)
        : decideEmbedding(deps, final, value, "bound", input.variable.occurrence, input.origin, work);
      if (embedding.kind === "refused") return embedding;
      const outcome: BoundCheckOutcome = { kind: "satisfied", embedding: embedding.value };
      return { kind: "ok", value: outcome, diagnostics: [] };
    },
  };
}

export function signatureVariableRule(deps: RulesDeps): VariableRule {
  return {
    finalize: input => {
      if (input.declaredConstraint !== null || input.declaredDefault !== null)
        return notDecidedYet("a signature variable with a declared default or constraint", null);
      const { variable, default: fallback, inferredTypeBound: checked } = input;
      if (fallback !== null) {
        if (fallback.rule !== "signature-producers" || variable.kind !== "signature" || variable.signature.part.kind !== "return"
          || fallback.variable !== variable.id || fallback.occurrence.body !== variable.occurrence.body
          || fallback.occurrence.node !== variable.occurrence.node || checked?.kind !== "available"
          || checked.value !== fallback.type || input.producers.length !== 0)
          return callerDefect("a no-value result requires its actual checked bound and no return-value producers", null);
        const term = readType(deps.types, checked.value);
        if (term.kind !== "intrinsic" || term.intrinsic !== "void")
          return callerDefect("a no-value result requires its actual checked void type", null);
        return { kind: "ok", diagnostics: [], value: { error: null, value: {
          type: checked.value, component: { kind: "body", value: variable.occurrence }, category: { kind: "dynamic" },
          numeric: null, sum: null, nominal: null, pointer: null,
        } } };
      }
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
      const producer = first.value;
      let finalized = producer;
      const term = readType(deps.types, producer.type);
      if (term.kind === "literal" && term.value.kind === "number")
        return notDecidedYet("the selected native default for an inferred numeric literal", null);
      if (input.variable.kind === "signature" && input.variable.signature.part.kind === "variable") {
        if (term.kind === "literal" && term.value.kind === "boolean") {
          const bound = input.inferredTypeBound;
          if (bound?.kind !== "available") return notDecidedYet("the actual checker bound for an inferred Boolean initializer", null);
          if (bound.value === term.base) finalized = { ...producer, type: term.base };
          else if (bound.value !== producer.type) return notDecidedYet("the native Boolean initializer inside its actual checker bound", null);
        }
      }
      const value = { value: finalized, error: null };
      validateValue(deps, value);
      return { kind: "ok", value, diagnostics: [] };
    },
    check: (input, work) => {
      validateValue(deps, input.final);
      validateValue(deps, input.bound);
      const error = mergeErrors([input.final, input.bound]);
      if (error !== null) return { kind: "ok", value: { kind: "error", error }, diagnostics: [] };
      if (input.bound.kind === "demand" && input.bound.value.type !== input.final.value.type)
        return { kind: "ok", value: { kind: "refused", reason: "signature-use-demand" }, diagnostics: [] };
      const embedding = input.bound.kind === "producer"
        ? decideEmbedding(deps, input.bound.value, input.final.value, "bound", input.variable.occurrence, input.origin, work)
        : decideEmbedding(deps, input.final.value, input.bound.value, "bound", input.variable.occurrence, input.origin, work);
      return embedding.kind === "refused" ? embedding
        : { kind: "ok", value: { kind: "satisfied", embedding: embedding.value }, diagnostics: [] };
    },
  };
}
