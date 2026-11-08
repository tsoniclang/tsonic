import type { SourceComponentSelector, SourceResult, SourceTypeEvidence } from "../../public/source/contracts.js";
import type { SourceDescriptorBuilder } from "../descriptor-contracts.js";
import { sourceLiteralDomainIncludes } from "../../source-model/literals/domain.js";

export type SourceEvidenceRelation = "yes" | "no" | "deferred";

export function sourceEvidenceExtends(builder: SourceDescriptorBuilder, source: SourceTypeEvidence,
  destination: SourceTypeEvidence): SourceResult<SourceEvidenceRelation> {
  const active = new Map<SourceTypeEvidence, Set<SourceTypeEvidence>>();
  const resolved = (value: SourceEvidenceRelation): SourceResult<SourceEvidenceRelation> => ({ kind: "resolved", value });

  function combine(values: readonly SourceResult<SourceEvidenceRelation>[], every: boolean): SourceResult<SourceEvidenceRelation> {
    let deferred = false;
    for (const value of values) {
      if (value.kind === "refused") return value;
      if (value.value === (every ? "no" : "yes")) return value;
      deferred ||= value.value === "deferred";
    }
    return resolved(deferred ? "deferred" : every ? "yes" : "no");
  }

  function child(left: SourceTypeEvidence, leftPart: SourceComponentSelector, right: SourceTypeEvidence,
    rightPart: SourceComponentSelector): SourceResult<SourceEvidenceRelation> {
    const first = builder.component(left, leftPart);
    if (first.kind === "refused") return first;
    const second = builder.component(right, rightPart);
    return second.kind === "refused" ? second : relate(first.value, second.value);
  }

  function relate(left: SourceTypeEvidence, right: SourceTypeEvidence): SourceResult<SourceEvidenceRelation> {
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
    if (actual === required) return resolved("yes");
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
        const first = builder.definition(left);
        if (first.kind === "refused") return first;
        const second = builder.definition(right);
        if (second.kind === "refused") return second;
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
        const relations: SourceResult<SourceEvidenceRelation>[] = [];
        if (required.kind === "shape") {
          if (actual.kind !== "shape") return resolved(required.members.every(member => member.optional) && required.indexes.length === 0 ? "yes" : "no");
          for (const member of required.members) {
            const selected = actual.members.filter(candidate => candidate.name === member.name);
            if (selected.length === 0 && member.optional) continue;
            if (selected.length !== 1 || selected[0]!.optional && !member.optional || selected[0]!.readonly && !member.readonly) return resolved("no");
            relations.push(child(left, { kind: "member", origin: selected[0]!.origin }, right, { kind: "member", origin: member.origin }));
          }
          for (const index of required.indexes) {
            const candidates = actual.indexes.filter(candidate => candidate.declaration === index.declaration);
            if (candidates.length !== 1) return resolved("no");
            relations.push(child(left, { kind: "index-key", declaration: candidates[0]!.declaration }, right,
              { kind: "index-key", declaration: index.declaration }));
            relations.push(child(left, { kind: "index-value", declaration: candidates[0]!.declaration }, right,
              { kind: "index-value", declaration: index.declaration }));
          }
        }
        for (const kind of ["calls", "constructs"] as const) {
          for (const requiredSignature of required[kind]) {
            const alternatives: SourceResult<SourceEvidenceRelation>[] = [];
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
