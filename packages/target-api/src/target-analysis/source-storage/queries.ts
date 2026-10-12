import type { Node, SourceFile } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../source-semantics/index.js";
import { sourceStorageSubjectType } from "./components.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "./resource-budget.js";
import { createSourceStorageTransport } from "./transport.js";
import { createSourceStorageDomains } from "./domains.js";
import type { SourceStorageSubject } from "./subjects.js";
import { sourceStorageHasOriginalCallableValue, sourceStorageHasOriginalValue, sourceStorageIsDataMember, sourceStorageMemberSubject } from "./subjects.js";
import type { SourceStorageSubstitutions } from "./substitutions.js";
import type {
  SourceStorageBindings, SourceStorageEffects, SourceStorageLimits, SourceStorageQueries, SourceStorageSubjectsSelection, SourceStorageOriginsSelection,
  SourceStorageSubjectSelection, SourceStorageTypedSubject, SourceStorageUnresolved, SourceStorageProducer, SourceStorageValueFrontier,
  SourceStorageBoundActivation,
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
  const bindingStates = new WeakMap<SourceStorageBindings, readonly SourceStorageSubstitutions[]>();
  const bindingViews = new Map<string, SourceStorageBindings>();
  const bindingRows = budget.createRows();
  const frontierBoundaries = new WeakMap<readonly SourceStorageSubject[], ReadonlySet<SourceStorageSubject>>();
  const frontierRows = budget.createRows();
  let declarations: ReadonlySet<Node> | undefined;
  const unresolved = (reason: string): SourceStorageUnresolved => Object.freeze({ kind: "unresolved", reason });
  const checkedNode = (node: Node): boolean => {
    if (!budget.step()) return false;
    const file = source.ast.getSourceFile(node);
    return file !== undefined && source.semantics.includes(file);
  };
  const checkedDeclaration = (declaration: Node): boolean => {
    if (declarations === undefined) {
      if (!bindingRows.add(1 + transport.visitedNodes.length)) return false;
      declarations = new Set(transport.visitedNodes);
    }
    if (!declarations.has(declaration) || !checkedNode(declaration)) return false;
    const ast = source.ast;
    return ast.is.IsClassDeclaration(declaration) || ast.is.IsClassExpression(declaration) ||
      ast.is.IsFunctionDeclaration(declaration) || ast.is.IsFunctionExpression(declaration) ||
      ast.is.IsArrowFunction(declaration) || ast.is.IsMethodDeclaration(declaration) ||
      ast.is.IsConstructorDeclaration(declaration) || ast.is.IsGetAccessorDeclaration(declaration) ||
      ast.is.IsSetAccessorDeclaration(declaration);
  };
  const selectedSubject = (subject: SourceStorageSubject | undefined): SourceStorageSubjectSelection => {
    if (budget.failure() !== undefined) return unresolved(budget.failure()!);
    if (subject === undefined) return unresolved("A source storage query has no exact checked subject.");
    if (subject.projection.length !== 0 && sourceStorageSubjectType(source, subject, transport.sourceFileFor(subject)) === undefined)
      return unresolved("A source storage projection has no exact checked component type.");
    return Object.freeze({ kind: "resolved", subject });
  };
  const subjectReason = (subject: SourceStorageSubject): string | undefined => {
    if (!budget.step()) return budget.failure();
    if (!transport.identities.has(subject)) return "A source storage subject belongs to a different transport graph.";
    if (subject.projection.length !== 0 && sourceStorageSubjectType(source, subject, transport.sourceFileFor(subject)) === undefined)
      return "A source storage projection has no exact checked component type.";
    return undefined;
  };
  const ancestryReason = (subject: SourceStorageSubject): string | undefined =>
    subjectReason(subject) ?? transport.unresolvedFor(subject) ?? budget.failure();
  const selectedSubjects = (subjects: Iterable<SourceStorageSubject> | undefined): SourceStorageSubjectsSelection => {
    if (subjects === undefined || budget.failure() !== undefined)
      return unresolved(budget.failure() ?? "Source storage ancestry has no exact bounded selection.");
    return Object.freeze({ kind: "resolved", subjects: Object.freeze([...subjects]) });
  };
  const bindingView = (states: Iterable<SourceStorageSubstitutions>): SourceStorageBindings | undefined => {
    const selected = [...new Set(states)].map(state => ({ state, identity: transport.substitutions.identityFor(state) }));
    if (selected.length === 0 || selected.some(value => value.identity === undefined)) return undefined;
    selected.sort((left, right) => left.identity! - right.identity!);
    const key = selected.map(value => value.identity).join(",");
    const existing = bindingViews.get(key);
    if (existing !== undefined) return existing;
    const subjects = new Map<SourceStorageSubject, Set<SourceStorageSubject>>();
    for (const { state } of selected) for (const formal of transport.substitutions.formals(state) ?? []) {
      if (!budget.step()) return undefined;
      const actuals = subjects.get(formal) ?? new Set<SourceStorageSubject>();
      const originals = transport.substitutions.origins(formal, state);
      if (originals === undefined) return undefined;
      for (const actual of originals) {
        if (!budget.step()) return undefined;
        actuals.add(actual);
      }
      subjects.set(formal, actuals);
    }
    const cost = 2 + selected.length + subjects.size + [...subjects.values()].reduce((count, actuals) => count + actuals.size, 0);
    if (budget.failure() !== undefined || !bindingRows.add(cost)) return undefined;
    const substitutions = [...subjects].map(([formal, actuals]) => Object.freeze({ formal, actuals: Object.freeze([...actuals]) }));
    const view = Object.freeze({ substitutions: Object.freeze(substitutions) });
    bindingStates.set(view, Object.freeze(selected.map(value => value.state)));
    bindingViews.set(key, view);
    return view;
  };
  const emptyBindings: SourceStorageBindings = Object.freeze({ substitutions: Object.freeze([]) });
  bindingStates.set(emptyBindings, Object.freeze([transport.substitutions.empty]));
  bindingViews.set("0", emptyBindings);
  const checkedInvocation = (node: Node): boolean => checkedNode(node) &&
    (transport.invocations.has(node) || transport.accessorTargets.has(node));
  const checkedCandidate = (candidate: Node, invocation: Node): boolean => {
    if (!checkedNode(candidate) || !checkedInvocation(invocation)) return false;
    if (transport.invocationImplementations(invocation).has(candidate)) return true;
    if (transport.invocationDeclarations.get(invocation) === candidate) return true;
    return source.ast.is.IsNewExpression(invocation) && transport.regions.instance(invocation).some(region => region.owner === candidate);
  };
  const boundOrigins = (subject: SourceStorageSubject, bindings: SourceStorageBindings): SourceStorageSubjectsSelection => {
    const reason = ancestryReason(subject);
    if (reason !== undefined) return unresolved(reason);
    const states = bindingStates.get(bindings);
    if (states === undefined) return unresolved("Invocation substitutions belong to a different source storage query.");
    const subjects = new Set<SourceStorageSubject>();
    for (const state of states) {
      const originals = transport.substitutions.origins(subject, state);
      if (originals === undefined) return unresolved(budget.failure() ?? "Source storage has no completed bound-origin selection.");
      for (const actual of originals) {
        if (!budget.step()) return unresolved(budget.failure()!);
        subjects.add(actual);
      }
    }
    return selectedSubjects(subjects);
  };
  const originSubjectsFor: SourceStorageQueries["originSubjectsFor"] = subject => {
    const reason = ancestryReason(subject);
    if (reason !== undefined) return unresolved(reason);
    const ancestors = transport.ancestorSubjects(subject);
    if (ancestors === undefined || budget.failure() !== undefined)
      return unresolved(budget.failure() ?? "Source storage ancestry exceeds its finite query budget.");
    const origins: SourceStorageSubject[] = [];
    let terminal = false;
    for (const owner of ancestors) {
      if (!budget.step()) return unresolved(budget.failure()!);
      const parents = transport.incomingFor(owner);
      if (parents.size === 0) terminal = true;
      if (sourceStorageHasOriginalValue(owner, source.ast, parents.size !== 0)) origins.push(owner);
    }
    return origins.length === 0 && !terminal
      ? unresolved("A source storage cycle has no proven original owner.") : selectedSubjects(origins);
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
  const selectDomain = (subject: SourceStorageSubject, bindings: SourceStorageBindings,
    purpose: "values" | "storage-producers") => {
    const reason = ancestryReason(subject);
    if (reason !== undefined) return unresolved(reason);
    const states = bindingStates.get(bindings);
    if (states === undefined) return unresolved("Invocation substitutions belong to a different source storage query.");
    const subjects = new Set<SourceStorageSubject>();
    const boundaries = new Set<ReturnType<typeof domains.select>["boundaries"][number]>();
    const producerStates = new Map<SourceStorageSubject, Set<SourceStorageSubstitutions>>();
    for (const state of states) {
      if (!budget.step()) return unresolved(budget.failure()!);
      const selected = domains.select(subject, state, purpose);
      if (selected.reason !== undefined) return unresolved(selected.reason);
      for (const origin of selected.subjects) { if (!budget.step()) return unresolved(budget.failure()!); subjects.add(origin); }
      if (purpose === "storage-producers") for (const origin of selected.boundSubjects) {
        if (!budget.step()) return unresolved(budget.failure()!);
        const states = producerStates.get(origin.subject) ?? new Set<SourceStorageSubstitutions>();
        states.add(origin.bindings);
        producerStates.set(origin.subject, states);
      }
      for (const boundary of selected.boundaries) { if (!budget.step()) return unresolved(budget.failure()!); boundaries.add(boundary); }
    }
    if (budget.failure() !== undefined) return unresolved(budget.failure()!);
    if (subjects.size === 0) return unresolved("A source storage cycle has no proven original owner.");
    const origins = typedOrigins([...subjects]);
    if (origins.kind === "unresolved") return origins;
    return boundaries.size === 0 ? Object.freeze({ kind: "complete" as const, origins: origins.origins, producerStates })
      : Object.freeze({ kind: "open" as const, origins: origins.origins, producerStates, boundaries: Object.freeze([...boundaries]) });
  };
  const closedOriginsFor: SourceStorageQueries["closedOriginsFor"] = (subject, bindings = emptyBindings) => {
    const selected = selectDomain(subject, bindings, "values");
    return selected.kind === "unresolved" ? selected : selected.kind === "complete"
      ? Object.freeze({ kind: "complete", origins: selected.origins })
      : Object.freeze({ kind: "open", origins: selected.origins, boundaries: selected.boundaries });
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
    subject(node, kind, projection) {
      if (kind !== undefined && kind !== "input" && kind !== "value" && kind !== "member" && kind !== "return" && kind !== "receiver")
        return unresolved("A source storage subject requires an exact input, value, member, return or receiver kind.");
      return selectedSubject(checkedNode(node) ? transport.subject(node, kind, projection) : undefined);
    },
    subjectFor(node) {
      return selectedSubject(checkedNode(node) ? transport.subjectFor(node) : undefined);
    },
    memberSubjectFor(node) {
      const ast = source.ast;
      const member = checkedNode(node) && (sourceStorageIsDataMember(node, ast) || ast.is.IsGetAccessorDeclaration(node) ||
        ast.is.IsSetAccessorDeclaration(node) || ast.is.IsMethodDeclaration(node) || ast.is.IsMethodSignatureDeclaration(node));
      return selectedSubject(member ? sourceStorageMemberSubject(node, ast, transport.subject) : undefined);
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
      const reason = subjectReason(subject) ?? transport.directlyUnresolvedFor(subject);
      return reason === undefined ? selectedSubjects(transport.incomingFor(subject)) : unresolved(reason);
    },
    ancestorsFor(subject) {
      const reason = ancestryReason(subject);
      return reason === undefined ? selectedSubjects(transport.ancestorSubjects(subject)) : unresolved(reason);
    },
    originSubjectsFor,
    originsFor(subject) {
      const selected = originSubjectsFor(subject);
      if (selected.kind === "unresolved") return selected;
      return typedOrigins(selected.subjects);
    },
    closedOriginsFor,
    storageProducersFor(subject, bindings = emptyBindings) {
      return budget.withRows(rows => {
      const selected = selectDomain(subject, bindings, "storage-producers");
      if (selected.kind === "unresolved") return selected;
      const producers: SourceStorageProducer[] = [];
      for (const origin of selected.origins) {
        const states = selected.producerStates.get(origin.subject);
        if (states === undefined || states.size === 0) return unresolved("A source storage producer lost its exact lexical activation.");
        for (const state of states) {
          if (!budget.step() || !rows.add(1)) return unresolved(budget.failure()!);
          const bindings = bindingView([state]);
          if (bindings === undefined) return unresolved(budget.failure() ?? "A source storage producer has no owned activation bindings.");
          producers.push(Object.freeze({ ...origin, bindings }));
        }
      }
      return selected.kind === "complete"
        ? Object.freeze({ kind: "complete", producers: Object.freeze(producers) })
        : Object.freeze({ kind: "open", producers: Object.freeze(producers), boundaries: selected.boundaries });
      });
    },
    localCallableCreationsFor(expression) {
      const subject = checkedNode(expression) ? transport.subjectFor(expression) : undefined;
      if (subject === undefined) return unresolved(budget.failure() ?? "Callable creation requires its exact checked expression.");
      const origins = closedOriginsFor(subject);
      if (origins.kind !== "complete") return origins.kind === "unresolved" ? origins
        : unresolved("An open callable domain cannot prove local creation.");
      const nodes: Node[] = [];
      for (const origin of origins.origins) {
        if (!budget.step()) return unresolved(budget.failure()!);
        if (!sourceStorageHasOriginalCallableValue(origin.subject, source.ast))
          return unresolved("Local callable creation requires an original unprojected implementation.");
        let current: Node | undefined = origin.subject.node;
        const visited = new Set<Node>();
        while (current !== undefined && current !== expression && !visited.has(current)) {
          if (!budget.step()) return unresolved(budget.failure()!);
          visited.add(current);
          current = source.ast.parent(current);
        }
        if (current !== expression) return unresolved("A callable origin was not created within the selected expression.");
        nodes.push(origin.subject.node);
      }
      return Object.freeze({ kind: "resolved", nodes: Object.freeze(nodes) });
    },
    unresolvedFor: ancestryReason,
    invocationImplementationsFor(invocation, bindings) {
      if (!checkedInvocation(invocation)) return unresolved(budget.failure() ?? "An invocation has no checked source transport.");
      const states = bindings === undefined ? undefined : bindingStates.get(bindings);
      if (bindings !== undefined && states === undefined)
        return unresolved("Invocation substitutions belong to a different source storage query.");
      const nodes = new Set<Node>();
      if (states === undefined) for (const node of transport.invocationImplementations(invocation)) nodes.add(node);
      else for (const state of states) for (const node of transport.invocationImplementations(invocation,
        origin => transport.substitutions.origins(origin, state))) {
        if (!budget.step()) return unresolved(budget.failure()!);
        nodes.add(node);
      }
      return budget.failure() !== undefined ? unresolved(budget.failure()!)
        : Object.freeze({ kind: "resolved", nodes: Object.freeze([...nodes]) });
    },
    invocationOriginsFor(subject, candidate, invocation) {
      const reason = ancestryReason(subject);
      if (reason !== undefined) return unresolved(reason);
      if (!checkedCandidate(candidate, invocation))
        return unresolved(budget.failure() ?? "Invocation substitution requires its exact selected implementation.");
      const transportReason = transport.unresolvedInvocations.get(invocation);
      if (transportReason !== undefined) return unresolved(transportReason);
      return selectedSubjects(transport.invocationOrigins(subject, candidate, invocation));
    },
    bindingsForDeclaration(declaration, parent = emptyBindings) {
      const states = bindingStates.get(parent);
      if (states === undefined) return unresolved("Invocation substitutions belong to a different source storage query.");
      if (!checkedDeclaration(declaration))
        return unresolved(budget.failure() ?? "Declaration substitution requires an exact checked callable or class owner.");
      const selected: SourceStorageSubstitutions[] = [];
      for (const state of states) {
        const binding = transport.substitutions.forDeclaration(declaration, state);
        if (binding === undefined) return unresolved(budget.failure() ?? "Declaration substitution has no bounded context.");
        selected.push(binding);
      }
      const view = bindingView(selected);
      return view === undefined || budget.failure() !== undefined
        ? unresolved(budget.failure() ?? "Declaration substitution exceeds its finite context budget.")
        : Object.freeze({ kind: "resolved", bindings: view });
    },
    bindingsForInvocation(candidate, invocation, parent = emptyBindings) {
      const states = bindingStates.get(parent);
      if (states === undefined) return unresolved("Invocation substitutions belong to a different source storage query.");
      if (!checkedCandidate(candidate, invocation))
        return unresolved(budget.failure() ?? "Invocation substitution requires its exact selected implementation.");
      const transportReason = transport.unresolvedInvocations.get(invocation);
      if (transportReason !== undefined) return unresolved(transportReason);
      const selected = new Set<SourceStorageSubstitutions>();
      for (const state of states) for (const binding of transport.invocationResults.forInvocation(candidate, invocation, state)) {
        if (!budget.step()) return unresolved(budget.failure()!);
        selected.add(binding);
      }
      const view = budget.failure() === undefined ? bindingView(selected) : undefined;
      return view === undefined || budget.failure() !== undefined
        ? unresolved(budget.failure() ?? "Invocation substitution exceeds its finite context budget.")
        : Object.freeze({ kind: "resolved", bindings: view });
    },
    boundOriginsFor: boundOrigins,
    boundActivationsFor(declaration, bindings) {
      return budget.withRows(rows => {
        const states = bindingStates.get(bindings);
        if (states === undefined) return unresolved("Invocation substitutions belong to a different source storage query.");
        if (!checkedDeclaration(declaration)) return unresolved(budget.failure() ?? "An activation requires its exact checked declaration.");
        const activations: SourceStorageBoundActivation[] = [];
        const seen = new Set<SourceStorageSubstitutions>();
        for (const state of states) {
          if (!budget.step()) return unresolved(budget.failure()!);
          const selected = transport.substitutions.boundActivation(state, declaration);
          if (selected === undefined) return unresolved(budget.failure() ?? "Source storage has no exact owning activation for this declaration.");
          if (seen.has(selected.scope)) continue;
          if (!rows.add(2)) return unresolved(budget.failure()!);
          seen.add(selected.scope);
          const owned = bindingView([selected.scope]);
          if (owned === undefined) return unresolved(budget.failure() ?? "An activation requires its retained declaration bindings.");
          if (selected.invocation === undefined) activations.push(Object.freeze({ kind: "declaration", declaration, bindings: owned }));
          else {
            const caller = selected.caller === undefined ? undefined : bindingView([selected.caller]);
            if (caller === undefined) return unresolved(budget.failure() ?? "An invocation activation requires exact caller bindings.");
            activations.push(Object.freeze({ kind: "invocation", declaration, invocation: selected.invocation,
              bindings: owned, callerBindings: caller }));
          }
        }
        return budget.failure() !== undefined ? unresolved(budget.failure()!)
          : Object.freeze({ kind: "resolved", activations: Object.freeze(activations) });
      });
    },
    boundValueFrontierFor(subject, bindings, boundaries, position = "value") {
      return budget.withRows(rows => {
        const reason = subjectReason(subject);
        if (reason !== undefined) return unresolved(reason);
        const states = bindingStates.get(bindings);
        if (states === undefined) return unresolved("Invocation substitutions belong to a different source storage query.");
        if (position !== "value" && position !== "input" || !Array.isArray(boundaries))
          return unresolved("A source value frontier requires an exact position and owned boundary subjects.");
        let stops = frontierBoundaries.get(boundaries);
        if (stops === undefined) {
          const selected = new Set<SourceStorageSubject>();
          for (let index = 0; index < boundaries.length; index += 1) {
            if (!budget.step() || !rows.add(1)) return unresolved(budget.failure()!);
            const descriptor = Object.getOwnPropertyDescriptor(boundaries, String(index));
            const boundary = descriptor === undefined || descriptor.get !== undefined || descriptor.set !== undefined
              ? undefined : descriptor.value as SourceStorageSubject | undefined;
            const invalid = boundary === undefined ? "A source value frontier boundary is not an owned subject." : subjectReason(boundary);
            if (invalid !== undefined) return unresolved(invalid);
            selected.add(boundary!);
          }
          stops = selected;
          if (Object.isFrozen(boundaries)) {
            if (!frontierRows.add(1 + stops.size)) return unresolved(budget.failure()!);
            frontierBoundaries.set(boundaries, stops);
          }
        }
        const frontier: SourceStorageValueFrontier[] = [];
        for (const state of states) {
          if (!budget.step()) return unresolved(budget.failure()!);
          const selected = transport.substitutions.frontier(subject, state, stops, position);
          if (selected === undefined || selected.reason !== undefined)
            return unresolved(selected?.reason ?? budget.failure() ?? "Source value transport has no completed frontier.");
          for (const current of selected.subjects) {
            if (!budget.step() || !rows.add(1)) return unresolved(budget.failure()!);
            const retained = bindingView([current.bindings]);
            if (retained === undefined) return unresolved(budget.failure() ?? "Source value transport lost its activation bindings.");
            frontier.push(Object.freeze({ kind: current.kind, subject: current.subject, bindings: retained }));
          }
        }
        return budget.failure() !== undefined ? unresolved(budget.failure()!) : frontier.length === 0
          ? unresolved("A source value transport cycle has no proven frontier.")
          : Object.freeze({ kind: "resolved", frontier: Object.freeze(frontier) });
      });
    },
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
