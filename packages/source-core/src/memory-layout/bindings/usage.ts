import type { ExtensionFactSubject, Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "@tsonic/target-api/source";
import { selectTsonicMemoryRecordBinding, selectTsonicMemoryRecordBindingFacts } from "./selection.js";

export interface TsonicMemoryBindingIndex {
  readonly issues: readonly { readonly node: Node; readonly reason: string }[];
  hasBoundField(subjects: readonly ExtensionFactSubject[]): boolean;
}

export function createTsonicMemoryBindingIndex(source: TargetSourceProgram): TsonicMemoryBindingIndex {
  return createMemoryBindingIndex(source, selectTsonicMemoryRecordBinding);
}

export function createTsonicMemoryBindingFactsIndex(source: TargetSourceProgram): TsonicMemoryBindingIndex {
  return createMemoryBindingIndex(source, selectTsonicMemoryRecordBindingFacts);
}

function createMemoryBindingIndex(source: TargetSourceProgram,
  select: typeof selectTsonicMemoryRecordBindingFacts): TsonicMemoryBindingIndex {
  const subjects = new WeakSet<ExtensionFactSubject>();
  const issues: { readonly node: Node; readonly reason: string }[] = [];
  for (const file of source.sourceFiles) {
    if (source.ast.isDeclarationFile(file)) continue;
    const pending: Node[] = [file];
    while (pending.length !== 0) {
      const node = pending.pop()!;
      if (source.ast.is.IsCallExpression(node)) {
        const selected = select(source.ast, source.sourceFacts, node);
        if (selected?.kind === "rejected") issues.push(Object.freeze({ node, reason: selected.reason }));
        else if (selected?.kind === "resolved") {
          for (const { binding } of selected.operation.fields) {
            subjects.add(binding.field.selectedDeclaration);
            if (binding.field.selectedSymbol !== undefined) subjects.add(binding.field.selectedSymbol);
          }
        }
      }
      source.ast.forEachChild(node, child => { if (child !== undefined) pending.push(child); });
    }
  }
  return Object.freeze({
    issues: Object.freeze(issues),
    hasBoundField(candidates: readonly ExtensionFactSubject[]) {
      return candidates.some(subject => subjects.has(subject));
    },
  });
}
