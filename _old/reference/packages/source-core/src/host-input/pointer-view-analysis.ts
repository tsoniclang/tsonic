import type { TsonicSourceFileAnalysisContext } from "./source-context.js";
import { selectedProviderCallMatches } from "./provider-calls.js";
import type { SelectedProviderSourceCall } from "./provider-calls.js";
import { tsonicCoreLangModule, tsonicCoreProviderVersion, tsonicCoreSourceExtensionId, tsonicCoreVirtualModulesProviderId } from "../identity.js";
import { tsonicPointerViewSignatureIds } from "../pointers/views/declarations.js";
import { tsonicPointerViewFactKey } from "./pointer-view-facts.js";

export function analyzeTsonicPointerView(selected: SelectedProviderSourceCall, context: TsonicSourceFileAnalysisContext): void {
  const overload = (["required", "optional"] as const).find(kind => selectedProviderCallMatches(selected, {
    kind: "export-signature", providerId: tsonicCoreVirtualModulesProviderId, providerVersion: tsonicCoreProviderVersion,
    providerModuleId: tsonicCoreLangModule, exportId: "viewptr", signatureId: tsonicPointerViewSignatureIds[kind],
  }, context));
  if (overload === undefined) return;
  const arguments_ = selected.selection.selection.argumentValues;
  const types = selected.selection.selection.application.signatureTypeArguments;
  const [pointer, read, write] = arguments_;
  const sourceType = types?.[0]?.checkedArgument;
  const target = types?.[1];
  if (arguments_.length !== 3 || pointer === undefined || read === undefined || write === undefined ||
      sourceType === undefined || target?.checkedArgument === undefined ||
      [pointer.type, read.type, write.type, sourceType, target.checkedArgument].some(type => context.typeShape.isAny(type)) ||
      selected.selection.selection.arguments.values.some(binding => binding.sourceForm !== "value")) {
    context.diagnostics.append({ extensionId: tsonicCoreSourceExtensionId, extensionCode: "SOURCE_CORE_POINTER_VIEW_NOT_PROVEN",
      numericCode: 9901181, category: "error", nodeOrSpan: selected.call,
      message: "viewptr requires its exact typed base pointer, read callback and write callback; erased or spread operands are not location evidence." });
    return;
  }
  const result = context.facts.set(selected.call, tsonicPointerViewFactKey, {
    call: selected.call, resultType: selected.selection.resultType, sourcePointeeType: sourceType,
    pointeeType: target.checkedArgument,
    ...(target.explicitTypeNode === undefined ? {} : { explicitPointeeTypeNode: target.explicitTypeNode }),
    pointerExpression: pointer.expression, pointerType: pointer.type,
    readExpression: read.expression, readType: read.type, writeExpression: write.expression, writeType: write.type,
    optional: overload === "optional",
  });
  if (result !== "inserted" && result !== "idempotent") {
    context.diagnostics.append({ extensionId: tsonicCoreSourceExtensionId, extensionCode: "SOURCE_CORE_POINTER_VIEW_FACT_REJECTED",
      numericCode: 9901182, category: "error", nodeOrSpan: selected.call,
      message: `The exact pointer view fact could not be published (${result}).` });
  }
}
