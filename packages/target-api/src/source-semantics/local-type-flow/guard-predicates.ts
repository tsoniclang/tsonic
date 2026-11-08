import type { Node } from "@tsonic/tsts";
import type { SourceTypeEvidence } from "../../public/source/contracts.js";
import type { SourceLiteralDomain } from "../../source-model/literals/domain.js";
import { sourceLiteralUnitsEqual, sourcePresenceLiteralDisposition } from "../../source-model/literals/domain.js";
import type { SourceProductionResult } from "../../source-model/production.js";
import type { SourceValueGuard } from "../native-value-guards.js";
import type { SourceSemanticProduction } from "./semantic-production.js";

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
      selected = actual.values.every(unit => sourceLiteralUnitsEqual(unit, target)) ? true
        : actual.values.every(unit => !sourceLiteralUnitsEqual(unit, target)) ? false : undefined;
    } else selected = value.category.kind === "known" && value.category.category !== guard.category ? false : undefined;
  }
  return resolved(selected === undefined ? undefined : selected !== guard.negated);
}
