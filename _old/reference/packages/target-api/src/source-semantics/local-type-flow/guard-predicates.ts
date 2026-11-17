import type { Node, SourcePrimitiveKind } from "@tsonic/tsts";
import type { SourceTypeEvidence } from "../../public/source/contracts.js";
import type { SourceLiteralDomain, SourceLiteralUnit } from "../../source-model/literals/domain.js";
import { sourceLiteralUnitsEqual, sourcePresenceLiteralDisposition } from "../../source-model/literals/domain.js";
import { sourceNumericLiteralIsExactlyRepresentableAsBinaryFloat } from "../../source-model/literals/token.js";
import { sourcePrimitiveIntegerBounds } from "./operator-decisions.js";
import { sourceNumericLiteralIdentity } from "../../source-model/literals/domain.js";
import type { SourceProductionResult } from "../../source-model/production.js";
import type { SourceValueGuard } from "../native-value-guards.js";
import type { SourceSemanticProduction } from "./production-context.js";

export function produceSourceGuardPredicate(context: Pick<SourceSemanticProduction, "builder"> & {
  syntaxDomain(node: Node): SourceProductionResult<SourceLiteralDomain>;
}, value: SourceTypeEvidence, guard: SourceValueGuard): SourceProductionResult<boolean | undefined> {
  const { builder } = context;
  builder.assertEvidence(value);
  const resolved = (value: boolean | undefined): SourceProductionResult<boolean | undefined> => ({ kind: "resolved", value });
  if (guard.kind === "nominal") return resolved(value.type.kind === "declared" && value.type.declaration === guard.declaration ? true : undefined);
  let selected: boolean | undefined;
  if (guard.kind === "absence") {
    const presence = sourcePresenceLiteralDisposition(builder.domain(value));
    selected = presence === "dynamic" ? undefined : presence === "absent";
  } else if (guard.kind === "typeof") {
    const category = value.category;
    if (category.kind !== "known") selected = undefined;
    else {
      const name = category.category === "absence" ? "undefined" : category.category;
      selected = name === guard.value;
    }
  } else {
    const literal = context.syntaxDomain(guard.literal);
    if (literal.kind !== "resolved") return literal;
    const actual = builder.domain(value);
    if (literal.value.kind !== "finite" || literal.value.values.length !== 1) selected = undefined;
    else if (actual.kind === "finite" && actual.values.length > 0) {
      const target = literal.value.values[0]!;
      const comparisons = actual.values.map(unit => runtimeLiteralEqual(unit, target, value));
      selected = comparisons.every(value => value === true) ? true
        : comparisons.every(value => value === false) ? false : undefined;
    } else selected = value.category.kind === "known" && value.category.category !== guard.category ? false : undefined;
  }
  return resolved(selected === undefined ? undefined : selected !== guard.negated);
}

function runtimeLiteralEqual(left: SourceLiteralUnit, right: SourceLiteralUnit, value: SourceTypeEvidence): boolean | undefined {
  if (left.kind !== "number" || right.kind !== "number") return sourceLiteralUnitsEqual(left, right);
  if (value.type.kind !== "primitive") return undefined;
  const primitive = value.type.primitive;
  if ((primitive === "float32" || primitive === "float64") &&
    (left.value.kind === "checked-float64" && Number.isNaN(left.value.value) ||
      right.value.kind === "checked-float64" && Number.isNaN(right.value.value))) return false;
  return exactRuntimeNumber(left.value, primitive) && exactRuntimeNumber(right.value, primitive)
    ? sourceLiteralUnitsEqual(left, right) : undefined;
}

function exactRuntimeNumber(value: Extract<SourceLiteralUnit, { readonly kind: "number" }>["value"],
  primitive: SourcePrimitiveKind): boolean {
  if (primitive === "float32" || primitive === "float64") {
    if (value.kind === "checked-float64") return primitive === "float64" || Math.fround(value.value) === value.value;
    const token = value.kind === "authored" ? value.token : {
      coefficient: value.value < 0n ? -value.value : value.value, exponent: 0n, negative: value.value < 0n,
      decimalText: value.value.toString(),
    };
    return sourceNumericLiteralIsExactlyRepresentableAsBinaryFloat(token, primitive);
  }
  const bounds = sourcePrimitiveIntegerBounds(primitive);
  if (bounds === undefined) return false;
  const identity = sourceNumericLiteralIdentity(value);
  if (typeof identity === "string" || identity.two < 0n || identity.five < 0n) return false;
  const maximum = bounds[1] > -bounds[0] ? bounds[1] : -bounds[0];
  if (identity.coefficient > maximum) return false;
  const bits = BigInt(maximum.toString(2).length);
  if (identity.coefficient !== 0n && (identity.two > bits || identity.five > bits)) return false;
  const magnitude = identity.coefficient * 2n ** identity.two * 5n ** identity.five;
  const integer = identity.negative ? -magnitude : magnitude;
  return integer >= bounds[0] && integer <= bounds[1];
}
