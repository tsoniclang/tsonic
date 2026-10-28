import type { Node, SourceFile, Type } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../source-semantics/index.js";
import { sourceStorageSubjectType } from "./model/components.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "./model/resource-budget.js";
import { createSourceStorageTransport } from "./transport/transport.js";
import { createSourceStorageDomains } from "./transport/domains.js";
import { sourceStorageRegionOwner } from "./graph/lexical-regions.js";
import { createSourceStorageConstructionQuery } from "./graph/construction.js";
import type { SourceStorageSubject, SourceStorageProjection } from "./model/subjects.js";
import { sourceStorageHasOriginalCallableValue, sourceStorageHasOriginalValue, sourceStorageIsDataMember, sourceStorageIsMemberProjection, sourceStorageMemberSubject, sourceStorageProjectionPath } from "./model/subjects.js";
import type { SourceStorageScope, SourceStorageProjectionView } from "./graph/scoped-model.js";
import { sourceStorageProjectionType } from "./scoped/projection-views.js";
import { sourceStorageMissingProducerReason } from "./scoped/substitutions.js";
import { createSourceStorageAncestorQuery } from "./graph/ancestors.js";
import { Node_Initializer } from "../../source-navigation/index.js";
import { sourceClassFieldHasStorage, sourceParameterIsProperty } from "../../source-navigation/class-members.js";
import type { SourceStorageBindings, SourceStorageEffects, SourceStorageLimits, SourceStorageQueries, SourceStorageSubjectsSelection, SourceStorageOriginsSelection, SourceStorageSubjectSelection, SourceStorageTypedSubject, SourceStorageUnresolved, SourceStorageProducer, SourceStorageValueFrontier, SourceStorageBoundActivation, SourceStorageBindingsSelection, SourceStorageDomainBoundary, SourceStorageWriteOccurrence } from "./model/types.js";

export function createSourceStorageQuery(
  source: TargetSourceProgram,
  sourceFiles: readonly SourceFile[],
  limits: SourceStorageLimits = defaultSourceStorageLimits,
  effects: SourceStorageEffects = {},
): SourceStorageQueries {
  const budget = createSourceStorageBudget(limits);
  const transport = createSourceStorageTransport(source, sourceFiles, budget, effects);
  const domains = createSourceStorageDomains(source, transport, budget);
  const bindingStates = new WeakMap<SourceStorageBindings, readonly SourceStorageScope[]>();
  const bindingViews = new Map<string, SourceStorageBindings>();
  const bindingRows = budget.createRows();
  const frontierBoundaries = new WeakMap<readonly SourceStorageSubject[], ReadonlySet<SourceStorageSubject>>();
  const frontierRows = budget.createRows();
  const unresolved = (reason: string): SourceStorageUnresolved => Object.freeze({ kind: "unresolved", reason });
  const checkedNode = (node: Node): boolean => {
    if (!budget.step()) return false;
    if (!transport.hasNode(node)) return false;
    const file = source.ast.getSourceFile(node);
    return file !== undefined && source.semantics.includes(file);
  };
  const checkedProjection = (component: SourceStorageProjection): boolean =>
    !sourceStorageIsMemberProjection(component) || checkedNode(component.declaration);
  const checkedDeclaration = (declaration: Node): boolean => {
    if (!transport.hasNode(declaration) || !checkedNode(declaration)) return false;
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
  const bindingView = (states: Iterable<SourceStorageScope>): SourceStorageBindings | undefined => {
    const selected = [...new Set(states)].map(state => ({ state, identity: transport.substitutions.identityFor(state) }));
    if (selected.length === 0 || selected.some(value => value.identity === undefined)) return undefined;
    selected.sort((left, right) => left.identity! - right.identity!);
    const key = selected.map(value => value.identity).join(",");
    const existing = bindingViews.get(key);
    if (existing !== undefined) return existing;
    if (budget.failure() !== undefined || !bindingRows.add(2 + selected.length)) return undefined;
    const view = Object.freeze({ kind: "source-storage-bindings" } satisfies SourceStorageBindings);
    bindingStates.set(view, Object.freeze(selected.map(value => value.state)));
    bindingViews.set(key, view);
    return view;
  };
  const emptyBindings: SourceStorageBindings = Object.freeze({ kind: "source-storage-bindings" });
  bindingStates.set(emptyBindings, Object.freeze([transport.substitutions.empty]));
  bindingViews.set("0", emptyBindings);
  const declarationBindings: SourceStorageQueries["bindingsForDeclaration"] = (declaration, parent = emptyBindings) => {
    const states = bindingStates.get(parent);
    if (states === undefined) return unresolved("Invocation substitutions belong to a different source storage query.");
    if (!checkedDeclaration(declaration))
      return unresolved(budget.failure() ?? "Declaration substitution requires an exact checked callable or class owner.");
    const selected: SourceStorageScope[] = [];
    for (const state of states) {
      const binding = transport.substitutions.forDeclaration(declaration, state);
      if (binding === undefined) return unresolved(budget.failure() ?? "Declaration substitution has no bounded context.");
      selected.push(binding);
    }
    const view = bindingView(selected);
    return view === undefined || budget.failure() !== undefined
      ? unresolved(budget.failure() ?? "Declaration substitution exceeds its finite context budget.")
      : Object.freeze({ kind: "resolved", bindings: view });
  };
  const bindingsForLexicalOwner = (node: Node): SourceStorageBindingsSelection => {
    if (!checkedNode(node)) return unresolved(budget.failure() ?? "Lexical substitution requires an exact checked source node.");
    const selected = transport.substitutions.forLexicalOwner(node);
    const bindings = selected === undefined ? undefined : bindingView([selected]);
    return bindings === undefined || budget.failure() !== undefined
      ? unresolved(budget.failure() ?? "Lexical substitution has no completed original declaration context.")
      : Object.freeze({ kind: "resolved", bindings });
  };
  const checkedInvocation = (node: Node): boolean => checkedNode(node) &&
    (transport.invocations.has(node) || transport.accessorTargets.has(node));
  const checkedCandidate = (candidate: Node, invocation: Node): boolean => {
    if (!checkedNode(candidate) || !checkedInvocation(invocation)) return false;
    if (transport.invocationImplementations(invocation).has(candidate)) return true;
    if (transport.invocationDeclarations.get(invocation) === candidate) return true;
    if (source.ast.is.IsNewExpression(invocation) &&
      (source.ast.is.IsClassDeclaration(candidate) || source.ast.is.IsClassExpression(candidate)) &&
      [...transport.invocationImplementations(invocation)].some(implementation =>
        source.ast.is.IsConstructorDeclaration(implementation) && source.ast.parent(implementation) === candidate)) return true;
    const mode = source.ast.is.IsClassDeclaration(candidate) || source.ast.is.IsClassExpression(candidate) ? "heritage" : undefined;
    return transport.constructionLineagesFor(invocation, undefined, mode)?.some(lineage =>
      lineage.classes.some(value => value.subject.node === candidate)) === true;
  };
  const boundOrigins = (subject: SourceStorageSubject, bindings: SourceStorageBindings): SourceStorageSubjectsSelection => {
    const reason = subjectReason(subject) ?? transport.directlyUnresolvedFor(subject);
    if (reason !== undefined) return unresolved(reason);
    const states = bindingStates.get(bindings);
    if (states === undefined) return unresolved("Invocation substitutions belong to a different source storage query.");
    const subjects = new Set<SourceStorageSubject>();
    for (const state of states) {
      const selected = transport.substitutions.walk(subject, state);
      if (selected === undefined || selected.reason !== undefined || selected.fatalReason !== undefined || selected.emptyDemands.length !== 0)
        return unresolved(budget.failure() ?? selected?.fatalReason ?? selected?.reason ??
          (selected !== undefined && selected.emptyDemands.length !== 0 ? sourceStorageMissingProducerReason
            : "Source storage has no completed bound-origin selection."));
      for (const current of selected.subjects) {
        const reason = transport.directlyUnresolvedFor(current.subject);
        if (reason !== undefined) return unresolved(reason);
      }
      for (const actual of selected.origins) {
        if (!budget.step()) return unresolved(budget.failure()!);
        subjects.add(actual);
      }
    }
    return selectedSubjects(subjects);
  };
  const originSubjectsFor: SourceStorageQueries["originSubjectsFor"] = subject => {
    const reason = ancestryReason(subject);
    if (reason !== undefined) return unresolved(reason);
    let failure: string | undefined;
    const ancestors = createSourceStorageAncestorQuery(budget, origin => {
      if (origin.kind !== "input" || Node_Initializer(source.ast, origin.node) === undefined)
        return transport.incomingFor(origin);
      const selected = transport.substitutions.walk(origin, transport.substitutions.empty);
      if (selected === undefined || selected.reason !== undefined || selected.fatalReason !== undefined || selected.emptyDemands.length !== 0) {
        failure ??= selected?.fatalReason ?? selected?.reason ?? budget.failure() ??
          (selected !== undefined && selected.emptyDemands.length !== 0 ? sourceStorageMissingProducerReason
            : "An initialized source input requires its completed value correspondence.");
        return new Set();
      }
      return selected.origins;
    });
    const origins: SourceStorageSubject[] = [];
    let terminal = false;
    for (const owner of ancestors(subject, (owner, parents) => {
      if (!budget.step()) return false;
      if (parents.size === 0) terminal = true;
      return sourceStorageHasOriginalValue(owner, source.ast, parents.size !== 0);
    })) origins.push(owner);
    return failure !== undefined || budget.failure() !== undefined
      ? unresolved(failure ?? budget.failure()!) : origins.length === 0 && !terminal
        ? unresolved("A source storage cycle has no proven original owner.") : selectedSubjects(origins);
  };
  type OriginViews = ReadonlyMap<SourceStorageSubject, ReadonlySet<readonly SourceStorageProjectionView[]>>;
  const unqualified: OriginViews = new Map();
  const typedOrigins = (subjects: readonly SourceStorageSubject[], qualified: OriginViews): SourceStorageOriginsSelection => {
    const origins: SourceStorageTypedSubject[] = [];
    for (const origin of subjects) {
      if (!budget.step()) return unresolved(budget.failure()!);
      const sourceFile = transport.sourceFileFor(origin);
      const views = qualified.get(origin);
      const types = new Set<Type>();
      for (const view of views === undefined ? [undefined] : views) {
        if (!budget.step()) return unresolved(budget.failure()!);
        const type = sourceStorageProjectionType(source, origin, view);
        if (type === undefined || sourceFile === undefined) return unresolved("A source storage origin has no exact checked component type.");
        if (!types.has(type)) {
          origins.push(Object.freeze({ subject: origin, type, sourceFile }));
          types.add(type);
        }
      }
    }
    return Object.freeze({ kind: "resolved", origins: Object.freeze(origins) });
  };
  const selectDomain = (subject: SourceStorageSubject, bindings: SourceStorageBindings,
    purpose: "values" | "storage-producers") => transport.substitutions.withQuery(() => {
    const reason = subjectReason(subject) ?? transport.directlyUnresolvedFor(subject);
    if (reason !== undefined) return unresolved(reason);
    const states = bindingStates.get(bindings);
    if (states === undefined) return unresolved("Invocation substitutions belong to a different source storage query.");
    const subjects = new Set<SourceStorageSubject>();
    const boundaries: SourceStorageDomainBoundary[] = [];
    const producerStates = new Map<SourceStorageSubject, Set<SourceStorageScope>>();
    const qualified = new Map<SourceStorageSubject, Set<readonly SourceStorageProjectionView[]>>();
    let absence = false;
    for (const state of states) {
      if (!budget.step()) return unresolved(budget.failure()!);
      const selected = domains.select(subject, state, purpose);
      if (selected.reason !== undefined) return unresolved(selected.reason);
      absence ||= selected.absence;
      for (const origin of selected.boundSubjects) {
        if (origin.views === undefined) continue;
        const views = qualified.get(origin.subject) ?? new Set<readonly SourceStorageProjectionView[]>();
        views.add(origin.views);
        qualified.set(origin.subject, views);
      }
      for (const origin of selected.subjects) { if (!budget.step()) return unresolved(budget.failure()!); subjects.add(origin); }
      if (purpose === "storage-producers") for (const origin of selected.boundSubjects) {
        if (!budget.step()) return unresolved(budget.failure()!);
        const states = producerStates.get(origin.subject) ?? new Set<SourceStorageScope>();
        states.add(origin.bindings);
        producerStates.set(origin.subject, states);
      }
      for (const boundary of selected.boundaries) {
        if (!budget.step()) return unresolved(budget.failure()!);
        const bindings = bindingView([boundary.bindings]);
        if (bindings === undefined) return unresolved(budget.failure() ?? "A source boundary requires its original owned activation bindings.");
        if (!boundaries.some(selected => selected.kind === boundary.kind && selected.subject === boundary.subject &&
          selected.owner === boundary.owner && selected.exposure === boundary.exposure && selected.bindings === bindings))
          boundaries.push(Object.freeze({ ...boundary, bindings }));
      }
    }
    if (budget.failure() !== undefined) return unresolved(budget.failure()!);
    if (subjects.size === 0 && boundaries.length === 0 && !absence)
      return unresolved("A source storage cycle has no proven original owner.");
    const origins = typedOrigins([...subjects], qualified);
    if (origins.kind === "unresolved") return origins;
    return boundaries.length === 0 ? Object.freeze({ kind: "complete" as const, origins: origins.origins, producerStates })
      : Object.freeze({ kind: "open" as const, origins: origins.origins, producerStates, boundaries: Object.freeze(boundaries) });
  });
  const closedOriginsFor: SourceStorageQueries["closedOriginsFor"] = (subject, bindings = emptyBindings) => {
    const selected = selectDomain(subject, bindings, "values");
    return selected.kind === "unresolved" ? selected : selected.kind === "complete"
      ? Object.freeze({ kind: "complete", origins: selected.origins })
      : Object.freeze({ kind: "open", origins: selected.origins, boundaries: selected.boundaries });
  };
  const producersFor = (subject: SourceStorageSubject, bindings: SourceStorageBindings) => budget.withRows(rows => {
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
      ? Object.freeze({ kind: "complete" as const, producers: Object.freeze(producers) })
      : Object.freeze({ kind: "open" as const, producers: Object.freeze(producers), boundaries: selected.boundaries });
  });
  const query: SourceStorageQueries = Object.freeze({
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
      const components = projection === undefined ? [] : sourceStorageProjectionPath(projection);
      return selectedSubject(checkedNode(node) && components !== undefined && components.every(checkedProjection)
        ? transport.subject(node, kind, components) : undefined);
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
      const components = projection === undefined ? [] : sourceStorageProjectionPath(projection);
      return selectedSubject(checkedNode(node) && components !== undefined && components.every(checkedProjection)
        ? transport.storageSubject(node, components) : undefined);
    },
    writeAt(reference, bindings) {
      if (!checkedNode(reference)) return unresolved(budget.failure() ?? "A source write requires its original checked occurrence.");
      if (!bindingStates.has(bindings)) return unresolved("A source write requires bindings from the identical source storage query.");
      const write = transport.writeAt(reference);
      if (write === undefined) return unresolved(budget.failure() ?? "A source write has no original published store occurrence.");
      return Object.freeze({ kind: "resolved", write, bindings });
    },
    formalMemberWriteDemand(declaration, parameter) {
      return transport.formalMemberWriteDemand(declaration, parameter);
    },
    sealFormalMemberWriteDemands: transport.sealFormalMemberWriteDemands,
    memberWritesFor(subject) {
      return budget.withRows(rows => {
        const reason = subjectReason(subject) ?? budget.failure();
        if (reason !== undefined) return unresolved(reason);
        const { ast } = source;
        const declaration = subject.node;
        const file = transport.sourceFileFor(subject);
        const owner = ast.parent(declaration);
        const objectMember = owner !== undefined && ast.is.IsObjectLiteralExpression(owner) &&
          (ast.is.IsMethodDeclaration(declaration) || ast.is.IsPropertyAssignment(declaration) ||
            ast.is.IsShorthandPropertyAssignment(declaration));
        if (!checkedNode(declaration) || file === undefined || file.IsDeclarationFile ||
          !source.navigation.isProjectDeclaration(declaration) || subject.projection.length !== 0 ||
          sourceStorageMemberSubject(declaration, ast, transport.subject) !== subject ||
          !objectMember && !sourceClassFieldHasStorage(ast, declaration) && !sourceParameterIsProperty(ast, declaration))
          return unresolved(budget.failure() ?? "Member-write selection requires its exact authored physical member slot.");
        const ownerSubject = objectMember ? transport.subjectFor(owner) : undefined;
        if (objectMember && ownerSubject === undefined)
          return unresolved(budget.failure() ?? "Member-write selection requires its original checked physical object owner.");
        const correspondence = ownerSubject === undefined ? undefined : transport.directlyUnresolvedFor(ownerSubject);
        if (correspondence !== undefined) return unresolved(correspondence);
        const selected = domains.writeBoundariesFor(subject);
        if (selected.reason !== undefined) return unresolved(selected.reason);
        const writes: SourceStorageWriteOccurrence[] = [];
        const references = new Set<Node>();
        for (const store of transport.storesFor(subject) ?? []) {
          if (!budget.step()) return unresolved(budget.failure()!);
          if (store.kind !== "mutation" || references.has(store.reference)) continue;
          const write = transport.writeAt(store.reference);
          if (write === undefined || write.kind !== "mutation" || !write.destinations.includes(subject))
            return unresolved(budget.failure() ?? "Member writes require every original published physical destination.");
          if (!rows.add(2)) return unresolved(budget.failure()!);
          references.add(store.reference);
          writes.push(write);
        }
        if (budget.failure() !== undefined) return unresolved(budget.failure()!);
        return selected.boundaries.length === 0
          ? Object.freeze({ kind: "complete", writes: Object.freeze(writes) })
          : Object.freeze({ kind: "open", writes: Object.freeze(writes), boundaries: selected.boundaries });
      });
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
      return typedOrigins(selected.subjects, unqualified);
    },
    closedOriginsFor,
    storageProducersFor(subject, bindings = emptyBindings) {
      return producersFor(subject, bindings);
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
    invocationImplementationsFor(invocation, bindings, callback) {
      if (!checkedInvocation(invocation)) return unresolved(budget.failure() ?? "An invocation has no checked source transport.");
      const states = bindings === undefined ? undefined : bindingStates.get(bindings);
      if (bindings !== undefined && states === undefined)
        return unresolved("Invocation substitutions belong to a different source storage query.");
      if (callback !== undefined) {
        const entry = transport.callbackEntriesFor(invocation).find(entry => entry.argument === callback);
        if (entry === undefined) return unresolved("A native callback requires its exact selected invocation entry identity.");
        const selected = transport.callbackImplementationSelection(entry);
        return selected === undefined ? unresolved(budget.failure() ?? "A native callback has no completed invocation selection.")
          : Object.freeze({ kind: "resolved", nodes: Object.freeze([...selected.nodes]), exact: selected.exact, inputs: selected.inputs });
      }
      const published = transport.invocationImplementationSelection(invocation);
      if (published === undefined) return unresolved(budget.failure() ?? "Invocation dispatch has no completed selection.");
      const expression = source.ast.is.IsCallExpression(invocation) ? source.ast.as.AsCallExpression(invocation)?.Expression : undefined;
      if (expression !== undefined && source.ast.kindName(expression) !== "KindSuperKeyword") {
        const target = transport.invocationTargets.get(invocation);
        if (target === undefined) return unresolved("A scoped invocation requires its exact checked callable operand.");
        const selected = selectDomain(target, bindings ?? emptyBindings, "storage-producers");
        if (selected.kind === "unresolved") return selected;
        const nodes = new Set<Node>();
        let exact = selected.kind === "complete";
        for (const origin of selected.origins) {
          if (!budget.step()) return unresolved(budget.failure()!);
          if (!sourceStorageHasOriginalCallableValue(origin.subject, source.ast)) { exact = false; continue; }
          const implementation = source.navigation.callableImplementation(origin.subject.node);
          if (implementation.kind !== "resolved") { exact = false; continue; }
          nodes.add(implementation.implementation.declaration);
        }
        return Object.freeze({ kind: "resolved", nodes: Object.freeze([...nodes]), exact, inputs: published.inputs });
      }
      const nodes = new Set<Node>();
      let exact = true;
      for (const state of states ?? [undefined]) {
        const selected = transport.invocationImplementationSelection(invocation, state === undefined ? undefined
          : origin => transport.substitutions.origins(origin, state));
        if (selected === undefined) return unresolved(budget.failure() ?? "Invocation dispatch has no completed selection.");
        exact &&= selected.exact;
        for (const node of selected.nodes) {
          if (!budget.step()) return unresolved(budget.failure()!);
          nodes.add(node);
        }
      }
      return budget.failure() !== undefined ? unresolved(budget.failure()!)
        : Object.freeze({ kind: "resolved", nodes: Object.freeze([...nodes]), exact, inputs: published.inputs });
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
    bindingsForDeclaration: declarationBindings,
    bindingsForLexicalOwner,
    bindingsForInvocation(candidate, invocation, parent = emptyBindings, capture) {
      const states = bindingStates.get(parent);
      if (states === undefined) return unresolved("Invocation substitutions belong to a different source storage query.");
      if (!checkedDeclaration(candidate) || !checkedInvocation(invocation) ||
        transport.accessorTargets.has(invocation) && !checkedCandidate(candidate, invocation))
        return unresolved(budget.failure() ?? "Invocation substitution requires its exact selected implementation.");
      const transportReason = transport.unresolvedInvocations.get(invocation);
      if (transportReason !== undefined) return unresolved(transportReason);
      const captureStates = capture === undefined ? undefined : bindingStates.get(capture.bindings);
      if (capture !== undefined) {
        const reason = subjectReason(capture.subject);
        if (reason !== undefined) return unresolved(reason);
        if (captureStates?.length !== 1) return unresolved("An exact invocation capture requires one owned producer activation.");
      }
      const selected = new Set<SourceStorageScope>();
      const captured = capture === undefined ? undefined : { subject: capture.subject, bindings: captureStates![0]! };
      for (const state of states) for (const binding of transport.invocationResults.forInvocation(candidate, invocation, state, captured)) {
        if (!budget.step()) return unresolved(budget.failure()!);
        selected.add(binding);
      }
      if (selected.size === 0 && budget.failure() === undefined)
        return unresolved("Invocation substitution has no exact completed implementation and capture activation.");
      const view = budget.failure() === undefined ? bindingView(selected) : undefined;
      return view === undefined || budget.failure() !== undefined
        ? unresolved(budget.failure() ?? "Invocation substitution exceeds its finite context budget.")
        : Object.freeze({ kind: "resolved", bindings: view });
    },
    boundOriginsFor: boundOrigins,
    invocationContextKeyFor(invocation, bindings) {
      const states = bindingStates.get(bindings);
      if (states === undefined) return unresolved("Invocation context keys belong to a different source storage query.");
      if (!checkedInvocation(invocation)) return unresolved(budget.failure() ?? "An invocation context key requires its exact checked source call or accessor.");
      const key = transport.substitutions.invocationContextKeyFor(invocation, states);
      return key === undefined || budget.failure() !== undefined
        ? unresolved(budget.failure() ?? "The exact source invocation context could not be encoded.")
        : Object.freeze({ kind: "resolved", key });
    },
    contextKeyFor(subjects, bindings) {
      const states = bindingStates.get(bindings);
      if (states === undefined) return unresolved("Context keys belong to a different source storage query.");
      if (!Array.isArray(subjects)) return unresolved("Context keys require exact checked source subjects.");
      for (let index = 0; index < subjects.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(subjects, String(index));
        const subject = descriptor === undefined || !("value" in descriptor) ? undefined
          : descriptor.value as SourceStorageSubject | undefined;
        const reason = subject === undefined ? "Context keys require a dense data-only subject selection." : subjectReason(subject);
        if (reason !== undefined) return unresolved(reason);
      }
      const key = transport.substitutions.contextKeyFor(subjects, states);
      return key === undefined || budget.failure() !== undefined
        ? unresolved(budget.failure() ?? "The exact source context could not be encoded.")
        : Object.freeze({ kind: "resolved", key });
    },
    boundActivationsFor(declaration, bindings) {
      return budget.withRows(rows => {
        const states = bindingStates.get(bindings);
        if (states === undefined) return unresolved("Invocation substitutions belong to a different source storage query.");
        if (!checkedDeclaration(declaration)) return unresolved(budget.failure() ?? "An activation requires its exact checked declaration.");
        const activations: SourceStorageBoundActivation[] = [];
        const seen = new Set<SourceStorageScope>();
        for (const state of states) {
          if (!budget.step()) return unresolved(budget.failure()!);
          const selected = transport.substitutions.boundActivation(state, declaration);
          if (selected === undefined) return unresolved(budget.failure() ?? "Source storage has no exact owning activation for this declaration.");
          if (seen.has(selected.scope)) continue;
          if (!rows.add(2)) return unresolved(budget.failure()!);
          seen.add(selected.scope);
          const owned = bindingView([selected.scope]);
          if (owned === undefined) return unresolved(budget.failure() ?? "An activation requires its retained declaration bindings.");
          if (selected.invocation === undefined) {
            if (selected.nativeEntry === undefined) activations.push(Object.freeze({ kind: "declaration", declaration, bindings: owned }));
            else {
              const caller = bindingView([selected.nativeEntry.caller]);
              if (caller === undefined) return unresolved(budget.failure() ?? "A native callback activation requires exact caller bindings.");
              activations.push(Object.freeze({ kind: "declaration", declaration, bindings: owned, nativeEntry: Object.freeze({
                invocation: selected.nativeEntry.invocation, argument: selected.nativeEntry.callback.argument, callerBindings: caller,
              }) }));
            }
          }
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
    contributingExecutionsFor(subject, declaration, entry) {
      return budget.withRows(rows => {
        if (entry === null || typeof entry !== "object") return unresolved("A source callback entry requires owned data-only producer evidence.");
        const subjectDescriptor = Object.getOwnPropertyDescriptor(entry, "subject");
        const bindingsDescriptor = Object.getOwnPropertyDescriptor(entry, "bindings");
        const callback = subjectDescriptor !== undefined && "value" in subjectDescriptor
          ? subjectDescriptor.value as SourceStorageSubject | undefined : undefined;
        const creation = bindingsDescriptor !== undefined && "value" in bindingsDescriptor
          ? bindingsDescriptor.value as SourceStorageBindings | undefined : undefined;
        if (callback === undefined || creation === undefined)
          return unresolved("A source callback entry requires owned data-only producer evidence.");
        const reason = subjectReason(subject) ?? subjectReason(callback);
        if (reason !== undefined) return unresolved(reason);
        const states = bindingStates.get(creation);
        if (states?.length !== 1) return unresolved("A source callback entry requires one owned creation activation.");
        const callable = sourceStorageHasOriginalCallableValue(callback, source.ast);
        const generator = !callable && callback.kind === "value" && callback.projection.length === 0 &&
          source.ast.is.IsCallExpression(callback.node)
          ? [...transport.invocationImplementations(callback.node)].filter(candidate =>
            source.semantics.forNode(candidate).operations.generator(candidate) !== undefined &&
            transport.substitutions.boundActivation(states[0]!, candidate)?.invocation === callback.node) : [];
        if (!checkedDeclaration(declaration) || source.ast.body(declaration) === undefined ||
          !callable && generator.length !== 1)
          return unresolved(budget.failure() ?? "A source callback entry requires its actual checked implementation and demanded owner.");
        const region = transport.regions.enclosing(subject.node);
        if (region === undefined || sourceStorageRegionOwner(source.ast, region) !== declaration ||
          subject.kind !== "value" || subject.projection.length !== 0 || transport.subjectFor(subject.node) !== subject)
          return unresolved(budget.failure() ?? "A source execution demand requires an identical unprojected value use in its checked owner.");
        const selected = transport.substitutions.contributingExecutions(subject, callable ? callback.node : generator[0]!,
          states[0]!, callable ? "callable" : "generator-result");
        if (selected === undefined || selected.reason !== undefined)
          return unresolved(selected?.reason ?? budget.failure() ?? "Source callback execution has no completed correlated activation selection.");
        const seen = new Set<SourceStorageScope>();
        const producers: SourceStorageProducer[] = [];
        const type = sourceStorageSubjectType(source, subject, transport.sourceFileFor(subject));
        const sourceFile = transport.sourceFileFor(subject);
        if (type === undefined || sourceFile === undefined) return unresolved("A contributing execution requires its checked demanded subject type.");
        for (const current of selected.subjects) {
          if (!budget.step()) return unresolved(budget.failure()!);
          const activation = transport.substitutions.boundActivation(current.bindings, declaration);
          if (activation === undefined) return unresolved(budget.failure() ?? "A contributing execution lost its actual owning activation.");
          if (seen.has(activation.scope)) continue;
          if (!rows.add(2)) return unresolved(budget.failure()!);
          seen.add(activation.scope);
          const bindings = bindingView([activation.scope]);
          if (bindings === undefined) return unresolved(budget.failure() ?? "A contributing execution lost its same-frame bindings.");
          producers.push(Object.freeze({ subject, type, sourceFile, bindings }));
        }
        if (budget.failure() !== undefined) return unresolved(budget.failure()!);
        const boundaries = [];
        for (const boundary of selected.boundaries) {
          if (!budget.step() || !rows.add(1)) return unresolved(budget.failure()!);
          if (boundary.exposure === undefined) return unresolved("A native execution boundary requires its actual exposure.");
          const bindings = bindingView([boundary.scope]);
          if (bindings === undefined) return unresolved(budget.failure() ?? "A native execution boundary requires its original creation bindings.");
          boundaries.push(Object.freeze({ kind: "unclassified-exposure" as const,
            subject: boundary.subject, exposure: boundary.exposure, bindings }));
        }
        return boundaries.length === 0 ? Object.freeze({ kind: "complete", producers: Object.freeze(producers) })
          : Object.freeze({ kind: "open", producers: Object.freeze(producers), boundaries: Object.freeze(boundaries) });
      });
    },
    nativeCallbackArgumentsFor(invocation) {
      if (!checkedNode(invocation) || !transport.invocations.has(invocation)) return unresolved("A native callback requires its checked invocation owner.");
      if (budget.failure() !== undefined) return unresolved(budget.failure()!);
      const reason = transport.unresolvedInvocations.get(invocation);
      if (reason !== undefined) return unresolved(reason);
      const entries = transport.callbackEntriesFor(invocation);
      const arguments_ = Object.freeze(entries.map(entry => entry.argument));
      const unknown = entries.filter(entry => entry.timing === "unknown");
      if (unknown.length === 0) return Object.freeze({ kind: "resolved", arguments: arguments_ });
      const lexical = query.bindingsForLexicalOwner(invocation);
      return lexical.kind === "unresolved" ? lexical : Object.freeze({ kind: "open", arguments: arguments_, boundaries: Object.freeze(unknown.map(entry =>
        Object.freeze({ kind: "unclassified-exposure" as const, subject: entry.argument.actual, exposure: invocation, bindings: lexical.bindings }))) });
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
        return budget.failure() !== undefined ? unresolved(budget.failure()!)
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
    executionRegionsFor(candidate, invocation, callerBindings = emptyBindings) {
      if (!bindingStates.has(callerBindings))
        return unresolved("Invocation substitutions belong to a different source storage query.");
      if (!checkedDeclaration(candidate))
        return unresolved(budget.failure() ?? "An execution region requires exact checked callable ownership.");
      if (invocation !== undefined) {
        const selected = query.bindingsForInvocation(candidate, invocation, callerBindings);
        if (selected.kind === "unresolved") return selected;
      }
      let failure: string | undefined;
      const nodes = transport.regions.callable(candidate, invocation, expression => {
        const subject = checkedNode(expression) ? transport.subjectFor(expression) : undefined;
        if (subject === undefined) {
          failure = budget.failure() ?? "Execution selection requires its exact checked argument subject.";
          return undefined;
        }
        const selected = boundOrigins(subject, callerBindings);
        const typed = selected.kind === "unresolved" ? selected : typedOrigins(selected.subjects, unqualified);
        if (typed.kind === "unresolved") { failure = typed.reason; return undefined; }
        return typed.origins.map(origin => origin.type);
      });
      return failure !== undefined || budget.failure() !== undefined ? unresolved(failure ?? budget.failure()!)
        : Object.freeze({ kind: "resolved", nodes: Object.freeze([...nodes]) });
    },
    instanceRegionsFor(invocation) {
      if (!checkedInvocation(invocation) || !source.ast.is.IsNewExpression(invocation))
        return unresolved(budget.failure() ?? "Instance execution requires its exact checked constructor invocation.");
      const selected = construction(invocation, emptyBindings);
      if (selected.kind === "unresolved") return selected;
      const regions = new Map<Node, { readonly owner: Node; readonly node: Node }>();
      for (const alternative of selected.alternatives) for (const entry of alternative.classes) for (const region of entry.regions) {
        if (!budget.step()) return unresolved(budget.failure()!);
        if (!regions.has(region.node)) regions.set(region.node, Object.freeze({ owner: entry.owner, node: region.node }));
      }
      return Object.freeze({ kind: "resolved", regions: Object.freeze([...regions.values()]) });
    },
    constructionFor(invocation, callerBindings = emptyBindings) {
      if (!bindingStates.has(callerBindings)) return unresolved("Invocation substitutions belong to a different source storage query.");
      if (!checkedInvocation(invocation)) return unresolved(budget.failure() ?? "Construction execution requires its exact checked invocation.");
      return construction(invocation, callerBindings);
    },
    enclosingRegionFor(node) { return checkedNode(node) ? transport.regions.enclosing(node) : undefined; },
  } satisfies SourceStorageQueries);
  const construction = createSourceStorageConstructionQuery(source, budget, query, transport.nativeConstructorsFor);
  return query;
}
