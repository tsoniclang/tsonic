import type { Node } from "@tsonic/tsts";
import type { SourceArgumentPlace, SourceAuthoredArgument, SourceComponentSelector, SourceTypeEvidence, SourceValueOperand } from "../../public/source/contracts.js";
import type { SourceProductionResult } from "../../source-model/production.js";
import type { SourceDescriptorBuilder } from "../descriptor-contracts.js";
import type { SourceCallParameter, SourceUnappliedArgumentPlace, SourceEffectiveArgument, SourceArgumentPlacement } from "./application-data.js";
import { sourceSemanticRefusal } from "./semantic-production.js";
import { produceSourceSequenceLayout } from "./tuple-layout.js";





export function produceSourceArgumentPlaces(context: {
  readonly builder: SourceDescriptorBuilder;
  readonly invocation: Node;
  readonly sourceArguments: readonly SourceAuthoredArgument[];
  readonly parameters: readonly SourceCallParameter[];
}): SourceProductionResult<SourceArgumentPlacement> {
  const { builder, invocation } = context;
  const expanded = produceSourceEffectiveArguments(builder, context.sourceArguments);
  if (expanded.kind !== "resolved") return expanded;
  const effective = expanded.value;
  const result: SourceUnappliedArgumentPlace[] = [];
  const refusal = (message: string) => sourceSemanticRefusal(invocation, message, "TSONIC_LOCAL_TYPE_GENERIC");
  const mismatch = (message: string): SourceProductionResult<SourceArgumentPlacement> =>
    ({ kind: "resolved", value: { kind: "not-applicable", site: invocation, message } });
  let effectiveIndex = 0;
  for (const [parameterIndex, parameter] of context.parameters.entries()) {
    if (parameter.index !== parameterIndex) throw new Error("Source call parameters require their exact original contiguous index vector.");
    builder.assertEvidence(parameter.type);
    const argument = effective[effectiveIndex];
    if (parameter.kind !== "rest") {
      if (argument === undefined) {
        if (parameter.kind === "required") return mismatch("A Source application omits an original required parameter.");
        continue;
      }
      if (argument.sourceForm === "spread-sequence") return refusal("A variable-length spread cannot establish one original fixed parameter place.");
      result.push(place(argument, effectiveIndex++, parameter, "parameter", parameter.type, []));
      continue;
    }
    if (parameterIndex !== context.parameters.length - 1) throw new Error("A Source rest parameter must be the final original signature parameter.");
    const slots = produceSourceSequenceLayout(builder, parameter.type);
    if (slots.kind !== "resolved") return slots;
    for (const [index, slot] of slots.value.entries()) {
      const argument = effective[effectiveIndex];
      if (slot.kind === "rest") {
        const suffix = slots.value.length - index - 1;
        const boundary = effective.length - suffix;
        if (boundary < effectiveIndex) return effective.some(argument => argument.sourceForm === "spread-sequence")
          ? refusal("A variable-length spread cannot prove the original required rest-tuple suffix.")
          : mismatch("A Source rest-tuple application omits an original required suffix.");
        if (suffix > 0 && effective.slice(boundary).some(argument => argument.sourceForm === "spread-sequence"))
          return refusal("A variable-length spread cannot fabricate the original fixed rest-tuple suffix places.");
        while (effectiveIndex < boundary) {
          const argument = effective[effectiveIndex]!;
          if (argument.sourceForm === "spread-sequence") result.push(place(argument, effectiveIndex++, parameter, "rest-sequence", slot.type, slot.path));
          else {
            if (slot.element === undefined) return refusal("An unresolved original generic rest sequence cannot admit a fabricated scalar element place.");
            result.push(place(argument, effectiveIndex++, parameter, "rest-element", slot.element, [...slot.path, { kind: "array-element" }]));
          }
        }
      } else if (argument === undefined) {
        if (slot.kind === "required") return mismatch("A Source application omits an original required rest-tuple element.");
      } else if (argument.sourceForm === "spread-sequence") {
        if (effectiveIndex !== effective.length - 1 || slot.container === undefined || slot.container.value.type.kind !== "tuple")
          return refusal("A variable-length spread cannot fabricate this original fixed rest-tuple place.");
        const selector = { kind: "tuple-slice" as const, start: slot.container.index, endCount: 0, readonly: slot.container.value.type.readonly };
        const tail = builder.component(slot.container.value, selector);
        if (tail.kind === "refused") return tail;
        result.push(place(argument, effectiveIndex++, parameter, "rest-sequence", tail.value, [...slot.path.slice(0, -1), selector]));
        break;
      } else result.push(place(argument, effectiveIndex++, parameter, "rest-element", slot.type, slot.path));
    }
  }
  return effectiveIndex === effective.length ? { kind: "resolved", value: { kind: "placed", values: Object.freeze(result) } }
    : effective.slice(effectiveIndex).some(argument => argument.sourceForm === "spread-sequence")
      ? refusal("A variable-length spread cannot prove that no argument exceeds the original parameter domain.")
      : mismatch("A Source application has an argument outside its original parameter domain.");

  function place(argument: SourceEffectiveArgument, effectiveArgumentIndex: number, parameter: SourceCallParameter,
    parameterForm: SourceArgumentPlace["parameter"]["form"], destination: SourceTypeEvidence,
    parameterPath: readonly SourceComponentSelector[]): SourceUnappliedArgumentPlace {
    return Object.freeze({ sourceArgument: argument.authored.occurrence, sourceArgumentIndex: argument.sourceArgumentIndex,
      effectiveArgument: argument.operand.occurrence, effectiveArgumentIndex,
      sourceForm: argument.sourceForm, spreadElementIndex: argument.spreadElementIndex,
      source: argument.source, parameter, parameterForm, destination, parameterPath: Object.freeze(parameterPath) });
  }

}

export function produceSourceEffectiveArguments(builder: SourceDescriptorBuilder,
  sourceArguments: readonly SourceAuthoredArgument[]): SourceProductionResult<readonly SourceEffectiveArgument[]> {
  const effective: SourceEffectiveArgument[] = [];
  for (const [sourceArgumentIndex, authored] of sourceArguments.entries()) {
    if (authored.operand.kind === "refused") return authored.operand;
    const operand = authored.operand.value;
    builder.assertEvidence(operand.value);
    if (authored.form === "value") {
      effective.push({ authored, operand, sourceArgumentIndex, sourceForm: "value", spreadElementIndex: undefined, source: operand.value });
      continue;
    }
    const definition = builder.produceDefinition(operand.value);
    if (definition.kind !== "resolved") return definition;
    const value = definition.value;
    if (value.type.kind !== "tuple") {
      effective.push({ authored, operand, sourceArgumentIndex, sourceForm: "spread-sequence", spreadElementIndex: undefined, source: operand.value });
      continue;
    }
    const layout = produceSourceSequenceLayout(builder, value);
    if (layout.kind !== "resolved") return layout;
    if (layout.value.every(slot => slot.kind === "required")) {
      for (const [index, slot] of layout.value.entries()) effective.push({ authored, operand, sourceArgumentIndex,
        sourceForm: "spread-element", spreadElementIndex: index, source: slot.type });
      continue;
    }
    for (const [index, element] of value.type.elements.entries()) {
      const source = builder.component(value, { kind: "tuple-element", index });
      if (source.kind === "refused") return source;
      if (element.kind === "required") effective.push({ authored, operand, sourceArgumentIndex, sourceForm: "spread-element", spreadElementIndex: index, source: source.value });
      else {
        const tail = builder.component(value, { kind: "tuple-slice", start: index, endCount: 0, readonly: value.type.readonly });
        if (tail.kind === "refused") return tail;
        effective.push({ authored, operand, sourceArgumentIndex, sourceForm: "spread-sequence", spreadElementIndex: index, source: tail.value });
        break;
      }
    }
  }
  return { kind: "resolved", value: Object.freeze(effective) };
}

export function produceSourceDeclaredParameterPlace(builder: SourceDescriptorBuilder, parameter: SourceCallParameter,
  path: readonly SourceComponentSelector[]): SourceProductionResult<SourceTypeEvidence> {
  let value = parameter.type;
  for (const selector of path) {
    const definition = builder.produceDefinition(value);
    if (definition.kind !== "resolved") return definition;
    if (definition.value.type.kind === "parameter" || definition.value.type.kind === "projection") {
      const component = builder.componentIdentity(parameter.type.component.root, [...parameter.type.component.path, ...path]);
      return { kind: "resolved", value: builder.evidence({ type: builder.projection(value.type, { kind: "component", component }),
        component, category: { kind: "dynamic" }, numeric: undefined, sum: undefined },
      [{ selector: { kind: "projection-source" }, value }], undefined, { kind: "open", presence: "dynamic" },
      { members: { kind: "definition" }, origins: { kind: "complete", nodes: [parameter.declaration ?? parameter.type.component.root] } }) };
    }
    const selected = builder.component(definition.value, selector);
    if (selected.kind === "refused") return selected;
    value = selected.value;
  }
  return { kind: "resolved", value };
}
