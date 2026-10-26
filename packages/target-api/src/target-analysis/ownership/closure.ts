import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../source-semantics/types.js";
import type { SourceControlFlowOptions, SourceFlowLimits } from "../flow/model.js";
import { createTargetGraphComponentQuery } from "../graph-component-query.js";
import type { SourceStorageSubject } from "../source-storage/model/subjects.js";
import { sourceStorageConstructionExpression } from "../source-storage/model/construction.js";
import type { SourceStorageBindings, SourceStorageConstructionSelection, SourceStorageQueries } from "../source-storage/model/types.js";
import type { SourceContinuationDependency, SourceOwnershipBudget, SourceOwnershipPremises, SourceOwnershipUnresolved, SourcePendingOperation, SourceRetentionPremise, SourceSuspensionSelection } from "./model.js";
import { createSourceContinuationTransfer } from "./continuation.js";
import { createSourceContinuationDependencyQuery } from "./dependencies.js";
import { createSourceSuspensionQuery } from "./suspension.js";
import { sourceOwnershipUnresolved } from "./contracts.js";
import { prepareSourceContinuationExecution, resolveSourceContinuationFlow, type SourceContinuationClosureSelection, type SourceContinuationExecution, type SourceContinuationRead } from "./flow.js";

type Closure = Extract<SourceContinuationClosureSelection, { readonly kind: "resolved" }>;

interface Invocation {
  readonly call: Node;
  readonly bindings: SourceStorageBindings;
}

interface InvocationInput {
  readonly declaration: Node;
  readonly executions: readonly { readonly candidate: Node; readonly execution: SourceContinuationExecution }[];
  readonly neighbours: ReadonlySet<Invocation>;
}

export function createSourceContinuationClosureQuery(input: {
  readonly source: TargetSourceProgram;
  readonly storage: SourceStorageQueries;
  readonly premises: SourceOwnershipPremises;
  readonly budget: SourceOwnershipBudget;
  readonly flowLimits?: Partial<SourceFlowLimits>;
  readonly domain?: SourceControlFlowOptions["domain"];
}) {
  const { source, storage, premises, budget } = input;
  if (source !== storage.source) throw new Error("Continuation closure and storage require the identical checked source program.");
  const vertices = new Map<Node, Map<string, Invocation>>();
  const contexts = new Map<Node, Map<SourceStorageBindings, string>>();
  const completed = new Map<Invocation, Closure>();
  const rows = budget.createRows();
  const completedRows: ReturnType<SourceOwnershipBudget["createRows"]>[] = [];
  let stagedRows: ReturnType<SourceOwnershipBudget["createRows"]>[] = [];
  let inputRows: ReturnType<SourceOwnershipBudget["createRows"]>[] | undefined;
  const bottom: Closure = Object.freeze({ kind: "resolved", reads: Object.freeze([]),
    results: Object.freeze([]), dependencies: Object.freeze([]), maySuspend: false });
  let failure: SourceOwnershipUnresolved | undefined;
  let staged = new Map<Invocation, Closure>();
  const contextFor = (call: Node, bindings: SourceStorageBindings): string | undefined => {
    const cached = contexts.get(call)?.get(bindings);
    if (cached !== undefined) return cached;
    const file = source.ast.getSourceFile(call);
    if (file === undefined || !source.semantics.includes(file))
      return refuse(call, "Continuation closure requires the exact checked invocation.");
    const selected = storage.invocationContextKeyFor(call, bindings);
    if (selected.kind === "unresolved") return refuse(call, selected.reason);
    if (!rows.add(2)) return undefined;
    const values = contexts.get(call) ?? new Map<SourceStorageBindings, string>();
    values.set(bindings, selected.key);
    contexts.set(call, values);
    return selected.key;
  };
  const vertexFor = (call: Node, bindings: SourceStorageBindings): Invocation | undefined => {
    if (!budget.step()) return undefined;
    const context = contextFor(call, bindings);
    if (context === undefined) return undefined;
    const known = vertices.get(call)?.get(context);
    if (known !== undefined) return known;
    if (!rows.add(2)) return undefined;
    const vertex = Object.freeze({ call, bindings });
    const values = vertices.get(call) ?? new Map<string, Invocation>();
    values.set(context, vertex);
    vertices.set(call, values);
    return vertex;
  };
  const refuse = (at: Node, reason: string): undefined => {
    failure = sourceOwnershipUnresolved(at, reason);
    return undefined;
  };
  const load = (vertex: Invocation) => {
    const { call, bindings } = vertex;
    const ownInputRows = () => {
      const selected = budget.createRows();
      inputRows!.push(selected);
      return selected;
    };
    const transient = ownInputRows();
    const inputBudget: SourceOwnershipBudget = { step: budget.step, failure: budget.failure, createRows: ownInputRows };
    const file = source.ast.getSourceFile(call);
    if (file === undefined || !source.semantics.includes(file))
      return refuse(call, "Continuation closure requires the exact checked invocation.");
    const semantics = source.semantics.forNode(call);
    const selected = semantics.operations.call(call);
    const declaration = selected?.sourceSelectedSignatureKind === "resolved"
      ? semantics.declarations.signatureDeclaration(selected.selectedSignature) : undefined;
    const implementations = storage.invocationImplementationsFor(call, bindings);
    const sourceConstruction = sourceStorageConstructionExpression(call, source, budget.step) !== undefined &&
      implementations.kind === "resolved" && implementations.nodes.some(candidate =>
        source.ast.is.IsClassDeclaration(candidate) || source.ast.is.IsClassExpression(candidate) || source.ast.is.IsConstructorDeclaration(candidate));
    const construction = sourceConstruction ? storage.constructionFor(call, bindings) : undefined;
    if (construction?.kind === "unresolved") return refuse(call, construction.reason);
    const candidates: readonly { readonly candidate: Node;
      readonly construction?: Extract<SourceStorageConstructionSelection, { readonly kind: "resolved" }>["alternatives"][number] }[] =
      construction === undefined ? implementations.kind === "resolved" ? implementations.nodes.map(candidate => ({ candidate })) : []
      : construction.alternatives.map(alternative => ({ candidate: alternative.root, construction: alternative }));
    const native = candidates.length === 0 || construction === undefined &&
      (implementations.kind === "unresolved" || !implementations.exact);
    if (native && (declaration === undefined || source.ast.body(declaration) !== undefined))
      return refuse(call, implementations.kind === "unresolved" ? implementations.reason
        : "An open callable domain requires its actual implementation or selected native declaration contract.");
    const executions: InvocationInput["executions"][number][] = [];
    const neighbours = new Set<Invocation>();
    if (!native) for (const entry of candidates) {
      if (!budget.step()) return refuse(call, budget.failure()!);
      const candidate = entry.candidate;
      const prepared = prepareSourceContinuationExecution({ source, storage, budget: inputBudget, candidate,
        construction: entry.construction, domain: input.domain,
        invocation: call, callerBindings: bindings, limits: input.flowLimits ?? {} });
      if (prepared.kind === "unresolved") { failure = prepared; return undefined; }
      if (!transient.add(1)) return refuse(call, budget.failure()!);
      executions.push(Object.freeze({ candidate, execution: prepared.execution }));
      for (const invoked of prepared.execution.invocations) {
        const target = vertexFor(invoked.call, invoked.bindings);
        if (target === undefined) return undefined;
        if (!neighbours.has(target) && !transient.add(1)) return refuse(invoked.call, budget.failure()!);
        neighbours.add(target);
      }
    }
    if (!transient.add(2)) return refuse(call, budget.failure()!);
    const data: InvocationInput = Object.freeze({ declaration: declaration ?? call,
      executions: Object.freeze(executions), neighbours });
    return { data, neighbours };
  };
  const select = createTargetGraphComponentQuery<Invocation, InvocationInput, ReadonlyMap<Invocation, Closure>>(load, members => {
    let current = new Map(members.map(member => [member.vertex, bottom]));
    let currentRows = budget.createRows();
    let published = false;
    try {
      const cyclic = members.length > 1 || members.some(member => member.data.neighbours.has(member.vertex));
      while (true) {
        if (!budget.step()) return undefined;
        const next = new Map<Invocation, Closure>();
        const nextRows = budget.createRows();
        let accepted = false;
        try {
          let changed = false;
          const lookup = (call: Node, bindings: SourceStorageBindings): SourceContinuationClosureSelection => {
            if (!budget.step()) return sourceOwnershipUnresolved(call, budget.failure()!);
            const context = contextFor(call, bindings);
            const vertex = context === undefined ? undefined : vertices.get(call)?.get(context);
            const selected = vertex === undefined ? undefined : current.get(vertex) ?? staged.get(vertex) ?? completed.get(vertex);
            return selected ?? sourceOwnershipUnresolved(call,
              "A continuation dependency requires its exact prepared call and canonical execution bindings.");
          };
          for (const member of members) {
            if (!budget.step()) return undefined;
            const temporary: ReturnType<SourceOwnershipBudget["createRows"]>[] = [];
            const evaluationBudget: SourceOwnershipBudget = { step: budget.step, failure: budget.failure,
              createRows() { const selected = budget.createRows(); temporary.push(selected); return selected; } };
            let joined: Closure | undefined;
            try {
              const value = evaluate(member.vertex, member.data, lookup, evaluationBudget);
              if (value.kind === "unresolved") { failure = value; return undefined; }
              joined = join(current.get(member.vertex)!, value, evaluationBudget);
              if (joined === undefined) return undefined;
              if (!nextRows.add(4 + joined.reads.length + joined.results.length + joined.dependencies.reduce(
                (count, dependency) => count + 2 + dependency.suspension.contracts.length, 0))) return undefined;
              changed ||= !equal(current.get(member.vertex)!, joined);
              if (budget.failure() !== undefined) return undefined;
              next.set(member.vertex, joined);
            } finally {
              for (const selected of temporary) selected.release();
            }
          }
          accepted = true;
          currentRows.release();
          currentRows = nextRows;
          current = next;
          if (!cyclic || !changed) break;
        } finally {
          if (!accepted) nextRows.release();
        }
      }
      for (const [vertex, value] of current) staged.set(vertex, value);
      stagedRows.push(currentRows);
      published = true;
      return current;
    } finally {
      if (!published) currentRows.release();
    }
  }, budget);

  function evaluate(vertex: Invocation, selected: InvocationInput,
    lookup: (call: Node, bindings: SourceStorageBindings) => SourceContinuationClosureSelection,
    evaluationBudget: SourceOwnershipBudget): SourceContinuationClosureSelection {
    const forSubject = (value: SourceStorageSubject, bindings: SourceStorageBindings): SourceSuspensionSelection | undefined => {
      const native = premises.suspensionFor(value, bindings);
      if (native !== undefined) return native;
      if (!source.ast.is.IsCallExpression(value.node) && !source.ast.is.IsNewExpression(value.node)) return undefined;
      const semantics = source.semantics.forNode(value.node);
      const call = semantics.operations.call(value.node);
      const selectedDeclaration = call?.sourceSelectedSignatureKind === "resolved"
        ? semantics.declarations.signatureDeclaration(call.selectedSignature) : undefined;
      const implementations = storage.invocationImplementationsFor(value.node, bindings);
      const sourceConstruction = sourceStorageConstructionExpression(value.node, source, evaluationBudget.step) !== undefined &&
        implementations.kind === "resolved" && implementations.nodes.some(candidate =>
          source.ast.is.IsClassDeclaration(candidate) || source.ast.is.IsClassExpression(candidate) || source.ast.is.IsConstructorDeclaration(candidate));
      const construction = sourceConstruction ? storage.constructionFor(value.node, bindings) : undefined;
      if (construction?.kind === "unresolved") return sourceOwnershipUnresolved(value.node, construction.reason);
      const declaration = selectedDeclaration ?? (construction?.kind === "resolved" ? value.node : undefined);
      if (declaration === undefined) return undefined;
      if (construction === undefined) {
        if (implementations.kind === "unresolved") return sourceOwnershipUnresolved(value.node, implementations.reason);
        if (!implementations.exact || implementations.nodes.length === 0 ||
          implementations.nodes.some(candidate => source.ast.body(candidate) === undefined)) return undefined;
      }
      const body = lookup(value.node, bindings);
      if (body.kind === "unresolved") return body;
      const type = storage.typeFor(value);
      return type.kind === "unresolved" ? sourceOwnershipUnresolved(value.node, type.reason)
        : Object.freeze({ kind: body.maySuspend ? "may-suspend" : "never", value,
            contractDeclaration: declaration, checkedType: type.type });
    };
    const transfer = createSourceContinuationTransfer(evaluationBudget);
    const suspensions = createSourceSuspensionQuery({ source, storage, budget: evaluationBudget,
      premises: { suspensionFor: forSubject } });
    const dependencies = createSourceContinuationDependencyQuery({ source, storage, budget: evaluationBudget,
      premises, transfer, suspensions });
    try {
      if (selected.executions.length === 0) {
        const pending = suspensions.forCall(vertex.call, vertex.bindings);
        if (pending.kind === "unresolved") return pending;
        if (pending.kind === "never") return bottom;
        const state = transfer.suspend(transfer.lattice.empty(), pending.pending);
        if (state === undefined) return sourceOwnershipUnresolved(vertex.call, evaluationBudget.failure()!);
        const retained = dependencies.forRead(state, vertex.call, selected.declaration, vertex.bindings);
        return retained.kind === "unresolved" ? retained : Object.freeze({ ...bottom,
          dependencies: retained.dependencies, maySuspend: true });
      }
      let result = bottom;
      for (const execution of selected.executions) {
        const flow = resolveSourceContinuationFlow({ source, storage, budget: evaluationBudget,
          candidate: execution.candidate, invocation: vertex.call, callerBindings: vertex.bindings,
          suspensions, dependencies, limits: input.flowLimits ?? {}, invocationFor: lookup,
          execution: execution.execution });
        if (flow.kind === "unresolved") return flow;
        let maySuspend = flow.maySuspend;
        let retained = bottom;
        for (const producer of execution.execution.completionInvocations) {
          const completed = lookup(producer.call, producer.bindings);
          if (completed.kind === "unresolved") return completed;
          const joined = join(retained, { ...bottom, dependencies: completed.dependencies }, evaluationBudget);
          if (joined === undefined) return sourceOwnershipUnresolved(producer.call, evaluationBudget.failure()!);
          retained = joined;
        }
        for (const returned of flow.results) {
          const completion = suspensions.forResult(returned.reference, returned.bindings);
          if (completion.kind === "unresolved") return completion;
          maySuspend ||= completion.kind === "resolved";
          if (completion.kind === "resolved") {
            const state = transfer.suspend(transfer.lattice.empty(), completion.pending);
            if (state === undefined) return sourceOwnershipUnresolved(returned.reference, evaluationBudget.failure()!);
            const selected = dependencies.forRead(state, returned.reference, returned.candidate, returned.bindings);
            if (selected.kind === "unresolved") return selected;
            const joined = join(retained, { ...bottom, dependencies: selected.dependencies }, evaluationBudget);
            if (joined === undefined) return sourceOwnershipUnresolved(returned.reference, evaluationBudget.failure()!);
            retained = joined;
          }
        }
        const completed = join(flow, retained, evaluationBudget);
        if (completed === undefined) return sourceOwnershipUnresolved(vertex.call, evaluationBudget.failure()!);
        const joined = join(result, { ...completed, maySuspend }, evaluationBudget);
        if (joined === undefined) return sourceOwnershipUnresolved(vertex.call, evaluationBudget.failure()!);
        result = joined;
      }
      return result;
    } finally {
      transfer.release();
    }
  }

  function sameRead(left: SourceContinuationRead, right: SourceContinuationRead): boolean {
    return left.reference === right.reference && left.candidate === right.candidate && left.bindings === right.bindings;
  }

  function sameRetention(left: SourceRetentionPremise, right: SourceRetentionPremise): boolean {
    if (left === right) return true;
    if (!budget.step() || left.kind !== right.kind || left.value !== right.value ||
      left.contractDeclaration !== right.contractDeclaration ||
      !source.semantics.forNode(left.value.node).types.isIdentical(left.checkedType, right.checkedType)) return false;
    if (left.kind === "retained" && right.kind === "retained") return left.reason === right.reason &&
      (left.reason !== "retained-owner" || right.reason === "retained-owner" && left.owner === right.owner);
    if (left.kind === "transferred" && right.kind === "transferred") return left.operation === right.operation;
    if (left.kind === "scoped-borrowed" && right.kind === "scoped-borrowed")
      return left.owner === right.owner && left.region === right.region && left.mode === right.mode;
    if (left.kind !== "formal-borrowed" || right.kind !== "formal-borrowed") return false;
    if (left.executionOwner !== right.executionOwner || left.mode !== right.mode || left.region.kind !== right.region.kind) return false;
    if (left.region.kind === "input-duration" && right.region.kind === "input-duration")
      return left.region.parameter === right.region.parameter;
    if (left.region.kind !== "type-argument" || right.region.kind !== "type-argument") return false;
    const types = source.semantics.forNode(left.value.node).types;
    return left.region.declaration === right.region.declaration &&
      left.region.binding.declaration === right.region.binding.declaration &&
      types.isIdentical(left.region.binding.parameterType, right.region.binding.parameterType) &&
      types.isIdentical(left.region.binding.argumentType, right.region.binding.argumentType);
  }

  function samePending(left: SourcePendingOperation, right: SourcePendingOperation): boolean {
    return left === right || left.operation === right.operation && left.expression === right.expression &&
      left.bindings === right.bindings && left.contracts.length === right.contracts.length &&
      left.contracts.every(contract => right.contracts.some(candidate => budget.step() &&
        contract.value === candidate.value && contract.contractDeclaration === candidate.contractDeclaration &&
        source.semantics.forNode(contract.value.node).types.isIdentical(contract.checkedType, candidate.checkedType)));
  }

  function sameDependency(left: SourceContinuationDependency, right: SourceContinuationDependency): boolean {
    return left.reference === right.reference && left.candidate === right.candidate && left.actual === right.actual &&
      samePending(left.suspension, right.suspension) && sameRetention(left.retention, right.retention);
  }

  function merge<Value>(left: readonly Value[], right: readonly Value[], matches: (left: Value, right: Value) => boolean,
    selectedBudget: SourceOwnershipBudget): readonly Value[] | undefined {
    const values = [...left];
    for (const value of right) {
      if (!selectedBudget.step()) return undefined;
      if (!values.some(existing => selectedBudget.step() && matches(existing, value))) values.push(value);
      if (selectedBudget.failure() !== undefined) return undefined;
    }
    if (!selectedBudget.createRows().add(1 + values.length)) return undefined;
    return Object.freeze(values);
  }

  function join(left: Closure, right: Closure, selectedBudget: SourceOwnershipBudget): Closure | undefined {
    const reads = merge(left.reads, right.reads, sameRead, selectedBudget);
    const results = merge(left.results, right.results, sameRead, selectedBudget);
    const dependencies = merge(left.dependencies, right.dependencies, sameDependency, selectedBudget);
    return reads === undefined || results === undefined || dependencies === undefined ? undefined
      : Object.freeze({ kind: "resolved", reads, results, dependencies, maySuspend: left.maySuspend || right.maySuspend });
  }

  function equal(left: Closure, right: Closure): boolean {
    return left.maySuspend === right.maySuspend && left.reads.length === right.reads.length &&
      left.results.length === right.results.length && left.dependencies.length === right.dependencies.length;
  }

  return Object.freeze({
    forInvocation(call: Node, bindings: SourceStorageBindings = storage.emptyBindings): SourceContinuationClosureSelection {
      if (inputRows !== undefined) return sourceOwnershipUnresolved(call, "A continuation query cannot publish an unfinished reentrant component.");
      failure = undefined;
      if (!budget.step()) return sourceOwnershipUnresolved(call, budget.failure()!);
      const vertex = vertexFor(call, bindings);
      if (vertex === undefined) return failure ?? sourceOwnershipUnresolved(call, budget.failure()!);
      const cached = completed.get(vertex);
      if (cached !== undefined) return cached;
      staged = new Map();
      stagedRows = [];
      inputRows = [];
      let published = false;
      try {
        const value = select(vertex)?.get(vertex);
        if (value === undefined || budget.failure() !== undefined) {
          return failure ?? sourceOwnershipUnresolved(call, budget.failure() ?? "Continuation closure has no complete bounded component summary.");
        }
        for (const [selected, result] of staged) completed.set(selected, result);
        completedRows.push(...stagedRows);
        published = true;
        return value;
      } finally {
        for (const selected of inputRows) selected.release();
        inputRows = undefined;
        if (!published) for (const selected of stagedRows) selected.release();
        stagedRows = [];
        staged.clear();
      }
    },
  });
}
