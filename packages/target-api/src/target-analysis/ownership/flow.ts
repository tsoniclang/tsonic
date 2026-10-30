import { AsAwaitExpression } from "../../source-navigation/checked-casts.js";
import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../source-semantics/types.js";
import { createSourceControlFlow } from "../flow/graph.js";
import { solveSourceFlow } from "../flow/solver.js";
import type { SourceControlFlowGraph, SourceControlFlowOptions, SourceFlowLimits, SourceFlowPoint } from "../flow/model.js";
import { sourceFlowOrder } from "../flow/ordering.js";
import { SourceFlowFailure } from "../flow/resources.js";
import type { SourceStorageBindings, SourceStorageConstructionSelection, SourceStorageQueries } from "../source-storage/model/types.js";
import type { SourceContinuationDependencyQueries } from "./dependencies.js";
import { createSourceContinuationTransfer, type SourceContinuationState, type SourceContinuationTransfer } from "./continuation.js";
import type { SourceSuspensionQueries } from "./suspension.js";
import type { SourceContinuationDependency, SourceOwnershipBudget, SourceOwnershipUnresolved, SourcePendingOperation, SourceRetentionPremise } from "./model.js";
import type { SourceStorageSubject } from "../source-storage/model/subjects.js";
import { sourceOwnershipUnresolved } from "./contracts.js";
import { sourceOwnershipImmediateType } from "./suspension.js";
import type { SourceDeclarationFlowExecutionRegion, SourceFlowUnresolved } from "../flow/model.js";
import { createSourceControlFlowDomain, createSourceDeclarationControlFlow } from "../flow/graph.js";
import { isSourceCallableBodyBoundary } from "../../source-navigation/index.js";
import type { SourceDeclarationOwnershipBudget, SourceDeclarationOwnershipValue, SourceDeclarationOwnershipValues,
  SourceDeclarationOwnershipUnresolved, SourceDeclarationContinuationDependency, SourceDeclarationPendingOperation } from "./model.js";
import type { SourceDeclarationContinuationDependencyQueries } from "./dependencies.js";
import type { SourceDeclarationSuspensionQueries } from "./suspension.js";
import { sourceDeclarationOwnershipUnresolved } from "./contracts.js";

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
  readonly contexts: ReadonlyMap<number, { readonly owner: Node; readonly bindings: SourceStorageBindings }>;
  readonly invocations: readonly { readonly call: Node; readonly bindings: SourceStorageBindings }[];
  readonly completionInvocations: readonly { readonly call: Node; readonly bindings: SourceStorageBindings }[];
}

interface SourceContinuationFlowInput {
  readonly source: TargetSourceProgram;
  readonly storage: SourceStorageQueries;
  readonly budget: SourceOwnershipBudget;
  readonly candidate: Node;
  readonly invocation: Node;
  readonly callerBindings: SourceStorageBindings;
  readonly construction?: Extract<SourceStorageConstructionSelection, { readonly kind: "resolved" }>["alternatives"][number];
  readonly suspensions: SourceSuspensionQueries;
  readonly dependencies: SourceContinuationDependencyQueries;
  readonly limits: Partial<SourceFlowLimits>;
  readonly invocationFor: (call: Node, bindings: SourceStorageBindings) => SourceContinuationClosureSelection;
  readonly execution?: SourceContinuationExecution;
  readonly domain?: SourceControlFlowOptions["domain"];
}

export function prepareSourceContinuationExecution(input: Pick<SourceContinuationFlowInput,
  "source" | "storage" | "budget" | "candidate" | "invocation" | "callerBindings" | "construction" | "limits" | "domain"
>): SourceOwnershipUnresolved | { readonly kind: "resolved"; readonly execution: SourceContinuationExecution } {
  const { source, storage, budget, candidate, invocation } = input;
  const selected = createSourceControlFlow(source, candidate, { domain: input.domain ?? { kind: "source" }, limits: input.limits,
    invocation: { storage, call: invocation, callerBindings: input.callerBindings, construction: input.construction } });
  if (selected.kind === "unresolved") return sourceOwnershipUnresolved(selected.source ?? candidate, selected.reason);
  const rows = budget.createRows();
  let published = false;
  try {
    const { reachable } = sourceFlowOrder(selected.graph, "forward", () => {
      if (!budget.step()) throw new SourceFlowFailure(budget.failure()!, candidate);
    });
    const contexts = new Map<number, { readonly owner: Node; readonly bindings: SourceStorageBindings }>();
    const invocations: { readonly call: Node; readonly bindings: SourceStorageBindings }[] = [];
    const completionInvocations: { readonly call: Node; readonly bindings: SourceStorageBindings }[] = [];
    const invokedContexts = new Map<Node, Set<SourceStorageBindings>>();
    const appendInvocation = (call: Node, bindings: SourceStorageBindings): boolean => {
      if (!budget.step()) return false;
      const selected = invokedContexts.get(call) ?? new Set<SourceStorageBindings>();
      if (selected.has(bindings)) return true;
      if (!rows.add(4)) return false;
      selected.add(bindings);
      invokedContexts.set(call, selected);
      invocations.push(Object.freeze({ call, bindings }));
      return true;
    };
    for (const point of selected.graph.points) {
      if (!budget.step()) return sourceOwnershipUnresolved(point.source ?? candidate, budget.failure()!);
      if (!reachable.has(point.id) || point.source === undefined) continue;
      const invoked = point.operation.kind === "evaluate" && (source.ast.is.IsCallExpression(point.source) ||
        source.ast.is.IsNewExpression(point.source) || storage.isAccessorInvocation(point.source));
      const returned = point.operation.kind === "return" && (source.ast.is.IsReturnStatement(point.source)
        ? source.ast.as.AsReturnStatement(point.source)?.Expression !== undefined : point.source === source.ast.body(candidate));
      if (!invoked && !returned && point.operation.kind !== "await" && sourceContinuationRead(source, point) === undefined) continue;
      const context = selected.graph.executionRegions.get(point.id);
      if (context === undefined) return sourceOwnershipUnresolved(point.source,
        "Continuation flow requires the exact checked execution-region bindings.");
      if (context.selection.kind === "unresolved") return sourceOwnershipUnresolved(point.source, context.selection.reason);
      if (!contexts.has(point.id)) {
        if (!rows.add(2)) return sourceOwnershipUnresolved(point.source, budget.failure()!);
        contexts.set(point.id, Object.freeze({ owner: context.owner, bindings: context.selection.bindings }));
      }
      if (invoked) {
        if (!appendInvocation(point.source, context.selection.bindings)) return sourceOwnershipUnresolved(point.source, budget.failure()!);
      }
      const completion = point.operation.kind === "await" ? AsAwaitExpression(source.ast, point.source)?.Expression
        : returned ? source.ast.is.IsReturnStatement(point.source)
          ? source.ast.as.AsReturnStatement(point.source)?.Expression : point.source : undefined;
      if (completion === undefined) continue;
      const types = source.semantics.forNode(completion).types;
      const type = types.expressionType(completion);
      if (type !== undefined && sourceOwnershipImmediateType(type, types, budget)) continue;
      const subject = storage.subjectFor(completion);
      if (subject.kind === "unresolved") return sourceOwnershipUnresolved(completion, subject.reason);
      const producers = storage.storageProducersFor(subject.subject, context.selection.bindings);
      if (producers.kind === "unresolved") return sourceOwnershipUnresolved(completion, producers.reason);
      for (const producer of producers.producers) {
        if (!budget.step()) return sourceOwnershipUnresolved(completion, budget.failure()!);
        if (!source.ast.is.IsCallExpression(producer.subject.node) && !source.ast.is.IsNewExpression(producer.subject.node) &&
          !storage.isAccessorInvocation(producer.subject.node)) continue;
        if (!appendInvocation(producer.subject.node, producer.bindings)) return sourceOwnershipUnresolved(completion, budget.failure()!);
        if (!rows.add(1)) return sourceOwnershipUnresolved(completion, budget.failure()!);
        completionInvocations.push(Object.freeze({ call: producer.subject.node, bindings: producer.bindings }));
      }
    }
    if (!rows.add(3)) return sourceOwnershipUnresolved(candidate, budget.failure()!);
    published = true;
    return Object.freeze({ kind: "resolved", execution: Object.freeze({ graph: selected.graph,
      contexts, invocations: Object.freeze(invocations), completionInvocations: Object.freeze(completionInvocations) }) });
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
  const contextFor = (point: SourceFlowPoint) => {
    const context = contexts.get(point.id);
    return context === undefined ? sourceOwnershipUnresolved(point.source ?? candidate, "Continuation flow requires the exact checked execution-region bindings.")
      : { kind: "resolved" as const, owner: context.owner, bindings: context.bindings };
  };
  let failure: SourceOwnershipUnresolved | undefined;
  const solution = solveSourceFlow(graph, {
    direction: "forward", lattice: transfer.lattice,
    transfer(point, state) {
      if (!budget.step()) { failure = sourceOwnershipUnresolved(point.source ?? candidate, budget.failure()!); return undefined; }
      if (point.operation.kind !== "await" || point.source === undefined) return state;
      const context = contextFor(point);
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
    const seen = new Map<Node, Map<Node, Map<SourceStorageSubject, Map<SourcePendingOperation, Set<SourceRetentionPremise>>>>>();
    let maySuspend = false;
    const append = (dependency: SourceContinuationDependency): boolean => {
      const candidates = seen.get(dependency.reference) ?? new Map<Node, Map<SourceStorageSubject, Map<SourcePendingOperation, Set<SourceRetentionPremise>>>>();
      const actuals = candidates.get(dependency.candidate) ?? new Map<SourceStorageSubject, Map<SourcePendingOperation, Set<SourceRetentionPremise>>>();
      const witnesses = actuals.get(dependency.actual) ?? new Map<SourcePendingOperation, Set<SourceRetentionPremise>>();
      const retained = witnesses.get(dependency.suspension) ?? new Set<SourceRetentionPremise>();
      if (retained.has(dependency.retention)) return true;
      if (!budget.step() || !rows.add(5)) return false;
      retained.add(dependency.retention);
      witnesses.set(dependency.suspension, retained);
      actuals.set(dependency.actual, witnesses);
      candidates.set(dependency.candidate, actuals);
      seen.set(dependency.reference, candidates);
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
      const context = contextFor(point);
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

export function sourceDeclarationOwnershipFlowFailure(selected: SourceFlowUnresolved,
  fallback: Node): SourceDeclarationOwnershipUnresolved {
  return selected.resource === undefined
    ? sourceDeclarationOwnershipUnresolved(selected.source ?? fallback, selected.reason)
    : Object.freeze({ kind: "unresolved", at: selected.resource.subject, reason: selected.reason,
        cause: Object.freeze({ kind: "resource-limit", subject: selected.resource.subject,
          category: selected.resource.dimension, limit: selected.resource.limit }) });
}

export function createSourceDeclarationOwnershipValues(input: {
  readonly source: TargetSourceProgram;
  readonly nodes: readonly Node[];
  readonly budget: SourceDeclarationOwnershipBudget;
  readonly limits: Partial<SourceFlowLimits>;
}) {
  const { source, budget } = input;
  const domain = createSourceControlFlowDomain(source, input.nodes);
  const graphs = new Map<Node, SourceControlFlowGraph<SourceDeclarationFlowExecutionRegion>>();
  const values = new Map<Node, SourceDeclarationOwnershipValue>();
  const owned = new WeakSet<SourceDeclarationOwnershipValue>();
  const rowsFor = (node: Node) => budget.createRows(node);
  const graphFor = (declaration: Node): SourceDeclarationOwnershipUnresolved |
    { readonly kind: "resolved"; readonly graph: SourceControlFlowGraph<SourceDeclarationFlowExecutionRegion> } => {
    if (!budget.step(declaration)) return budget.failure()!;
    if (domain.kind === "unresolved") return sourceDeclarationOwnershipFlowFailure(domain, declaration);
    const existing = graphs.get(declaration);
    if (existing !== undefined) return Object.freeze({ kind: "resolved", graph: existing });
    const selected = createSourceDeclarationControlFlow(source, declaration, { domain: domain.domain, limits: input.limits });
    if (selected.kind === "unresolved") return sourceDeclarationOwnershipFlowFailure(selected, declaration);
    const rows = rowsFor(declaration);
    if (!rows.add(1)) { rows.release(); return budget.failure()!; }
    graphs.set(declaration, selected.graph);
    return selected;
  };
  const declarationFor = (node: Node): Node | SourceDeclarationOwnershipUnresolved => {
    const visited = new Set<Node>();
    for (let current: Node | undefined = node; current !== undefined; current = source.ast.parent(current)) {
      if (!budget.step(node)) return budget.failure()!;
      if (visited.has(current)) return sourceDeclarationOwnershipUnresolved(node, "A declaration-local value has cyclic checked ancestry.");
      visited.add(current);
      if (isSourceCallableBodyBoundary(source.ast, current) || source.ast.is.IsPropertyDeclaration(current) ||
        source.ast.is.IsClassStaticBlockDeclaration(current) || source.ast.is.IsSourceFile(current)) return current;
    }
    return sourceDeclarationOwnershipUnresolved(node, "A local value requires its actual checked declaration or module owner.");
  };
  const regionFor = (node: Node): SourceDeclarationFlowExecutionRegion | SourceDeclarationOwnershipUnresolved => {
    if (!budget.step(node)) return budget.failure()!;
    const file = source.ast.getSourceFile(node);
    if (file === undefined || !source.semantics.includes(file))
      return sourceDeclarationOwnershipUnresolved(node, "A local region requires an original node from this checked source program.");
    const declaration = declarationFor(node);
    if ("kind" in declaration) return declaration;
    const selected = graphFor(declaration);
    if (selected.kind === "unresolved") return selected;
    const regions = new Set<SourceDeclarationFlowExecutionRegion>();
    const visited = new Set<Node>();
    let current: Node | undefined = source.ast.is.IsParameterDeclaration(node) || source.ast.is.IsVariableDeclaration(node)
      ? source.ast.name(node) : node;
    if (current === undefined)
      return sourceDeclarationOwnershipUnresolved(node, "A local declared value requires its original checked binding name.");
    while (current !== undefined) {
      if (!budget.step(node)) return budget.failure()!;
      if (visited.has(current)) return sourceDeclarationOwnershipUnresolved(node, "A local graph projection has cyclic checked ancestry.");
      visited.add(current);
      for (const point of selected.graph.sourcePoints.get(current) ?? []) {
        const region = selected.graph.executionRegions.get(point);
        if (region !== undefined) regions.add(region);
      }
      if (regions.size !== 0 || current === declaration) break;
      current = source.ast.parent(current);
    }
    return regions.size === 1 ? [...regions][0]!
      : sourceDeclarationOwnershipUnresolved(node, "A local value requires one exact published declaration execution region.");
  };
  const query: SourceDeclarationOwnershipValues = Object.freeze({
    regionFor,
    owns: (value: SourceDeclarationOwnershipValue) => owned.has(value),
    forNode(node: Node): SourceDeclarationOwnershipValue | SourceDeclarationOwnershipUnresolved {
      if (!budget.step(node)) return budget.failure()!;
      const existing = values.get(node);
      if (existing !== undefined) return existing;
      const region = regionFor(node);
      if ("kind" in region) return region;
      const semantics = source.semantics.forNode(node);
      const call = source.ast.is.IsCallExpression(node) || source.ast.is.IsNewExpression(node)
        ? semantics.operations.call(node) : undefined;
      const selectedType = call?.sourceSelectedSignatureKind === "resolved" ? call.sourceResultType
        : semantics.types.expressionType(node) ?? semantics.declarations.declaredValueType(node);
      if (selectedType === undefined)
        return sourceDeclarationOwnershipUnresolved(node, "A local native value needs its exact completed checked type component.");
      const declaration = call?.sourceSelectedSignatureKind === "resolved"
        ? semantics.declarations.signatureDeclaration(call.selectedSignature) : source.navigation.sourceReferenceFor(node)?.declaration;
      const authoredTypeNode = declaration === undefined ? undefined : source.ast.typeNode(declaration);
      const component = Object.freeze({ selectedType, ...(declaration === undefined ? {} : { declaration }),
        ...(authoredTypeNode === undefined ? {} : { authoredTypeNode }),
        ...(call === undefined ? {} : { contextualCall: call }) });
      const value: SourceDeclarationOwnershipValue = Object.freeze({ node, component, region });
      const rows = rowsFor(node);
      if (!rows.add(2)) { rows.release(); return budget.failure()!; }
      values.set(node, value);
      owned.add(value);
      return value;
    },
  });
  return Object.freeze({ values: query, graphFor, declarationFor });
}

export interface SourceDeclarationContinuationFlowSelection {
  readonly kind: "resolved";
  readonly declaration: Node;
  readonly dependencies: readonly SourceDeclarationContinuationDependency[];
  readonly maySuspend: boolean;
}

export function resolveSourceDeclarationContinuationFlow(input: {
  readonly source: TargetSourceProgram;
  readonly graph: SourceControlFlowGraph<SourceDeclarationFlowExecutionRegion>;
  readonly budget: SourceDeclarationOwnershipBudget;
  readonly suspensions: SourceDeclarationSuspensionQueries;
  readonly dependencies: SourceDeclarationContinuationDependencyQueries;
  readonly limits: Partial<SourceFlowLimits>;
}): SourceDeclarationContinuationFlowSelection | SourceDeclarationOwnershipUnresolved {
  const { source, graph, budget, suspensions } = input;
  const at = graph.declaration;
  const transfer = createSourceContinuationTransfer<SourceDeclarationPendingOperation>({
    step: () => budget.step(at), createRows: () => budget.createRows(at), failure: () => budget.failure()?.reason,
  });
  try {
    let failure: SourceDeclarationOwnershipUnresolved | undefined;
    const solution = solveSourceFlow<ReadonlySet<SourceDeclarationPendingOperation>>(graph, {
      direction: "forward", lattice: transfer.lattice,
      transfer(point, state) {
        if (!budget.step(point.source ?? at)) { failure = budget.failure(); return undefined; }
        if (point.operation.kind !== "await" || point.source === undefined) return state;
        const selected = suspensions.forAwait(point.source);
        if (selected.kind === "unresolved") { failure = selected; return undefined; }
        return selected.kind === "never" ? state : transfer.suspend(state, selected.pending);
      },
    }, input.limits);
    if (solution.kind === "unresolved") return failure ?? sourceDeclarationOwnershipFlowFailure(solution, at);
    const rows = budget.createRows(at);
    let published = false;
    try {
      const dependencies: SourceDeclarationContinuationDependency[] = [];
      const append = (state: ReadonlySet<SourceDeclarationPendingOperation>, reference: Node): SourceDeclarationOwnershipUnresolved | undefined => {
        const selected = input.dependencies.forRead(state, reference, at);
        if (selected.kind === "unresolved") return selected;
        for (const dependency of selected.dependencies) {
          if (!budget.step(reference)) return budget.failure();
          if (dependencies.some(existing => existing.reference === dependency.reference &&
            existing.suspension === dependency.suspension && existing.retention === dependency.retention)) continue;
          if (!rows.add(1)) return budget.failure();
          dependencies.push(dependency);
        }
        return undefined;
      };
      let maySuspend = false;
      for (const point of graph.points) {
        if (!budget.step(point.source ?? at)) return budget.failure()!;
        if (!solution.reachable.has(point.id) || point.source === undefined) continue;
        const state = solution.before.get(point.id);
        if (state === undefined)
          return sourceDeclarationOwnershipUnresolved(point.source, "A reachable local continuation lacks its completed flow state.");
        const reference = sourceContinuationRead(source, point);
        if (reference !== undefined) {
          const problem = append(state, reference);
          if (problem !== undefined) return problem;
        }
        if (point.operation.kind === "await") {
          const selected = suspensions.forAwait(point.source);
          if (selected.kind === "unresolved") return selected;
          if (selected.kind === "resolved") {
            maySuspend = true;
            const held = transfer.suspend(transfer.lattice.empty(), selected.pending);
            if (held === undefined) return budget.failure()!;
            const problem = append(held, selected.pending.expression);
            if (problem !== undefined) return problem;
          }
        }
      }
      published = true;
      return Object.freeze({ kind: "resolved", declaration: at, dependencies: Object.freeze(dependencies), maySuspend });
    } finally { if (!published) rows.release(); }
  } finally { transfer.release(); }
}
