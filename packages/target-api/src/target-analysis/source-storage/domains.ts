import type { Node, SourceFile, Type } from "@tsonic/tsts";
import { argumentPassingFactKey, flowStateFactKey, pointerOperationFactKey } from "@tsonic/tsts";
import { Node_Expression, Node_Initializer } from "../../source-navigation/index.js";
import type { TargetSourceProgram } from "../../source-semantics/index.js";
import { sourcePresentStorageType, sourceStorageComponents, sourceStorageSubjectType, sourceStorageComponentType } from "./components.js";
import type { SourceStorageBudget } from "./resource-budget.js";
import type { SourceStorageSubject } from "./subjects.js";
import { sourceStorageHasOriginalCallableValue } from "./subjects.js";
import type { SourceStorageSubstitutions } from "./substitutions.js";
import type { createSourceStorageTransport } from "./transport.js";
import type { SourceStorageDomainBoundary } from "./types.js";
import { createSourceStorageDomainWitnesses } from "./domain-witnesses.js";
import { createSourceStorageDomainPublications, type SourceStoragePublication } from "./domain-publications.js";
import { createSourceStorageDomainInputs } from "./domain-inputs.js";

export function createSourceStorageDomains(
  source: TargetSourceProgram,
  transport: ReturnType<typeof createSourceStorageTransport>,
  budget: SourceStorageBudget,
) {
  const { ast, navigation, semantics } = source;
  const witnesses = createSourceStorageDomainWitnesses(budget);
  const publications = createSourceStorageDomainPublications(budget);
  const domainInputs = createSourceStorageDomainInputs(transport, witnesses, budget);
  const opaque = new Set(transport.boundaries.map(boundary => boundary.invocation));
  let initialized = false;
  const add = domainInputs.add;
  const publish = (subject: SourceStorageSubject | undefined, exposure: Node, writes = true,
    kind: SourceStoragePublication["kind"] = "external-write", type?: Type, sourceFile?: SourceFile, externalEntry = false,
    inputOwner?: SourceStorageSubject): void => {
    if (subject === undefined) return;
    const file = sourceFile ?? transport.sourceFileFor(subject);
    const selected = type ?? sourceStorageSubjectType(source, subject, file);
    if (selected !== undefined && file !== undefined)
      publications.add(subject, selected, file, exposure, writes, kind, externalEntry, inputOwner);
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
          const formal = transport.subject(parameter.parameterDeclaration);
          add(formal, "external-input", exposure);
          publish(formal, exposure, false, "external-write", undefined, undefined, true, formal);
        }
      }
      publish(transport.subject(owner, "receiver"), exposure);
    } else {
      for (const parameter of ast.parameters(owner)) {
        if (!budget.step()) return;
        const formal = transport.subject(parameter);
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
      const preservedInputs = new Set<Node>();
      for (const expression of effect?.preservedInputs ?? []) {
        if (!budget.step()) return;
        preservedInputs.add(expression);
      }
      if (effect?.resultAlias === undefined && effect?.resultAllocation === undefined)
        add(transport.subject(boundary.invocation), "opaque-result", boundary.invocation);
      for (const expression of transport.invocationArguments.get(boundary.invocation) ?? []) {
        if (!budget.step()) return;
        const subject = transport.subjectFor(expression);
        const preserved = preservedInputs.has(expression);
        publish(subject, boundary.invocation, !preserved, "opaque-write");
        if (preserved) continue;
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
          add(storage === undefined ? subject : transport.subjectFor(storage), "opaque-write", boundary.invocation);
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
            publication.kind, type, publication.sourceFile, publication.externalEntry, publication.inputOwner);
        }
        continue;
      }
      if (context.types.isStringLike(present) || context.types.isNumberLike(present) || context.types.isBooleanLike(present) ||
        context.types.isBigIntLike(present) || context.types.isSymbolLike(present) || context.types.isNullish(present) ||
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
        const contextual = ast.is.IsObjectLiteralExpression(owner.node) ? ownerContext.types.contextualType(owner.node) : undefined;
        const relation = ownerContext.types.structuralMembers(contextual ?? type, present);
        if (relation.kind === "available") for (const member of relation.members) {
          if (!budget.step()) return;
          if (member.kind !== "present") continue;
          for (const declaration of member.source.declarations) {
            if (!budget.step()) return;
            if (!accessible(declaration) || !transport.retainCheckedContext(declaration, file)) continue;
            const child = transport.subject(declaration, ast.is.IsGetAccessorDeclaration(declaration) ? "return" : "value");
            if (publication.inputOwner !== undefined) add(child, "external-input", publication.exposure, publication.inputOwner);
            if (publication.writes && (!member.destination.property.readonly || !member.source.property.readonly) && member.destination.read !== "method" &&
              !ast.is.IsGetAccessorDeclaration(declaration) && !ast.is.IsSetAccessorDeclaration(declaration))
              add(child, publication.kind, publication.exposure, owner);
            if (publication.writes) for (const setter of member.source.setters) {
              if (!budget.step()) return;
              callable(setter, publication.exposure);
            }
            if (member.destination.read === "method") callable(declaration, publication.exposure);
            else publish(child, publication.exposure, publication.writes, publication.kind, member.destination.property.type, file,
              publication.externalEntry, publication.inputOwner);
          }
        }
        const indexes = context.types.indexInfos(present);
        for (const component of sourceStorageComponents(present, context)) {
          if (!budget.step()) return;
          const element = sourceStorageComponentType(present, component, context);
          if (element === undefined) continue;
          const originals = component.kind === "array-element" ? sourceStorageComponents(type, ownerContext)
            : [ownerContext.types.isTuple(type) ? component : { kind: "array-element" as const }];
          for (const original of originals) {
            if (!budget.step()) return;
            const child = transport.subject(owner.node, owner.kind, [...owner.projection, original]);
            if (publication.inputOwner !== undefined) add(child, "external-input", publication.exposure, publication.inputOwner);
            if (publication.writes && indexes.some(value => !value.readonly)) add(child, publication.kind, publication.exposure, owner);
            publish(child, publication.exposure, publication.writes, publication.kind, element, file, publication.externalEntry, publication.inputOwner);
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
  const boundariesFor = (subject: SourceStorageSubject): readonly SourceStorageDomainBoundary[] => {
    const selected = [...witnesses.forSubject(subject)];
    for (let length = 0; length < subject.projection.length && budget.step(); length += 1) {
      const owner = transport.subject(subject.node, subject.kind, subject.projection.slice(0, length));
      for (const boundary of owner === undefined ? [] : witnesses.forSubject(owner)) {
        if (!budget.step()) break;
        if (boundary.kind === "external-input" || boundary.kind === "external-write" || boundary.kind === "opaque-write") selected.push(boundary);
      }
    }
    return selected;
  };
  const inputsFor = (subject: SourceStorageSubject, bindings: SourceStorageSubstitutions): ReadonlySet<SourceStorageSubject> => {
    const incoming = transport.incomingFor(subject);
    const receiver = subject.kind === "return" ? transport.subject(subject.node, "receiver") : undefined;
    if (incoming.size !== 0 && receiver !== undefined && bindings.has(receiver) && ast.body(subject.node) !== undefined) {
      const selected = new Set<SourceStorageSubject>();
      for (const origin of incoming) {
        if (!budget.step()) break;
        if (origin.kind !== "return") selected.add(origin);
      }
      return selected;
    }
    if (incoming.size !== 0 || subject.projection.length === 0) return incoming;
    const root = transport.subject(subject.node, subject.kind);
    const file = root === undefined ? undefined : transport.sourceFileFor(root);
    const type = root === undefined ? undefined : sourceStorageSubjectType(source, root, file);
    if (root === undefined || type === undefined || file === undefined) return incoming;
    const context = semantics.forFile(file);
    if (!context.types.couldContainTypeVariables(type)) return incoming;
    const selected = new Set<SourceStorageSubject>();
    for (const origin of transport.incomingFor(root)) {
      if (!budget.step()) break;
      const originType = sourceStorageSubjectType(source, origin, transport.sourceFileFor(origin));
      if (originType === undefined || !context.types.isIdentical(type, originType)) continue;
      const projected = transport.subject(origin.node, origin.kind, [...origin.projection, ...subject.projection]);
      if (projected !== undefined && (transport.substitutions.selection(projected, bindings) !== undefined ||
        transport.incomingFor(origin).size !== 0)) selected.add(projected);
    }
    return selected;
  };
  const dispatchInputs = (subject: SourceStorageSubject, bindings: SourceStorageSubstitutions): readonly SourceStorageSubject[] => {
    const node = subject.node;
    const selected = semantics.forNode(node).operations.call(node);
    const result: SourceStorageSubject[] = [];
    const accessor = transport.accessorTargets.has(node);
    const target = accessor ? undefined : transport.subjectFor(Node_Expression(ast, node));
    const physical = transport.physicalMemberInputs(node, origin => transport.substitutions.origins(origin, bindings));
    if (physical !== undefined) {
      for (const input of physical) {
        if (!budget.step()) break;
        result.push(input);
      }
    } else if (target !== undefined) result.push(target);
    const declaration = accessor ? transport.accessorTargets.get(node)?.[0] : transport.invocationDeclarations.get(node);
    if (declaration !== undefined && !ast.hasModifierKind(declaration, "static") && !ast.hasModifierKind(declaration, "private") &&
      (ast.is.IsMethodDeclaration(declaration) || ast.kindName(declaration) === "KindMethodSignature" ||
        ast.is.IsGetAccessorDeclaration(declaration) || ast.is.IsSetAccessorDeclaration(declaration))) {
      const receiver = selected?.sourceReceiver?.expression ?? selected?.sourceCalleeAccess?.receiver.expression
        ?? semantics.forNode(node).operations.propertyAccess(node)?.receiver.expression;
      const receiverSubject = transport.subjectFor(receiver);
      if (receiverSubject !== undefined && ast.kindName(receiver) !== "KindSuperKeyword") result.push(receiverSubject);
    }
    return result;
  };
  const externalInput = (subject: SourceStorageSubject, bindings: SourceStorageSubstitutions): boolean => budget.withRows(rows => {
    const pending = [{ subject, bindings }];
    const visited = new Map<SourceStorageSubstitutions, Set<SourceStorageSubject>>();
    while (pending.length !== 0 && budget.step()) {
      const current = pending.pop()!;
      const checked = visited.get(current.bindings) ?? new Set<SourceStorageSubject>();
      if (checked.has(current.subject)) continue;
      if (!rows.add(1)) break;
      checked.add(current.subject);
      visited.set(current.bindings, checked);
      const bound = transport.substitutions.selection(current.subject, current.bindings);
      if (bound === undefined) {
        domainInputs.read(current.subject);
        if (domainInputs.has(current.subject)) return true;
      }
      for (const input of bound?.inputs ?? inputsFor(current.subject, current.bindings)) {
        if (!budget.step()) break;
        pending.push({ subject: input, bindings: bound?.context ?? current.bindings });
      }
    }
    return false;
  });
  const memberInputs = (subject: SourceStorageSubject, owner: SourceStorageSubject, bindings: SourceStorageSubstitutions) => {
    const bound = transport.substitutions.selection(owner, bindings);
    if (bound === undefined) return undefined;
    const file = transport.sourceFileFor(owner);
    const type = sourceStorageSubjectType(source, owner, file);
    if (type === undefined) return undefined;
    return budget.withRows(rows => {
      const result: { readonly subject: SourceStorageSubject; readonly bindings: SourceStorageSubstitutions }[] = [];
      const pending: { readonly subject: SourceStorageSubject; readonly type: Type }[] = [];
      for (const input of bound.inputs) {
        if (!budget.step()) break;
        pending.push({ subject: input, type });
      }
      const visited = new Map<SourceStorageSubject, Set<Type>>();
      while (pending.length !== 0 && budget.step()) {
        const current = pending.pop()!;
        const types = visited.get(current.subject) ?? new Set<Type>();
        if (types.has(current.type)) continue;
        if (!rows.add(1)) break;
        types.add(current.type);
        visited.set(current.subject, types);
        const file = transport.sourceFileFor(current.subject);
        const type = sourceStorageSubjectType(source, current.subject, file);
        if (file === undefined || type === undefined) continue;
        const relation = semantics.forFile(file).types.structuralMembers(type, current.type);
        if (relation.kind !== "available") continue;
        for (const member of relation.members) {
          if (!budget.step()) break;
          if (member.kind !== "present") continue;
          let matches = false;
          for (const declaration of member.destination.declarations) {
            if (!budget.step()) break;
            matches ||= declaration === subject.node;
          }
          for (const declaration of member.source.declarations) {
            if (!budget.step() || !transport.retainCheckedContext(declaration, file)) break;
            const original = transport.subject(declaration, ast.is.IsGetAccessorDeclaration(declaration) ? "return" : "value");
            if (original === undefined) continue;
            if (matches) result.push({ subject: original, bindings: bound.context });
            else pending.push({ subject: original, type: member.destination.property.type });
          }
        }
      }
      return result.length === 0 ? undefined : result;
    });
  };
  const returnReceiver = (subject: SourceStorageSubject, bindings: SourceStorageSubstitutions) => {
    if (subject.kind !== "return" || !ast.is.IsGetAccessorDeclaration(subject.node) && !ast.is.IsMethodDeclaration(subject.node)) return undefined;
    const receiver = transport.subject(subject.node, "receiver");
    return receiver === undefined ? undefined : transport.substitutions.selection(receiver, bindings);
  };
  const collectEffectiveInputs = (subject: SourceStorageSubject, bindings: SourceStorageSubstitutions, externalEntry: boolean) => {
    const bound = transport.substitutions.selection(subject, bindings);
    if (bound !== undefined) {
      const inputs: { readonly subject: SourceStorageSubject; readonly bindings: SourceStorageSubstitutions }[] = [];
      for (const input of bound.inputs) {
        if (!budget.step()) break;
        inputs.push({ subject: input, bindings: bound.context });
      }
      return inputs;
    }
    const members: { readonly subject: SourceStorageSubject; readonly bindings: SourceStorageSubstitutions }[] = [];
    if (bindings.size !== 0 && returnReceiver(subject, bindings) === undefined) {
      for (const formal of bindings.keys()) { if (!budget.step()) break; domainInputs.read(subject, formal); }
      for (const owner of domainInputs.owners(subject)) {
        if (!budget.step()) break;
        if (owner === undefined) continue;
        for (const input of memberInputs(subject, owner, bindings) ?? []) {
          if (!budget.step()) break;
          members.push(input);
        }
      }
    }
    if (members.length !== 0) return members;
    if (externalEntry) {
      domainInputs.read(subject);
      if (domainInputs.has(subject)) return [];
    }
    const node = subject.node;
    const invocation = transport.invocations.has(node) || transport.accessorTargets.has(node);
    if (ast.is.IsNewExpression(node) && transport.invocationEffects.get(node)?.resultAlias === undefined) {
      const selected: { readonly subject: SourceStorageSubject; readonly bindings: SourceStorageSubstitutions }[] = [];
      for (const candidate of transport.invocationImplementations(node, origin => transport.substitutions.origins(origin, bindings))) {
        if (!budget.step()) break;
        const result = transport.subject(candidate, "return", subject.projection);
        if (result === undefined || transport.incomingFor(result).size === 0) continue;
        const state = transport.substitutions.forInvocation(candidate, node, bindings);
        if (state !== undefined) selected.push({ subject: result, bindings: state });
      }
      return selected;
    }
    if (invocation && transport.invocationEffects.get(node)?.resultAlias === undefined && !opaque.has(node) &&
      (!externalEntry || !dispatchInputs(subject, bindings).some(input => externalInput(input, bindings))) &&
      (ast.is.IsCallExpression(node) || transport.accessorTargets.has(node))) {
      const selected: { readonly subject: SourceStorageSubject; readonly bindings: SourceStorageSubstitutions }[] = [];
      for (const candidate of transport.invocationImplementations(node, origin => transport.substitutions.origins(origin, bindings))) {
        if (!budget.step()) break;
        const state = transport.substitutions.forInvocation(candidate, node, bindings);
        const result = transport.subject(candidate, "return", subject.projection);
        if (state !== undefined && result !== undefined) selected.push({ subject: result, bindings: state });
      }
      if (selected.length !== 0) return selected;
    }
    if (invocation && externalEntry && dispatchInputs(subject, bindings).some(input => externalInput(input, bindings))) return [];
    const inputs: { readonly subject: SourceStorageSubject; readonly bindings: SourceStorageSubstitutions }[] = [];
    for (const input of inputsFor(subject, bindings)) {
      if (!budget.step()) break;
      inputs.push({ subject: input, bindings });
    }
    return inputs;
  };
  const adjacencies = new WeakMap<SourceStorageSubstitutions, {
    readonly internal: ReturnType<typeof selectAdjacency>;
    readonly external: ReturnType<typeof selectAdjacency>;
  }>();
  const adjacencyRows = budget.createRows();
  const selectAdjacency = (bindings: SourceStorageSubstitutions, externalEntry: boolean) =>
    domainInputs.query((subject: SourceStorageSubject) => new Set(collectEffectiveInputs(subject, bindings, externalEntry)));
  const effectiveInputs = (subject: SourceStorageSubject, bindings: SourceStorageSubstitutions, externalEntry = false) => {
    let selected = adjacencies.get(bindings);
    if (selected === undefined) {
      if (!adjacencyRows.add(3)) return new Set<ReturnType<typeof collectEffectiveInputs>[number]>();
      selected = { internal: selectAdjacency(bindings, false), external: selectAdjacency(bindings, true) };
      adjacencies.set(bindings, selected);
    }
    return (externalEntry ? selected.external : selected.internal)(subject) ?? new Set<ReturnType<typeof collectEffectiveInputs>[number]>();
  };
  const publicationOrigins = (subject: SourceStorageSubject, externalEntry: boolean): ReadonlySet<SourceStorageSubject> => budget.withRows(rows => {
    const pending = [{ subject, bindings: transport.substitutions.empty }];
    const visited = new Map<SourceStorageSubstitutions, Set<SourceStorageSubject>>();
    const origins = new Set<SourceStorageSubject>();
    while (pending.length !== 0 && budget.step()) {
      const current = pending.pop()!;
      const checked = visited.get(current.bindings) ?? new Set<SourceStorageSubject>();
      if (checked.has(current.subject)) continue;
      if (!rows.add(1)) break;
      checked.add(current.subject);
      visited.set(current.bindings, checked);
      const inputs = effectiveInputs(current.subject, current.bindings, externalEntry);
      if (inputs.size === 0 || ast.is.IsNewExpression(current.subject.node) &&
        transport.invocationEffects.get(current.subject.node)?.resultAlias === undefined) origins.add(current.subject);
      for (const input of inputs) {
        if (!budget.step()) break;
        pending.push(input);
      }
    }
    return origins;
  });
  const select = (subject: SourceStorageSubject, bindings: SourceStorageSubstitutions,
    purpose: "values" | "storage-producers" = "values") => budget.withRows(rows => {
    initialize();
    const pending = [{ subject, bindings, collect: true }];
    const visited = new Map<SourceStorageSubstitutions, Map<SourceStorageSubject, number>>();
    const origins = new Set<SourceStorageSubject>();
    const boundaries = new Set<SourceStorageDomainBoundary>();
    let reason: string | undefined;
    while (pending.length !== 0 && budget.step()) {
      const current = pending.pop()!;
      const checked = visited.get(current.bindings) ?? new Map<SourceStorageSubject, number>();
      const flag = current.collect ? 2 : 1;
      const previous = checked.get(current.subject) ?? 0;
      if ((previous & flag) !== 0) continue;
      if (!rows.add(1)) break;
      checked.set(current.subject, previous | flag);
      visited.set(current.bindings, checked);
      const bound = transport.substitutions.selection(current.subject, current.bindings);
      const stores = purpose === "storage-producers" ? transport.storedInputsFor(current.subject) : undefined;
      if (stores !== undefined) {
        reason = transport.unresolvedStoredInputsFor(current.subject);
        if (reason !== undefined) break;
      }
      for (const forwarded of bound?.forwarded ?? []) {
        if (!budget.step()) break;
        for (const boundary of boundariesFor(forwarded)) {
          if (!budget.step()) break;
          if (boundary.kind !== "external-input") boundaries.add(boundary);
        }
      }
      for (const boundary of boundariesFor(current.subject)) {
        if (!budget.step()) break;
        if (stores !== undefined && boundary.kind === "external-input" && boundary.owner !== undefined) continue;
        const ownerBinding = boundary.kind !== "external-input" ? undefined : returnReceiver(current.subject, current.bindings)
          ?? (boundary.owner !== undefined && memberInputs(current.subject, boundary.owner, current.bindings) !== undefined
            ? transport.substitutions.selection(boundary.owner, current.bindings) : undefined);
        if (ownerBinding !== undefined) {
          for (const input of ownerBinding.inputs) {
            if (!budget.step()) break;
            pending.push({ subject: input, bindings: ownerBinding.context, collect: false });
          }
        } else if (boundary.kind !== "external-input" || bound === undefined) boundaries.add(boundary);
      }
      const node = current.subject.node;
      if (bound === undefined && (transport.invocations.has(node) || transport.accessorTargets.has(node)) &&
        transport.invocationEffects.get(node)?.resultAlias === undefined) {
        for (const input of dispatchInputs(current.subject, current.bindings)) {
          if (!budget.step()) break;
          pending.push({ subject: input, bindings: current.bindings, collect: false });
        }
      }
      const incoming = stores === undefined || bound !== undefined ? effectiveInputs(current.subject, current.bindings)
        : new Set([...stores].map(stored => ({ subject: stored, bindings: current.bindings })));
      if (current.collect && (incoming.size === 0 || sourceStorageHasOriginalCallableValue(current.subject, ast) || ast.is.IsNewExpression(node) &&
        transport.invocationEffects.get(node)?.resultAlias === undefined)) origins.add(current.subject);
      for (const origin of incoming) {
        if (!budget.step()) break;
        pending.push({ ...origin, collect: current.collect });
      }
    }
    return Object.freeze({ subjects: Object.freeze([...origins]), boundaries: Object.freeze([...boundaries]), reason });
  });
  return Object.freeze({ select });
}
