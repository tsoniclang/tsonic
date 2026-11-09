import type { ExtensionFactKey, Node } from "@tsonic/tsts";
import type { TsonicSourceFileAnalysisContext } from "./source-context.js";
import { tsonicCoreSourceExtensionId } from "../identity.js";
import type { TsonicDataLayoutFact, TsonicMemoryFieldLayoutFact, TsonicMemoryLayoutFact } from "./memory-layout-facts.js";
import type { TsonicRawMemoryOperationFact } from "./raw-memory-facts.js";
import type { MemorySourceCall } from "./memory-analysis-model.js";
import type { TsonicMemoryFieldBindingFact } from "./memory-binding-facts.js";
import type { readMemoryLayoutConstant } from "./memory-readers.js";

export interface MemorySourceAnalysis {
  readonly registrations: ReadonlyMap<string, TsonicDataLayoutFact>;
  readonly field: (expression: Node, context: TsonicSourceFileAnalysisContext) => TsonicMemoryFieldLayoutFact | undefined;
  readonly layout: (expression: Node, context: TsonicSourceFileAnalysisContext) => TsonicMemoryLayoutFact | undefined;
  readonly layoutQuery: (expression: Node, context: TsonicSourceFileAnalysisContext) => ReturnType<typeof readMemoryLayoutConstant>;
  readonly binding: (expression: Node, context: TsonicSourceFileAnalysisContext) => TsonicMemoryFieldBindingFact | undefined;
  readonly rawOperation: (expression: Node, context: TsonicSourceFileAnalysisContext) => TsonicRawMemoryOperationFact | undefined;
}

export function memoryDiagnostic(call: MemorySourceCall, code: string, message: string): void {
  const { selected, context } = call;
  context.diagnostics.append({
    extensionId: tsonicCoreSourceExtensionId,
    extensionCode: `SOURCE_CORE_MEMORY_${code}`,
    ...(code === "COMPILER_RESOURCE_LIMIT" ? { publicCode: "TSONIC_COMPILER_RESOURCE_LIMIT" } : {}),
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
