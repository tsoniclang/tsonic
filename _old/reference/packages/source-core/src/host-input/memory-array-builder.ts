import { tsonicFixedArrayFactKey } from "./fixed-array-facts.js";
import { memoryDiagnostic, publishMemoryFact } from "./memory-analysis-context.js";
import type { MemorySourceAnalysis } from "./memory-analysis-context.js";
import type { MemorySourceCall } from "./memory-analysis-model.js";
import { memoryLayoutDimensionsError } from "../memory-layout/dimensions.js";
import { dataLayoutsEqual, memoryLayoutCaptureLimitsError, memoryLayoutDimensions, tsonicMemoryLayoutFactKey } from "./memory-layout-facts.js";
import type { TsonicArrayMemoryLayoutFact } from "./memory-layout-facts.js";
import { exactIntegerConstant, exactLayoutSize, selectedDataLayout } from "./memory-source-values.js";
import { memoryDescriptorKeys } from "../memory-layout/descriptor-declarations.js";
import { readMemoryDescriptor } from "./memory-descriptors.js";
import { captureMemoryArraySource } from "./memory-source-capture.js";
import { tsonicMemorySourceFactKey } from "./memory-publications.js";

export function analyzeMemoryArrayLayout(call: MemorySourceCall, analysis: MemorySourceAnalysis): void {
  const { selected, context } = call;
  const descriptor = readMemoryDescriptor(call, memoryDescriptorKeys.memoryarraylayout);
  if (descriptor === undefined) return;
  const dataLayoutExpression = descriptor.get("datalayout")!;
  const dataLayout = selectedDataLayout(dataLayoutExpression, context, analysis.registrations);
  const byteSize = exactLayoutSize(descriptor.get("bytesize")!, context);
  const byteAlignment = exactLayoutSize(descriptor.get("bytealignment")!, context);
  const stride = exactLayoutSize(descriptor.get("stride")!, context);
  const elementLayoutExpression = descriptor.get("elementlayout")!;
  const count = exactIntegerConstant(descriptor.get("length")!, context);
  if (dataLayout === undefined || byteSize === undefined ||
      byteAlignment === undefined || stride === undefined || count === undefined || count.value < 0n) {
    memoryDiagnostic(call, "ARRAY_LAYOUT_NOT_PROVEN", "memoryarraylayout requires an exact registered ABI, whole-array dimensions, selected element layout and non-negative integer literal extent.");
    return;
  }
  const elementLayout = analysis.layout(elementLayoutExpression, context);
  if (elementLayout === undefined) {
    memoryDiagnostic(call, "ARRAY_ELEMENT_NOT_PROVEN", "memoryarraylayout requires a finalized element layout, not an unproduced descriptor.");
    return;
  }
  const source = captureMemoryArraySource(call, count);
  if (source === undefined) {
    memoryDiagnostic(call, "ARRAY_TYPE_NOT_PROVEN", "Memory array element and extent must match the exact selected fixed-array type and source marker domains.");
    return;
  }
  const { fixedArray } = source;
  if (!dataLayoutsEqual(dataLayout, elementLayout.dataLayout)) {
    memoryDiagnostic(call, "ARRAY_ELEMENT_ABI_MISMATCH", "Memory array and element layout must use the same exact ABI identity and descriptor.");
    return;
  }
  const fact: TsonicArrayMemoryLayoutFact = {
    kind: "array", call: selected.call, sourceType: fixedArray.sourceType,
    dataLayoutExpression, dataLayout, byteSize, byteAlignment, stride,
    fixedArray, elementLayoutExpression, elementLayout,
  };
  const captureError = memoryLayoutCaptureLimitsError([elementLayout]);
  if (captureError !== undefined) {
    memoryDiagnostic(call, "LAYOUT_CAPTURE_LIMIT", captureError);
    return;
  }
  const error = memoryLayoutDimensionsError(memoryLayoutDimensions(fact));
  if (error !== undefined) {
    memoryDiagnostic(call, "ARRAY_DIMENSIONS_INVALID", error);
    return;
  }
  publishMemoryFact(call, tsonicFixedArrayFactKey, fixedArray);
  publishMemoryFact(call, tsonicMemoryLayoutFactKey, fact);
  publishMemoryFact(call, tsonicMemorySourceFactKey,
    call.publications.create(call.selected.call, { source: source.source, owner: undefined }));
}
