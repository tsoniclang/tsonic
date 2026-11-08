import type { Node } from "@tsonic/tsts";
import type { SourceArgumentPlace, SourceAuthoredArgument, SourceTypeEvidence } from "../../public/source/contracts.js";
import type { SourceDescriptorBuilder, SourceProductionResult } from "../descriptor-contracts.js";
import { sourceSemanticRefusal } from "./semantic-production.js";

export interface SourceCallParameter {
  readonly index: number;
  readonly declaration: Node | undefined;
  readonly kind: "required" | "optional" | "rest";
  readonly type: SourceTypeEvidence;
}

export interface SourceUnappliedArgumentPlace {
  readonly sourceArgument: Node;
  readonly sourceArgumentIndex: number;
  readonly effectiveArgument: Node;
  readonly effectiveArgumentIndex: number;
  readonly sourceForm: SourceArgumentPlace["sourceForm"];
  readonly spreadElementIndex: number | undefined;
  readonly source: SourceTypeEvidence;
  readonly parameter: SourceCallParameter;
  readonly parameterForm: SourceArgumentPlace["parameter"]["form"];
  readonly destination: SourceTypeEvidence;
}

interface SourceEffectiveArgument {
  readonly authored: SourceAuthoredArgument;
  readonly sourceArgumentIndex: number;
  readonly sourceForm: SourceArgumentPlace["sourceForm"];
  readonly spreadElementIndex: number | undefined;
  readonly source: SourceTypeEvidence;
}

export function produceSourceArgumentPlaces(context: {
  readonly builder: SourceDescriptorBuilder;
  readonly invocation: Node;
  readonly sourceArguments: readonly SourceAuthoredArgument[];
  readonly parameters: readonly SourceCallParameter[];
}): SourceProductionResult<readonly SourceUnappliedArgumentPlace[]> {
  const { builder, invocation } = context;
  const effective: SourceEffectiveArgument[] = [];
  const result: SourceUnappliedArgumentPlace[] = [];
  const refusal = (message: string) => sourceSemanticRefusal(invocation, message, "TSONIC_LOCAL_TYPE_GENERIC");
  for (const [sourceArgumentIndex, authored] of context.sourceArguments.entries()) {
    builder.assertEvidence(authored.operand.value);
    if (authored.form === "value") {
      effective.push({ authored, sourceArgumentIndex, sourceForm: "value", spreadElementIndex: undefined, source: authored.operand.value });
      continue;
    }
    const definition = builder.produceDefinition(authored.operand.value);
    if (definition.kind !== "resolved") return definition;
    const value = definition.value;
    if (value.type.kind !== "tuple") {
      effective.push({ authored, sourceArgumentIndex, sourceForm: "spread-sequence", spreadElementIndex: undefined, source: authored.operand.value });
      continue;
    }
    for (const [index, element] of value.type.elements.entries()) {
      const source = builder.component(value, { kind: "tuple-element", index });
      if (source.kind === "refused") return source;
      if (element.kind === "required") effective.push({ authored, sourceArgumentIndex, sourceForm: "spread-element", spreadElementIndex: index, source: source.value });
      else {
        const tail = builder.component(value, { kind: "tuple-slice", start: index, endCount: 0, readonly: value.type.readonly });
        if (tail.kind === "refused") return tail;
        effective.push({ authored, sourceArgumentIndex, sourceForm: "spread-sequence", spreadElementIndex: index, source: tail.value });
        break;
      }
    }
  }
  let effectiveIndex = 0;
  for (const [parameterIndex, parameter] of context.parameters.entries()) {
    if (parameter.index !== parameterIndex) throw new Error("Source call parameters require their exact original contiguous index vector.");
    builder.assertEvidence(parameter.type);
    const argument = effective[effectiveIndex];
    if (parameter.kind !== "rest") {
      if (argument === undefined) {
        if (parameter.kind === "required") return refusal("A Source application omits an original required parameter.");
        continue;
      }
      if (argument.sourceForm === "spread-sequence") return refusal("A variable-length spread cannot establish one original fixed parameter place.");
      result.push(place(argument, effectiveIndex++, parameter, "parameter", parameter.type));
      continue;
    }
    if (parameterIndex !== context.parameters.length - 1) throw new Error("A Source rest parameter must be the final original signature parameter.");
    const definition = builder.produceDefinition(parameter.type);
    if (definition.kind !== "resolved") return definition;
    const rest = definition.value;
    if (rest.type.kind === "tuple") {
      for (const [index, element] of rest.type.elements.entries()) {
        const argument = effective[effectiveIndex];
        if (argument === undefined) {
          if (element.kind === "required") return refusal("A Source application omits an original required rest-tuple element.");
          continue;
        }
        const destination = builder.component(rest, { kind: "tuple-element", index });
        if (destination.kind === "refused") return destination;
        if (element.kind === "rest") {
          const tail = sequence(destination.value, parameter);
          if (tail.kind !== "resolved") return tail;
          const suffix = rest.type.elements.length - index - 1;
          const boundary = effective.length - suffix;
          if (boundary < effectiveIndex) return refusal("A Source rest-tuple application omits an original required suffix.");
          if (suffix > 0 && effective.slice(boundary).some(argument => argument.sourceForm === "spread-sequence")) {
            return refusal("A variable-length spread cannot fabricate the original fixed rest-tuple suffix places.");
          }
          while (effectiveIndex < boundary) {
            const argument = effective[effectiveIndex]!;
            if (argument.sourceForm === "spread-sequence") result.push(place(argument, effectiveIndex++, parameter, "rest-sequence", tail.value.sequence));
            else {
              if (tail.value.element === undefined) return refusal("An unresolved original generic rest sequence cannot admit a fabricated scalar element place.");
              result.push(place(argument, effectiveIndex++, parameter, "rest-element", tail.value.element));
            }
          }
          continue;
        }
        if (argument.sourceForm === "spread-sequence") {
          const tail = builder.component(rest, { kind: "tuple-slice", start: index, endCount: 0, readonly: rest.type.readonly });
          if (tail.kind === "refused") return tail;
          if (effectiveIndex !== effective.length - 1) return refusal("An optional tuple spread before later arguments has no single original effective parameter vector.");
          result.push(place(argument, effectiveIndex++, parameter, "rest-sequence", tail.value));
          break;
        }
        result.push(place(argument, effectiveIndex++, parameter, "rest-element", destination.value));
      }
      continue;
    }
    const tail = sequence(rest, parameter);
    if (tail.kind !== "resolved") return tail;
    return appendSequence(tail.value, parameter);
  }
  return effectiveIndex === effective.length ? { kind: "resolved", value: Object.freeze(result) }
    : refusal("A Source application has an argument outside its original parameter domain.");

  function place(argument: SourceEffectiveArgument, effectiveArgumentIndex: number, parameter: SourceCallParameter,
    parameterForm: SourceArgumentPlace["parameter"]["form"], destination: SourceTypeEvidence): SourceUnappliedArgumentPlace {
    return Object.freeze({ sourceArgument: argument.authored.occurrence, sourceArgumentIndex: argument.sourceArgumentIndex,
      effectiveArgument: argument.authored.operand.occurrence, effectiveArgumentIndex,
      sourceForm: argument.sourceForm, spreadElementIndex: argument.spreadElementIndex,
      source: argument.source, parameter, parameterForm, destination });
  }

  function sequence(value: SourceTypeEvidence, parameter: SourceCallParameter): SourceProductionResult<{
    readonly sequence: SourceTypeEvidence; readonly element: SourceTypeEvidence | undefined;
  }> {
    const definition = builder.produceDefinition(value);
    if (definition.kind !== "resolved") return definition;
    const selected = definition.value;
    if (selected.type.kind === "array") {
      const element = builder.component(selected, { kind: "array-element" });
      return element.kind === "refused" ? element : { kind: "resolved", value: { sequence: value, element: element.value } };
    }
    if (selected.type.kind === "parameter" || selected.type.kind === "projection") {
      return { kind: "resolved", value: { sequence: value, element: undefined } };
    }
    return sourceSemanticRefusal(parameter.declaration ?? invocation, "An original rest parameter requires its solved sequence or tuple component.", "TSONIC_LOCAL_TYPE_GENERIC");
  }

  function appendSequence(tail: { readonly sequence: SourceTypeEvidence; readonly element: SourceTypeEvidence | undefined },
    parameter: SourceCallParameter): SourceProductionResult<readonly SourceUnappliedArgumentPlace[]> {
    while (effectiveIndex < effective.length) {
      const argument = effective[effectiveIndex]!;
      if (argument.sourceForm === "spread-sequence") result.push(place(argument, effectiveIndex++, parameter, "rest-sequence", tail.sequence));
      else {
        if (tail.element === undefined) return refusal("An unresolved original generic rest sequence cannot admit a fabricated scalar element place.");
        result.push(place(argument, effectiveIndex++, parameter, "rest-element", tail.element));
      }
    }
    return { kind: "resolved", value: Object.freeze(result) };
  }
}
