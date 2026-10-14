import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../source-semantics/types.js";
import type { SourceFlowLimits } from "../flow/model.js";
import { defaultSourceFlowLimits } from "../flow/resources.js";
import type { SourceStorageSubject } from "../source-storage/model/subjects.js";
import type { SourceStorageBindings, SourceStorageQueries } from "../source-storage/model/types.js";
import type { SourceOwnershipBudget, SourceOwnershipPremises, SourceSuspensionSelection } from "./model.js";
import { createSourceContinuationTransfer } from "./continuation.js";
import { createSourceContinuationDependencyQuery } from "./dependencies.js";
import { createSourceSuspensionQuery } from "./suspension.js";
import { sourceOwnershipUnresolved } from "./contracts.js";
import { resolveSourceContinuationFlow, type SourceContinuationClosureSelection } from "./flow.js";

export function createSourceContinuationClosureQuery(input: {
  readonly source: TargetSourceProgram;
  readonly storage: SourceStorageQueries;
  readonly premises: SourceOwnershipPremises;
  readonly budget: SourceOwnershipBudget;
  readonly flowLimits?: Partial<SourceFlowLimits>;
}) {
  const { source, storage, premises, budget } = input;
  if (source !== storage.source) throw new Error("Continuation closure and storage require the identical checked source program.");
  const cache = new Map<Node, Map<SourceStorageBindings, SourceContinuationClosureSelection>>();
  const active = new Set<Node>();
  const rows = budget.createRows();
  const transfer = createSourceContinuationTransfer(budget);
  const suspensionPremises = { suspensionFor: forSubject };
  const suspensions = createSourceSuspensionQuery({ ...input, premises: suspensionPremises });
  const dependencies = createSourceContinuationDependencyQuery({ ...input, transfer, suspensions });

  function forSubject(value: SourceStorageSubject, bindings: SourceStorageBindings): SourceSuspensionSelection | undefined {
    const native = premises.suspensionFor(value, bindings);
    if (native !== undefined) return native;
    if (!source.ast.is.IsCallExpression(value.node)) return undefined;
    const selected = source.semantics.forNode(value.node).operations.call(value.node);
    const declaration = selected?.sourceSelectedSignatureKind === "resolved"
      ? source.semantics.forNode(value.node).declarations.signatureDeclaration(selected.selectedSignature) : undefined;
    if (declaration === undefined) return undefined;
    const implementations = storage.invocationImplementationsFor(value.node, bindings);
    if (implementations.kind === "unresolved") return sourceOwnershipUnresolved(value.node, implementations.reason);
    if (!implementations.exact || implementations.nodes.length === 0 ||
      implementations.nodes.some(candidate => source.ast.body(candidate) === undefined)) return undefined;
    const body = forInvocation(value.node, bindings);
    if (body.kind === "unresolved") return body;
    let maySuspend = body.maySuspend;
    if (!maySuspend) for (const result of body.results) {
      const completion = suspensions.forResult(result.reference, result.bindings);
      if (completion.kind === "unresolved") return completion;
      maySuspend ||= completion.kind === "resolved";
    }
    const type = storage.typeFor(value);
    if (type.kind === "unresolved") return sourceOwnershipUnresolved(value.node, type.reason);
    return Object.freeze({ kind: maySuspend ? "may-suspend" : "never", value,
      contractDeclaration: declaration, checkedType: type.type });
  }

  function forInvocation(call: Node, bindings: SourceStorageBindings): SourceContinuationClosureSelection {
    if (!budget.step()) return sourceOwnershipUnresolved(call, budget.failure()!);
    const file = source.ast.getSourceFile(call);
    if (file === undefined || !source.semantics.includes(file)) return sourceOwnershipUnresolved(call, "Continuation closure requires the exact checked invocation.");
    const implementations = storage.invocationImplementationsFor(call, bindings);
    if (implementations.kind === "unresolved") return sourceOwnershipUnresolved(call, implementations.reason);
    const existing = cache.get(call)?.get(bindings);
    if (existing !== undefined) return existing;
    let result: SourceContinuationClosureSelection;
    if (implementations.nodes.length === 0) {
      const semantics = source.semantics.forNode(call);
      const selected = semantics.operations.call(call);
      const declaration = selected?.sourceSelectedSignatureKind === "resolved"
        ? semantics.declarations.signatureDeclaration(selected.selectedSignature) : undefined;
      if (declaration === undefined || source.ast.body(declaration) !== undefined ||
        !source.ast.is.IsFunctionDeclaration(declaration) && !source.ast.is.IsMethodDeclaration(declaration) &&
        !source.ast.is.IsConstructorDeclaration(declaration)) {
        return sourceOwnershipUnresolved(call, "An open callable domain requires its actual implementation or selected native declaration contract.");
      }
      result = nativeClosure(call, declaration, bindings);
    } else {
      if (!implementations.exact || implementations.nodes.length === 0) {
        return sourceOwnershipUnresolved(call, "An open callable domain cannot prove complete continuation dependencies.");
      }
      const completed: Extract<SourceContinuationClosureSelection, { kind: "resolved" }>[] = [];
      for (const candidate of implementations.nodes) {
        if (!budget.step()) return sourceOwnershipUnresolved(call, budget.failure()!);
        if (active.has(candidate)) return sourceOwnershipUnresolved(call, "Recursive continuation execution has no closed finite summary.");
        if (active.size >= (input.flowLimits?.maximumDepth ?? defaultSourceFlowLimits.maximumDepth)) {
          return sourceOwnershipUnresolved(call, "Continuation execution exceeds its finite call-depth budget.");
        }
        const bound = storage.bindingsForInvocation(candidate, call, bindings);
        if (bound.kind === "unresolved") return sourceOwnershipUnresolved(call, bound.reason);
        active.add(candidate);
        let closure: SourceContinuationClosureSelection;
        try {
          closure = resolveSourceContinuationFlow({ source, storage, budget, candidate, invocation: call,
            bindings: bound.bindings, suspensions, dependencies,
            limits: input.flowLimits ?? {}, invocationFor: forInvocation });
        } finally { active.delete(candidate); }
        if (closure.kind === "unresolved") return closure;
        completed.push(closure);
      }
      if (!rows.add(3 + completed.reduce((count, body) => count + body.reads.length + body.results.length + body.dependencies.length, 0))) {
        return sourceOwnershipUnresolved(call, budget.failure()!);
      }
      result = Object.freeze({ kind: "resolved", reads: Object.freeze(completed.flatMap(body => body.reads)),
        results: Object.freeze(completed.flatMap(body => body.results)),
        dependencies: Object.freeze(completed.flatMap(body => body.dependencies)), maySuspend: completed.some(body => body.maySuspend) });
    }
    if (result.kind === "unresolved") return result;
    if (!rows.add(2)) return sourceOwnershipUnresolved(call, budget.failure()!);
    const byBinding = cache.get(call) ?? new Map<SourceStorageBindings, SourceContinuationClosureSelection>();
    byBinding.set(bindings, result);
    cache.set(call, byBinding);
    return result;
  }

  function nativeClosure(call: Node, declaration: Node, bindings: SourceStorageBindings): SourceContinuationClosureSelection {
    const pending = suspensions.forCall(call, bindings);
    if (pending.kind === "unresolved") return pending;
    if (pending.kind === "never") return Object.freeze({ kind: "resolved", reads: Object.freeze([]),
      results: Object.freeze([]), dependencies: Object.freeze([]), maySuspend: false });
    const nativeTransfer = createSourceContinuationTransfer(budget);
    try {
      const state = nativeTransfer.suspend(nativeTransfer.lattice.empty(), pending.pending);
      if (state === undefined) return sourceOwnershipUnresolved(call, budget.failure()!);
      const result = dependencies.forRead(state, call, declaration, bindings);
      return result.kind === "unresolved" ? result : Object.freeze({ kind: "resolved", reads: Object.freeze([]),
        results: Object.freeze([]), dependencies: result.dependencies, maySuspend: true });
    } finally { nativeTransfer.release(); }
  }

  return Object.freeze({
    forInvocation(call: Node, bindings: SourceStorageBindings = storage.emptyBindings): SourceContinuationClosureSelection {
      return forInvocation(call, bindings);
    },
  });
}
