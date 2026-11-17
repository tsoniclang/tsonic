import type { Node } from "@tsonic/tsts";
import type { SourceApplicationIdentity, SourceArgumentPlace, SourceAuthoredArgument, SourceComponentSelector, SourceOmittedArgument, SourceTypeEvidence, SourceValueOperand } from "../../public/source/contracts.js";
import type { SourceProductionResult } from "../../source-model/production.js";
import type { SourceDescriptorBuilder } from "../descriptor-contracts.js";
import type { SourceCallParameter, SourceUnappliedArgumentPlace, SourceEffectiveArgument, SourceArgumentPlacement } from "./application-data.js";
import { sourceSemanticRefusal } from "./semantic-production.js";
import { produceSourceSequenceLayout } from "./tuple-layout.js";
import { createSourceOmissionAllowance } from "./signature-omissions.js";





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
  const omitted: Extract<SourceArgumentPlacement, { readonly kind: "placed" }>["omitted"][number][] = [];
  const allowsOmission = createSourceOmissionAllowance(builder, invocation);
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
        if (!parameter.omission.acceptsOmission) return mismatch("A Source application omits an original required parameter.");
        omitted.push(Object.freeze({ parameter, path: Object.freeze([]), destination: parameter.type,
          action: parameter.omission.initializer.kind === "present"
            ? Object.freeze({ kind: "initializer", initializer: parameter.omission.initializer.value })
            : Object.freeze({ kind: "absence", value: absence(parameter.type) }) }));
        continue;
      }
      if (argument.sourceForm === "spread-sequence") return refusal("A variable-length spread cannot establish one original fixed parameter place.");
      result.push(place(argument, effectiveIndex++, parameter, "parameter", parameter.type, []));
      continue;
    }
    if (parameterIndex !== context.parameters.length - 1) throw new Error("A Source rest parameter must be the final original signature parameter.");
    const slots = produceSourceSequenceLayout(builder, parameter.type);
    if (slots.kind !== "resolved") return slots;
    if (slots.value.length === 0) omitted.push(Object.freeze({ parameter, path: Object.freeze([]), destination: parameter.type,
      action: Object.freeze({ kind: "empty-rest" }) }));
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
        if (effectiveIndex === boundary) omitted.push(Object.freeze({ parameter, path: slot.path, destination: slot.type,
          action: Object.freeze({ kind: "empty-rest" }) }));
        while (effectiveIndex < boundary) {
          const argument = effective[effectiveIndex]!;
          if (argument.sourceForm === "spread-sequence") result.push(place(argument, effectiveIndex++, parameter, "rest-sequence", slot.type, slot.path));
          else {
            if (slot.element === undefined) return refusal("An unresolved original generic rest sequence cannot admit a fabricated scalar element place.");
            result.push(place(argument, effectiveIndex++, parameter, "rest-element", slot.element, [...slot.path, { kind: "array-element" }]));
          }
        }
      } else if (argument === undefined) {
        const allowed = slot.kind === "optional" ? { kind: "resolved" as const, value: true } : allowsOmission(slot.type, false);
        if (allowed.kind !== "resolved") return allowed;
        if (!allowed.value) return mismatch("A Source application omits an original required rest-tuple element.");
        omitted.push(Object.freeze({ parameter, path: slot.path, destination: slot.type,
          action: Object.freeze({ kind: "absence", value: absence(slot.type) }) }));
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
  return effectiveIndex === effective.length ? { kind: "resolved", value: { kind: "placed", values: Object.freeze(result), omitted: Object.freeze(omitted) } }
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

  function absence(destination: SourceTypeEvidence): SourceTypeEvidence {
    return builder.evidence({ type: builder.intrinsic("absence"), component: destination.component,
      category: { kind: "known", category: "absence" }, numeric: undefined, sum: undefined }, [], undefined,
    { kind: "finite", values: [{ kind: "absence" }] },
    { members: { kind: "unavailable" }, origins: builder.sourceOriginSubjects(destination) });
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

export function produceSourceOmittedArguments(builder: SourceDescriptorBuilder, identity: SourceApplicationIdentity,
  parameters: readonly SourceCallParameter[], placement: Extract<SourceArgumentPlacement, { readonly kind: "placed" }>):
  SourceProductionResult<readonly SourceOmittedArgument[]> {
  const result: SourceOmittedArgument[] = [];
  for (const omitted of placement.omitted) {
    const parameter = parameters[omitted.parameter.index];
    if (parameter === undefined || parameter.index !== omitted.parameter.index || parameter.declaration !== omitted.parameter.declaration)
      throw new Error("An omitted Source input retains its exact original formal declaration and ordinal.");
    const original = produceSourceDeclaredParameterPlace(builder, parameter, omitted.path);
    if (original.kind !== "resolved") return original;
    const form = parameter.kind !== "rest" ? "parameter" : omitted.action.kind === "empty-rest" ? "rest-sequence" : "rest-element";
    result.push(Object.freeze({ parameter: Object.freeze({ signature: identity.signature, index: parameter.index,
      ...(parameter.declaration === undefined ? {} : { declaration: parameter.declaration }), form }), path: omitted.path,
    destination: Object.freeze({ declaration: Object.freeze({ origin: Object.freeze({ kind: "parameter", signature: identity.signature,
      index: parameter.index, ...(parameter.declaration === undefined ? {} : { declaration: parameter.declaration }) }), type: original.value }),
    applied: omitted.destination, application: Object.freeze({ kind: "call", identity }) }), action: omitted.action }));
  }
  return { kind: "resolved", value: Object.freeze(result) };
}
