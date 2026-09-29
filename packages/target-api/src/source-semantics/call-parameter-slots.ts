import type {
  TypeShapeQueries,
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
  typeShape: Pick<TypeShapeQueries, "isTuple" | "getTupleElementInfos">,
): readonly SourceCallParameterSlot[] | undefined {
  if (source.sourceSelectedSignatureKind !== "resolved") {
    return undefined;
  }
  const slots: SourceCallParameterSlot[] = [];
  const indexes = new Set<number>();
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
    for (const [index, element] of elements.entries()) {
      slots.push(Object.freeze({
        sourceParameterIndex: parameter.parameterIndex,
        sourceParameterName: `${parameter.parameterName || "arg"}${index}`,
        form: element.elementKind === "optional"
          ? "optional"
          : element.elementKind === "rest" || element.elementKind === "variadic"
            ? "rest"
            : "required",
      }));
    }
  }
  return Object.freeze(slots);
}
