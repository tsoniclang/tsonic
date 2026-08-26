import type {
  ExtensionFactKey,
  SourceAnalysisContext,
} from "@tsonic/tsts";
import {
  sourceNativePointerSignatureIds,
  type SourceNativePointerProviderNames,
} from "./provider-declarations.js";
import type {
  TsonicNativePointerOperationFact,
} from "./facts.js";
import type {
  TsonicSourceFileAnalysisContext,
} from "../analysis/context.js";
import {
  type ProviderSourceCallSelector,
  type SelectedProviderSourceCall,
  forEachSelectedProviderSourceCall,
  selectedProviderCallMatches,
} from "../analysis/source-call.js";

export interface NativePointerOperationAnalysisContract {
  readonly providerId: string;
  readonly providerVersion: string;
  readonly providerModuleId: string;
  readonly names: SourceNativePointerProviderNames;
  readonly factKey: ExtensionFactKey<TsonicNativePointerOperationFact>;
  readonly extensionId: string;
  readonly diagnosticPrefix: string;
  readonly diagnosticNumberBase: number;
}

export function analyzeNativePointerOperations(
  context: SourceAnalysisContext,
  contract: NativePointerOperationAnalysisContract,
): void {
  const selectors = Object.freeze([
    selector(contract, contract.names.loadExport, sourceNativePointerSignatureIds.load, "load"),
    selector(contract, contract.names.storeExport, sourceNativePointerSignatureIds.store, "store"),
    selector(contract, contract.names.offsetExport, sourceNativePointerSignatureIds.offset, "offset"),
    selector(
      contract,
      contract.names.offsetBytesExport,
      sourceNativePointerSignatureIds.offsetBytes,
      "offset-bytes",
    ),
  ] as const);
  forEachSelectedProviderSourceCall(context, (selected, sourceContext): void => {
    const matched = selectors.find((candidate) =>
      selectedProviderCallMatches(selected, candidate.selector, sourceContext));
    if (matched !== undefined) {
      analyzeSelectedOperation(selected, sourceContext, contract, matched.operation);
    }
  });
}

function selector(
  contract: NativePointerOperationAnalysisContract,
  exportId: string,
  signatureId: string,
  operation: TsonicNativePointerOperationFact["operation"],
): {
  readonly selector: ProviderSourceCallSelector;
  readonly operation: TsonicNativePointerOperationFact["operation"];
} {
  return Object.freeze({
    selector: Object.freeze({
      kind: "export-signature" as const,
      providerId: contract.providerId,
      providerVersion: contract.providerVersion,
      providerModuleId: contract.providerModuleId,
      exportId,
      signatureId,
    }),
    operation,
  });
}

function analyzeSelectedOperation(
  selected: SelectedProviderSourceCall,
  context: TsonicSourceFileAnalysisContext,
  contract: NativePointerOperationAnalysisContract,
  operation: TsonicNativePointerOperationFact["operation"],
): void {
  const pointer = selected.selection.sourceArguments[0];
  const pointee = selected.selection.sourceSelectedMethodTypeArguments?.[0];
  if (pointer === undefined || pointee === undefined) {
    appendDiagnostic(
      selected,
      context,
      contract,
      "SELECTED_EVIDENCE_MISSING",
      0,
      "The selected native-pointer operation is missing its exact pointer or pointee evidence.",
    );
    return;
  }
  const base = {
    pointerExpression: pointer.expression,
    pointerType: pointer.type,
    pointeeType: pointee.selectedType,
    ...(pointee.explicitTypeNode === undefined
      ? {}
      : { explicitPointeeTypeNode: pointee.explicitTypeNode }),
    resultType: selected.selection.sourceResultType,
  };
  const fact = (() => {
    switch (operation) {
      case "load":
        return { ...base, operation };
      case "store": {
        const value = selected.selection.sourceArguments[1];
        return value === undefined
          ? undefined
          : {
              ...base,
              operation,
              valueExpression: value.expression,
              valueType: value.type,
            };
      }
      case "offset":
      case "offset-bytes": {
        const offset = selected.selection.sourceArguments[1];
        return offset === undefined
          ? undefined
          : {
              ...base,
              operation,
              offsetExpression: offset.expression,
              offsetType: offset.type,
            };
      }
    }
  })();
  if (fact === undefined) {
    appendDiagnostic(
      selected,
      context,
      contract,
      "OPERAND_EVIDENCE_MISSING",
      1,
      `The selected native-pointer '${operation}' operation is missing one exact operand.`,
    );
    return;
  }
  const result = context.facts.set(
    selected.call,
    contract.factKey,
    fact,
    [{
      message: "Native-pointer operation fact derived from one exact selected provider call.",
    }],
  );
  if (result !== "inserted" && result !== "idempotent") {
    appendDiagnostic(
      selected,
      context,
      contract,
      "FACT_WRITE_FAILED",
      2,
      `The selected native-pointer operation fact could not be recorded (${result}).`,
    );
  }
}

function appendDiagnostic(
  selected: SelectedProviderSourceCall,
  context: TsonicSourceFileAnalysisContext,
  contract: NativePointerOperationAnalysisContract,
  suffix: string,
  numberOffset: number,
  message: string,
): void {
  const extensionCode = `${contract.diagnosticPrefix}_${suffix}`;
  context.diagnostics.append({
    extensionId: contract.extensionId,
    extensionCode,
    numericCode: contract.diagnosticNumberBase + numberOffset,
    category: "error",
    message,
    nodeOrSpan: selected.call,
    identity: `native-pointer:${extensionCode}:${context.ast.getPath(context.ast.getSourceFile(selected.call))}:${context.ast.pos(selected.call)}:${context.ast.end(selected.call)}`,
  });
}
