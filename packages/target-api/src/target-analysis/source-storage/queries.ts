import type { Node, SourceFile } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../source-semantics/index.js";
import { sourceStorageSubjectType } from "./components.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "./resource-budget.js";
import { createSourceStorageTransport } from "./transport.js";
import { createSourceStorageDomains } from "./domains.js";
import type { SourceStorageSubject } from "./subjects.js";
import type { SourceStorageSubstitutions } from "./substitutions.js";
import type {
  SourceStorageBindings, SourceStorageEffects, SourceStorageLimits, SourceStorageQueries, SourceStorageSubjectsSelection, SourceStorageOriginsSelection,
  SourceStorageSubjectSelection, SourceStorageTypedSubject, SourceStorageUnresolved,
} from "./types.js";

export function createSourceStorageQuery(
  source: TargetSourceProgram,
  sourceFiles: readonly SourceFile[],
  limits: SourceStorageLimits = defaultSourceStorageLimits,
  effects: SourceStorageEffects = {},
): SourceStorageQueries {
  const budget = createSourceStorageBudget(limits);
  const transport = createSourceStorageTransport(source, sourceFiles, budget, effects);
  const domains = createSourceStorageDomains(source, transport, budget);
  const bindingStates = new WeakMap<SourceStorageBindings, SourceStorageSubstitutions>();
  const bindingViews = new Map<SourceStorageSubstitutions, SourceStorageBindings>();
  const unresolved = (reason: string): SourceStorageUnresolved => Object.freeze({ kind: "unresolved", reason });
  const checkedNode = (node: Node): boolean => {
    if (!budget.step()) return false;
    const file = source.ast.getSourceFile(node);
    return file !== undefined && source.semantics.includes(file);
  };
  const selectedSubject = (subject: SourceStorageSubject | undefined): SourceStorageSubjectSelection => {
    if (budget.failure() !== undefined) return unresolved(budget.failure()!);
    if (subject === undefined) return unresolved("A source storage query has no exact checked subject.");
    if (subject.projection.length !== 0 && sourceStorageSubjectType(source, subject, transport.sourceFileFor(subject)) === undefined)
      return unresolved("A source storage projection has no exact checked component type.");
    return Object.freeze({ kind: "resolved", subject });
  };
  const subjectReason = (subject: SourceStorageSubject): string | undefined => {
    if (budget.failure() !== undefined) return budget.failure();
    if (!transport.identities.has(subject)) return "A source storage subject belongs to a different transport graph.";
    if (subject.projection.length !== 0 && sourceStorageSubjectType(source, subject, transport.sourceFileFor(subject)) === undefined)
      return "A source storage projection has no exact checked component type.";
    return transport.unresolvedFor(subject) ?? budget.failure();
  };
  const selectedSubjects = (subjects: Iterable<SourceStorageSubject> | undefined): SourceStorageSubjectsSelection => {
    if (subjects === undefined || budget.failure() !== undefined)
      return unresolved(budget.failure() ?? "Source storage ancestry has no exact bounded selection.");
    return Object.freeze({ kind: "resolved", subjects: Object.freeze([...subjects]) });
  };
  const bindingView = (state: SourceStorageSubstitutions): SourceStorageBindings => {
    const existing = bindingViews.get(state);
    if (existing !== undefined) return existing;
    const substitutions = [...state].map(([formal, selection]) => Object.freeze({ formal, actuals: Object.freeze([...selection.actuals]) }));
    const view = Object.freeze({ substitutions: Object.freeze(substitutions) });
    bindingStates.set(view, state);
    bindingViews.set(state, view);
    return view;
  };
  const emptyBindings = bindingView(transport.substitutions.empty);
  const checkedInvocation = (node: Node): boolean => checkedNode(node) &&
    (transport.invocations.has(node) || transport.accessorTargets.has(node));
  const checkedCandidate = (candidate: Node, invocation: Node): boolean => {
    if (!checkedNode(candidate) || !checkedInvocation(invocation)) return false;
    if (transport.invocationImplementations(invocation).has(candidate)) return true;
    if (transport.invocationDeclarations.get(invocation) === candidate) return true;
    return source.ast.is.IsNewExpression(invocation) && transport.regions.instance(invocation).some(region => region.owner === candidate);
  };
  const boundOrigins = (subject: SourceStorageSubject, bindings: SourceStorageBindings): SourceStorageSubjectsSelection => {
    const reason = subjectReason(subject);
    if (reason !== undefined) return unresolved(reason);
    const state = bindingStates.get(bindings);
    if (state === undefined) return unresolved("Invocation substitutions belong to a different source storage query.");
    return selectedSubjects(transport.substitutions.origins(subject, state));
  };
  const originSubjectsFor: SourceStorageQueries["originSubjectsFor"] = subject => {
    const reason = subjectReason(subject);
    if (reason !== undefined) return unresolved(reason);
    const ancestors = transport.ancestorSubjects(subject);
    if (ancestors === undefined || budget.failure() !== undefined)
      return unresolved(budget.failure() ?? "Source storage ancestry exceeds its finite query budget.");
    const origins = [...ancestors].filter(owner => transport.incomingFor(owner).size === 0);
    return origins.length === 0 ? unresolved("A source storage cycle has no proven original owner.") : selectedSubjects(origins);
  };
  const typedOrigins = (subjects: readonly SourceStorageSubject[]): SourceStorageOriginsSelection => {
    const origins: SourceStorageTypedSubject[] = [];
    for (const origin of subjects) {
      if (!budget.step()) return unresolved(budget.failure()!);
      const sourceFile = transport.sourceFileFor(origin);
      const type = sourceStorageSubjectType(source, origin, sourceFile);
      if (type === undefined || sourceFile === undefined) return unresolved("A source storage origin has no exact checked component type.");
      origins.push(Object.freeze({ subject: origin, type, sourceFile }));
    }
    return Object.freeze({ kind: "resolved", origins: Object.freeze(origins) });
  };
  return Object.freeze({
    source,
    sourceFiles: Object.freeze([...sourceFiles]),
    nodes: Object.freeze([...transport.visitedNodes]),
    subjects: Object.freeze([...transport.identities]),
    boundaries: Object.freeze([...transport.boundaries]),
    invocations: Object.freeze([...transport.invocations]),
    accessorInvocations: Object.freeze([...transport.accessorTargets.keys()]),
    emptyBindings,
    failureReason: budget.failure,
    subject(node, kind = "value", projection) {
      if (kind !== "value" && kind !== "return" && kind !== "receiver")
        return unresolved("A source storage subject requires an exact value, return or receiver kind.");
      return selectedSubject(checkedNode(node) ? transport.subject(node, kind, projection) : undefined);
    },
    subjectFor(node) {
      return selectedSubject(checkedNode(node) ? transport.subjectFor(node) : undefined);
    },
    storageSubjectFor(node, projection) {
      return selectedSubject(checkedNode(node) ? transport.storageSubject(node, projection) : undefined);
    },
    typeFor(subject) {
      const reason = subjectReason(subject);
      if (reason !== undefined) return unresolved(reason);
      const sourceFile = transport.sourceFileFor(subject);
      const type = sourceStorageSubjectType(source, subject, sourceFile);
      return type === undefined || sourceFile === undefined ? unresolved("A source storage subject has no exact checked component type.")
        : Object.freeze({ kind: "resolved", type, sourceFile });
    },
    incomingFor(subject) {
      const reason = subjectReason(subject);
      return reason === undefined ? selectedSubjects(transport.incomingFor(subject)) : unresolved(reason);
    },
    ancestorsFor(subject) {
      const reason = subjectReason(subject);
      return reason === undefined ? selectedSubjects(transport.ancestorSubjects(subject)) : unresolved(reason);
    },
    originSubjectsFor,
    originsFor(subject) {
      const selected = originSubjectsFor(subject);
      if (selected.kind === "unresolved") return selected;
      return typedOrigins(selected.subjects);
    },
    closedOriginsFor(subject, bindings = emptyBindings) {
      const reason = subjectReason(subject);
      if (reason !== undefined) return unresolved(reason);
      const state = bindingStates.get(bindings);
      if (state === undefined) return unresolved("Invocation substitutions belong to a different source storage query.");
      const selected = domains.select(subject, state);
      if (budget.failure() !== undefined) return unresolved(budget.failure()!);
      if (selected.subjects.length === 0) return unresolved("A source storage cycle has no proven original owner.");
      const origins = typedOrigins(selected.subjects);
      if (origins.kind === "unresolved") return origins;
      return selected.boundaries.length === 0 ? Object.freeze({ kind: "complete", origins: origins.origins })
        : Object.freeze({ kind: "open", origins: origins.origins, boundaries: selected.boundaries });
    },
    unresolvedFor: subjectReason,
    invocationImplementationsFor(invocation, bindings) {
      if (!checkedInvocation(invocation)) return unresolved(budget.failure() ?? "An invocation has no checked source transport.");
      const state = bindings === undefined ? undefined : bindingStates.get(bindings);
      if (bindings !== undefined && state === undefined)
        return unresolved("Invocation substitutions belong to a different source storage query.");
      const nodes = transport.invocationImplementations(invocation, state === undefined ? undefined
        : origin => transport.substitutions.origins(origin, state));
      return budget.failure() !== undefined ? unresolved(budget.failure()!)
        : Object.freeze({ kind: "resolved", nodes: Object.freeze([...nodes]) });
    },
    invocationOriginsFor(subject, candidate, invocation) {
      const reason = subjectReason(subject);
      if (reason !== undefined) return unresolved(reason);
      if (!checkedCandidate(candidate, invocation))
        return unresolved(budget.failure() ?? "Invocation substitution requires its exact selected implementation.");
      const transportReason = transport.unresolvedInvocations.get(invocation);
      if (transportReason !== undefined) return unresolved(transportReason);
      return selectedSubjects(transport.invocationOrigins(subject, candidate, invocation));
    },
    bindingsForInvocation(candidate, invocation, parent = emptyBindings) {
      const state = bindingStates.get(parent);
      if (state === undefined) return unresolved("Invocation substitutions belong to a different source storage query.");
      if (!checkedCandidate(candidate, invocation))
        return unresolved(budget.failure() ?? "Invocation substitution requires its exact selected implementation.");
      const transportReason = transport.unresolvedInvocations.get(invocation);
      if (transportReason !== undefined) return unresolved(transportReason);
      const selected = transport.substitutions.forInvocation(candidate, invocation, state);
      return selected === undefined || budget.failure() !== undefined
        ? unresolved(budget.failure() ?? "Invocation substitution exceeds its finite context budget.")
        : Object.freeze({ kind: "resolved", bindings: bindingView(selected) });
    },
    boundOriginsFor: boundOrigins,
    invocationArgumentsFor(invocation) {
      if (!checkedInvocation(invocation)) return unresolved(budget.failure() ?? "An invocation has no checked source argument transport.");
      return Object.freeze({ kind: "resolved", nodes: transport.invocationArguments.get(invocation) ?? Object.freeze([]) });
    },
    argumentTransportsFor(invocation) {
      if (!checkedInvocation(invocation)) return unresolved(budget.failure() ?? "An invocation has no checked source argument transport.");
      const reason = transport.unresolvedInvocations.get(invocation);
      if (reason !== undefined) return unresolved(reason);
      const arguments_ = transport.argumentTransports.get(invocation);
      return arguments_ === undefined ? unresolved("An accessor does not supply ordinary call argument bindings.")
        : Object.freeze({ kind: "resolved", arguments: arguments_ });
    },
    mutationOwnerFor(node) { return budget.failure() === undefined ? transport.mutationOwners.get(node) : undefined; },
    isAccessorInvocation(node) { return transport.accessorTargets.has(node); },
    executionRegionsFor(candidate, invocation) {
      if (!checkedNode(candidate) || invocation !== undefined && !checkedCandidate(candidate, invocation))
        return unresolved(budget.failure() ?? "An execution region requires exact checked callable ownership.");
      const nodes = transport.regions.callable(candidate, invocation);
      return budget.failure() !== undefined ? unresolved(budget.failure()!)
        : Object.freeze({ kind: "resolved", nodes: Object.freeze([...nodes]) });
    },
    instanceRegionsFor(invocation) {
      if (!checkedInvocation(invocation) || !source.ast.is.IsNewExpression(invocation))
        return unresolved(budget.failure() ?? "Instance execution requires its exact checked constructor invocation.");
      const regions = transport.regions.instance(invocation).map(region => Object.freeze(region));
      return budget.failure() !== undefined ? unresolved(budget.failure()!)
        : Object.freeze({ kind: "resolved", regions: Object.freeze(regions) });
    },
    enclosingRegionFor(node) { return checkedNode(node) ? transport.regions.enclosing(node) : undefined; },
  } satisfies SourceStorageQueries);
}
