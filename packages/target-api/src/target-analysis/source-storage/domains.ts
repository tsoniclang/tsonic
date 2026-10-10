import type { Node, SourceFile, Type } from "@tsonic/tsts";
import { argumentPassingFactKey, flowStateFactKey, pointerOperationFactKey } from "@tsonic/tsts";
import { Node_Initializer } from "../../source-navigation/index.js";
import type { TargetSourceProgram } from "../../source-semantics/index.js";
import { sourcePresentStorageType, sourceStorageComponents, sourceStorageSubjectType, sourceStorageComponentType } from "./components.js";
import type { SourceStorageBudget } from "./resource-budget.js";
import type { SourceStorageSubject } from "./subjects.js";
import { sourceStorageMemberSubject } from "./subjects.js";
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
          const declarations = new Set<Node>();
          for (const selected of member.source.declarations) {
            if (!budget.step()) return;
            const originals = transport.memberFlow.declarationsFor(owner, selected, contextual ?? type);
            if (originals === undefined) {
              budget.reject("Source storage publication requires exact checked physical member correspondence.");
              return;
            }
            for (const declaration of originals) { if (!budget.step()) return; declarations.add(declaration); }
          }
          for (const declaration of declarations) {
            if (!budget.step()) return;
            if (!accessible(declaration) || !transport.retainCheckedContext(declaration, file)) continue;
            const child = sourceStorageMemberSubject(declaration, ast, transport.subject);
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
  const selectedMembers = (subject: SourceStorageSubject, owner: SourceStorageSubject, bindings: SourceStorageSubstitutions) => {
    const bound = transport.substitutions.selection(owner, bindings);
    if (bound === undefined) return undefined;
    const file = transport.sourceFileFor(owner);
    const type = sourceStorageSubjectType(source, owner, file);
    if (type === undefined) return undefined;
    return budget.withRows(rows => {
      const result: { readonly subject: SourceStorageSubject; readonly bindings: SourceStorageSubstitutions }[] = [];
      const pending = bound.map(input => ({ ...input, type }));
      const visited = new Map<SourceStorageSubstitutions, Map<SourceStorageSubject, Set<Type>>>();
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
          const matches = member.destination.declarations.includes(subject.node);
          for (const declaration of member.source.declarations) {
            if (!budget.step() || !transport.retainCheckedContext(declaration, file)) return undefined;
            const original = sourceStorageMemberSubject(declaration, ast, transport.subject);
            if (original === undefined) continue;
            if (matches) result.push({ subject: original, bindings: current.bindings });
            else pending.push({ subject: original, bindings: current.bindings, type: member.destination.property.type });
          }
        }
      }
      return result.length === 0 ? undefined : result;
    });
  };
  const receiverBinding = (subject: SourceStorageSubject, bindings: SourceStorageSubstitutions): boolean => {
    if (subject.kind !== "return" || !ast.is.IsGetAccessorDeclaration(subject.node) && !ast.is.IsMethodDeclaration(subject.node)) return false;
    const receiver = transport.subject(subject.node, "receiver");
    return receiver !== undefined && transport.substitutions.isBound(receiver, bindings);
  };
  const publicationOrigins = (subject: SourceStorageSubject, externalEntry: boolean): ReadonlySet<SourceStorageSubject> => {
    if (!externalEntry) return transport.substitutions.origins(subject, transport.substitutions.empty) ?? new Set();
    const selected = transport.substitutions.walk(subject, transport.substitutions.empty, current => {
      if (!externalEntry || transport.substitutions.isBound(current.subject, current.bindings)) return false;
      domainInputs.read(current.subject);
      return domainInputs.has(current.subject);
    });
    return selected?.origins ?? new Set();
  };
  const select = (subject: SourceStorageSubject, bindings: SourceStorageSubstitutions,
    purpose: "values" | "storage-producers" = "values") => budget.withRows(rows => {
    initialize();
    const selected = transport.substitutions.walk(subject, bindings);
    if (selected === undefined) return Object.freeze({
      subjects: Object.freeze([] as SourceStorageSubject[]), boundaries: Object.freeze([] as SourceStorageDomainBoundary[]),
      reason: budget.failure() ?? "Source storage requires one completed scoped relation.",
    });
    const boundaries = new Set<SourceStorageDomainBoundary>();
    const pending = [...selected.subjects];
    const visited = new Map<SourceStorageSubstitutions, Set<SourceStorageSubject>>();
    let reason: string | undefined;
    while (pending.length !== 0) {
      if (!budget.step()) break;
      const current = pending.pop()!;
      const selected = visited.get(current.bindings);
      if (selected?.has(current.subject)) continue;
      if (!rows.add(1 + (selected === undefined ? 1 : 0))) break;
      const retained = selected ?? new Set<SourceStorageSubject>();
      retained.add(current.subject); visited.set(current.bindings, retained);
      const stores = purpose === "storage-producers" ? transport.storedInputsFor(current.subject) : undefined;
      reason = transport.unresolvedStoredInputsFor(current.subject);
      if (reason !== undefined) break;
      const bound = transport.substitutions.isBound(current.subject, current.bindings);
      for (const boundary of boundariesFor(current.subject)) {
        if (!budget.step()) break;
        if (boundary.kind === "external-input") {
          if (purpose === "storage-producers" && !current.contributes) continue;
          if (bound || stores !== undefined && boundary.owner !== undefined || receiverBinding(current.subject, current.bindings)) continue;
          if (boundary.owner !== undefined) {
            const members = selectedMembers(current.subject, boundary.owner, current.bindings);
            if (members !== undefined) { pending.push(...members.map(member => ({ ...member, contributes: current.contributes }))); continue; }
          }
        }
        boundaries.add(boundary);
      }
    }
    return Object.freeze({ subjects: Object.freeze([...selected.origins]), boundaries: Object.freeze([...boundaries]), reason });
  });
  return Object.freeze({ select });
}
