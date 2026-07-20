import {
  completeCheckedSourceCallProduction,
  defaultValueFactKey,
  deferCheckedSourceCallProduction,
  fieldFactKey,
  rejectCheckedSourceCallProduction,
} from "@tsonic/tsts";
import type {
  CheckedSourceCallOperation,
  CheckedSourceCallProducer,
  CheckedSourceCallProducerContext,
  CheckedSourceCallProduction,
  ExtensionDiagnostic,
  ExtensionFactKey,
  ExtensionInitializeContext,
} from "@tsonic/tsts";
import {
  tsonicCoreLangModule,
  tsonicCoreProviderVersion,
  tsonicCoreSourceExtensionId,
  tsonicCoreVirtualModulesProviderId,
} from "./identity.js";
import {
  tsonicSourceMarkerSignatureIds,
} from "./provider-declarations.js";

const sourceMarkerEvidenceProducers = Object.freeze([
  markerProducer(
    "field",
    tsonicSourceMarkerSignatureIds.field,
    fieldFactKey,
    "SOURCE_SEMANTICS_MISSING_FIELD_TYPE_EVIDENCE",
    9901102,
    "field<T>() requires explicit field type evidence.",
    "SOURCE_SEMANTICS_FIELD_CONTEXT_NOT_PROVEN",
    9901108,
    "field<T>() requires a proven static field-containing context.",
  ),
  markerProducer(
    "defaultof",
    tsonicSourceMarkerSignatureIds.defaultof,
    defaultValueFactKey,
    "SOURCE_SEMANTICS_MISSING_DEFAULT_TYPE_EVIDENCE",
    9901106,
    "defaultof<T>() requires explicit type evidence.",
  ),
] satisfies readonly CheckedSourceCallProducer[]);

export function registerTsonicSourceMarkerEvidenceProducers(context: ExtensionInitializeContext): void {
  for (const producer of sourceMarkerEvidenceProducers) {
    context.registerCheckedSourceCallProducer(producer);
  }
}

function markerProducer<TFact>(
  exportId: string,
  signatureId: string,
  factKey: ExtensionFactKey<TFact>,
  missingTypeCode: string,
  missingTypeNumericCode: number,
  missingTypeMessage: string,
  missingContextCode?: string,
  missingContextNumericCode?: number,
  missingContextMessage?: string,
): CheckedSourceCallProducer {
  return Object.freeze({
    selector: Object.freeze({
      kind: "export-signature" as const,
      providerId: tsonicCoreVirtualModulesProviderId,
      providerVersion: tsonicCoreProviderVersion,
      providerModuleId: tsonicCoreLangModule,
      exportId,
      signatureId,
    }),
    produce(
      operation: CheckedSourceCallOperation,
      context: CheckedSourceCallProducerContext,
    ): CheckedSourceCallProduction {
      const fact = context.facts.get(operation.call, factKey) ??
        context.factResolver.resolve(operation.call, factKey);
      if (fact !== undefined) {
        return completeCheckedSourceCallProduction;
      }
      if (context.phase === "checking") {
        return deferCheckedSourceCallProduction;
      }
      const hasExplicitTypeEvidence = operation.sourceSelection.kind === "applicable" &&
        operation.sourceSelection.methodTypeArguments.some((argument) => argument.explicitTypeNode !== undefined);
      const extensionCode = hasExplicitTypeEvidence && missingContextCode !== undefined
        ? missingContextCode
        : missingTypeCode;
      const numericCode = hasExplicitTypeEvidence && missingContextNumericCode !== undefined
        ? missingContextNumericCode
        : missingTypeNumericCode;
      const message = hasExplicitTypeEvidence && missingContextMessage !== undefined
        ? missingContextMessage
        : missingTypeMessage;
      return rejectCheckedSourceCallProduction(sourceMarkerDiagnostic(operation, extensionCode, numericCode, message));
    },
  });
}

function sourceMarkerDiagnostic(
  operation: CheckedSourceCallOperation,
  extensionCode: string,
  numericCode: number,
  message: string,
): ExtensionDiagnostic {
  return {
    extensionId: tsonicCoreSourceExtensionId,
    extensionCode,
    numericCode,
    publicCode: `TSONIC_SOURCE_CORE_${numericCode}`,
    category: "error",
    message,
    nodeOrSpan: operation.call,
  };
}
