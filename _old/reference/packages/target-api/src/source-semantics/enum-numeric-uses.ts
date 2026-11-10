import type { Node } from "@tsonic/tsts";
import type { SourceRefusal, SourceTypeEvidence } from "../public/source/contracts.js";
import type { SourceProductionResult } from "../source-model/production.js";
import { sourceSemanticRefusal } from "./local-type-flow/semantic-production.js";
import type { SourceSemanticProduction } from "./local-type-flow/production-context.js";

export interface SourceEnumValueDomain {
  readonly possible: readonly Node[];
  readonly certain: Node | undefined;
}

export function sourceEnumValueDomain(context: SourceSemanticProduction,
  evidence: SourceTypeEvidence): SourceProductionResult<SourceEnumValueDomain> {
  const { builder, ast } = context;
  const pending = [evidence];
  const seen = new Set<SourceTypeEvidence>();
  const possible = new Set<Node>();
  let ordinary = false;
  while (pending.length > 0) {
    const value = pending.pop()!;
    builder.assertEvidence(value);
    if (seen.has(value)) continue;
    seen.add(value);
    if (value.sum !== undefined) { pending.push(...value.sum.arms); continue; }
    if (value.type.kind === "optional") {
      const selected = builder.component(value, { kind: "optional-value" });
      if (selected.kind === "refused") return selected;
      pending.push(selected.value);
      continue;
    }
    if (value.type.kind === "declared" && ast.is.IsEnumDeclaration(value.type.declaration)) {
      possible.add(value.type.declaration);
      continue;
    }
    const defined = builder.produceDefinition(value);
    if (defined.kind !== "resolved") return defined;
    if (defined.value !== value) { pending.push(defined.value); continue; }
    if (!(value.type.kind === "intrinsic" && ["absence", "void", "never"].includes(value.type.intrinsic))) ordinary = true;
  }
  const values = Object.freeze([...possible]);
  return { kind: "resolved", value: Object.freeze({ possible: values, certain: values.length === 1 && !ordinary ? values[0] : undefined }) };
}

export function sourceEnumUseRefusal(context: SourceSemanticProduction, domain: SourceEnumValueDomain,
  site: Node, stringProjection: boolean): SourceRefusal {
  const declaration = domain.possible[0];
  if (declaration === undefined) throw new Error("An enum projection refusal requires its exact original enum declaration.");
  const name = context.ast.text(context.ast.name(declaration));
  return sourceSemanticRefusal(site, stringProjection
    ? `Enum value '${name}' is converted to a string; enum-to-string conversion is not supported yet.`
    : `Enum value '${name}' is used as a number; enum-numeric operations are not supported yet. Use equality or bitwise operations within the same enum instead.`,
  "TSONIC_ENUM_NUMERIC_USE_NOT_SUPPORTED");
}

export function sourceEnumDestination(context: SourceSemanticProduction, value: SourceTypeEvidence,
  destination: SourceTypeEvidence, site: Node): SourceProductionResult<{ readonly kind: "supported" }> {
  const source = sourceEnumValueDomain(context, value);
  if (source.kind !== "resolved") return source;
  if (source.value.possible.length === 0) return { kind: "resolved", value: { kind: "supported" } };
  const target = sourceEnumValueDomain(context, destination);
  if (target.kind !== "resolved") return target;
  return source.value.possible.every(declaration => target.value.possible.includes(declaration))
    ? { kind: "resolved", value: { kind: "supported" } }
    : sourceEnumUseRefusal(context, source.value, site, destination.category.kind === "known" && destination.category.category === "string");
}

export function sourceEnumOperator(context: SourceSemanticProduction, operator: string,
  operands: readonly SourceTypeEvidence[], site: Node): SourceProductionResult<
    { readonly kind: "ordinary" | "comparison" } | { readonly kind: "enum"; readonly value: SourceTypeEvidence }> {
  const domains: SourceEnumValueDomain[] = [];
  for (const value of operands) {
    const domain = sourceEnumValueDomain(context, value);
    if (domain.kind !== "resolved") return domain;
    domains.push(domain.value);
  }
  const selected = domains.find(domain => domain.possible.length > 0);
  if (selected === undefined) return { kind: "resolved", value: { kind: "ordinary" } };
  const same = selected.certain !== undefined && domains.every(domain => domain.certain === selected.certain);
  const equality = ["equal", "not-equal", "equal-strict", "not-equal-strict"].includes(operator);
  const absence = operands.some(value => {
    const domain = context.builder.domain(value);
    return domain.kind === "finite" && domain.values.length > 0 && domain.values.every(unit => unit.kind === "absence");
  });
  if (equality && (same || absence)) return { kind: "resolved", value: { kind: "comparison" } };
  if (same && ["bit-not", "bit-and", "bit-or", "bit-xor"].includes(operator)) {
    const value = operands.find((_, index) => domains[index]!.certain === selected.certain)!;
    return { kind: "resolved", value: { kind: "enum", value } };
  }
  return sourceEnumUseRefusal(context, selected, site,
    operator === "add" && operands.some(value => value.category.kind === "known" && value.category.category === "string"));
}
