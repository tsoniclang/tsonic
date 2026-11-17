import { selectInlineSourceMember } from "./selected-source-member.js";
import { memoryDiagnostic, publishMemoryFact } from "./memory-analysis-context.js";
import type { MemorySourceAnalysis } from "./memory-analysis-context.js";
import type { MemorySourceCall } from "./memory-analysis-model.js";
import { dataLayoutsEqual, memoryLayoutCaptureLimitsError, memoryLayoutDimensions, tsonicMemoryFieldLayoutFactKey, tsonicMemoryLayoutFactKey, tsonicMemoryLayoutQueryFactKey } from "./memory-layout-facts.js";
import { exactLayoutSize, selectedDataLayout } from "./memory-source-values.js";
import { memoryFieldDimensionsError, memoryLayoutDimensionsError } from "../memory-layout/dimensions.js";
import { isMemoryFieldDeclaration, isMemoryFieldSelector } from "./memory-selectors.js";
import { selectTsonicFixedArray } from "./fixed-array-selection.js";
import { readSourceFact } from "./provider-calls.js";
import { memoryDescriptorKeys } from "../memory-layout/descriptor-declarations.js";
import { readMemoryDescriptor, readMemoryDescriptorFields } from "./memory-descriptors.js";
import { captureMemoryBindingSource } from "./memory-source-capture.js";

export function analyzeMemoryField(call: MemorySourceCall, analysis: MemorySourceAnalysis): void {
  const { selected, context } = call;
  const descriptor = readMemoryDescriptor(call, memoryDescriptorKeys.memoryfield);
  if (descriptor === undefined) return;
  const selector = descriptor.get("select")!;
  const fieldLayoutExpression = descriptor.get("fieldlayout")!;
  const types = selected.selection.selection.application.signatureTypeArguments;
  const sourceType = types?.[0]?.checkedArgument;
  const fieldType = types?.[1]?.checkedArgument;
  const member = selectInlineSourceMember(selector, context);
  const byteOffset = exactLayoutSize(descriptor.get("byteoffset")!, context);
  const byteAlignment = exactLayoutSize(descriptor.get("bytealignment")!, context);
  const fieldLayout = analysis.layout(fieldLayoutExpression, context);
  const declaration = member.kind === "selected" ? member.selectedDeclaration : undefined;
  if (sourceType === undefined || fieldType === undefined ||
      member.kind !== "selected" || declaration === undefined || !isMemoryFieldSelector(selector, context) ||
      !isMemoryFieldDeclaration(declaration, context) || byteOffset === undefined || byteAlignment === undefined) {
    memoryDiagnostic(call, "FIELD_NOT_PROVEN", "memoryfield requires one selected non-optional physical field and exact non-negative integer layout constants.");
    return;
  }
  if (fieldLayout === undefined) {
    memoryDiagnostic(call, "FIELD_LAYOUT_NOT_PROVEN", "memoryfield requires the exact selected child layout for its field type.");
    return;
  }
  const property = context.checker.getResolvedPropertyAccessInfo(member.expression as typeof declaration);
  const error = memoryFieldDimensionsError({ byteOffset, byteAlignment });
  if (error !== undefined) {
    memoryDiagnostic(call, "FIELD_DIMENSIONS_INVALID", error);
    return;
  }
  publishMemoryFact(call, tsonicMemoryFieldLayoutFactKey, {
    call: selected.call, sourceType, selector, selectedDeclaration: declaration,
    ...(property?.selectedSymbol === undefined ? {} : { selectedSymbol: property.selectedSymbol }),
    fieldType, byteOffset, byteAlignment, fieldLayoutExpression, fieldLayout,
  });
  captureMemoryBindingSource(call, 1, 0);
}

export function analyzeMemoryLayout(call: MemorySourceCall, analysis: MemorySourceAnalysis): void {
  const { selected, context } = call;
  const descriptor = readMemoryDescriptor(call, memoryDescriptorKeys.memorylayout);
  if (descriptor === undefined) return;
  const fieldExpressions = readMemoryDescriptorFields(descriptor.get("fields")!, call);
  if (fieldExpressions === undefined) return;
  const pointee = selected.selection.selection.application.signatureTypeArguments?.[0];
  const dataLayoutExpression = descriptor.get("datalayout")!;
  const dataLayout = selectedDataLayout(dataLayoutExpression, context, analysis.registrations);
  const byteSize = exactLayoutSize(descriptor.get("bytesize")!, context);
  const byteAlignment = exactLayoutSize(descriptor.get("bytealignment")!, context);
  const stride = exactLayoutSize(descriptor.get("stride")!, context);
  if (pointee?.checkedArgument === undefined || dataLayout === undefined ||
      byteSize === undefined || byteAlignment === undefined || stride === undefined) {
    memoryDiagnostic(call, "LAYOUT_NOT_PROVEN", "memorylayout requires an exact selected type, registered ABI token, and non-negative safe integer size, alignment and stride.");
    return;
  }
  const array = selectTsonicFixedArray(pointee.checkedArgument, context,
    { getFact: (subject, key) => readSourceFact(context, subject, key) }, { authoredTypeNode: pointee.explicitTypeNode });
  if (array !== undefined) {
    memoryDiagnostic(call, "ARRAY_ELEMENT_REQUIRED", "A fixed-array memory layout requires memoryarraylayout and its exact element child; a field-only descriptor is incomplete.");
    return;
  }
  const fields = fieldExpressions.map(expression => analysis.field(expression, context));
  if (fields.some((field) => field === undefined)) {
    memoryDiagnostic(call, "LAYOUT_FIELD_NOT_PROVEN", "Every layout field must retain an exact field fact for the same selected source type.");
    return;
  }
  if (fields.some((field) => field !== undefined && !dataLayoutsEqual(field.fieldLayout.dataLayout, dataLayout))) {
    memoryDiagnostic(call, "LAYOUT_FIELD_ABI_MISMATCH", "Every physical field must use the same exact ABI identity and descriptor as its containing layout.");
    return;
  }
  const fact = {
    kind: "value" as const,
    call: selected.call, sourceType: pointee.checkedArgument,
    ...(pointee.explicitTypeNode === undefined ? {} : { explicitTypeNode: pointee.explicitTypeNode }),
    dataLayoutExpression, dataLayout, byteSize, byteAlignment, stride,
    fields: fields.filter((field) => field !== undefined),
  };
  const captureError = memoryLayoutCaptureLimitsError(fact.fields.map(field => field.fieldLayout), fact.fields.length);
  if (captureError !== undefined) {
    memoryDiagnostic(call, "LAYOUT_CAPTURE_LIMIT", captureError);
    return;
  }
  const error = memoryLayoutDimensionsError(memoryLayoutDimensions(fact));
  if (error !== undefined) {
    memoryDiagnostic(call, "LAYOUT_DIMENSIONS_INVALID", error);
    return;
  }
  publishMemoryFact(call, tsonicMemoryLayoutFactKey, fact);
  captureMemoryBindingSource(call, 0);
}

export function analyzeMemoryLayoutQuery(call: MemorySourceCall, analysis: MemorySourceAnalysis): void {
  const { selected, context } = call;
  const operand = selected.selection.selection.argumentValues[0];
  if (operand === undefined) {
    memoryDiagnostic(call, "QUERY_OPERAND_MISSING", "Layout query is missing its exact selected layout operand.");
    return;
  }
  const layout = analysis.layout(operand.expression, context);
  const base = {
    call: selected.call, layoutExpression: operand.expression,
    layoutType: operand.type, resultType: selected.selection.resultType,
  };
  if (call.name === "fieldoffsetof") {
    const member = selectInlineSourceMember(selected.selection.selection.argumentValues[1]?.expression, context);
    const declaration = member.kind === "selected" ? member.selectedDeclaration : undefined;
    const selector = selected.selection.selection.argumentValues[1];
    if (declaration === undefined || selector === undefined || !isMemoryFieldSelector(selector.expression, context) ||
        !isMemoryFieldDeclaration(declaration, context) || layout === undefined) {
      memoryDiagnostic(call, "QUERY_FIELD_NOT_PROVEN", "fieldoffsetof requires one exact non-optional physical field selection.");
      return;
    }
    publishMemoryFact(call, tsonicMemoryLayoutQueryFactKey, { ...base, operation: "field-offset", selectedFieldDeclaration: declaration });
    captureMemoryBindingSource(call, 0);
    return;
  }
  const operation = call.name === "sizeof" ? "size" : call.name === "alignof" ? "alignment" : "stride";
  publishMemoryFact(call, tsonicMemoryLayoutQueryFactKey, { ...base, operation });
  captureMemoryBindingSource(call, 0);
}
