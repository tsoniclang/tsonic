import type { Node } from "@tsonic/tsts";
import type { SourceArgumentPlace, SourceTypeEvidence } from "../../public/source/contracts.js";
import type { SourceJsApiResultPresence } from "../../source-model/profile.js";
import type { SourceProductionResult } from "../../source-model/production.js";
import { sourcePresenceLiteralDisposition } from "../../source-model/literals/domain.js";
import { sourceKeyDomainContains } from "./key-domains.js";
import { sourceKeyEvidence } from "./type-keys.js";
import { sourceSemanticRefusal } from "./semantic-production.js";
import type { SourceSemanticProduction } from "./production-context.js";

type SerializationPresence = "present" | "absent" | "unknown";

export function produceSourceSerializationResult(context: SourceSemanticProduction,
  law: Extract<SourceJsApiResultPresence, { readonly kind: "serialization" }>, occurrence: Node,
  arguments_: readonly SourceArgumentPlace[], declaredResult: SourceTypeEvidence): SourceProductionResult<SourceTypeEvidence> {
  const { builder, objects } = context;
  const active = new Set<SourceTypeEvidence>();
  const resolved = (value: SerializationPresence): SourceProductionResult<SerializationPresence> => ({ kind: "resolved", value });
  const combine = (values: readonly SerializationPresence[]): SerializationPresence => values.length === 0 ? "unknown"
    : values.every(value => value === "present") ? "present" : values.every(value => value === "absent") ? "absent" : "unknown";

  function callable(value: SourceTypeEvidence): SourceProductionResult<SerializationPresence | undefined> {
    if (value.sum !== undefined) {
      const proofs: SerializationPresence[] = [];
      for (const arm of value.sum.arms) {
        const proof = callable(arm);
        if (proof.kind !== "resolved") return proof;
        if (proof.value === undefined) return { kind: "resolved", value: undefined };
        proofs.push(proof.value);
      }
      return resolved(combine(proofs));
    }
    const definition = builder.produceDefinition(value);
    if (definition.kind !== "resolved") return definition;
    const type = definition.value.type;
    if (type.kind !== "shape" && type.kind !== "callable" || type.calls.length === 0)
      return { kind: "resolved", value: undefined };
    const proofs: SerializationPresence[] = [];
    for (const signature of type.calls) {
      const result = builder.component(definition.value, { kind: "result", signature: signature.identity });
      if (result.kind === "refused") return result;
      const proof = serializable(result.value, false, false);
      if (proof.kind !== "resolved") return proof;
      proofs.push(proof.value);
    }
    return resolved(combine(proofs));
  }

  function serializable(value: SourceTypeEvidence, applyConversion: boolean, nested: boolean): SourceProductionResult<SerializationPresence> {
    builder.assertEvidence(value);
    if (active.has(value)) return resolved("unknown");
    if (value.sum !== undefined) {
      const proofs: SerializationPresence[] = [];
      for (const arm of value.sum.arms) {
        const proof = serializable(arm, applyConversion, nested);
        if (proof.kind !== "resolved") return proof;
        proofs.push(proof.value);
      }
      return resolved(combine(proofs));
    }
    const presence = sourcePresenceLiteralDisposition(builder.domain(value));
    if (presence === "absent") return resolved(nested ? "present" : "absent");
    if (value.type.kind === "optional") return resolved("unknown");
    if (value.category.kind === "known" && (value.category.category === "boolean" || value.category.category === "number" ||
      value.category.category === "string")) return resolved(presence === "present" ? "present" : "unknown");
    const definition = builder.produceDefinition(value);
    if (definition.kind !== "resolved") return definition;
    const selected = definition.value;
    const type = selected.type;
    if (type.kind !== "shape" && type.kind !== "callable" && type.kind !== "array" && type.kind !== "tuple") return resolved("unknown");
    active.add(value);
    try {
      if (applyConversion) {
        const key = sourceKeyEvidence(context, occurrence, { kind: "string", value: law.conversionMember });
        const conversion = objects.indexed(selected, key, (destination, source) => sourceKeyDomainContains(builder, destination, source));
        if (conversion.kind !== "resolved") return conversion;
        if (conversion.value.kind === "unavailable" && conversion.value.reason !== "missing-member") return resolved("unknown");
        if (conversion.value.kind === "available" && (conversion.value.members.length > 1 || conversion.value.indexes.length > 0)) return resolved("unknown");
        const member = conversion.value.kind === "available" ? conversion.value.members[0] : undefined;
        if (member !== undefined) {
          const read = member.readType();
          if (read.kind !== "resolved") return read;
          if (read.value.kind === "present") {
            const proof = callable(read.value.value);
            if (proof.kind !== "resolved") return proof;
            if (proof.value !== undefined) return resolved(member.optional ? "unknown" : nested && proof.value === "absent" ? "present" : proof.value);
          }
        }
      }
      if ((type.kind === "callable" || type.kind === "shape" && type.calls.length > 0) && !nested) return resolved("absent");
      if (presence !== "present" && !nested) return resolved("unknown");
      if (type.kind === "array" || type.kind === "tuple") {
        const parts = type.kind === "array" ? [{ kind: "array-element" as const }]
          : type.elements.map((_, index) => ({ kind: "tuple-element" as const, index }));
        for (const part of parts) {
          const element = builder.component(selected, part);
          if (element.kind === "refused") return element;
          const proof = serializable(element.value, true, true);
          if (proof.kind !== "resolved") return proof;
          if (proof.value === "unknown") return proof;
        }
        return resolved("present");
      }
      const inventory = builder.members(selected);
      if (inventory.kind !== "resolved") return inventory;
      if (inventory.value.kind !== "complete" || inventory.value.indexes.length !== 0) return resolved("unknown");
      for (const member of inventory.value.members) {
        const read = member.readType();
        if (read.kind !== "resolved") return read;
        if (read.value.kind === "none") continue;
        const memberDefinition = builder.produceDefinition(read.value.value);
        if (memberDefinition.kind !== "resolved") return memberDefinition;
        const memberType = memberDefinition.value.type;
        if (memberType.kind === "callable" || memberType.kind === "shape" && memberType.calls.length > 0) continue;
        const proof = serializable(read.value.value, true, true);
        if (proof.kind !== "resolved") return proof;
        if (proof.value === "unknown") return proof;
      }
      return resolved("present");
    } finally { active.delete(value); }
  }

  const values = arguments_.filter(argument => argument.parameter.index === law.valueParameterIndex);
  const replacers = arguments_.filter(argument => argument.parameter.index === law.replacerParameterIndex);
  if (values.length > 1 || replacers.length > 1) return sourceSemanticRefusal(occurrence,
    "A serialization operation requires its exact original value and root replacer argument places.");
  const value = values[0]?.source;
  const base = value === undefined ? resolved("absent") : serializable(value, true, false);
  if (base.kind !== "resolved") return base;
  let proof = base.value;
  const replacer = replacers[0]?.source;
  if (replacer !== undefined && sourcePresenceLiteralDisposition(builder.domain(replacer)) !== "absent") {
    const callback = callable(replacer);
    if (callback.kind !== "resolved") return callback;
    if (callback.value !== undefined) proof = callback.value;
    else {
      const definition = builder.produceDefinition(replacer);
      if (definition.kind !== "resolved") return definition;
      if (definition.value.type.kind !== "array" && definition.value.type.kind !== "tuple") proof = "unknown";
    }
  }
  if (proof !== "present") return { kind: "resolved", value: declaredResult };
  if (declaredResult.type.kind === "string") return { kind: "resolved", value: declaredResult };
  if (declaredResult.type.kind !== "optional") return sourceSemanticRefusal(occurrence,
    "A serialization declaration must retain its canonical string or string-and-absence result.");
  const string = builder.component(declaredResult, { kind: "optional-value" });
  if (string.kind === "refused") return string;
  if (string.value.type.kind !== "string") throw new Error("A serialization result presence proof requires its actual original string payload.");
  return builder.join(builder.componentIdentity(occurrence, []), "inferred", [string.value], context.input.syntax(occurrence));
}
