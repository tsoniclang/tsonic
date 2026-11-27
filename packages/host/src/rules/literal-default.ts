import type { Result } from "../diag/contract.js";
import { hostDiagnosticCode } from "../diag/index.js";
import type { Origin } from "../ids/contract.js";
import type { ConstraintScheme, DefaultConstraint, EqualityConstraint, InferenceValue, VariableBound, VariableRule } from "../ir-infer/contract.js";
import type { CategoryEvidence } from "../ir-types/contract.js";
import { admitTypePublicationStep, internType, isNativeIntegerPrimitive, nativeIntegerGeometryOf, readType, refuseTypeConstruction } from "../ir-types/index.js";
import type { RulesDeps } from "./contract.js";
import { fitsFloat64, integerLiteralFit } from "./embed.js";
import { callerDefect, notDecidedYet } from "./frontier.js";
import { variableOf } from "./schemes.js";

function storageRefusal(origin: Origin, name: "TSONIC_NATIVE_STORAGE_CARRIER_CONFLICT" | "TSONIC_NATIVE_STORAGE_LITERAL_INEXACT",
  message: string): Result<never> {
  const code = hostDiagnosticCode(name);
  return { kind: "refused", diagnostics: [{ code: { kind: "host", name: code, rendered: code }, severity: "error",
    site: { kind: "source", origin }, source: "rules", evidence: [], message, arguments: [], related: [], fix: null }] };
}

export function literalVariableRule(deps: RulesDeps): VariableRule {
  return {
    finalize: input => {
      const { variable, default: fallback } = input;
      if (variable.kind !== "literal" || fallback?.rule !== "literal-native-default" || fallback.type !== null
        || fallback.variable !== variable.id || fallback.occurrence.body !== variable.occurrence.body
        || fallback.occurrence.node !== variable.occurrence.node)
        return callerDefect("a literal default requires its actual checked occurrence and inference variable", null);
      if (input.producers.length !== 0 || input.declaredConstraint !== null || input.declaredDefault !== null
        || input.demands.some(demand => demand.contribution.role.kind !== "equality" || demand.contribution.role.direction !== "left-to-right"))
        return notDecidedYet("a literal default with separately supplied bounds", null);
      const authored = variable.value;
      if (authored.kind !== "number") return notDecidedYet("the native default for a non-number literal", null);
      const required = input.demands[0];
      if (required !== undefined) {
        const category: CategoryEvidence = { kind: "known", category: "number" };
        return { kind: "ok", diagnostics: [], value: { error: null, value: {
          type: required.value.type, component: { kind: "body", value: variable.occurrence }, category,
          numeric: { kind: "literal", producer: variable.occurrence, category, authored }, nominal: null, sum: null, pointer: null,
        } } };
      }
      const integral = /^(?:[0-9][0-9_]*|0[xX][0-9a-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+)$/u.test(authored.token);
      if (integral) {
        const geometry = nativeIntegerGeometryOf("int64", deps.selectedNativeFacts, () => true);
        if (geometry.kind !== "integer") return callerDefect("the signed integral literal default requires the actual int64 domain", null);
        const { numerator, denominator, negativeZero } = authored.value;
        if (denominator !== 1n || negativeZero) return callerDefect("an authored integral token must retain its exact integral value", null);
        if (numerator < geometry.minimum || numerator > geometry.maximum)
          return notDecidedYet("an authored integral literal outside its selected int64 range", null);
      } else if (!fitsFloat64(deps, authored.value)) {
        return notDecidedYet("an authored fractional or exponent literal without an exact native Float64 fit", null);
      }
      const type = internType(deps.types, { kind: "primitive", primitive: integral ? "int64" : "float64" });
      const category: CategoryEvidence = { kind: "known", category: "number" };
      return { kind: "ok", diagnostics: [], value: { error: null, value: {
        type, component: { kind: "body", value: variable.occurrence }, category,
        numeric: { kind: "literal", producer: variable.occurrence, category, authored },
        nominal: null, sum: null, pointer: null,
      } } };
    },
    check: (input, work) => {
      if (input.variable.kind !== "literal" || input.variable.value.kind !== "number" || input.bound.kind !== "demand"
        || input.bound.contribution.role.kind !== "equality" || input.bound.contribution.role.direction !== "left-to-right")
        return notDecidedYet("a separate bound on a literal with a native default", null);
      const { origin } = input;
      if (input.final.value.type !== input.bound.value.type)
        return storageRefusal(origin, "TSONIC_NATIVE_STORAGE_CARRIER_CONFLICT", "The compound writes require different native carriers for this storage.");
      const stopped = admitTypePublicationStep(work.typeWork);
      if (stopped !== null) return refuseTypeConstruction(work.typeWork, stopped, origin, work.unit);
      const type = readType(deps.types, input.final.value.type);
      if (type.kind !== "primitive")
        return callerDefect("a literal storage demand names its selected numeric carrier", origin);
      const fit = type.primitive === "float64" ? fitsFloat64(deps, input.variable.value.value) ? "literal-fit" : "lossy-numeric"
        : integerLiteralFit(deps, input.variable.value, input.final.value.type, work);
      if (fit !== null && typeof fit !== "string") return refuseTypeConstruction(work.typeWork, fit, origin, work.unit);
      if (fit !== "literal-fit")
        return storageRefusal(origin, "TSONIC_NATIVE_STORAGE_LITERAL_INEXACT", "The initializer does not fit the native carrier required by the compound write.");
      return { kind: "ok", value: { kind: "satisfied", embedding: { kind: "identity" } }, diagnostics: [] };
    },
  };
}

export function storageEqualityScheme(deps: RulesDeps): ConstraintScheme<EqualityConstraint> {
  const operands = (left: InferenceValue | undefined, right: InferenceValue | undefined, constraint: EqualityConstraint) => {
    if (left?.value.type !== constraint.left || right?.value.type !== constraint.right)
      return callerDefect("an equality has the actual operand and literal storage positions", null);
    return { left, right };
  };
  return {
    enumerate: ({ constraint, group, variables, reference, evidence }) => {
      operands(evidence[0], evidence[1], constraint);
      const from = variableOf(deps, constraint.left, constraint.occurrence, group);
      const into = variableOf(deps, constraint.right, constraint.occurrence, group);
      if (into === null || variables[into]?.kind !== "literal")
        return callerDefect("a storage equality must bound the actual owned literal variable", null);
      return { kind: "ok", diagnostics: [], value: [{
        key: { node: constraint.occurrence, candidate: null, role: { kind: "equality", direction: "left-to-right" } },
        reads: from === null ? [] : [from], bounds: [into], constraint: reference,
      }] };
    },
    evaluate: ({ constraint, contribution, reads, evidence }) => {
      const positions = operands(evidence[0], evidence[1], constraint);
      const from = variableOf(deps, constraint.left, constraint.occurrence, null);
      const into = variableOf(deps, constraint.right, constraint.occurrence, null);
      const source = from === null ? positions.left : reads.find(row => row.variable === from);
      if (source === undefined || into === null) return callerDefect("a storage equality needs its actual finalized operand", null);
      const destination = contribution.bounds.length === 0 ? reads.find(row => row.variable === into) : null;
      if (destination === undefined || contribution.bounds.length !== 0 &&
        (contribution.bounds.length !== 1 || contribution.bounds[0] !== into))
        return callerDefect("a storage equality retains its actual destination variable", null);
      const error = source.error ?? destination?.error ?? null;
      if (error !== null)
        return { kind: "ok", diagnostics: [], value: { bounds: [], selectedCandidate: null, decision: { kind: "error", error } } };
      const offered = readType(deps.types, source.value.type);
      const native = offered.kind === "primitive" && (isNativeIntegerPrimitive(offered.primitive) || offered.primitive === "float64");
      const bounds: readonly VariableBound[] = native && destination === null
        ? [{ contribution: contribution.key, variable: into, kind: "demand", value: source.value, error: null }]
        : [];
      return { kind: "ok", diagnostics: [], value: { bounds, selectedCandidate: null,
        decision: { kind: "eq", equivalent: destination === null ? native : source.value.type === destination.value.type } } };
    },
  };
}

export const defaultScheme: ConstraintScheme<DefaultConstraint> = {
  enumerate: ({ constraint, reference, variables }) => {
    if (constraint.rule === "signature-producers") {
      const variable = variables[constraint.variable];
      if (constraint.type === null || variable?.kind !== "signature" || variable.signature.part.kind !== "return")
        return callerDefect("a no-value default requires its actual signature result variable and checked type", null);
    } else if (constraint.rule !== "literal-native-default" || constraint.type !== null) {
      return notDecidedYet("a default other than an unannotated native literal", null);
    }
    return { kind: "ok", diagnostics: [], value: [{
      key: { node: constraint.occurrence, candidate: null, role: { kind: "default" } },
      reads: [constraint.variable], bounds: [], constraint: reference,
    }] };
  },
  evaluate: ({ constraint, reads }) => {
    const [selected] = reads;
    if (reads.length !== 1 || selected?.variable !== constraint.variable)
      return callerDefect("a default decision reads its own finalized variable", null);
    if (constraint.rule === "signature-producers" && (selected.error !== null || selected.value.type !== constraint.type))
      return callerDefect("a no-value result decision keeps the actual checked completion", null);
    return { kind: "ok", diagnostics: [], value: { bounds: [], selectedCandidate: null,
      decision: selected.error === null ? { kind: "default", type: selected.value.type } : { kind: "error", error: selected.error },
    } };
  },
};
