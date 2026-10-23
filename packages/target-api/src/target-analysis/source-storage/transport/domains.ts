import type { Node, SourceFile, Type } from "@tsonic/tsts";
import { argumentPassingFactKey, flowStateFactKey, pointerOperationFactKey } from "@tsonic/tsts";
import { Node_Expression, Node_Initializer } from "../../../source-navigation/index.js";
import type { TargetSourceProgram } from "../../../source-semantics/index.js";
import { sourcePresentStorageType, sourceStorageComponents, sourceStorageSubjectType, sourceStorageComponentType, sourceStorageIsScalarType } from "../model/components.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageSubject } from "../model/subjects.js";
import { sourceStorageHasOriginalCallableValue, sourceStorageIsDataMember, sourceStorageIsMemberProjection, sourceStorageMemberSubject } from "../model/subjects.js";
import type { SourceStorageScopedSubject, SourceStorageScope } from "../graph/scoped-model.js";
import { sourceStorageMissingProducerReason } from "../scoped/substitutions.js";
import type { createSourceStorageTransport } from "./transport.js";
import type { SourceStorageDomainBoundary } from "../model/types.js";
import { createSourceStorageDomainWitnesses } from "../graph/domain-witnesses.js";
import { createSourceStorageDomainPublications, type SourceStoragePublication } from "../graph/domain-publications.js";
import { createSourceStorageDomainInputs } from "./domain-inputs.js";
import { sourceStorageClassLineages } from "../model/construction.js";
import { sourceStorageConstructionExpression } from "../model/construction.js";

export function createSourceStorageDomains(
  source: TargetSourceProgram,
  transport: ReturnType<typeof createSourceStorageTransport>,
  budget: SourceStorageBudget,
) {
  const { ast, navigation, semantics } = source;
  const witnesses = createSourceStorageDomainWitnesses(budget);
  const publications = createSourceStorageDomainPublications(budget, (ancestor, current) => {
    if (!semantics.forFile(current.sourceFile).types.isIdentical(ancestor.type, current.type) ||
      ancestor.subject.node !== current.subject.node || ancestor.subject.kind !== current.subject.kind ||
      ancestor.subject.projection.length >= current.subject.projection.length ||
      transport.subject(current.subject.node, current.subject.kind,
        current.subject.projection.slice(0, ancestor.subject.projection.length)) !== ancestor.subject) return false;
    if (witnesses.forSubject(ancestor.subject).some(boundary => boundary.exposure === current.exposure &&
      (boundary.kind === "external-input" && (boundary.owner === current.inputOwner ||
        boundary.owner === undefined && ancestor.subject === current.inputOwner) ||
        boundary.kind === "external-write" || boundary.kind === "opaque-write"))) return true;
    const types = semantics.forFile(current.sourceFile).types;
    const original = sourceStorageSubjectType(source, ancestor.subject, transport.sourceFileFor(ancestor.subject));
    const repeated = sourceStorageSubjectType(source, current.subject, transport.sourceFileFor(current.subject));
    if (original === undefined || repeated === undefined || !types.isIdentical(original, repeated) ||
      types.isAny(original) || types.isUnknown(original) || types.couldContainTypeVariables(original)) return false;
    const alternatives = types.isUnion(current.type) ? types.unionOrIntersectionTypes(current.type) : [current.type];
    return alternatives.every(present => {
      if (!budget.step()) return false;
      if (types.isNullish(present) || sourceStorageIsScalarType(present, semantics.forFile(current.sourceFile))) return true;
      if (types.isAny(present) || types.isUnknown(present) || types.couldContainTypeVariables(present) ||
        types.callSignatures(present).length !== 0 || types.constructSignatures(present).length !== 0) return false;
      const indexes = types.indexInfos(present);
      const properties = types.propertyInfos(present);
      if (indexes.length === 0 && properties.length === 0) return false;
      return indexes.every(index => index.readonly) && properties.every(property =>
        property.readonly && [property.symbol, ...property.rootSymbols].every(symbol =>
          semantics.forFile(current.sourceFile).declarations.symbolDeclarations(symbol).every(declaration =>
            sourceStorageIsDataMember(declaration, ast))));
    });
  });
  const domainInputs = createSourceStorageDomainInputs(transport, witnesses, budget);
  let initialized = false;
  const add = domainInputs.add;
  const publish = (subject: SourceStorageSubject | undefined, exposure: Node, writes = true,
    kind: SourceStoragePublication["kind"] = "external-write", type?: Type, sourceFile?: SourceFile, externalEntry = false,
    inputOwner?: SourceStorageSubject, parent?: SourceStoragePublication): void => {
    if (subject === undefined) return;
    const file = sourceFile ?? transport.sourceFileFor(subject);
    const selected = type ?? sourceStorageSubjectType(source, subject, file);
    if (selected !== undefined && file !== undefined)
      publications.add(subject, selected, file, exposure, writes, kind, externalEntry, inputOwner, parent);
  };
  const callable = (declaration: Node, exposure: Node): void => {
    const selected = navigation.callableImplementation(declaration);
    const owner = selected.kind === "resolved" ? selected.implementation.declaration : declaration;
    if (!publications.callable(owner, exposure)) return;
    if (ast.is.IsClassDeclaration(owner) || ast.is.IsClassExpression(owner)) {
      const constructors = navigation.classConstructors(owner);
      if (constructors.kind === "resolved") for (const signature of constructors.signatures) {
        if (!budget.step()) return;
        for (const parameter of signature.parameters) {
          if (!budget.step()) return;
          const formal = transport.subject(parameter.parameterDeclaration, "input");
          add(formal, "external-input", exposure);
          publish(formal, exposure, false, "external-write", undefined, undefined, true, formal);
        }
      }
      publish(transport.subject(owner, "receiver"), exposure);
    } else {
      for (const parameter of ast.parameters(owner)) {
        if (!budget.step()) return;
        const formal = transport.subject(parameter, "input");
        const entries = transport.invocations.has(exposure) ? transport.callbackEntriesFor(exposure).filter(callback =>
          budget.step() && transport.callbackImplementationsFor(callback).has(owner)) : [];
        const nativeInput = formal !== undefined && entries.length !== 0 &&
          entries.every(callback => {
            if (!budget.step()) return false;
            const selected = transport.invocationInputs(formal, owner, exposure, callback);
            return selected.subjects.size !== 0 && !selected.subjects.has(formal) &&
              selected.calleeSubjects?.includes(formal) !== true;
          });
        if (nativeInput) continue;
        add(formal, "external-input", exposure);
        publish(formal, exposure, false, "external-write", undefined, undefined, true, formal);
      }
      if (ast.body(owner) !== undefined) {
        if (ast.is.IsMethodDeclaration(owner) || ast.is.IsGetAccessorDeclaration(owner) || ast.is.IsSetAccessorDeclaration(owner))
          add(transport.subject(owner, "receiver"), "external-input", exposure);
        publish(transport.subject(owner, "return"), exposure, true, "external-write", undefined, undefined, true);
      }
    }
  };
  const accessible = (declaration: Node): boolean => !ast.hasModifierKind(declaration, "private");
  const initializePublications = (): void => {
    for (const node of transport.visitedNodes) {
      if (!budget.step()) return;
      if (!ast.is.IsVariableDeclaration(node) && !ast.is.IsFunctionDeclaration(node) && !ast.is.IsClassDeclaration(node)) continue;
      if (ast.is.IsVariableDeclaration(node) && navigation.isProjectDeclaration(node) && Node_Initializer(ast, node) === undefined) {
        for (let owner: Node | undefined = node; owner !== undefined && !ast.is.IsSourceFile(owner) && budget.step(); owner = ast.parent(owner)) {
          if (!ast.hasModifierKind(owner, "ambient")) continue;
          const subject = transport.subjectFor(node);
          add(subject, "external-input", node);
          publish(subject, node, false, "external-write", undefined, undefined, true, subject);
          break;
        }
      }
      const summary = navigation.declarationUseSummary(node);
      if (summary.exported) {
        const subject = transport.subjectFor(node);
        if (ast.is.IsVariableDeclaration(node) && ast.variableDeclarationKind(node) !== "const") add(subject, "external-write", node);
        publish(subject, node);
        if (ast.is.IsClassDeclaration(node) || ast.is.IsFunctionDeclaration(node)) callable(node, node);
      }
      if (summary.hasUnclassifiedValueUse) publish(transport.subjectFor(node), node, true, "unclassified-exposure");
    }
    for (const boundary of transport.boundaries) {
      if (!budget.step()) return;
      const effect = transport.invocationEffects.get(boundary.invocation);
      if (effect?.resultAlias === undefined && effect?.resultAllocation === undefined)
        add(transport.subject(boundary.invocation), "opaque-result", boundary.invocation);
      for (const expression of transport.invocationArguments.get(boundary.invocation) ?? []) {
        if (!budget.step()) return;
        const subject = transport.subjectFor(expression);
        publish(subject, boundary.invocation, true, "opaque-write");
        const passing = source.sourceFacts.getFact(expression, argumentPassingFactKey);
        const flow = source.sourceFacts.getFact(expression, flowStateFactKey);
        const pointer = source.sourceFacts.getFact(expression, pointerOperationFactKey);
        const storage = passing?.storageExpression ?? (pointer?.operation === "address-of" ? pointer.storageExpression : undefined);
        const file = storage === undefined ? undefined : ast.getSourceFile(storage);
        if (storage !== undefined && (file === undefined || !semantics.includes(file))) {
          budget.reject("Source storage exposure requires its exact checked storage expression.");
          return;
        }
        if (passing !== undefined && passing.mode !== "by-value" && passing.mode !== "byref-readonly" && passing.mode !== "borrow-shared" ||
          pointer?.operation === "address-of" || flow?.state === "borrowed-mut")
          add(transport.locationFor(storage ?? expression), "opaque-write", boundary.invocation);
      }
    }
    for (let index = 0; index < publications.size() && budget.step(); index += 1) {
      const publication = publications.at(index)!;
      const context = semantics.forFile(publication.sourceFile);
      const present = sourcePresentStorageType(publication.type, context);
      if (present === undefined) {
        if (context.types.isUnion(publication.type)) for (const type of context.types.unionOrIntersectionTypes(publication.type)) {
          if (!budget.step()) return;
          if (!context.types.isNullish(type)) publish(publication.subject, publication.exposure, publication.writes,
            publication.kind, type, publication.sourceFile, publication.externalEntry, publication.inputOwner, publication);
        }
        continue;
      }
      if (sourceStorageIsScalarType(present, context) || context.types.isNullish(present) ||
        context.types.isVoidLike(present) || context.types.isNever(present)) continue;
      if (context.types.propertyInfos(present).length === 0 && context.types.indexInfos(present).length === 0 &&
        context.types.callSignatures(present).length === 0 && context.types.constructSignatures(present).length === 0) continue;
      for (const owner of publicationOrigins(publication.subject, publication.externalEntry)) {
        if (!budget.step()) return;
        const file = transport.sourceFileFor(owner);
        const type = sourceStorageSubjectType(source, owner, file);
        if (type === undefined || file === undefined) continue;
        const ownerContext = semantics.forFile(file);
        for (const signature of [...ownerContext.types.callSignatures(type), ...ownerContext.types.constructSignatures(type)]) {
          if (!budget.step()) return;
          const declaration = ownerContext.declarations.signatureDeclaration(signature);
          if (declaration !== undefined) callable(declaration, publication.exposure);
        }
        const members = transport.memberFlow.membersFor(owner, present);
        if (members === undefined) {
          const components = transport.memberFlow.componentsFor(owner);
          if (components === undefined) add(owner, "unclassified-exposure", publication.exposure, publication.inputOwner);
          else for (const component of components) {
            if (!budget.step()) return;
            const child = component.kind === "member" || component.kind === "method-value"
              ? sourceStorageMemberSubject(component.declaration, ast, transport.subject)
              : transport.subject(owner.node, owner.kind, [...owner.projection, component]);
            add(child, "unclassified-exposure", publication.exposure, owner);
          }
        }
        for (const member of members === undefined ? [] : members) {
          if (!budget.step()) return;
          if (member.kind !== "present") continue;
          const declarations = new Set<Node>();
          for (const declaration of member.source.declarations) { if (!budget.step()) return; declarations.add(declaration); }
          for (const declaration of declarations) {
            if (!budget.step()) return;
            if (!accessible(declaration) || !transport.retainCheckedContext(declaration, file)) continue;
            const child = sourceStorageMemberSubject(declaration, ast, transport.subject);
            if (publication.inputOwner !== undefined) add(child, "external-input", publication.exposure, publication.inputOwner);
            const declaringOwner = ast.parent(declaration);
            const objectMethod = ast.is.IsMethodDeclaration(declaration) && declaringOwner !== undefined &&
              ast.is.IsObjectLiteralExpression(declaringOwner);
            if (publication.writes && (!member.destination.property.readonly || !member.source.property.readonly) &&
              (member.destination.read !== "method" || objectMethod) &&
              !ast.is.IsGetAccessorDeclaration(declaration) && !ast.is.IsSetAccessorDeclaration(declaration))
              add(child, publication.kind, publication.exposure, owner);
            if (publication.writes) for (const setter of member.source.setters) {
              if (!budget.step()) return;
              callable(setter, publication.exposure);
            }
            if (member.destination.read === "method" && !sourceStorageIsDataMember(declaration, ast)) callable(declaration, publication.exposure);
            else publish(child, publication.exposure, publication.writes, publication.kind, member.destination.property.type, file,
              publication.externalEntry, publication.inputOwner, publication);
          }
        }
        const indexes = context.types.indexInfos(present);
        for (const component of sourceStorageComponents(present, context)) {
          if (!budget.step()) return;
          const element = sourceStorageComponentType(present, component, context, ast);
          if (element === undefined) continue;
          const originals = component.kind === "array-element" ? sourceStorageComponents(type, ownerContext)
            : [ownerContext.types.isTuple(type) ? component : { kind: "array-element" as const }];
          for (const original of originals) {
            if (!budget.step()) return;
            const child = transport.subject(owner.node, owner.kind, [...owner.projection, original]);
            if (publication.inputOwner !== undefined) add(child, "external-input", publication.exposure, publication.inputOwner);
            if (publication.writes && indexes.some(value => !value.readonly)) add(child, publication.kind, publication.exposure, owner);
            publish(child, publication.exposure, publication.writes, publication.kind, element, file, publication.externalEntry, publication.inputOwner, publication);
          }
        }
      }
    }
  };
  const initialize = (): void => {
    if (initialized) return;
    initialized = true;
    try {
      initializePublications();
    } finally {
      publications.finish();
      domainInputs.seal();
    }
  };
  const boundariesFor = (subject: SourceStorageSubject): readonly Omit<SourceStorageDomainBoundary, "bindings">[] => {
    const selected = [...witnesses.forSubject(subject)];
    for (let length = 0; length < subject.projection.length && budget.step(); length += 1) {
      const owner = transport.subject(subject.node, subject.kind, subject.projection.slice(0, length));
      for (const boundary of owner === undefined ? [] : witnesses.forSubject(owner)) {
        if (!budget.step()) break;
        if (boundary.kind === "external-input" || boundary.kind === "external-write" || boundary.kind === "opaque-write" ||
          boundary.kind === "unclassified-exposure") selected.push(boundary);
      }
    }
    return selected;
  };
  const closedSourceInvocation = (invocation: Node, bindings: SourceStorageScope): boolean => {
    if (transport.unresolvedInvocations.has(invocation)) return false;
    if (ast.is.IsCallExpression(invocation) && ast.kindName(Node_Expression(ast, invocation)) !== "KindSuperKeyword") {
      const target = transport.invocationTargets.get(invocation);
      const selected = target === undefined ? undefined : transport.substitutions.walk(target, bindings);
      if (selected === undefined || selected.reason !== undefined || selected.fatalReason !== undefined ||
        selected.emptyDemands.length !== 0 || selected.origins.size === 0) return false;
      for (const origin of selected.origins) {
        if (!budget.step() || !sourceStorageHasOriginalCallableValue(origin, ast)) return false;
        const implementation = navigation.callableImplementation(origin.node);
        if (implementation.kind !== "resolved" || ast.body(implementation.implementation.declaration) === undefined) return false;
      }
      // The callee's receiver selects the member: an unbound external receiver leaves the implementation open even though
      // the receiver value itself does not contribute.
      const receivers = new Set<SourceStorageSubject>();
      const callee = Node_Expression(ast, invocation);
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
        for (const boundary of boundariesFor(current.subject)) {
          if (!budget.step()) return false;
          if (boundary.kind === "external-input") {
            if (!transport.substitutions.isBound(current.subject, current.bindings) && !receiverBinding(current.subject, current.bindings)) return false;
          } else if (boundary.kind === "external-write" || boundary.exposure !== invocation) return false;
        }
      }
      return true;
    }
    if (sourceStorageConstructionExpression(invocation, source, budget.step) === undefined) return false;
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
      const pending = bound.map(input => ({ ...input, type }));
      const visited = new Map<SourceStorageScope, Map<SourceStorageSubject, Set<Type>>>();
      while (pending.length !== 0) {
        if (!budget.step()) return undefined;
        const current = pending.pop()!;
        const states = visited.get(current.bindings);
        const subjects = states?.get(current.subject);
        if (subjects?.has(current.type)) continue;
        if (!rows.add(1 + (states === undefined ? 1 : 0) + (subjects === undefined ? 1 : 0))) return undefined;
        const selected = states ?? new Map<SourceStorageSubject, Set<Type>>();
        const types = subjects ?? new Set<Type>();
        types.add(current.type); selected.set(current.subject, types); visited.set(current.bindings, selected);
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
            else pending.push({ subject: original, bindings: current.bindings, type: member.destination.property.type });
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
  const publicationOrigins = function* (subject: SourceStorageSubject, externalEntry: boolean): Iterable<SourceStorageSubject> {
    const bindings = externalEntry ? transport.substitutions.forLexicalOwner(subject.node) : transport.substitutions.empty;
    if (bindings === undefined) {
      budget.reject("Source storage publication requires its completed original lexical creation bindings.");
      return;
    }
    const selected = transport.substitutions.walk(subject, bindings, current => {
      if (current.subject.kind === "value" && ast.is.IsIdentifier(current.subject.node)) {
        const declaration = navigation.sourceReferenceFor(current.subject.node)?.declaration;
        const input = declaration !== undefined && ast.is.IsParameterDeclaration(declaration) ? transport.subject(declaration, "input") : undefined;
        if (input !== undefined && !transport.substitutions.isBound(input, current.bindings) &&
          transport.guardedValues.appliesTo(current.subject.node) === true) return true;
      }
      if (transport.substitutions.isBound(current.subject, current.bindings)) return false;
      domainInputs.read(current.subject);
      return domainInputs.has(current.subject);
    });
    yield* selected?.origins ?? [];
    if (selected !== undefined && (selected.reason !== undefined || selected.fatalReason !== undefined || selected.emptyDemands.length !== 0) &&
      !selected.origins.has(subject)) yield subject;
  };
  // The root scope and a top-level declaration activation are where an outside caller's values enter.
  const entryActivation = (bindings: SourceStorageScope): boolean => bindings === transport.substitutions.empty ||
    bindings.kind === "frame" && bindings.boundary === "declaration" && bindings.parents.length === 1 &&
    bindings.parents[0] === transport.substitutions.empty;
  // A member location reached from outside the program that the program also writes holds those writes as well.
  const writtenMember = (subject: SourceStorageSubject): boolean => {
    const last = subject.projection[subject.projection.length - 1];
    const member = last !== undefined && sourceStorageIsMemberProjection(last)
      ? sourceStorageMemberSubject(last.declaration, ast, transport.subject) : subject.kind === "member" ? subject : undefined;
    return member !== undefined && (transport.storedValuesFor(member)?.length ?? 0) !== 0;
  };
  const select = (subject: SourceStorageSubject, bindings: SourceStorageScope,
    purpose: "values" | "storage-producers" = "values") => budget.withRows(rows => {
    initialize();
    const isExternalInput = (current: SourceStorageScopedSubject): boolean => {
      const boundaries = boundariesFor(current.subject);
      if (!boundaries.some(boundary => boundary.kind === "external-input")) return false;
      if (transport.substitutions.isBound(current.subject, current.bindings) ||
        receiverBinding(current.subject, current.bindings)) return false;
      // A location with stored writes holds them as well as its outside value, so the walk continues into its stores.
      if (writtenMember(current.subject)) return false;
      const stores = transport.storedInputsFor(current.subject);
      return boundaries.some(boundary => boundary.kind === "external-input" &&
        (boundary.owner === undefined || stores === undefined) &&
        !closedSourceInvocation(boundary.exposure, current.bindings));
    };
    const selected = transport.substitutions.walk(subject, bindings, isExternalInput, false);
    if (selected?.fatalReason !== undefined) budget.reject(selected.fatalReason);
    if (selected === undefined || selected.reason !== undefined || budget.failure() !== undefined) return Object.freeze({
      subjects: Object.freeze([] as SourceStorageSubject[]), boundaries: Object.freeze([] as SourceStorageDomainBoundary<SourceStorageScope>[]),
      boundSubjects: Object.freeze([] as SourceStorageScopedSubject[]),
      absence: false,
      reason: budget.failure() ?? selected?.reason ?? "Source storage requires one completed scoped relation.",
    });
    const boundaries: SourceStorageDomainBoundary<SourceStorageScope>[] = [];
    const retainBoundary = (boundary: Omit<SourceStorageDomainBoundary, "bindings">, bindings: SourceStorageScope): void => {
      if (boundaries.some(selected => selected.kind === boundary.kind && selected.subject === boundary.subject &&
        selected.owner === boundary.owner && selected.exposure === boundary.exposure && selected.bindings === bindings)) return;
      if (rows.add(1)) boundaries.push(Object.freeze({ ...boundary, bindings }));
    };
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
        const frontier = transport.substitutions.walk(entry.value, demand.scope, isExternalInput);
        if (frontier?.fatalReason !== undefined) budget.reject(frontier.fatalReason);
        if (frontier === undefined || frontier.reason !== undefined || frontier.fatalReason !== undefined || frontier.emptyDemands.length !== 0) {
          reason = budget.failure() ?? frontier?.reason ?? sourceStorageMissingProducerReason;
          break;
        }
        for (const current of frontier.subjects) {
          if (!budget.step()) break;
          if (!current.contributes || !frontier.origins.has(current.subject) || !isExternalInput(current)) continue;
          for (const boundary of boundariesFor(current.subject)) {
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
      const declaration = semantics.forNode(node).operations.propertyAccess(node)?.selectedDeclaration;
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
    const pending = [...selected.subjects];
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
      for (const boundary of boundariesFor(current.subject)) {
        if (!budget.step()) break;
        if ((boundary.kind === "opaque-result" || boundary.kind === "opaque-write" || boundary.kind === "unclassified-exposure") &&
          closedSourceInvocation(boundary.exposure, current.bindings)) continue;
        if (boundary.kind === "external-input") {
          if (purpose === "storage-producers" && !current.contributes) {
            if (!closedSourceInvocation(boundary.exposure, current.bindings) && !transport.substitutions.isBound(current.subject, current.bindings))
              for (const member of declaredMembers.get(current.subject) ?? [])
                pending.push({ subject: member, bindings: current.bindings, contributes: true });
            continue;
          }
          if (closedSourceInvocation(boundary.exposure, current.bindings)) continue;
          if (transport.substitutions.isBound(current.subject, current.bindings) ||
            stores !== undefined && boundary.owner !== undefined || receiverBinding(current.subject, current.bindings)) continue;
          if (boundary.owner !== undefined) {
            const members = selectedMembers(current.subject, boundary.owner, current.bindings);
            if (members !== undefined) { pending.push(...members.map(member => ({ ...member, contributes: current.contributes }))); continue; }
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
      if (!candidate.contributes || !selected.origins.has(candidate.subject)) continue;
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
    const boundaries = boundariesFor(subject).filter(boundary => boundary.kind === "external-write" ||
      boundary.kind === "opaque-write" || boundary.kind === "unclassified-exposure");
    const reason = budget.failure() ?? transport.directlyUnresolvedFor(subject) ?? boundaries.map(boundary =>
      transport.unresolvedInvocations.get(boundary.exposure)).find(reason => reason !== undefined);
    return Object.freeze({ boundaries: Object.freeze(boundaries), reason });
  };
  return Object.freeze({ select, writeBoundariesFor });
}
