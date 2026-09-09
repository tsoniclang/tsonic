import { tsonicFixedArrayFactKey } from "../fixed-arrays/facts.js";
import { memoryDiagnostic, publishMemoryFact } from "./analysis-context.js";
import type { MemorySourceAnalysis, MemorySourceCall } from "./analysis-context.js";
import { memoryLayoutDimensionsError } from "./dimensions.js";
import { dataLayoutsEqual, memoryLayoutCaptureLimitsError, tsonicMemoryLayoutFactKey } from "./facts.js";
import type { TsonicArrayMemoryLayoutFact } from "./facts.js";
import { exactIntegerConstant, exactLayoutSize, selectedDataLayout } from "./source-values.js";

export function analyzeMemoryArrayLayout(call: MemorySourceCall, analysis: MemorySourceAnalysis): void {
  const { selected, context } = call;
  const args = selected.selection.sourceArguments;
  const dataLayout = args[0] === undefined ? undefined : selectedDataLayout(args[0], context, analysis.registrations);
  const byteSize = args[1] === undefined ? undefined : exactLayoutSize(args[1].expression, context);
  const byteAlignment = args[2] === undefined ? undefined : exactLayoutSize(args[2].expression, context);
  const stride = args[3] === undefined ? undefined : exactLayoutSize(args[3].expression, context);
  const element = args[4];
  const count = args[5] === undefined ? undefined : exactIntegerConstant(args[5].expression, context);
  if (args.length !== 6 || args[0] === undefined || dataLayout === undefined || byteSize === undefined ||
      byteAlignment === undefined || stride === undefined || element === undefined || count === undefined || count.value < 0n) {
    memoryDiagnostic(call, "ARRAY_LAYOUT_NOT_PROVEN", "memoryArrayLayout requires an exact registered ABI, whole-array dimensions, selected element layout and non-negative integer literal extent.");
    return;
  }
  const elementLayout = analysis.layout(element.expression, context);
  if (elementLayout === undefined) {
    memoryDiagnostic(call, "ARRAY_ELEMENT_NOT_PROVEN", "memoryArrayLayout requires a finalized element layout, not an unproduced descriptor.");
    return;
  }
  const fixedArray = analysis.types.array(call, elementLayout, count);
  if (fixedArray === undefined) {
    memoryDiagnostic(call, "ARRAY_TYPE_NOT_PROVEN", "Memory array element and extent must match the exact selected fixed-array type and source marker domains.");
    return;
  }
  if (!dataLayoutsEqual(dataLayout, elementLayout.dataLayout)) {
    memoryDiagnostic(call, "ARRAY_ELEMENT_ABI_MISMATCH", "Memory array and element layout must use the same exact ABI identity and descriptor.");
    return;
  }
  const fact: TsonicArrayMemoryLayoutFact = {
    kind: "array", call: selected.call, sourceType: fixedArray.sourceType,
    dataLayoutExpression: args[0].expression, dataLayout, byteSize, byteAlignment, stride,
    fixedArray, elementLayoutExpression: element.expression, elementLayout,
  };
  const error = memoryLayoutDimensionsError(fact);
  if (error !== undefined) {
    memoryDiagnostic(call, "ARRAY_DIMENSIONS_INVALID", error);
    return;
  }
  const captureError = memoryLayoutCaptureLimitsError([elementLayout]);
  if (captureError !== undefined) {
    memoryDiagnostic(call, "LAYOUT_CAPTURE_LIMIT", captureError);
    return;
  }
  publishMemoryFact(call, tsonicFixedArrayFactKey, fixedArray);
  publishMemoryFact(call, tsonicMemoryLayoutFactKey, fact);
  analysis.types.publish(call);
}
