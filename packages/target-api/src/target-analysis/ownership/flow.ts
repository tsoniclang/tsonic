import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../source-semantics/types.js";
import { createSourceControlFlow } from "../flow/graph.js";
import { solveSourceFlow } from "../flow/solver.js";
import type { SourceControlFlowGraph, SourceFlowLimits, SourceFlowPoint } from "../flow/model.js";
import { sourceFlowOrder } from "../flow/ordering.js";
import { SourceFlowFailure } from "../flow/resources.js";
import type { SourceStorageBindings, SourceStorageQueries } from "../source-storage/model/types.js";
import type { SourceContinuationDependencyQueries } from "./dependencies.js";
import { createSourceContinuationTransfer, type SourceContinuationState, type SourceContinuationTransfer } from "./continuation.js";
import type { SourceSuspensionQueries } from "./suspension.js";
import type { SourceContinuationDependency, SourceOwnershipBudget, SourceOwnershipUnresolved,
  SourcePendingOperation, SourceRetentionPremise } from "./model.js";
import type { SourceStorageSubject } from "../source-storage/model/subjects.js";
import { sourceOwnershipUnresolved } from "./contracts.js";

export interface SourceContinuationRead {
  readonly reference: Node;
  readonly candidate: Node;
  readonly bindings: SourceStorageBindings;
}

export type SourceContinuationClosureSelection = SourceOwnershipUnresolved | {
  readonly kind: "resolved";
  readonly reads: readonly SourceContinuationRead[];
  readonly results: readonly SourceContinuationRead[];
  readonly dependencies: readonly SourceContinuationDependency[];
  readonly maySuspend: boolean;
};

export interface SourceContinuationExecution {
  readonly graph: SourceControlFlowGraph;
  readonly contexts: ReadonlyMap<Node, { readonly owner: Node; readonly bindings: SourceStorageBindings }>;
  readonly invocations: readonly { readonly call: Node; readonly bindings: SourceStorageBindings }[];
}

interface SourceContinuationFlowInput {
  readonly source: TargetSourceProgram;
  readonly storage: SourceStorageQueries;
  readonly budget: SourceOwnershipBudget;
  readonly candidate: Node;
  readonly invocation: Node;
  readonly callerBindings: SourceStorageBindings;
  readonly suspensions: SourceSuspensionQueries;
  readonly dependencies: SourceContinuationDependencyQueries;
  readonly limits: Partial<SourceFlowLimits>;
  readonly invocationFor: (call: Node, bindings: SourceStorageBindings) => SourceContinuationClosureSelection;
  readonly execution?: SourceContinuationExecution;
}

export function prepareSourceContinuationExecution(input: Pick<SourceContinuationFlowInput,
  "source" | "storage" | "budget" | "candidate" | "invocation" | "callerBindings" | "limits"
>): SourceOwnershipUnresolved | { readonly kind: "resolved"; readonly execution: SourceContinuationExecution } {
  const { source, storage, budget, candidate, invocation } = input;
  const selected = createSourceControlFlow(source, candidate, { limits: input.limits,
    invocation: { storage, call: invocation, callerBindings: input.callerBindings } });
  if (selected.kind === "unresolved") return sourceOwnershipUnresolved(selected.source ?? candidate, selected.reason);
  const rows = budget.createRows();
  let published = false;
  try {
    const { reachable } = sourceFlowOrder(selected.graph, "forward", () => {
      if (!budget.step()) throw new SourceFlowFailure(budget.failure()!, candidate);
    });
    const contexts = new Map<Node, { readonly owner: Node; readonly bindings: SourceStorageBindings }>();
    const invocations: { readonly call: Node; readonly bindings: SourceStorageBindings }[] = [];
    for (const point of selected.graph.points) {
      if (!budget.step()) return sourceOwnershipUnresolved(point.source ?? candidate, budget.failure()!);
      if (!reachable.has(point.id) || point.source === undefined) continue;
      const invoked = point.operation.kind === "evaluate" && (source.ast.is.IsCallExpression(point.source) ||
        source.ast.is.IsNewExpression(point.source) || storage.isAccessorInvocation(point.source));
      const returned = point.operation.kind === "return" && (source.ast.is.IsReturnStatement(point.source)
        ? source.ast.as.AsReturnStatement(point.source)?.Expression !== undefined : point.source === source.ast.body(candidate));
      if (!invoked && !returned && point.operation.kind !== "await" && sourceContinuationRead(source, point) === undefined) continue;
      const region = storage.enclosingRegionFor(point.source);
      const context = region === undefined ? undefined : selected.graph.executionRegions.get(region);
      if (context === undefined) return sourceOwnershipUnresolved(point.source,
        "Continuation flow requires the exact checked execution-region bindings.");
      if (context.selection.kind === "unresolved") return sourceOwnershipUnresolved(point.source, context.selection.reason);
      if (!contexts.has(point.source)) {
        if (!rows.add(2)) return sourceOwnershipUnresolved(point.source, budget.failure()!);
        contexts.set(point.source, Object.freeze({ owner: context.owner, bindings: context.selection.bindings }));
      }
      if (invoked) {
        if (!rows.add(1)) return sourceOwnershipUnresolved(point.source, budget.failure()!);
        invocations.push(Object.freeze({ call: point.source, bindings: context.selection.bindings }));
      }
    }
    if (!rows.add(3)) return sourceOwnershipUnresolved(candidate, budget.failure()!);
    published = true;
    return Object.freeze({ kind: "resolved", execution: Object.freeze({ graph: selected.graph,
      contexts, invocations: Object.freeze(invocations) }) });
  } catch (error) {
    if (!(error instanceof SourceFlowFailure)) throw error;
    return sourceOwnershipUnresolved(error.source ?? candidate, error.message);
  } finally {
    if (!published) rows.release();
  }
}

export function resolveSourceContinuationFlow(input: SourceContinuationFlowInput): SourceContinuationClosureSelection {
  const transfer = createSourceContinuationTransfer(input.budget);
  try { return resolve(input, transfer); } finally { transfer.release(); }
}

function resolve(input: SourceContinuationFlowInput, transfer: SourceContinuationTransfer): SourceContinuationClosureSelection {
  const { source, storage, budget, candidate, suspensions } = input;
  const selected = input.execution === undefined ? prepareSourceContinuationExecution(input)
    : { kind: "resolved" as const, execution: input.execution };
  if (selected.kind === "unresolved") return selected;
  const { graph, contexts } = selected.execution;
  const contextFor = (node: Node) => {
    const context = contexts.get(node);
    return context === undefined ? sourceOwnershipUnresolved(node, "Continuation flow requires the exact checked execution-region bindings.")
      : { kind: "resolved" as const, owner: context.owner, bindings: context.bindings };
  };
  let failure: SourceOwnershipUnresolved | undefined;
  const solution = solveSourceFlow(graph, {
    direction: "forward", lattice: transfer.lattice,
    transfer(point, state) {
      if (!budget.step()) { failure = sourceOwnershipUnresolved(point.source ?? candidate, budget.failure()!); return undefined; }
      if (point.operation.kind !== "await" || point.source === undefined) return state;
      const context = contextFor(point.source);
      if (context.kind === "unresolved") { failure = context; return undefined; }
      const suspension = suspensions.forAwait(point.source, context.bindings);
      if (suspension.kind === "unresolved") { failure = suspension; return undefined; }
      return suspension.kind === "never" ? state : transfer.suspend(state, suspension.pending);
    },
  }, input.limits);
  if (solution.kind === "unresolved") return failure ?? sourceOwnershipUnresolved(solution.source ?? candidate, solution.reason);
  const rows = budget.createRows();
  let published = false;
  try {
    const reads = new Set<SourceContinuationRead>();
    const results: SourceContinuationRead[] = [];
    const localReads = new Map<Node, Map<SourceStorageBindings, Map<Node, SourceContinuationRead>>>();
    const dependencies: SourceContinuationDependency[] = [];
    const seen = new Map<Node, Map<SourceStorageSubject, Map<SourcePendingOperation, Set<SourceRetentionPremise>>>>();
    let maySuspend = false;
    const append = (dependency: SourceContinuationDependency): boolean => {
      const actuals = seen.get(dependency.reference) ?? new Map<SourceStorageSubject, Map<SourcePendingOperation, Set<SourceRetentionPremise>>>();
      const witnesses = actuals.get(dependency.actual) ?? new Map<SourcePendingOperation, Set<SourceRetentionPremise>>();
      const retained = witnesses.get(dependency.suspension) ?? new Set<SourceRetentionPremise>();
      if (retained.has(dependency.retention)) return true;
      if (!budget.step() || !rows.add(4)) return false;
      retained.add(dependency.retention);
      witnesses.set(dependency.suspension, retained);
      actuals.set(dependency.actual, witnesses);
      seen.set(dependency.reference, actuals);
      dependencies.push(dependency);
      return true;
    };
    const observe = (read: SourceContinuationRead, state: SourceContinuationState): SourceOwnershipUnresolved | undefined => {
      if (!reads.has(read)) {
        if (!rows.add(1)) return sourceOwnershipUnresolved(read.reference, budget.failure()!);
        reads.add(read);
      }
      const result = input.dependencies.forRead(state, read.reference, read.candidate, read.bindings);
      if (result.kind === "unresolved") return result;
      for (const dependency of result.dependencies) {
        if (!append(dependency)) return sourceOwnershipUnresolved(read.reference, budget.failure()!);
      }
      return undefined;
    };
    for (const point of graph.points) {
      if (!budget.step()) return sourceOwnershipUnresolved(point.source ?? candidate, budget.failure()!);
      if (!solution.reachable.has(point.id) || point.source === undefined) continue;
      const state = solution.before.get(point.id)!;
      const context = contextFor(point.source);
      const reference = sourceContinuationRead(source, point);
      if (reference !== undefined) {
        if (context.kind === "unresolved") return context;
        const byBinding = localReads.get(reference);
        const byOwner = byBinding?.get(context.bindings);
        let read = byOwner?.get(context.owner);
        if (read === undefined) {
          if (!rows.add(1 + (byBinding === undefined ? 1 : 0) + (byOwner === undefined ? 1 : 0))) {
            return sourceOwnershipUnresolved(reference, budget.failure()!);
          }
          read = Object.freeze({ reference, candidate: context.owner, bindings: context.bindings });
          const owners = byOwner ?? new Map<Node, SourceContinuationRead>();
          const bindings = byBinding ?? new Map<SourceStorageBindings, Map<Node, SourceContinuationRead>>();
          owners.set(context.owner, read);
          bindings.set(context.bindings, owners);
          localReads.set(reference, bindings);
        }
        const problem = observe(read, state);
        if (problem !== undefined) return problem;
      }
      if (point.operation.kind === "await") {
        if (context.kind === "unresolved") return context;
        const suspension = suspensions.forAwait(point.source, context.bindings);
        if (suspension.kind === "unresolved") return suspension;
        if (suspension.kind === "resolved") {
          maySuspend = true;
          const held = transfer.suspend(transfer.lattice.empty(), suspension.pending);
          if (held === undefined) return sourceOwnershipUnresolved(point.source, budget.failure()!);
          const owned = input.dependencies.forRead(held, suspension.pending.expression, context.owner, context.bindings);
          if (owned.kind === "unresolved") return owned;
          for (const dependency of owned.dependencies) if (!append(dependency)) return sourceOwnershipUnresolved(point.source, budget.failure()!);
        }
      }
      if (point.operation.kind === "evaluate" && (source.ast.is.IsCallExpression(point.source) ||
        source.ast.is.IsNewExpression(point.source) || storage.isAccessorInvocation(point.source))) {
        if (context.kind === "unresolved") return context;
        const nested = input.invocationFor(point.source, context.bindings);
        if (nested.kind === "unresolved") return nested;
        for (const dependency of nested.dependencies) if (!append(dependency)) return sourceOwnershipUnresolved(point.source, budget.failure()!);
        for (const read of nested.reads) {
          const problem = observe(read, state);
          if (problem !== undefined) return problem;
        }
      }
      if (point.operation.kind === "return") {
        const result = source.ast.is.IsReturnStatement(point.source) ? source.ast.as.AsReturnStatement(point.source)?.Expression
          : point.source === source.ast.body(candidate) ? point.source : undefined;
        if (result !== undefined) {
          if (context.kind === "unresolved") return context;
          if (!rows.add(1)) return sourceOwnershipUnresolved(result, budget.failure()!);
          results.push(Object.freeze({ reference: result, candidate: context.owner, bindings: context.bindings }));
        }
      }
    }
    if (!rows.add(2)) return sourceOwnershipUnresolved(candidate, budget.failure()!);
    published = true;
    return Object.freeze({ kind: "resolved", reads: Object.freeze([...reads]), results: Object.freeze(results),
      dependencies: Object.freeze(dependencies), maySuspend });
  } finally {
    if (!published) rows.release();
  }
}

function sourceContinuationRead(source: TargetSourceProgram, point: SourceFlowPoint): Node | undefined {
  if (point.operation.kind === "read") return point.source;
  if (point.operation.kind === "capture") return point.operation.binding;
  if (point.operation.kind !== "evaluate" || point.source === undefined) return undefined;
  const { ast } = source;
  return ast.kindName(point.source) === "KindThisKeyword" || ast.is.IsPropertyAccessExpression(point.source) ||
    ast.is.IsElementAccessExpression(point.source) ? point.source : undefined;
}
