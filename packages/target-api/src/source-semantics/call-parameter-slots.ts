import type {
  TypeShapeQueries,
  TypeSignatureParameterInfo,
} from "@tsonic/tsts";
import type {
  ResolvedSourceCallInfo,
} from "./call-result-selection.js";

export interface SourceCallParameterSlot {
  readonly sourceParameterIndex: number;
  readonly sourceParameterName: string;
  readonly form: "required" | "optional" | "rest";
}

export function selectSourceCallParameterSlots(
  source: ResolvedSourceCallInfo,
  typeShape: Pick<TypeShapeQueries, "isTuple" | "getTupleElementInfos" | "getSignatureParameterInfos">,
): readonly SourceCallParameterSlot[] | undefined {
  if (source.sourceSelectedSignatureKind !== "resolved") {
    return undefined;
  }
  const slots: SourceCallParameterSlot[] = [];
  const indexes = new Set<number>();
  let effectiveParameters: readonly TypeSignatureParameterInfo[] | undefined;
  for (const parameter of source.sourceSelectedSignatureParameters) {
    if (!Number.isSafeInteger(parameter.parameterIndex) ||
      parameter.parameterIndex < 0 || indexes.has(parameter.parameterIndex)) {
      return undefined;
    }
    indexes.add(parameter.parameterIndex);
    if (!parameter.rest || !typeShape.isTuple(parameter.selectedType)) {
      slots.push(Object.freeze({
        sourceParameterIndex: parameter.parameterIndex,
        sourceParameterName: parameter.parameterName,
        form: parameter.rest
          ? "rest"
          : parameter.acceptsOmission ? "optional" : "required",
      }));
      continue;
    }
    const elements = typeShape.getTupleElementInfos(parameter.selectedType);
    effectiveParameters ??= typeShape.getSignatureParameterInfos(source.selectedSignature);
    const start = slots.length;
    for (const index of elements.keys()) {
      const effective = effectiveParameters[start + index];
      if (effective === undefined) return undefined;
      slots.push(Object.freeze({
        sourceParameterIndex: parameter.parameterIndex,
        sourceParameterName: `${parameter.parameterName || "arg"}${index}`,
        form: effective.parameterKind === "rest"
          ? "rest" : effective.acceptsOmission ? "optional" : "required",
      }));
    }
  }
  if (effectiveParameters !== undefined && slots.length !== effectiveParameters.length) return undefined;
  return Object.freeze(slots);
}
