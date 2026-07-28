import {
  defaultValueFactKey,
  fieldFactKey,
} from "@tsonic/tsts";
import type {
  ExtensionFactKey,
  SourceAnalysisContext,
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
import {
  type ProviderSourceCallSelector,
  type SelectedProviderSourceCall,
  forEachSelectedProviderSourceCall,
  readSourceFact,
  selectedProviderCallMatches,
} from "./source-call-analysis.js";

const sourceMarkerRules = Object.freeze([
  sourceMarkerRule(
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
  sourceMarkerRule(
    "defaultof",
    tsonicSourceMarkerSignatureIds.defaultof,
    defaultValueFactKey,
    "SOURCE_SEMANTICS_MISSING_DEFAULT_TYPE_EVIDENCE",
    9901106,
    "defaultof<T>() requires explicit type evidence.",
  ),
] satisfies readonly SourceMarkerRule[]);

export function analyzeTsonicSourceMarkerEvidence(context: SourceAnalysisContext): void {
  forEachSelectedProviderSourceCall(context, (selected): void => {
    for (const rule of sourceMarkerRules) {
      if (selectedProviderCallMatches(selected, rule.selector, context)) {
        rule.validate(selected, context);
        return;
      }
    }
  });
}

interface SourceMarkerRule {
  readonly selector: ProviderSourceCallSelector;
  readonly validate: (
    selected: SelectedProviderSourceCall,
    context: SourceAnalysisContext,
  ) => void;
}

function sourceMarkerRule<TFact>(
  exportId: string,
  signatureId: string,
  factKey: ExtensionFactKey<TFact>,
  missingTypeCode: string,
  missingTypeNumericCode: number,
  missingTypeMessage: string,
  missingContextCode?: string,
  missingContextNumericCode?: number,
  missingContextMessage?: string,
): SourceMarkerRule {
  const selector = Object.freeze({
    kind: "export-signature" as const,
    providerId: tsonicCoreVirtualModulesProviderId,
    providerVersion: tsonicCoreProviderVersion,
    providerModuleId: tsonicCoreLangModule,
    exportId,
    signatureId,
  });
  return {
    selector,
    validate(selected, context): void {
      validateSourceMarker(selected, context, {
        factKey,
        missingTypeCode,
        missingTypeNumericCode,
        missingTypeMessage,
        ...(missingContextCode === undefined ? {} : { missingContextCode }),
        ...(missingContextNumericCode === undefined ? {} : { missingContextNumericCode }),
        ...(missingContextMessage === undefined ? {} : { missingContextMessage }),
      });
    },
  };
}

interface SourceMarkerValidation<TFact> {
  readonly factKey: ExtensionFactKey<TFact>;
  readonly missingTypeCode: string;
  readonly missingTypeNumericCode: number;
  readonly missingTypeMessage: string;
  readonly missingContextCode?: string;
  readonly missingContextNumericCode?: number;
  readonly missingContextMessage?: string;
}

function validateSourceMarker<TFact>(
  selected: SelectedProviderSourceCall,
  context: SourceAnalysisContext,
  rule: SourceMarkerValidation<TFact>,
): void {
  if (readSourceFact(context, selected.call, rule.factKey) !== undefined) {
    return;
  }
  const hasExplicitTypeEvidence =
    selected.selection.sourceSelectedMethodTypeArguments?.some(
      (argument) => argument.explicitTypeNode !== undefined,
    ) === true;
  const extensionCode = hasExplicitTypeEvidence && rule.missingContextCode !== undefined
    ? rule.missingContextCode
    : rule.missingTypeCode;
  const numericCode = hasExplicitTypeEvidence && rule.missingContextNumericCode !== undefined
    ? rule.missingContextNumericCode
    : rule.missingTypeNumericCode;
  const message = hasExplicitTypeEvidence && rule.missingContextMessage !== undefined
    ? rule.missingContextMessage
    : rule.missingTypeMessage;
  context.diagnostics.append({
    extensionId: tsonicCoreSourceExtensionId,
    extensionCode,
    numericCode,
    publicCode: `TSONIC_SOURCE_CORE_${numericCode}`,
    category: "error",
    message,
    nodeOrSpan: selected.call,
    identity: `source-core-marker:${extensionCode}:${context.ast.getPath(context.ast.getSourceFile(selected.call))}:${context.ast.pos(selected.call)}:${context.ast.end(selected.call)}`,
  });
}
