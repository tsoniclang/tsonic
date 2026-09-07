import type { TsonicSourceFileAnalysisContext } from "../../analysis/context.js";
import type { TsonicDataLayoutFact } from "../../memory-layout/facts.js";
import type { MemorySourceAnalysis } from "../../memory-layout/analysis-context.js";
import { classifyIntegerConstant, selectedPrimitive, selectedValueAnnotation } from "../../memory-layout/source-values.js";
import type { SelectedMemoryValue } from "../../memory-layout/source-values.js";

export interface RawOffsetInteger {
  readonly runtimeBase: "number" | "bigint";
  readonly signedness: "signed" | "unsigned";
  readonly width: 8 | 16 | 32 | 64 | 128;
}

export function selectedRawOffsetInteger(
  value: SelectedMemoryValue,
  dataLayout: TsonicDataLayoutFact,
  context: TsonicSourceFileAnalysisContext,
  analysis: MemorySourceAnalysis,
): RawOffsetInteger | undefined {
  const constant = classifyIntegerConstant(value.expression, context);
  if (constant.kind === "invalid") return undefined;
  const primitive = selectedPrimitive(value, context, analysis);
  if (primitive !== undefined) {
    const integer = ((): RawOffsetInteger | undefined => {
      switch (primitive.kind) {
        case "int8": case "int16": case "int32": case "int64": case "int128":
        case "uint8": case "uint16": case "uint32": case "uint64": case "uint128": {
          const width = primitive.width;
          if (width !== 8 && width !== 16 && width !== 32 && width !== 64 && width !== 128) return undefined;
          const runtimeBase = primitive.runtimeBase;
          return runtimeBase === "number" || runtimeBase === "bigint"
            ? { runtimeBase, signedness: primitive.signed === true ? "signed" as const : "unsigned" as const, width }
            : undefined;
        }
        case "native-int": case "native-uint": return {
          runtimeBase: "number" as const,
          signedness: primitive.kind === "native-int" ? "signed" as const : "unsigned" as const,
          width: dataLayout.addressWidth,
        };
        default: return undefined;
      }
    })();
    if (integer === undefined) return undefined;
    return constant.kind === "available" && (
      constant.runtimeBase !== integer.runtimeBase || !integerFits(constant.value, integer)
    ) ? undefined : integer;
  }
  if (selectedValueAnnotation(value, context) !== undefined) return undefined;
  if (constant.kind !== "available") return undefined;
  const integer: RawOffsetInteger = {
    runtimeBase: constant.runtimeBase, signedness: "signed", width: dataLayout.addressWidth,
  };
  return integerFits(constant.value, integer) ? integer : undefined;
}

function integerFits(value: bigint, integer: RawOffsetInteger): boolean {
  const bits = BigInt(integer.width);
  const minimum = integer.signedness === "signed" ? -(1n << (bits - 1n)) : 0n;
  const maximum = integer.signedness === "signed" ? (1n << (bits - 1n)) - 1n : (1n << bits) - 1n;
  return value >= minimum && value <= maximum;
}
