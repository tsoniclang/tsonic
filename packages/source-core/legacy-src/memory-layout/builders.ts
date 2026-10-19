import { selectInlineSourceMember } from "../analysis/selected-source-member.js";
import { memoryDiagnostic, publishMemoryFact } from "./analysis-context.js";
import type { MemorySourceAnalysis, MemorySourceCall } from "./analysis-context.js";
import { dataLayoutsEqual, memoryLayoutCaptureLimitsError, tsonicMemoryFieldLayoutFactKey, tsonicMemoryLayoutFactKey, tsonicMemoryLayoutQueryFactKey } from "./facts.js";
import { exactLayoutSize, selectedDataLayout } from "./source-values.js";
import { memoryFieldDimensionsError, memoryLayoutDimensionsError } from "./dimensions.js";
import { isMemoryFieldDeclaration, isMemoryFieldSelector } from "./selectors.js";
import { selectTsonicFixedArray } from "../fixed-arrays/selection.js";
import { readSourceFact } from "../analysis/source-call.js";
import { memoryDescriptorKeys } from "./descriptor-declarations.js";
import { readMemoryDescriptor, readMemoryDescriptorFields } from "./descriptors.js";

export function analyzeMemoryField(call: MemorySourceCall, analysis: MemorySourceAnalysis): void {
  const { selected, context } = call;
  const descriptor = readMemoryDescriptor(call, memoryDescriptorKeys.memoryfield);
  if (descriptor === undefined) return;
  const selector = descriptor.get("select")!;
  const fieldLayoutExpression = descriptor.get("fieldlayout")!;
  const types = selected.selection.sourceSelectedMethodTypeArguments;
  const sourceType = types?.[0]?.selectedType;
  const fieldType = types?.[1]?.selectedType;
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
  if (fieldLayout === undefined || !analysis.types.field(call, declaration, selector, fieldLayout)) {
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
  analysis.types.publish(call);
}

export function analyzeMemoryLayout(call: MemorySourceCall, analysis: MemorySourceAnalysis): void {
  const { selected, context } = call;
  const descriptor = readMemoryDescriptor(call, memoryDescriptorKeys.memorylayout);
  if (descriptor === undefined) return;
  const fieldExpressions = readMemoryDescriptorFields(descriptor.get("fields")!, call);
  if (fieldExpressions === undefined) return;
  const pointee = selected.selection.sourceSelectedMethodTypeArguments?.[0];
  const dataLayoutExpression = descriptor.get("datalayout")!;
  const dataLayout = selectedDataLayout(dataLayoutExpression, context, analysis.registrations);
  const byteSize = exactLayoutSize(descriptor.get("bytesize")!, context);
  const byteAlignment = exactLayoutSize(descriptor.get("bytealignment")!, context);
  const stride = exactLayoutSize(descriptor.get("stride")!, context);
  if (pointee === undefined || dataLayout === undefined ||
      byteSize === undefined || byteAlignment === undefined || stride === undefined) {
    memoryDiagnostic(call, "LAYOUT_NOT_PROVEN", "memorylayout requires an exact selected type, registered ABI token, and non-negative safe integer size, alignment and stride.");
    return;
  }
  const array = selectTsonicFixedArray(pointee.selectedType, context,
    { getFact: (subject, key) => readSourceFact(context, subject, key) }, { authoredTypeNode: pointee.explicitTypeNode });
  if (array !== undefined) {
    memoryDiagnostic(call, "ARRAY_ELEMENT_REQUIRED", "A fixed-array memory layout requires memoryarraylayout and its exact element child; a field-only descriptor is incomplete.");
    return;
  }
  if (!analysis.types.layout(call)) {
    memoryDiagnostic(call, "TYPE_NOT_PROVEN", "Memory layout requires an exact closed source memory type and selected marker domain.");
    return;
  }
  const fields = fieldExpressions.map(expression => analysis.field(expression, context));
  if (fields.some((field) => field === undefined) ||
      !analysis.types.aggregate(call, fields.filter(field => field !== undefined).map(field => field.call))) {
    memoryDiagnostic(call, "LAYOUT_FIELD_NOT_PROVEN", "Every layout field must retain an exact field fact for the same selected source type.");
    return;
  }
  if (fields.some((field) => field !== undefined && !dataLayoutsEqual(field.fieldLayout.dataLayout, dataLayout))) {
    memoryDiagnostic(call, "LAYOUT_FIELD_ABI_MISMATCH", "Every physical field must use the same exact ABI identity and descriptor as its containing layout.");
    return;
  }
  const fact = {
    kind: "value" as const,
    call: selected.call, sourceType: pointee.selectedType,
    ...(pointee.explicitTypeNode === undefined ? {} : { explicitTypeNode: pointee.explicitTypeNode }),
    dataLayoutExpression, dataLayout, byteSize, byteAlignment, stride,
    fields: fields.filter((field) => field !== undefined),
  };
  const error = memoryLayoutDimensionsError(fact);
  if (error !== undefined) {
    memoryDiagnostic(call, "LAYOUT_DIMENSIONS_INVALID", error);
    return;
  }
  const captureError = memoryLayoutCaptureLimitsError(fact.fields.map(field => field.fieldLayout), fact.fields.length);
  if (captureError !== undefined) {
    memoryDiagnostic(call, "LAYOUT_CAPTURE_LIMIT", captureError);
    return;
  }
  publishMemoryFact(call, tsonicMemoryLayoutFactKey, fact);
  analysis.types.publish(call);
}

export function analyzeMemoryLayoutQuery(call: MemorySourceCall, analysis: MemorySourceAnalysis): void {
  const { selected, context } = call;
  const operand = selected.selection.sourceArguments[0];
  if (operand === undefined) {
    memoryDiagnostic(call, "QUERY_OPERAND_MISSING", "Layout query is missing its exact selected layout operand.");
    return;
  }
  const layout = analysis.layout(operand.expression, context);
  const base = {
    call: selected.call, layoutExpression: operand.expression,
    layoutType: operand.type, resultType: selected.selection.sourceResultType,
  };
  if (call.name === "fieldoffsetof") {
    const member = selectInlineSourceMember(selected.selection.sourceArguments[1]?.expression, context);
    const declaration = member.kind === "selected" ? member.selectedDeclaration : undefined;
    const selector = selected.selection.sourceArguments[1];
    if (declaration === undefined || selector === undefined || !isMemoryFieldSelector(selector.expression, context) ||
        !isMemoryFieldDeclaration(declaration, context) || layout === undefined || !analysis.types.queryField(call, declaration, layout)) {
      memoryDiagnostic(call, "QUERY_FIELD_NOT_PROVEN", "fieldoffsetof requires one exact non-optional physical field selection.");
      return;
    }
    publishMemoryFact(call, tsonicMemoryLayoutQueryFactKey, { ...base, operation: "field-offset", selectedFieldDeclaration: declaration });
    analysis.types.publish(call);
    return;
  }
  const operation = call.name === "sizeof" ? "size" : call.name === "alignof" ? "alignment" : "stride";
  publishMemoryFact(call, tsonicMemoryLayoutQueryFactKey, { ...base, operation });
}
