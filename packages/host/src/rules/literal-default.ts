import type { ConstraintScheme, DefaultConstraint, VariableRule } from "../ir-infer/contract.js";
import type { CategoryEvidence } from "../ir-types/contract.js";
import { internType, nativeIntegerGeometryOf } from "../ir-types/index.js";
import type { RulesDeps } from "./contract.js";
import { fitsFloat64 } from "./embed.js";
import { callerDefect, notDecidedYet } from "./frontier.js";

export function literalVariableRule(deps: RulesDeps): VariableRule {
  return {
    finalize: input => {
      const { variable, default: fallback } = input;
      if (variable.kind !== "literal" || fallback?.rule !== "literal-native-default" || fallback.type !== null
        || fallback.variable !== variable.id || fallback.occurrence.body !== variable.occurrence.body
        || fallback.occurrence.node !== variable.occurrence.node)
        return callerDefect("a literal default requires its actual checked occurrence and inference variable", null);
      if (input.producers.length !== 0 || input.demands.length !== 0 || input.declaredConstraint !== null || input.declaredDefault !== null)
        return notDecidedYet("a literal default with separately supplied bounds", null);
      const authored = variable.value;
      if (authored.kind !== "number") return notDecidedYet("the native default for a non-number literal", null);
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
    check: () => notDecidedYet("a separate bound on a literal with a native default", null),
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
