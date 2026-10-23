import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../../source-semantics/index.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageCallEffect } from "../model/types.js";
import type { SourceStorageSubject } from "../model/subjects.js";
import type { SourceStorageActivation, SourceStorageReduction, SourceStorageScope, SourceStorageTerm } from "../graph/scoped-model.js";
import { sourceStorageReference } from "../graph/scoped-model.js";
import type { SourceStorageScopedTransport } from "../scoped/scoped-transport.js";
import type { SourceStorageScopes } from "../scoped/scoped-scopes.js";
import { sourceStorageExecutionDemands, walkSourceStorageExecution } from "../scoped/execution-reachability.js";

export function createSourceStorageGeneratorResumes(source: TargetSourceProgram, budget: SourceStorageBudget,
  queries: {
    readonly invocationEffects: ReadonlyMap<Node, SourceStorageCallEffect>;
    subjectFor(node: Node): SourceStorageSubject | undefined;
    originsFor(subject: SourceStorageSubject): Iterable<SourceStorageSubject> | undefined;
    implementationsFor(invocation: Node): ReadonlySet<Node> | undefined;
  }) {
  return (invocation: Node): ReadonlySet<Node> | undefined => budget.withRows(rows => {
    const result = new Set<Node>();
    if (queries.invocationEffects.get(invocation)?.resumeReceiver !== true) return result;
    const receiver = source.semantics.forNode(invocation).operations.call(invocation)?.sourceReceiver?.expression;
    const selected = receiver === undefined ? undefined : queries.subjectFor(receiver);
    const origins = selected === undefined ? undefined : queries.originsFor(selected);
    if (origins === undefined) return undefined;
    for (const origin of origins) {
      if (!budget.step()) return undefined;
      if (origin.kind !== "value" || origin.projection.length !== 0 || !source.ast.is.IsCallExpression(origin.node)) continue;
      const implementations = queries.implementationsFor(origin.node);
      if (implementations === undefined) return undefined;
      for (const candidate of implementations) {
        if (!budget.step()) return undefined;
        if (source.semantics.forNode(candidate).operations.generator(candidate) === undefined || result.has(candidate)) continue;
        if (!rows.add(1)) return undefined;
        result.add(candidate);
      }
    }
    return result;
  });
}

export function createSourceStorageGeneratorInputs(source: TargetSourceProgram, budget: SourceStorageBudget,
  transport: SourceStorageScopedTransport, scopes: SourceStorageScopes, queries: {
    read(term: SourceStorageTerm): ReadonlySet<SourceStorageTerm> | undefined;
    birth(subject: SourceStorageSubject, scope: SourceStorageScope): SourceStorageActivation | undefined;
  }) {
  const throws = [...transport.invocationEffects].filter(([, effect]) => effect.throwInput !== undefined);
  const empty: SourceStorageTerm = Object.freeze({ kind: "empty", absence: undefined });
  return (term: Extract<SourceStorageTerm, { readonly kind: "generator-inputs" }>): SourceStorageReduction | undefined => {
    if (term.original.kind !== "leaf") return { kind: "project", inputs: [term.original], select: original =>
      original.kind === "empty" ? [original] : [Object.freeze({ ...term, original })] };
    const original = term.original;
    const node = original.subject.node;
    const implementations = transport.pointerInvocations.has(node) ? transport.pointerAccessors(node) : transport.invocationImplementations(node);
    if (implementations === undefined) return undefined;
    const candidates = original.subject.kind !== "value" || original.subject.projection.length !== 0 || !source.ast.is.IsCallExpression(node) ? []
      : [...implementations].filter(candidate => source.semantics.forNode(candidate).operations.generator(candidate) !== undefined &&
        scopes.boundActivation(original.scope, candidate)?.invocation === node);
    const expected = queries.birth(original.subject, original.scope);
    if (candidates.length === 0 || expected === undefined || !expected.closed)
      return { kind: "replace", terms: [Object.freeze({ kind: "unresolved", subject: original.subject, scope: original.scope,
        reason: "Generator throw inputs require the original checked creation and its completed scoped birth." })] };
    const terms: SourceStorageTerm[] = [empty];
    for (const [invocation, effect] of throws) {
      if (!budget.step()) return undefined;
      const call = source.semantics.forNode(invocation).operations.call(invocation);
      const receiver = transport.subjectFor(call?.sourceReceiver?.expression);
      const bindings = call?.sourceArgumentBindings.filter(binding => binding.sourceParameterIndex === effect.throwInput);
      const binding = bindings?.length === 1 ? bindings[0] : undefined;
      const argument = binding?.sourceForm === "value" && binding.sourceParameterForm === "parameter"
        ? transport.subjectFor(call?.sourceArguments[binding.sourceArgumentIndex]?.expression) : undefined;
      if (receiver === undefined || argument === undefined) {
        terms.push(Object.freeze({ kind: "unresolved", subject: original.subject, scope: original.scope, exposure: invocation,
          reason: "A generator throw input requires its exact checked receiver and scalar argument." }));
        continue;
      }
      const roots = sourceStorageExecutionDemands(transport, scopes, budget, invocation, undefined, true);
      if (roots === undefined) return undefined;
      for (const execution of walkSourceStorageExecution(budget, roots, queries.read)) {
        if (!budget.step()) return undefined;
        if (execution.kind === "unresolved") { terms.push(execution); continue; }
        if (execution.kind !== "leaf" || execution.subject.node !== invocation) continue;
        const receivers = queries.read(sourceStorageReference(receiver, execution.scope));
        if (receivers === undefined) return undefined;
        for (const selected of receivers) {
          if (!budget.step()) return undefined;
          if (selected.kind === "unresolved") { terms.push(selected); continue; }
          if (selected.kind !== "leaf") continue;
          const actual = queries.birth(selected.subject, selected.scope);
          if (actual === undefined) return undefined;
          if (actual.key !== expected.key) continue;
          if (!actual.closed) {
            terms.push(Object.freeze({ kind: "unresolved", subject: original.subject, scope: original.scope, exposure: invocation,
              reason: "A generator throw receiver has no completed original creation correspondence." }));
            continue;
          }
          terms.push(sourceStorageReference(argument, execution.scope));
        }
      }
    }
    return { kind: "replace", terms };
  };
}
