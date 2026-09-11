import type { MemorySourceAnalysis, MemorySourceCall } from "../analysis-context.js";
import { memoryDiagnostic, publishMemoryFact } from "../analysis-context.js";
import { tsonicMemoryFieldLayoutFactKey } from "../facts.js";
import { tsonicMemoryFieldBindingFactKey, tsonicMemoryRecordBindingFactKey } from "./facts.js";

export function analyzeMemoryFieldBinding(call: MemorySourceCall, analysis: MemorySourceAnalysis): void {
  const { selected, context } = call;
  const args = selected.selection.sourceArguments;
  const [fieldOperand, pointer] = args;
  const types = selected.selection.sourceSelectedMethodTypeArguments;
  const sourceType = types?.[0]?.selectedType;
  const pointeeType = types?.[1]?.selectedType;
  const field = fieldOperand === undefined ? undefined : analysis.field(fieldOperand.expression, context);
  if (args.length !== 2 || fieldOperand === undefined || pointer === undefined || field === undefined ||
      sourceType === undefined || pointeeType === undefined ||
      selected.selection.sourceArgumentBindings.some(binding => binding.sourceForm !== "value") ||
      !analysis.types.binding(call, field)) {
    memoryDiagnostic(call, "FIELD_BINDING_NOT_PROVEN", "bindMemoryField requires one finalized field and a non-nil pointer with that field's exact source memory domain.");
    return;
  }
  publishMemoryFact(call, tsonicMemoryFieldBindingFactKey, {
    call: selected.call, resultType: selected.selection.sourceResultType, sourceType, pointeeType,
    fieldExpression: fieldOperand.expression, field, pointerExpression: pointer.expression, pointerType: pointer.type,
  });
  analysis.types.publish(call);
}

export function analyzeMemoryRecordBinding(call: MemorySourceCall, analysis: MemorySourceAnalysis): void {
  const { selected, context } = call;
  const [operand, ...arguments_] = selected.selection.sourceArguments;
  const sourceType = selected.selection.sourceSelectedMethodTypeArguments?.[0]?.selectedType;
  const layout = operand === undefined ? undefined : analysis.layout(operand.expression, context);
  if (operand === undefined || sourceType === undefined || layout?.kind !== "value" ||
      arguments_.length !== layout.fields.length ||
      selected.selection.sourceArgumentBindings.some(binding => binding.sourceForm !== "value") ||
      !analysis.types.record(call, layout)) {
    memoryDiagnostic(call, "RECORD_BINDING_NOT_PROVEN", "bindMemoryRecord requires a closed data record layout and one explicit binding for every field.");
    return;
  }
  const fields = arguments_.map(operand => ({ expression: operand.expression, binding: analysis.binding(operand.expression, context) }));
  const unmatched = new Map(layout.fields.map(field => [field.call, field]));
  for (const field of fields) {
    const declared = field.binding === undefined ? undefined : unmatched.get(field.binding.field.call);
    if (declared === undefined || field.binding === undefined || !tsonicMemoryFieldLayoutFactKey.equals(declared, field.binding.field)) {
      memoryDiagnostic(call, "RECORD_FIELD_BINDINGS_NOT_PROVEN", "Record field bindings must select each exact layout field once, without missing, duplicate or unrelated locations.");
      return;
    }
    unmatched.delete(declared.call);
  }
  publishMemoryFact(call, tsonicMemoryRecordBindingFactKey, {
    call: selected.call, resultType: selected.selection.sourceResultType, sourceType, layoutExpression: operand.expression, layout,
    fields: fields.map(field => ({ expression: field.expression, binding: field.binding! })),
  });
  analysis.types.publish(call);
}
