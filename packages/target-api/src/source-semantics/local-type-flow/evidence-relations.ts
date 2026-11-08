import type { SourceComponentSelector, SourceTypeEvidence } from "../../public/source/contracts.js";
import type { SourceProductionResult } from "../descriptor-contracts.js";
import { sourceLiteralDomainIncludes } from "../../source-model/literals/domain.js";
import type { SourceSemanticProduction } from "./semantic-production.js";
import { sourceKeyDomainContains } from "./key-domains.js";

export type SourceEvidenceRelation = "yes" | "no" | "deferred";

export function sourceEvidenceExtends(context: Pick<SourceSemanticProduction, "builder" | "objects">, source: SourceTypeEvidence,
  destination: SourceTypeEvidence): SourceProductionResult<SourceEvidenceRelation> {
  const { builder, objects } = context;
  const active = new Map<SourceTypeEvidence, Set<SourceTypeEvidence>>();
  const resolved = (value: SourceEvidenceRelation): SourceProductionResult<SourceEvidenceRelation> => ({ kind: "resolved", value });

  function combine(values: readonly SourceProductionResult<SourceEvidenceRelation>[], every: boolean): SourceProductionResult<SourceEvidenceRelation> {
    let deferred = false;
    const dependencies = new Set<Extract<SourceProductionResult<never>, { kind: "pending" }>["dependencies"][number]>();
    for (const value of values) {
      if (value.kind === "refused") return value;
      if (value.kind === "pending") { value.dependencies.forEach(dependency => dependencies.add(dependency)); continue; }
      if (value.value === (every ? "no" : "yes")) return value;
      deferred ||= value.value === "deferred";
    }
    return dependencies.size > 0 ? { kind: "pending", dependencies: [...dependencies] }
      : resolved(deferred ? "deferred" : every ? "yes" : "no");
  }

  function child(left: SourceTypeEvidence, leftPart: SourceComponentSelector, right: SourceTypeEvidence,
    rightPart: SourceComponentSelector): SourceProductionResult<SourceEvidenceRelation> {
    const first = builder.component(left, leftPart);
    if (first.kind === "refused") return first;
    const second = builder.component(right, rightPart);
    return second.kind === "refused" ? second : relate(first.value, second.value);
  }

  function relate(left: SourceTypeEvidence, right: SourceTypeEvidence): SourceProductionResult<SourceEvidenceRelation> {
    builder.assertEvidence(left);
    builder.assertEvidence(right);
    const actual = left.type, required = right.type;
    if (actual.kind === "intrinsic" && actual.intrinsic === "never") return resolved("yes");
    if (required.kind === "intrinsic" && (required.intrinsic === "unknown" || required.intrinsic === "any")) return resolved("yes");
    if (actual.kind === "parameter" || required.kind === "parameter") return resolved(
      actual.kind === "parameter" && required.kind === "parameter" && actual.declaration === required.declaration ? "yes" : "deferred");
    if (actual.kind === "projection" || required.kind === "projection") return resolved("deferred");
    if (actual.kind === "intrinsic" && actual.intrinsic === "any") return resolved("deferred");
    if (left.sum !== undefined) return combine(left.sum.arms.map(arm => relate(arm, right)), true);
    if (right.sum !== undefined) return combine(right.sum.arms.map(arm => relate(left, arm)), false);
    const leftDomain = builder.domain(left), rightDomain = builder.domain(right);
    if (rightDomain.kind === "finite" && (leftDomain.kind !== "finite" ||
      !leftDomain.values.every(value => sourceLiteralDomainIncludes(rightDomain, value)))) return resolved("no");
    if (left.category.kind === "known" && right.category.kind === "known" && left.category.category !== right.category.category) return resolved("no");
    if (left === right) return resolved("yes");
    let rightValues = active.get(left);
    if (rightValues?.has(right)) return resolved("deferred");
    if (rightValues === undefined) { rightValues = new Set(); active.set(left, rightValues); }
    rightValues.add(right);
    try {
      if (actual.kind === "declared" && required.kind === "declared" && actual.declaration === required.declaration) {
        if ((actual.extent === undefined) !== (required.extent === undefined) || actual.extent !== undefined &&
          (actual.extent.length !== required.extent?.length || actual.extent.runtimeBase !== required.extent.runtimeBase) ||
          actual.typeArguments.length !== required.typeArguments.length) return resolved("no");
        return combine(actual.typeArguments.map((_, index) => child(left,
          { kind: "type-argument", declaration: actual.declaration, index }, right,
          { kind: "type-argument", declaration: required.declaration, index })), true);
      }
      if (actual.kind === "declared" || required.kind === "declared") {
        const first = builder.produceDefinition(left);
        if (first.kind !== "resolved") return first;
        const second = builder.produceDefinition(right);
        if (second.kind !== "resolved") return second;
        if (first.value.type === actual && second.value.type === required) return resolved("no");
        return relate(first.value, second.value);
      }
      if (actual.kind === "optional") {
        if (required.kind !== "optional") return resolved("no");
        return child(left, { kind: "optional-value" }, right, { kind: "optional-value" });
      }
      if (required.kind === "optional") {
        if (actual.kind === "intrinsic" && actual.intrinsic === "absence") return resolved("yes");
        const payload = builder.component(right, { kind: "optional-value" });
        return payload.kind === "refused" ? payload : relate(left, payload.value);
      }
      if (actual.kind === "primitive" || required.kind === "primitive") return resolved(
        actual.kind === "primitive" && required.kind === "primitive" && actual.primitive === required.primitive ? "yes" : "no");
      if (actual.kind === "intrinsic" || required.kind === "intrinsic") {
        if (actual.kind === "intrinsic" && required.kind === "intrinsic") return resolved(actual.intrinsic === required.intrinsic ? "yes" : "no");
        return resolved(required.kind === "intrinsic" && required.intrinsic === "object" &&
          (actual.kind === "array" || actual.kind === "tuple" || actual.kind === "shape" || actual.kind === "callable") ? "yes" : "no");
      }
      if (actual.kind === "string" || required.kind === "string") return resolved(actual.kind === required.kind ? "yes" : "no");
      if (actual.kind === "array" && required.kind === "array") return actual.readonly && !required.readonly ? resolved("no")
        : child(left, { kind: "array-element" }, right, { kind: "array-element" });
      if (actual.kind === "tuple" && required.kind === "array") return actual.readonly && !required.readonly ? resolved("no")
        : combine(actual.elements.map((_, index) => child(left, { kind: "tuple-element", index }, right, { kind: "array-element" })), true);
      if (actual.kind === "tuple" && required.kind === "tuple") {
        if (actual.readonly && !required.readonly || actual.elements.length !== required.elements.length) return resolved("no");
        return combine(actual.elements.map((element, index) => element.kind === required.elements[index]!.kind
          ? child(left, { kind: "tuple-element", index }, right, { kind: "tuple-element", index }) : resolved("no")), true);
      }
      if ((actual.kind === "shape" || actual.kind === "callable") && (required.kind === "shape" || required.kind === "callable")) {
        const relations: SourceProductionResult<SourceEvidenceRelation>[] = [];
        if (required.kind === "shape") {
          const pairs = objects.correspondence(left, right, "correspondence", (destination, source) =>
            sourceKeyDomainContains(builder, destination, source));
          if (pairs.kind !== "resolved") return pairs;
          if (pairs.value.kind === "unavailable") return resolved(pairs.value.reason === "unresolved-shape" ? "deferred" : "no");
          for (const pair of pairs.value.members) {
            if (pair.kind === "absent") {
              if (!pair.destination.optional) return resolved("no");
              continue;
            }
            if (pair.source.optional && !pair.destination.optional) return resolved("no");
            if (pair.destination.readType !== undefined) {
              if (pair.source.readType === undefined) return resolved("no");
              relations.push(relate(pair.source.readType, pair.destination.readType));
            }
            if (pair.destination.writeType !== undefined && !pair.destination.readonly) {
              if (pair.source.writeType === undefined || pair.source.readonly) return resolved("no");
              relations.push(relate(pair.destination.writeType, pair.source.writeType));
            }
          }
          for (const pair of pairs.value.indexes) {
            const alternatives: SourceProductionResult<SourceEvidenceRelation>[] = [];
            for (const candidate of pair.sources) {
              const selected: SourceProductionResult<SourceEvidenceRelation>[] = [resolved(candidate.coverage)];
              if (pair.destination.readType !== undefined) selected.push(candidate.source.readType === undefined ? resolved("no")
                : relate(candidate.source.readType, pair.destination.readType));
              if (pair.destination.writeType !== undefined && !pair.destination.readonly) selected.push(
                candidate.source.writeType === undefined || candidate.source.readonly ? resolved("no")
                  : relate(pair.destination.writeType, candidate.source.writeType));
              alternatives.push(combine(selected, true));
            }
            relations.push(combine(alternatives, false));
          }
        }
        for (const kind of ["calls", "constructs"] as const) {
          for (const requiredSignature of required[kind]) {
            const alternatives: SourceProductionResult<SourceEvidenceRelation>[] = [];
            for (const actualSignature of actual[kind]) {
              if (actualSignature.parameters.length !== requiredSignature.parameters.length ||
                actualSignature.identity.typeParameters.length !== requiredSignature.identity.typeParameters.length) continue;
              const matches = actualSignature.parameters.map((parameter, index) => parameter.kind !== requiredSignature.parameters[index]!.kind
                ? resolved("no") : child(right, { kind: "parameter", signature: requiredSignature.identity, index }, left,
                  { kind: "parameter", signature: actualSignature.identity, index }));
              matches.push(child(left, { kind: "result", signature: actualSignature.identity }, right,
                { kind: "result", signature: requiredSignature.identity }));
              alternatives.push(combine(matches, true));
            }
            relations.push(combine(alternatives, false));
          }
        }
        return combine(relations, true);
      }
      return resolved("no");
    } finally { rightValues.delete(right); }
  }
  return relate(source, destination);
}
