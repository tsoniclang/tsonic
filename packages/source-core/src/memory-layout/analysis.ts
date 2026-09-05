import type { ExtensionFactKey, Node, SourceAnalysisContext } from "@tsonic/tsts";
import type { TsonicSourceFileAnalysisContext } from "../analysis/context.js";
import { forEachSelectedProviderSourceCall, selectedProviderCallMatches } from "../analysis/source-call.js";
import { tsonicCoreLangModule, tsonicCoreProviderVersion, tsonicCoreVirtualModulesProviderId } from "../identity.js";
import { analyzeRawMemoryCall } from "../pointers/raw-memory/analysis.js";
import { tsonicRawMemoryOperationFactKey } from "../pointers/raw-memory/facts.js";
import { memoryDiagnostic } from "./analysis-context.js";
import type { MemorySourceAnalysis, MemorySourceCall } from "./analysis-context.js";
import { analyzeMemoryField, analyzeMemoryLayout, analyzeMemoryLayoutQuery } from "./builders.js";
import { tsonicMemorySignatureIds } from "./declarations.js";
import { tsonicMemoryFieldLayoutFactKey, tsonicMemoryLayoutFactKey } from "./facts.js";
import type { TsonicDataLayoutFact } from "./facts.js";
import { immutableValueOrigin } from "./source-values.js";

const selectors = Object.entries(tsonicMemorySignatureIds).map(([name, signatureId]) => ({
  name: name as keyof typeof tsonicMemorySignatureIds,
  selector: {
    kind: "export-signature" as const, providerId: tsonicCoreVirtualModulesProviderId,
    providerVersion: tsonicCoreProviderVersion, providerModuleId: tsonicCoreLangModule,
    exportId: name, signatureId,
  },
}));

export function analyzeTsonicMemoryOperations(
  context: SourceAnalysisContext,
  registrations: ReadonlyMap<string, TsonicDataLayoutFact>,
): void {
  const calls = new Map<Node, MemorySourceCall>();
  forEachSelectedProviderSourceCall(context, (selected, sourceContext) => {
    if (declarationOnly(selected.call, sourceContext)) return;
    const rule = selectors.find((candidate) => selectedProviderCallMatches(selected, candidate.selector, sourceContext));
    if (rule !== undefined) calls.set(selected.call, { selected, context: sourceContext, name: rule.name });
  });
  const pending = new Set<Node>();
  const completed = new Set<Node>();
  const analysis: MemorySourceAnalysis = {
    registrations,
    field: (expression, sourceContext) => demand(expression, sourceContext, tsonicMemoryFieldLayoutFactKey),
    layout: (expression, sourceContext) => demand(expression, sourceContext, tsonicMemoryLayoutFactKey),
    rawOperation: (expression, sourceContext) => context.facts.get(demandOrigin(expression, sourceContext), tsonicRawMemoryOperationFactKey),
  };
  function demandOrigin(expression: Node, sourceContext: TsonicSourceFileAnalysisContext): Node | undefined {
    const origin = immutableValueOrigin(expression, sourceContext);
    if (origin === undefined) return undefined;
    const producer = calls.get(origin);
    if (producer !== undefined) analyze(producer);
    return origin;
  }
  function demand<T>(expression: Node, sourceContext: TsonicSourceFileAnalysisContext, key: ExtensionFactKey<T>): T | undefined {
    const origin = demandOrigin(expression, sourceContext);
    const fact = context.facts.get(origin, key);
    if (fact !== undefined && origin !== expression) context.facts.set(expression, key, fact);
    return fact;
  }
  function analyze(call: MemorySourceCall): void {
    const node = call.selected.call;
    if (completed.has(node)) return;
    if (pending.has(node)) {
      memoryDiagnostic(call, "LAYOUT_CYCLE", "Memory layout demands form a cycle without a finalized descriptor.");
      return;
    }
    pending.add(node);
    switch (call.name) {
      case "memoryField": analyzeMemoryField(call); break;
      case "memoryLayout": analyzeMemoryLayout(call, analysis); break;
      case "sizeOf": case "alignOf": case "strideOf": case "fieldOffsetOf":
        analyzeMemoryLayoutQuery(call, analysis); break;
      default: analyzeRawMemoryCall(call, analysis); break;
    }
    pending.delete(node);
    completed.add(node);
  }
  for (const call of calls.values()) analyze(call);
}

function declarationOnly(node: Node, context: TsonicSourceFileAnalysisContext): boolean {
  let current: Node | undefined = node;
  while (current !== undefined) {
    if (context.ast.hasModifierKind(current, "ambient") || context.ast.is.IsInterfaceDeclaration(current) ||
        context.ast.is.IsTypeAliasDeclaration(current) || context.ast.is.IsTypeLiteralNode(current)) return true;
    current = context.ast.parent(current);
  }
  return false;
}
