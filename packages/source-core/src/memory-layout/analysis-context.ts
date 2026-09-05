import type { ExtensionFactKey, Node } from "@tsonic/tsts";
import type { TsonicSourceFileAnalysisContext } from "../analysis/context.js";
import type { SelectedProviderSourceCall } from "../analysis/source-call.js";
import { tsonicCoreSourceExtensionId } from "../identity.js";
import type { tsonicMemorySignatureIds } from "./declarations.js";
import type { TsonicDataLayoutFact, TsonicMemoryFieldLayoutFact, TsonicMemoryLayoutFact } from "./facts.js";
import type { TsonicRawMemoryOperationFact } from "../pointers/raw-memory/facts.js";

export interface MemorySourceCall {
  readonly selected: SelectedProviderSourceCall;
  readonly context: TsonicSourceFileAnalysisContext;
  readonly name: keyof typeof tsonicMemorySignatureIds;
}

export interface MemorySourceAnalysis {
  readonly registrations: ReadonlyMap<string, TsonicDataLayoutFact>;
  readonly field: (expression: Node, context: TsonicSourceFileAnalysisContext) => TsonicMemoryFieldLayoutFact | undefined;
  readonly layout: (expression: Node, context: TsonicSourceFileAnalysisContext) => TsonicMemoryLayoutFact | undefined;
  readonly rawOperation: (expression: Node, context: TsonicSourceFileAnalysisContext) => TsonicRawMemoryOperationFact | undefined;
}

export function memoryDiagnostic(call: MemorySourceCall, code: string, message: string): void {
  const { selected, context } = call;
  context.diagnostics.append({
    extensionId: tsonicCoreSourceExtensionId,
    extensionCode: `SOURCE_CORE_MEMORY_${code}`,
    numericCode: 9901180,
    category: "error", message, nodeOrSpan: selected.call,
    identity: `memory:${code}:${context.ast.getPath(context.ast.getSourceFile(selected.call))}:${context.ast.pos(selected.call)}:${context.ast.end(selected.call)}`,
  });
}

export function publishMemoryFact<T>(call: MemorySourceCall, key: ExtensionFactKey<T>, value: T): void {
  const result = call.context.facts.set(call.selected.call, key, value);
  if (result !== "inserted" && result !== "idempotent") {
    memoryDiagnostic(call, "FACT_REJECTED", `The exact ${call.name} fact could not be published (${result}).`);
  }
}
