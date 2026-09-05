import { selectInlineSourceMember } from "../analysis/selected-source-member.js";
import { memoryDiagnostic, publishMemoryFact } from "./analysis-context.js";
import type { MemorySourceAnalysis, MemorySourceCall } from "./analysis-context.js";
import { tsonicMemoryFieldLayoutFactKey, tsonicMemoryLayoutFactKey, tsonicMemoryLayoutQueryFactKey } from "./facts.js";
import { exactLayoutSize, selectedDataLayout } from "./source-values.js";
import { memoryFieldDimensionsError, memoryLayoutDimensionsError } from "./dimensions.js";
import { isMemoryFieldSelector } from "./selectors.js";

export function analyzeMemoryField(call: MemorySourceCall): void {
  const { selected, context } = call;
  const args = selected.selection.sourceArguments;
  const types = selected.selection.sourceSelectedMethodTypeArguments;
  const sourceType = types?.[0]?.selectedType;
  const fieldType = types?.[1]?.selectedType;
  const member = selectInlineSourceMember(selected, context);
  const byteOffset = args[1] === undefined ? undefined : exactLayoutSize(args[1].expression, context);
  const byteAlignment = args[2] === undefined ? undefined : exactLayoutSize(args[2].expression, context);
  const declaration = member.kind === "selected" ? member.selectedDeclaration : undefined;
  if (args.length !== 3 || sourceType === undefined || fieldType === undefined || args[0] === undefined ||
      member.kind !== "selected" || declaration === undefined || !isMemoryFieldSelector(args[0].expression, context) ||
      (!context.ast.is.IsPropertyDeclaration(declaration) && !context.ast.is.IsPropertySignatureDeclaration(declaration)) ||
      context.ast.questionToken(declaration) !== undefined || byteOffset === undefined || byteAlignment === undefined) {
    memoryDiagnostic(call, "FIELD_NOT_PROVEN", "memoryField requires one selected non-optional physical field and exact non-negative integer layout constants.");
    return;
  }
  const property = context.checker.getResolvedPropertyAccessInfo(member.expression as typeof declaration);
  const error = memoryFieldDimensionsError({ byteOffset, byteAlignment });
  if (error !== undefined) {
    memoryDiagnostic(call, "FIELD_DIMENSIONS_INVALID", error);
    return;
  }
  publishMemoryFact(call, tsonicMemoryFieldLayoutFactKey, {
    call: selected.call, sourceType, selector: args[0].expression, selectedDeclaration: declaration,
    ...(property?.selectedSymbol === undefined ? {} : { selectedSymbol: property.selectedSymbol }),
    fieldType, byteOffset, byteAlignment,
  });
}

export function analyzeMemoryLayout(call: MemorySourceCall, analysis: MemorySourceAnalysis): void {
  const { selected, context } = call;
  const args = selected.selection.sourceArguments;
  const pointee = selected.selection.sourceSelectedMethodTypeArguments?.[0];
  const dataLayout = args[0] === undefined ? undefined : selectedDataLayout(args[0], context, analysis.registrations);
  const byteSize = args[1] === undefined ? undefined : exactLayoutSize(args[1].expression, context);
  const byteAlignment = args[2] === undefined ? undefined : exactLayoutSize(args[2].expression, context);
  const stride = args[3] === undefined ? undefined : exactLayoutSize(args[3].expression, context);
  if (pointee === undefined || dataLayout === undefined || args[0] === undefined ||
      byteSize === undefined || byteAlignment === undefined || stride === undefined) {
    memoryDiagnostic(call, "LAYOUT_NOT_PROVEN", "memoryLayout requires an exact selected type, registered ABI token, and non-negative safe integer size, alignment and stride.");
    return;
  }
  const fields = args.slice(4).map((value) => analysis.field(value.expression, context));
  if (fields.some((field) => field === undefined || !context.typeShape.isTypeIdenticalTo(field.sourceType, pointee.selectedType))) {
    memoryDiagnostic(call, "LAYOUT_FIELD_NOT_PROVEN", "Every layout field must retain an exact field fact for the same selected source type.");
    return;
  }
  const fact = {
    call: selected.call, sourceType: pointee.selectedType,
    ...(pointee.explicitTypeNode === undefined ? {} : { explicitTypeNode: pointee.explicitTypeNode }),
    dataLayoutExpression: args[0].expression, dataLayout, byteSize, byteAlignment, stride,
    fields: fields.filter((field) => field !== undefined),
  };
  const error = memoryLayoutDimensionsError(fact);
  if (error !== undefined) {
    memoryDiagnostic(call, "LAYOUT_DIMENSIONS_INVALID", error);
    return;
  }
  publishMemoryFact(call, tsonicMemoryLayoutFactKey, fact);
}

export function analyzeMemoryLayoutQuery(call: MemorySourceCall, analysis: MemorySourceAnalysis): void {
  const { selected, context } = call;
  const operand = selected.selection.sourceArguments[0];
  if (operand === undefined) {
    memoryDiagnostic(call, "QUERY_OPERAND_MISSING", "Layout query is missing its exact selected layout operand.");
    return;
  }
  analysis.layout(operand.expression, context);
  const base = {
    call: selected.call, layoutExpression: operand.expression,
    layoutType: operand.type, resultType: selected.selection.sourceResultType,
  };
  if (call.name === "fieldOffsetOf") {
    const member = selectInlineSourceMember(selected, context, "property", 1);
    const declaration = member.kind === "selected" ? member.selectedDeclaration : undefined;
    const selector = selected.selection.sourceArguments[1];
    if (declaration === undefined || selector === undefined || !isMemoryFieldSelector(selector.expression, context) ||
        (!context.ast.is.IsPropertyDeclaration(declaration) && !context.ast.is.IsPropertySignatureDeclaration(declaration)) ||
        context.ast.questionToken(declaration) !== undefined) {
      memoryDiagnostic(call, "QUERY_FIELD_NOT_PROVEN", "fieldOffsetOf requires one exact non-optional physical field selection.");
      return;
    }
    publishMemoryFact(call, tsonicMemoryLayoutQueryFactKey, { ...base, operation: "field-offset", selectedFieldDeclaration: declaration });
    return;
  }
  const operation = call.name === "sizeOf" ? "size" : call.name === "alignOf" ? "alignment" : "stride";
  publishMemoryFact(call, tsonicMemoryLayoutQueryFactKey, { ...base, operation });
}
