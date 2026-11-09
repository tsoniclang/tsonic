import type { ExtensionFactKey, Node, SourceAnalysisContext } from "@tsonic/tsts";
import type { TsonicSourceFileAnalysisContext } from "./source-context.js";
import { forEachSelectedProviderSourceCall, selectedProviderCallMatches } from "./provider-calls.js";
import { tsonicCoreLangModule, tsonicCoreProviderVersion, tsonicCoreVirtualModulesProviderId } from "../identity.js";
import { analyzeRawMemoryCall } from "./raw-memory-analysis.js";
import { tsonicRawMemoryOperationFactKey } from "./raw-memory-facts.js";
import { memoryDiagnostic } from "./memory-analysis-context.js";
import type { MemorySourceAnalysis } from "./memory-analysis-context.js";
import type { MemorySourceCall } from "./memory-analysis-model.js";
import { analyzeMemoryField, analyzeMemoryLayout, analyzeMemoryLayoutQuery } from "./memory-builders.js";
import { analyzeMemoryArrayLayout } from "./memory-array-builder.js";
import { tsonicMemorySignatureIds } from "../memory-layout/declarations.js";
import { maximumMemoryLayoutDepth, tsonicMemoryFieldLayoutFactKey, tsonicMemoryLayoutFactKey } from "./memory-layout-facts.js";
import type { TsonicDataLayoutFact } from "./memory-layout-facts.js";
import { immutableValueOrigin } from "./memory-source-values.js";
import { analyzeMemoryFieldBinding, analyzeMemoryRecordBinding } from "./memory-binding-analysis.js";
import { tsonicMemoryFieldBindingFactKey } from "./memory-binding-facts.js";
import { analyzeTsonicPointerView } from "./pointer-view-analysis.js";
import { readMemoryLayoutConstant } from "./memory-readers.js";

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
    analyzeTsonicPointerView(selected, sourceContext);
    const rule = selectors.find((candidate) => selectedProviderCallMatches(selected, candidate.selector, sourceContext));
    if (rule !== undefined) calls.set(selected.call, { selected, context: sourceContext, name: rule.name });
  });
  const pending = new Set<Node>();
  const completed = new Set<Node>();
  const owner = calls.values().next().value;
  if (owner === undefined) return;
  const analysis: MemorySourceAnalysis = {
    registrations,
    field: (expression, sourceContext) => demand(expression, sourceContext, tsonicMemoryFieldLayoutFactKey),
    layout: (expression, sourceContext) => demand(expression, sourceContext, tsonicMemoryLayoutFactKey),
    layoutQuery: (expression, sourceContext) => {
      const origin = demandOrigin(expression, sourceContext);
      return origin === undefined ? undefined : readMemoryLayoutConstant(
        { getFact: (subject, key) => context.facts.get(subject, key) }, origin);
    },
    binding: (expression, sourceContext) => demand(expression, sourceContext, tsonicMemoryFieldBindingFactKey),
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
    if (pending.size >= maximumMemoryLayoutDepth * 2) {
      memoryDiagnostic(call, "COMPILER_RESOURCE_LIMIT", `Memory layout dependencies exceeded the compiler resource limit depth=${maximumMemoryLayoutDepth * 2}.`);
      return;
    }
    pending.add(node);
    try {
      switch (call.name) {
        case "memoryfield": analyzeMemoryField(call, analysis); break;
        case "memorylayout": analyzeMemoryLayout(call, analysis); break;
        case "memoryarraylayout": analyzeMemoryArrayLayout(call, analysis); break;
        case "bindmemoryfield": analyzeMemoryFieldBinding(call, analysis); break;
        case "bindmemoryrecord": analyzeMemoryRecordBinding(call, analysis); break;
        case "sizeof": case "alignof": case "strideof": case "fieldoffsetof":
          analyzeMemoryLayoutQuery(call, analysis); break;
        default: analyzeRawMemoryCall(call, analysis); break;
      }
    } finally {
      pending.delete(node);
    }
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
