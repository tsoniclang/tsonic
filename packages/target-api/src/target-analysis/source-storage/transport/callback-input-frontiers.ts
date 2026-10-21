import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../../source-semantics/index.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageSubject } from "../model/subjects.js";
import { sourceStorageFormalOwner } from "../model/subjects.js";
import type { SourceStorageCallbackEntry, SourceStorageDomainBoundary } from "../model/types.js";
import type { SourceStorageInvocationInputQuery } from "../graph/invocation-inputs.js";
import { sourceStorageNativeInputSlots } from "../graph/invocation-inputs.js";
import type { createSourceStorageGraphQueries } from "../graph/graph-queries.js";

export function createSourceStorageCallbackInputFrontiers(
  source: TargetSourceProgram,
  budget: SourceStorageBudget,
  graphQueries: ReturnType<typeof createSourceStorageGraphQueries>,
  host: {
    readonly invocations: ReadonlySet<Node>;
    readonly callbackEntriesFor: (invocation: Node) => readonly SourceStorageCallbackEntry[];
    readonly callbackImplementationsFor: (entry: SourceStorageCallbackEntry) => ReadonlySet<Node>;
    readonly invocationTargets: ReadonlyMap<Node, SourceStorageSubject>;
    readonly subjectFor: (node: Node | undefined) => SourceStorageSubject | undefined;
    readonly originSubjects: (subject: SourceStorageSubject) => ReadonlySet<SourceStorageSubject> | undefined;
    readonly invocationInputs: SourceStorageInvocationInputQuery;
    readonly nativePayloadCandidates: (invocation: Node) => ReadonlySet<{
      readonly values: readonly SourceStorageSubject[]; readonly complete: boolean;
    }> | undefined;
  },
) {
  const { ast, semantics } = source;
  const step = budget.step;
  const { invocations, callbackEntriesFor, callbackImplementationsFor, invocationTargets,
    subjectFor, originSubjects, invocationInputs, nativePayloadCandidates } = host;
  let nativeInputs: ReadonlyMap<Node, readonly { readonly invocation: Node; readonly candidate: Node;
    readonly callback: SourceStorageCallbackEntry }[]> | undefined;
  const nativeInputIndex = () => {
    if (nativeInputs === undefined) {
      const rows = budget.createRows();
      const selected = new Map<Node, { readonly invocation: Node; readonly candidate: Node; readonly callback: SourceStorageCallbackEntry }[]>();
      let complete = false;
      try {
        for (const invocation of invocations) for (const callback of callbackEntriesFor(invocation))
          for (const candidate of callbackImplementationsFor(callback)) {
            if (!step()) return undefined;
            for (const parameter of ast.parameters(candidate)) {
              if (!step()) return undefined;
              const file = parameter === undefined ? undefined : ast.getSourceFile(parameter);
              if (parameter === undefined || file === undefined || !semantics.includes(file) ||
                !ast.is.IsParameterDeclaration(parameter) || ast.parent(parameter) !== candidate) {
                budget.reject("Source storage native callback inputs require exact checked parameter declaration ownership.");
                return undefined;
              }
              const retained = selected.get(parameter);
              if (retained?.some(entry => entry.invocation === invocation && entry.callback === callback && entry.candidate === candidate)) continue;
              if (!rows.add(retained === undefined ? 2 : 1)) return undefined;
              const entries = retained ?? [];
              entries.push(Object.freeze({ invocation, candidate, callback }));
              selected.set(parameter, entries);
            }
          }
        for (const entries of selected.values()) Object.freeze(entries);
        nativeInputs = selected; complete = true;
      } finally { if (!complete) rows.release(); }
    }
    return nativeInputs;
  };
  const callbackInputFrontiersFor = graphQueries.query((invocation: Node): ReadonlySet<Omit<SourceStorageDomainBoundary, "bindings"> & {
    readonly callback?: SourceStorageCallbackEntry;
  }> | undefined => {
    const selected = new Set<Omit<SourceStorageDomainBoundary, "bindings"> & { readonly callback?: SourceStorageCallbackEntry }>();
    const nativeArguments = nativeInputIndex();
    if (nativeArguments === undefined) return undefined;
    if (nativeArguments.size === 0) return selected;
    const operands: { readonly subject: SourceStorageSubject; readonly callback?: SourceStorageCallbackEntry }[] = [];
    const target = invocationTargets.get(invocation);
    if (target !== undefined) operands.push({ subject: target });
    const checked = semantics.forNode(invocation).operations.call(invocation);
    const receiver = subjectFor(checked?.sourceReceiver?.expression ?? checked?.sourceCalleeAccess?.receiver.expression);
    if (receiver !== undefined && receiver !== target) operands.push({ subject: receiver });
    for (const callback of callbackEntriesFor(invocation)) operands.push({ subject: callback.argument.actual, callback });
    for (const operand of operands) {
      const origins = originSubjects(operand.subject);
      if (origins === undefined) return undefined;
      for (const origin of origins) {
        if (!step()) return undefined;
        const owner = sourceStorageFormalOwner(origin, ast);
        if (owner === undefined || origin.kind !== "input") continue;
        const entries = nativeArguments.get(origin.node) ?? [];
        for (const entry of entries) {
          if (!step()) return undefined;
          if (entry.candidate !== owner) continue;
          const bounds = sourceStorageNativeInputSlots(source, owner, origin, entry.callback.argument.binding.selectedParameterType,
            semantics.forNode(entry.invocation), step);
          if (bounds !== undefined && bounds.every(bound => bound.absent)) continue;
          const inputs = invocationInputs(origin, owner, entry.invocation, entry.callback);
          if (!inputs.calleeSubjects?.includes(origin)) continue;
          const candidates = nativePayloadCandidates(entry.invocation)?.values().next().value;
          if (candidates === undefined) return undefined;
          for (const candidate of candidates.values) {
            if (!step()) return undefined;
            selected.add(Object.freeze({ kind: "unclassified-exposure", subject: candidate, owner: origin, exposure: entry.invocation,
              ...(operand.callback === undefined ? {} : { callback: operand.callback }) }));
          }
          if (!candidates.complete) selected.add(Object.freeze({ kind: "unclassified-exposure", subject: origin, owner: origin,
            exposure: entry.invocation, ...(operand.callback === undefined ? {} : { callback: operand.callback }) }));
        }
      }
    }
    return selected;
  });
  return callbackInputFrontiersFor;
}
