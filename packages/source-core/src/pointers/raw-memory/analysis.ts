import type { MemorySourceAnalysis, MemorySourceCall } from "../../memory-layout/analysis-context.js";
import { memoryDiagnostic, publishMemoryFact } from "../../memory-layout/analysis-context.js";
import { selectedDataLayout } from "../../memory-layout/source-values.js";
import { selectedAddressIntegerDomain } from "./address-integers.js";
import { tsonicKeepAliveFactKey, tsonicRawMemoryOperationFactKey } from "./facts.js";
import { selectedRawOffsetInteger } from "./integers.js";

export function analyzeRawMemoryCall(call: MemorySourceCall, analysis: MemorySourceAnalysis): void {
  const { selected, context, name } = call;
  const args = selected.selection.sourceArguments;
  const operand = args[0];
  const base = { call: selected.call, resultType: selected.selection.sourceResultType };
  if (operand === undefined) {
    memoryDiagnostic(call, "OPERAND_MISSING", "The memory operation is missing its selected operand.");
    return;
  }
  if (name === "keepAlive") {
    publishMemoryFact(call, tsonicKeepAliveFactKey, { ...base, valueExpression: operand.expression, valueType: operand.type });
    return;
  }
  if (name === "toRawPointer" || name === "reinterpretRawPointer") {
    const pointee = selected.selection.sourceSelectedMethodTypeArguments?.[0];
    const layout = args[1];
    if (pointee === undefined || layout === undefined) {
      memoryDiagnostic(call, "POINTEE_MISSING", "Raw conversion requires its exact resolved pointee and selected layout operand.");
      return;
    }
    analysis.layout(layout.expression, context);
    const typed = { ...base, pointeeType: pointee.selectedType, layoutExpression: layout.expression, layoutType: layout.type };
    publishMemoryFact(call, tsonicRawMemoryOperationFactKey, name === "toRawPointer"
      ? { ...typed, operation: "to-raw", pointerExpression: operand.expression, pointerType: operand.type }
      : { ...typed, operation: "reinterpret", rawExpression: operand.expression, rawType: operand.type,
          ...(pointee.explicitTypeNode === undefined ? {} : { explicitPointeeTypeNode: pointee.explicitTypeNode }) });
    return;
  }
  const dataLayoutOperand = args[name === "offsetRawPointer" ? 2 : 1];
  const dataLayout = dataLayoutOperand === undefined ? undefined : selectedDataLayout(dataLayoutOperand, context, analysis.registrations);
  if (dataLayoutOperand === undefined || dataLayout === undefined) {
    memoryDiagnostic(call, "ABI_NOT_PROVEN", "Address arithmetic requires one exact registered data-layout token.");
    return;
  }
  const raw = { ...base, rawExpression: operand.expression, rawType: operand.type, dataLayoutExpression: dataLayoutOperand.expression };
  if (name === "offsetRawPointer") {
    const offset = args[1];
    const integer = offset === undefined ? undefined : selectedRawOffsetInteger(offset, dataLayout, context, analysis);
    if (offset === undefined || integer === undefined) {
      memoryDiagnostic(call, "OFFSET_INTEGER_NOT_PROVEN", "Raw byte offsets require exact signed/unsigned integer evidence or an in-range integral constant; floating and unproven numeric domains are not accepted.");
      return;
    }
    publishMemoryFact(call, tsonicRawMemoryOperationFactKey, {
      ...raw, operation: "byte-offset", offsetExpression: offset.expression, offsetType: offset.type,
      offsetRuntimeBase: integer.runtimeBase, offsetSignedness: integer.signedness, offsetWidth: integer.width,
    });
  } else if (name === "rawPointerToAddressInteger" || name === "addressIntegerToRawPointer") {
    const domain = selectedAddressIntegerDomain(call, dataLayout, analysis);
    if (domain === undefined) {
      memoryDiagnostic(call, "ADDRESS_INTEGER_NOT_PROVEN", "Address conversions require uint32/number for a 32-bit ABI or uint64/bigint for a 64-bit ABI and an in-range unsigned value. Raw-to-integer requires an explicit address type argument; inverse conversion requires an exact operand domain or an explicitly typed integral constant.");
      return;
    }
    publishMemoryFact(call, tsonicRawMemoryOperationFactKey, name === "rawPointerToAddressInteger"
      ? { ...raw, ...domain, operation: "raw-to-address-integer" }
      : { ...base, ...domain, operation: "address-integer-to-raw", addressExpression: operand.expression,
      addressType: operand.type, dataLayoutExpression: dataLayoutOperand.expression,
    });
  }
}
