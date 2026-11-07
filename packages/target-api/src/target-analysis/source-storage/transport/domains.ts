import type { SourceAnalysisProgram } from "../../analysis-program.js";
import { createSourceStorageDomainInitialization } from "./domain-initialization.js";
import type { Node } from "@tsonic/tsts";
import type { SourceTypeDescriptor } from "../../../source-semantics/descriptor-model.js";
import { Node_Expression, Node_Initializer } from "../../../source-navigation/index.js";
import { sourceStorageSubjectType, sourceStorageTypesEqual } from "../model/components.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageSubject } from "../model/subjects.js";
import { sourceStorageFormalOwner, sourceStorageHasOriginalCallableValue, sourceStorageIsMemberProjection, sourceStorageMemberSubject } from "../model/subjects.js";
import type { SourceStorageScopedSubject, SourceStorageScope, SourceStorageRelationWitness } from "../graph/scoped-model.js";
import { sourceStorageMissingProducerReason } from "../scoped/substitutions.js";
import type { createSourceStorageTransport } from "./transport.js";
import type { SourceStorageDomainBoundary } from "../model/types.js";
import { createSourceStorageDomainWitnesses, type SourceStorageDomainWitness } from "../graph/domain-witnesses.js";
import { createSourceStorageDomainPublications } from "../graph/domain-publications.js";
import { createSourceStorageDomainInputs } from "./domain-inputs.js";
import { sourceStorageClassLineages } from "../model/construction.js";
import { sourceConstructionExpression } from "../../../source-navigation/class-initialization.js";
import { sourceStorageRegionOwner } from "../graph/lexical-regions.js";
import { createSourceStoragePublicationDemands } from "./publication-demands.js";

export function createSourceStorageDomains(
  source: SourceAnalysisProgram,
  transport: ReturnType<typeof createSourceStorageTransport>,
  budget: SourceStorageBudget,
) {
  const { ast, navigation } = source;
  const witnesses = createSourceStorageDomainWitnesses(budget);
  const publications = createSourceStorageDomainPublications(budget, transport.substitutions.empty);
  const publicationDemands = createSourceStoragePublicationDemands(source, transport, budget,
    (subject, bindings) => publicationOriginsIn(subject, bindings));
  const domainInputs = createSourceStorageDomainInputs(transport, witnesses, budget);
  let initialized = false;
  const add = domainInputs.add;
  const initializePublications = createSourceStorageDomainInitialization({
    source, transport, budget, witnesses, publications, publicationDemands, add,
    publicationOriginsIn: (subject, bindings) => publicationOriginsIn(subject, bindings),
  });
  const initialize = (): void => {
    if (initialized) return;
    initialized = true;
    try {
      transport.substitutions.withQuery(initializePublications);
    } finally {
      publications.finish();
      publicationDemands.finish();
      domainInputs.seal();
    }
  };
  const memberActivation = (subject: SourceStorageSubject, bindings: SourceStorageScope) => {
    if (subject.kind !== "member") return undefined;
    const parent = ast.parent(subject.node);
    const declaredClass = parent !== undefined && ast.is.IsConstructorDeclaration(parent) ? ast.parent(parent) : parent;
    return declaredClass !== undefined && (ast.is.IsClassDeclaration(declaredClass) || ast.is.IsClassExpression(declaredClass))
      ? transport.substitutions.boundActivation(bindings, declaredClass) : undefined;
  };
  const matchesCreation = (boundary: SourceStorageDomainWitness, bindings: SourceStorageScope,
    readActivation: () => ReturnType<typeof memberActivation>): boolean => {
    if (boundary.kind === "external-input" && boundary.owner !== undefined) {
      const owner = sourceStorageFormalOwner(boundary.owner, source);
      if (owner !== undefined && readActivation()?.invocation !== undefined &&
        transport.substitutions.ownerScope(bindings, owner) === undefined) return false;
    }
    if (boundary.creationBindings === undefined) return true;
    const owner = boundary.owner ?? boundary.subject;
    if (boundary.subject.kind === "member" && owner.kind === "value" && owner.projection.length === 0 &&
      ast.is.IsNewExpression(owner.node)) {
      const activation = readActivation();
      if (activation?.invocation !== undefined && activation.caller !== undefined && ast.is.IsNewExpression(activation.invocation)) {
        if (activation.invocation !== owner.node) return false;
        const exposed = transport.substitutions.creationKeyFor(owner, boundary.creationBindings);
        const observed = transport.substitutions.creationKeyFor(owner, activation.caller);
        if (exposed === undefined || observed === undefined) {
          budget.reject("Source storage writer evidence requires its exact original creation correspondence.");
          return false;
        }
        return exposed === observed;
      }
    }
    const region = transport.regions.enclosing(owner.node);
    const lexicalOwner = region === undefined ? undefined : sourceStorageRegionOwner(ast, region);
    const exposureRegion = transport.regions.enclosing(boundary.exposure);
    if (lexicalOwner !== undefined && exposureRegion !== undefined &&
      sourceStorageRegionOwner(ast, exposureRegion) === lexicalOwner) {
      const exposed = transport.substitutions.boundActivation(boundary.creationBindings, lexicalOwner);
      const observed = transport.substitutions.boundActivation(bindings, lexicalOwner);
      if (exposed !== undefined && exposed.invocation === undefined && exposed.nativeEntry === undefined &&
        observed !== undefined) return true;
    }
    const exposed = transport.substitutions.creationKeyFor(owner, boundary.creationBindings);
    const observed = boundary.creationBindings === bindings ? exposed : transport.substitutions.creationKeyFor(owner, bindings);
    if (exposed === undefined || observed === undefined) {
      budget.reject("Source storage writer evidence requires its exact original creation correspondence.");
      return false;
    }
    return exposed === observed;
  };
  const boundariesFor = (subject: SourceStorageSubject, bindings?: SourceStorageScope,
    kind?: "external-input"): readonly SourceStorageDomainWitness[] => {
    const selected = [...witnesses.forSubject(subject, kind)];
    for (let length = 0; length < subject.projection.length && budget.step(); length += 1) {
      const owner = transport.subject(subject.node, subject.kind, subject.projection.slice(0, length));
      for (const boundary of owner === undefined ? [] : witnesses.forSubject(owner, kind)) {
        if (!budget.step()) break;
        if (boundary.kind === "opaque-result") selected.push(Object.freeze({ ...boundary, subject }));
        else if (boundary.kind === "external-input" || boundary.kind === "external-write" || boundary.kind === "opaque-write" ||
          boundary.kind === "unclassified-exposure") selected.push(boundary);
      }
    }
    if (bindings === undefined) return selected;
    let activation: ReturnType<typeof memberActivation>;
    let inspected = false;
    const readActivation = () => {
      if (!inspected) {
        activation = memberActivation(subject, bindings);
        inspected = true;
      }
      return activation;
    };
    return selected.filter(boundary => matchesCreation(boundary, bindings, readActivation));
  };
  const closedInvocations = new Map<Node, Map<SourceStorageScope, boolean>>();
  const invocationRows = budget.createRows();
  const computeClosedSourceInvocation = (invocation: Node, bindings: SourceStorageScope): boolean => {
    if (transport.unresolvedInvocations.has(invocation)) return false;
    if (ast.is.IsCallExpression(invocation) && ast.kindName(Node_Expression(ast, invocation)) !== "KindSuperKeyword") {
      const callee = Node_Expression(ast, invocation);
      const declaration = callee !== undefined && ast.is.IsIdentifier(callee)
        ? navigation.sourceReferenceFor(callee)?.declaration : undefined;
      const authored = declaration !== undefined && ast.is.IsFunctionDeclaration(declaration) &&
        ast.body(declaration) !== undefined && navigation.isProjectDeclaration(declaration) ? transport.subject(declaration) : undefined;
      if (authored !== undefined && transport.incomingFor(authored).size === 0 &&
        transport.storedValuesFor(authored) === undefined && transport.unresolvedStoredInputsFor(authored) === undefined &&
        boundariesFor(authored, bindings).length === 0) return true;
      const target = transport.invocationTargets.get(invocation);
      const selected = target === undefined ? undefined : transport.substitutions.walk(target, bindings);
      if (selected === undefined || selected.reason !== undefined || selected.fatalReason !== undefined ||
        selected.emptyDemands.length !== 0 || selected.effectFrontiers.length !== 0 || selected.origins.size === 0) return false;
      for (const origin of selected.origins) {
        if (!budget.step() || !sourceStorageHasOriginalCallableValue(origin, ast)) return false;
        const implementation = navigation.callableImplementation(origin.node);
        if (implementation.kind !== "resolved" || ast.body(implementation.implementation.declaration) === undefined) return false;
      }
      // The callee's receiver selects the member: an unbound external receiver leaves the implementation open even though
      // the receiver value itself does not contribute.
      const receivers = new Set<SourceStorageSubject>();
      let receiver = callee !== undefined && ast.is.IsPropertyAccessExpression(callee) ? transport.subjectFor(Node_Expression(ast, callee)) : undefined;
      for (let depth = 0; receiver !== undefined && !receivers.has(receiver) && depth < 64; depth += 1) {
        if (!budget.step()) return false;
        receivers.add(receiver);
        const parents = transport.incomingFor(receiver);
        receiver = parents.size === 1 ? parents.values().next().value : undefined;
      }
      for (const current of selected.subjects) {
        if (!budget.step()) return false;
        if (!current.contributes && !receivers.has(current.subject)) continue;
        for (const boundary of boundariesFor(current.subject, current.bindings)) {
          if (!budget.step()) return false;
          if (boundary.kind === "external-input") {
            if (!transport.substitutions.isBound(current.subject, current.bindings) && !receiverBinding(current.subject, current.bindings)) return false;
          } else if (boundary.kind === "external-write" || boundary.exposure !== invocation) return false;
        }
      }
      return true;
    }
    if (sourceConstructionExpression(invocation, source, budget.step) === undefined) return false;
    const target = transport.invocationTargets.get(invocation);
    if (target === undefined) return false;
    const lineages = sourceStorageClassLineages(source, budget, transport.substitutions.values(target, bindings), {
      subjectFor: transport.subjectFor,
      valuesFor: transport.substitutions.values,
      nativeConstructorsFor: transport.nativeConstructorsFor,
    });
    return lineages !== undefined && lineages.length !== 0 && lineages.every(lineage => lineage.complete &&
      lineage.classes.length !== 0 && lineage.classes.every(value => navigation.isProjectDeclaration(value.subject.node)));
  };
  const closedSourceInvocation = (invocation: Node, bindings: SourceStorageScope): boolean => {
    if (!budget.step()) return false;
    const states = closedInvocations.get(invocation);
    const existing = states?.get(bindings);
    if (existing !== undefined) return existing;
    const selected = computeClosedSourceInvocation(invocation, bindings);
    if (budget.failure() !== undefined || !invocationRows.add(states === undefined ? 2 : 1)) return false;
    const retained = states ?? new Map<SourceStorageScope, boolean>();
    retained.set(bindings, selected);
    closedInvocations.set(invocation, retained);
    return selected;
  };
  const selectedMembers = (subject: SourceStorageSubject, owner: SourceStorageSubject, bindings: SourceStorageScope) => {
    const bound = transport.substitutions.selection(owner, bindings);
    if (bound === undefined) return undefined;
    const file = transport.sourceFileFor(owner);
    const type = sourceStorageSubjectType(source, owner, file);
    if (type === undefined) return undefined;
    const component = subject.projection[0];
    const target = component !== undefined && (component.kind === "member" || component.kind === "method-value")
      ? component.declaration : subject.node;
    const remaining = target === subject.node ? [] : subject.projection.slice(1);
    return budget.withRows(rows => {
      const result: { readonly subject: SourceStorageSubject; readonly bindings: SourceStorageScope }[] = [];
      const pending: { readonly subject: SourceStorageSubject; readonly bindings: SourceStorageScope;
        readonly type: SourceTypeDescriptor }[] = bound.map(input => ({ ...input, type }));
      const visited = new Map<SourceStorageScope, Map<SourceStorageSubject, SourceTypeDescriptor[]>>();
      while (pending.length !== 0) {
        if (!budget.step()) return undefined;
        const current = pending.pop()!;
        const states = visited.get(current.bindings);
        const subjects = states?.get(current.subject);
        if (subjects?.some(seen => sourceStorageTypesEqual(seen, current.type)) === true) continue;
        if (!rows.add(1 + (states === undefined ? 1 : 0) + (subjects === undefined ? 1 : 0))) return undefined;
        const selected = states ?? new Map<SourceStorageSubject, SourceTypeDescriptor[]>();
        const types = subjects ?? [];
        types.push(current.type); selected.set(current.subject, types); visited.set(current.bindings, selected);
        const file = transport.sourceFileFor(current.subject);
        if (file === undefined) continue;
        const members = transport.memberFlow.membersFor(current.subject, current.type);
        for (const member of members ?? []) {
          if (!budget.step()) return undefined;
          if (member.kind !== "present") continue;
          const matches = member.destination.declarations.includes(target);
          for (const declaration of member.source.declarations) {
            if (!budget.step() || !transport.retainCheckedContext(declaration, file)) return undefined;
            const original = sourceStorageMemberSubject(declaration, ast, transport.subject);
            if (original === undefined) continue;
            if (matches) {
              const projected = remaining.length === 0 ? original : transport.subject(original.node, original.kind,
                [...original.projection, ...remaining]);
              if (projected === undefined) return undefined;
              result.push({ subject: projected, bindings: current.bindings });
            }
            else if (member.destination.type === undefined) return undefined;
            else pending.push({ subject: original, bindings: current.bindings, type: member.destination.type });
          }
        }
      }
      return result.length === 0 ? undefined : result;
    });
  };
  const receiverBinding = (subject: SourceStorageSubject, bindings: SourceStorageScope): boolean => {
    if (subject.kind !== "return" || !ast.is.IsGetAccessorDeclaration(subject.node) && !ast.is.IsMethodDeclaration(subject.node)) return false;
    const receiver = transport.subject(subject.node, "receiver");
    return receiver !== undefined && transport.substitutions.isBound(receiver, bindings);
  };
  const separateExportedCreation = (boundary: Omit<SourceStorageDomainBoundary, "bindings">,
    bindings: SourceStorageScope): boolean => {
    const owner = boundary.owner;
    if (boundary.kind !== "external-write" || owner?.kind !== "value" || owner.projection.length !== 0 ||
      !ast.is.IsObjectLiteralExpression(owner.node) && !ast.is.IsArrayLiteralExpression(owner.node)) return false;
    const implementation = navigation.callableImplementation(boundary.exposure);
    const region = transport.regions.enclosing(owner.node);
    if (implementation.kind !== "resolved" || region === undefined ||
      sourceStorageRegionOwner(ast, region) !== implementation.implementation.declaration) return false;
    const activation = transport.substitutions.boundActivation(bindings, implementation.implementation.declaration);
    return activation?.invocation !== undefined && activation.nativeEntry === undefined;
  };
  const aggregateInput = (current: SourceStorageScopedSubject & { readonly original: boolean }, exposure: Node): boolean => {
    const owner = !current.original && current.subject.kind === "input" ? sourceStorageFormalOwner(current.subject, source) : undefined;
    return owner === exposure && ast.body(owner) !== undefined;
  };
  const writtenMember = (subject: SourceStorageSubject): boolean => {
    const last = subject.projection[subject.projection.length - 1];
    const member = last !== undefined && sourceStorageIsMemberProjection(last)
      ? sourceStorageMemberSubject(last.declaration, ast, transport.subject) : subject.kind === "member" ? subject : undefined;
    return member !== undefined && (transport.storedValuesFor(member)?.length ?? 0) !== 0;
  };
  const isExternalInput = (current: SourceStorageScopedSubject & { readonly original: boolean }): boolean => {
    const boundaries = boundariesFor(current.subject, current.bindings, "external-input");
    if (!boundaries.some(boundary => boundary.kind === "external-input")) return false;
    if (transport.substitutions.isBound(current.subject, current.bindings) ||
      receiverBinding(current.subject, current.bindings)) return false;
    if (writtenMember(current.subject)) return false;
    const stores = transport.storedInputsFor(current.subject);
    return boundaries.some(boundary => boundary.kind === "external-input" && !aggregateInput(current, boundary.exposure) &&
      (boundary.owner === undefined || stores === undefined) &&
      !closedSourceInvocation(boundary.exposure, current.bindings));
  };
  const publicationQueries = new Map<SourceStorageScope, (subject: SourceStorageSubject) => ReadonlySet<SourceStorageScopedSubject> | undefined>();
  const publicationRows = budget.createRows();
  const publicationOriginsIn = (subject: SourceStorageSubject, bindings: SourceStorageScope): ReadonlySet<SourceStorageScopedSubject> | undefined => {
    let query = publicationQueries.get(bindings);
    if (query === undefined) {
      if (!publicationRows.add(1)) return undefined;
      query = domainInputs.query((subject: SourceStorageSubject) => {
        const hasInputs = domainInputs.readPresence(subject);
        const selected = transport.substitutions.walk(subject, bindings, !hasInputs ? undefined : current => {
          if (transport.substitutions.isBound(current.subject, current.bindings)) return false;
          domainInputs.read(current.subject);
          return current.original && domainInputs.has(current.subject);
        });
        if (budget.failure() !== undefined) return undefined;
        const origins = new Set<SourceStorageScopedSubject>();
        for (const current of selected?.subjects ?? []) {
          if (!budget.step()) return undefined;
          if (current.contributes && selected?.origins.has(current.subject))
            origins.add(Object.freeze({ subject: current.subject, bindings: current.bindings, views: current.views }));
        }
        if (selected !== undefined && (selected.reason !== undefined || selected.fatalReason !== undefined || selected.emptyDemands.length !== 0))
          origins.add(Object.freeze({ subject, bindings }));
        return origins;
      });
      publicationQueries.set(bindings, query);
    }
    return query(subject);
  };
  // The root scope and a top-level declaration activation are where an outside caller's values enter.
  const entryActivation = (bindings: SourceStorageScope): boolean => bindings === transport.substitutions.empty ||
    bindings.kind === "frame" && bindings.boundary === "declaration" && bindings.parents.length === 1 &&
    bindings.parents[0] === transport.substitutions.empty;
  const demandedFailure = (selected: ReturnType<typeof transport.substitutions.walk>, purpose: "values" | "storage-producers") =>
    selected?.fatalReason ?? (purpose === "values" ? selected?.demandReason : undefined);
  const select = (subject: SourceStorageSubject, bindings: SourceStorageScope,
    purpose: "values" | "storage-producers" = "values") => budget.withRows(rows => {
    initialize();
    const selected = transport.substitutions.walk(subject, bindings,
      domainInputs.hasInputs() ? { kind: "input", admits: isExternalInput } : undefined, false);
    const failure = demandedFailure(selected, purpose);
    if (failure !== undefined) budget.reject(failure);
    if (selected === undefined || selected.reason !== undefined || budget.failure() !== undefined) return Object.freeze({
      subjects: Object.freeze([] as SourceStorageSubject[]), boundaries: Object.freeze([] as SourceStorageDomainBoundary<SourceStorageScope>[]),
      boundSubjects: Object.freeze([] as SourceStorageScopedSubject[]),
      absence: false,
      reason: budget.failure() ?? selected?.reason ?? "Source storage requires one completed scoped relation.",
    });
    const boundaries: SourceStorageDomainBoundary<SourceStorageScope>[] = [];
    const retainBoundary = (boundary: SourceStorageDomainWitness, bindings: SourceStorageScope): void => {
      const context = boundary.creationBindings ?? bindings;
      if (boundaries.some(selected => selected.kind === boundary.kind && selected.subject === boundary.subject &&
        selected.owner === boundary.owner && selected.exposure === boundary.exposure && selected.bindings === context)) return;
      if (rows.add(1)) boundaries.push(Object.freeze({ kind: boundary.kind, subject: boundary.subject, exposure: boundary.exposure,
        ...(boundary.owner === undefined ? {} : { owner: boundary.owner }), bindings: context }));
    };
    for (const frontier of selected.effectFrontiers) {
      if (!budget.step()) break;
      if (frontier.exposure !== undefined)
        retainBoundary({ kind: "opaque-write", subject: frontier.subject, exposure: frontier.exposure }, frontier.scope);
    }
    let reason: string | undefined;
    for (const demand of selected.emptyDemands) {
      if (!budget.step()) break;
      if (demand.kind !== "reference" && demand.kind !== "leaf") { reason = sourceStorageMissingProducerReason; break; }
      const stores = transport.storedValuesFor(demand.subject);
      let explained = false;
      for (const entry of stores ?? []) {
        if (!budget.step()) break;
        if (entry.store.reason !== undefined) { reason = sourceStorageMissingProducerReason; break; }
        if (entry.value === undefined) continue;
        const frontier = transport.substitutions.walk(entry.value, demand.scope, { kind: "input", admits: isExternalInput });
        const failure = demandedFailure(frontier, purpose);
        if (failure !== undefined) budget.reject(failure);
        if (frontier === undefined || frontier.reason !== undefined || frontier.fatalReason !== undefined || frontier.emptyDemands.length !== 0) {
          reason = budget.failure() ?? frontier?.reason ?? sourceStorageMissingProducerReason;
          break;
        }
        for (const current of frontier.subjects) {
          if (!budget.step()) break;
          if (!current.contributes || !frontier.origins.has(current.subject) || !isExternalInput(current)) continue;
          for (const boundary of boundariesFor(current.subject, current.bindings)) {
            if (!budget.step()) break;
            if (boundary.kind !== "external-input" || closedSourceInvocation(boundary.exposure, current.bindings)) continue;
            retainBoundary(boundary, current.bindings);
            explained = true;
          }
        }
        if (budget.failure() !== undefined) break;
      }
      if (reason !== undefined || budget.failure() !== undefined) break;
      if (!explained) { reason = sourceStorageMissingProducerReason; break; }
    }
    // An external receiver of a contributing member read supplies that member through its declared contract: the
    // declared member (an interface signature with its own external input, or a class member with its own producers)
    // joins the domain in place of the receiver, so observed callers never close an outside caller's member.
    const declaredMembers = new Map<SourceStorageSubject, SourceStorageSubject[]>();
    for (const candidate of selected.subjects) {
      if (!budget.step()) break;
      const node = candidate.subject.node;
      if (!candidate.contributes || candidate.subject.kind !== "value" || candidate.subject.projection.length !== 0 ||
        !ast.is.IsPropertyAccessExpression(node)) continue;
      const declaration = navigation.memberAccess(node)?.declaration;
      const member = declaration === undefined ? undefined : sourceStorageMemberSubject(declaration, ast, transport.subject);
      if (member === undefined) continue;
      let receiver = transport.subjectFor(Node_Expression(ast, node));
      for (let depth = 0; receiver !== undefined && depth < 64; depth += 1) {
        if (!budget.step() || !rows.add(1)) break;
        const members = declaredMembers.get(receiver) ?? [];
        if (!members.includes(member)) members.push(member);
        declaredMembers.set(receiver, members);
        const parents = transport.incomingFor(receiver);
        receiver = parents.size === 1 ? parents.values().next().value : undefined;
      }
    }
    const pending: (SourceStorageRelationWitness & { readonly original: boolean })[] = [...selected.subjects];
    const visited = new Map<SourceStorageScope, Set<SourceStorageSubject>>();
    while (reason === undefined && pending.length !== 0) {
      if (!budget.step()) break;
      const current = pending.pop()!;
      const seen = visited.get(current.bindings);
      if (seen?.has(current.subject)) continue;
      if (!rows.add(1 + (seen === undefined ? 1 : 0))) break;
      const retained = seen ?? new Set<SourceStorageSubject>();
      retained.add(current.subject); visited.set(current.bindings, retained);
      const stores = purpose === "storage-producers" ? transport.storedInputsFor(current.subject) : undefined;
      reason = transport.directlyUnresolvedFor(current.subject) ?? transport.unresolvedStoredInputsFor(current.subject);
      if (reason !== undefined) break;
      for (const boundary of boundariesFor(current.subject, current.bindings)) {
        if (!budget.step()) break;
        if (separateExportedCreation(boundary, current.bindings)) continue;
        if (boundary.kind === "opaque-result" && !current.observesValue) continue;
        if ((boundary.kind === "opaque-result" || boundary.kind === "opaque-write" || boundary.kind === "unclassified-exposure") &&
          closedSourceInvocation(boundary.exposure, current.bindings)) continue;
        if (boundary.kind === "external-input") {
          if (aggregateInput(current, boundary.exposure) && (current.contributes || purpose === "storage-producers")) continue;
          if (purpose === "storage-producers" && !current.contributes) {
            if (!closedSourceInvocation(boundary.exposure, current.bindings) && !transport.substitutions.isBound(current.subject, current.bindings))
              for (const member of declaredMembers.get(current.subject) ?? [])
                pending.push({ subject: member, bindings: current.bindings, contributes: true, observesValue: current.observesValue, original: false });
            continue;
          }
          if (closedSourceInvocation(boundary.exposure, current.bindings)) continue;
          if (transport.substitutions.isBound(current.subject, current.bindings) ||
            stores !== undefined && boundary.owner !== undefined || receiverBinding(current.subject, current.bindings)) continue;
          if (boundary.owner !== undefined) {
            const members = selectedMembers(current.subject, boundary.owner, current.bindings);
            if (members !== undefined) { pending.push(...members.map(member => ({ ...member, contributes: current.contributes,
              observesValue: current.observesValue, original: false }))); continue; }
          }
        }
        retainBoundary(boundary, current.bindings);
      }
      const origin = current.subject;
      if (selected.origins.has(origin) && ast.is.IsVariableDeclaration(origin.node) && Node_Initializer(ast, origin.node) === undefined &&
        !navigation.isProjectDeclaration(origin.node) && (transport.nativeConstructorsFor(origin)?.length ?? 0) === 0)
        retainBoundary({ kind: "external-input", subject: origin, exposure: origin.node }, current.bindings);
    }
    // An unbound external input is the domain's boundary, never one of its executed producers.
    const boundSubjects: SourceStorageScopedSubject[] = [];
    const producing = new Set<SourceStorageSubject>();
    for (const candidate of selected.subjects) {
      if (!budget.step()) break;
      if (!candidate.original) continue;
      if (purpose === "storage-producers" && bindings === transport.substitutions.empty && candidate.subject.kind === "input" &&
        entryActivation(candidate.bindings) &&
        isExternalInput(candidate)) continue;
      if (!rows.add(1)) break;
      boundSubjects.push(candidate);
      producing.add(candidate.subject);
    }
    if (budget.failure() !== undefined) reason = budget.failure();
    const subjects = purpose === "storage-producers" ? [...selected.origins].filter(origin => producing.has(origin) ||
      !selected.subjects.some(candidate => candidate.subject === origin && candidate.contributes)) : [...selected.origins];
    return Object.freeze({ subjects: Object.freeze(subjects), boundSubjects: Object.freeze(boundSubjects),
      boundaries: Object.freeze(boundaries), reason, absence: selected.absence });
  });
  const writeBoundariesFor = (subject: SourceStorageSubject) => {
    initialize();
    const selected = boundariesFor(subject).filter(boundary => boundary.kind === "external-write" ||
      (boundary.kind === "opaque-write" || boundary.kind === "unclassified-exposure") &&
      !closedSourceInvocation(boundary.exposure, transport.substitutions.empty));
    const reason = budget.failure() ?? transport.directlyUnresolvedFor(subject) ?? selected.map(boundary =>
      transport.unresolvedInvocations.get(boundary.exposure)).find(reason => reason !== undefined);
    const boundaries = selected.map(boundary => Object.freeze({ kind: boundary.kind, subject: boundary.subject,
      exposure: boundary.exposure, ...(boundary.owner === undefined ? {} : { owner: boundary.owner }) }));
    return Object.freeze({ boundaries: Object.freeze(boundaries), reason });
  };
  return Object.freeze({ select, writeBoundariesFor });
}
