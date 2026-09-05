import type { SourcePrimitiveFact } from "@tsonic/tsts";
import { readSourcePrimitiveAnnotation } from "../../analysis/source-primitive.js";
import type { MemorySourceAnalysis, MemorySourceCall } from "../../memory-layout/analysis-context.js";
import type { TsonicDataLayoutFact } from "../../memory-layout/facts.js";
import { classifyIntegerConstant, selectedPrimitive, selectedValueAnnotation } from "../../memory-layout/source-values.js";
import type { TsonicAddressIntegerDomain } from "./facts.js";

function addressDomain(primitive: SourcePrimitiveFact | undefined): TsonicAddressIntegerDomain | undefined {
  if (primitive?.kind === "uint32" && primitive.width === 32 &&
      primitive.runtimeBase === "number" && primitive.signed === false) {
    return { addressWidth: 32, addressRuntimeBase: "number", addressSignedness: "unsigned" };
  }
  if (primitive?.kind === "uint64" && primitive.width === 64 &&
      primitive.runtimeBase === "bigint" && primitive.signed === false) {
    return { addressWidth: 64, addressRuntimeBase: "bigint", addressSignedness: "unsigned" };
  }
  return undefined;
}

export function selectedAddressIntegerDomain(
  call: MemorySourceCall,
  dataLayout: TsonicDataLayoutFact,
  analysis: MemorySourceAnalysis,
): TsonicAddressIntegerDomain | undefined {
  const { selected, context, name } = call;
  const argument = selected.selection.sourceSelectedMethodTypeArguments?.[0];
  if (argument === undefined) return undefined;
  const explicit = argument.explicitTypeNode === undefined ? undefined
    : addressDomain(readSourcePrimitiveAnnotation(context, argument.explicitTypeNode));
  if (argument.explicitTypeNode !== undefined && explicit === undefined) return undefined;
  if (name === "rawPointerToAddressInteger") {
    return explicit?.addressWidth === dataLayout.addressWidth ? explicit : undefined;
  }
  const operand = selected.selection.sourceArguments[0];
  if (operand === undefined) return undefined;
  const primitive = selectedPrimitive(operand, context, analysis);
  const domain = addressDomain(primitive);
  const constant = classifyIntegerConstant(operand.expression, context);
  if (constant.kind === "invalid") return undefined;
  if (domain === undefined && (primitive !== undefined || selectedValueAnnotation(operand, context) !== undefined)) {
    return undefined;
  }
  if (domain === undefined && (explicit === undefined || constant.kind !== "available")) return undefined;
  if (domain !== undefined && explicit !== undefined && domain.addressWidth !== explicit.addressWidth) return undefined;
  const selectedDomain = domain ?? explicit;
  if (selectedDomain === undefined || selectedDomain.addressWidth !== dataLayout.addressWidth) return undefined;
  if (constant.kind === "available" && (
    constant.runtimeBase !== selectedDomain.addressRuntimeBase || constant.value < 0n ||
    constant.value >= (1n << BigInt(selectedDomain.addressWidth))
  )) return undefined;
  return selectedDomain;
}
