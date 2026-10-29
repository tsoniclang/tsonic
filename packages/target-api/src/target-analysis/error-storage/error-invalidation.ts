import type { Node } from "@tsonic/tsts";
import { forEachSourceImmediateEvaluationChild, Node_Expression } from "../../source-navigation/index.js";
import type { TargetSourceProgram } from "../../source-semantics/index.js";
import type { SourceStorageSubject } from "../source-storage/model/subjects.js";
import { sourceStorageHasOriginalCallableValue } from "../source-storage/model/subjects.js";
import type { SourceStorageBindings, SourceStorageClosedOriginsSelection, SourceStorageQueries } from "../source-storage/model/types.js";
import type { SourceErrorStorageDemandQueries } from "./error-storage-demands.js";
import type { SourceErrorDeclarationQueries } from "./protocol.js";

export function createSourceErrorLocalInvalidationQuery(
  source: TargetSourceProgram,
  fieldFor: SourceErrorDeclarationQueries["fieldFor"],
  mutationFor: SourceErrorDeclarationQueries["mutationFor"],
  owns: (node: Node) => boolean,
): SourceErrorDeclarationQueries["invalidationFor"] {
  const { ast } = source;
  return (read, expression) => {
    if (read === undefined || !owns(read.node) || !owns(expression)) return Object.freeze({ kind: "unresolved",
      reason: "Local Error invalidation requires the original checked read and later expression." });
    const checked = fieldFor(read.node);
    if (checked.kind !== "resolved" || checked.value !== read || read.accessMode !== "read") return Object.freeze({ kind: "unresolved",
      reason: "Local Error invalidation requires its exact published field-read selection." });
    const pending = [{ node: expression, completed: false }];
    while (pending.length !== 0) {
      const { node, completed } = pending.pop()!;
      if (!owns(node)) return Object.freeze({ kind: "unresolved", reason: "An Error effect left its checked source domain." });
      if (!completed) {
        pending.push({ node, completed: true });
        const children: Node[] = [];
        forEachSourceImmediateEvaluationChild(ast, node, child => children.push(child));
        for (const child of children.reverse()) pending.push({ node: child, completed: false });
        continue;
      }
      if (ast.is.IsAwaitExpression(node) || ast.is.IsYieldExpression(node)) return Object.freeze({ kind: "invalidated", at: node });
      const mutations = mutationFor(node);
      if (mutations.kind === "unresolved") return mutations;
      if (mutations.kind === "resolved") {
        if (mutations.value.some(mutation => mutation.kind === "field"
          ? mutation.field.memberDeclaration === read.memberDeclaration
          : mutation.scalar.slot.fields.includes(read.memberDeclaration))) return Object.freeze({ kind: "invalidated", at: node });
        if (ast.is.IsCallExpression(node)) continue;
      }
      if (ast.is.IsCallExpression(node) || ast.is.IsNewExpression(node)) return Object.freeze({ kind: "invalidated", at: node });
      if (ast.is.IsPropertyAccessExpression(node)) {
        const field = fieldFor(node);
        if (field.kind === "unresolved") return field;
        if (field.kind !== "resolved") {
          const property = source.semantics.forNode(node).operations.propertyAccess(node);
          const declaration = property?.selectedDeclaration;
          if (declaration === undefined || ast.is.IsGetAccessorDeclaration(declaration)) return Object.freeze({ kind: "invalidated", at: node });
        }
      }
      if (source.navigation.expressionEffects(node).mutates && mutations.kind !== "resolved")
        return Object.freeze({ kind: "invalidated", at: node });
    }
    return Object.freeze({ kind: "preserved" });
  };
}

export function createSourceErrorInvalidationQuery(
  source: TargetSourceProgram,
  storage: SourceStorageQueries,
  storageFor: SourceErrorStorageDemandQueries["storageFor"],
  nativeSubjects: ReadonlySet<SourceStorageSubject>,
  capturedStackTargets: ReadonlyMap<Node, SourceStorageSubject>,
  step: () => boolean,
  failureReason: () => string | undefined,
): SourceErrorStorageDemandQueries["invalidationFor"] {
  const { ast } = source;
  return (owner, expression, pureInvocations) => {
    const selectedOwner = storage.storageSubjectFor(owner);
    if (selectedOwner.kind === "unresolved") return selectedOwner;
    const demand = storageFor(selectedOwner.subject);
    if (demand.kind === "unresolved") return demand;
    const ancestors = storage.ancestorsFor(selectedOwner.subject);
    if (ancestors.kind === "unresolved") return ancestors;
    const sourceOwners = new Set(ancestors.subjects);
    const lexical = storage.bindingsForLexicalOwner(expression);
    if (lexical.kind === "unresolved") return lexical;
    const pending = [{ node: expression, bindings: lexical.bindings }];
    const visited = new Map<SourceStorageBindings, Set<Node>>();
    let unresolved: string | undefined;
    let unproven: string | undefined;
    let ownerOrigins: SourceStorageClosedOriginsSelection | undefined;
    let ownerRoots: Set<SourceStorageSubject> | undefined;
    const overlapsOwner = (subject: SourceStorageSubject, bindings: SourceStorageBindings) => {
      const affected = storage.closedOriginsFor(subject, bindings);
      if (affected.kind === "unresolved") return affected;
      for (const origin of affected.origins) {
        if (!step()) return Object.freeze({ kind: "unresolved" as const, reason: failureReason()! });
        if (sourceOwners.has(origin.subject)) return Object.freeze({ kind: "overlap" as const });
      }
      ownerOrigins ??= storage.closedOriginsFor(selectedOwner.subject, lexical.bindings);
      if (ownerOrigins.kind === "unresolved") return ownerOrigins;
      if (ownerRoots === undefined) {
        ownerRoots = new Set<SourceStorageSubject>();
        for (const origin of ownerOrigins.origins) {
          if (!step()) return Object.freeze({ kind: "unresolved" as const, reason: failureReason()! });
          ownerRoots.add(origin.subject);
        }
      }
      for (const origin of affected.origins) {
        if (!step()) return Object.freeze({ kind: "unresolved" as const, reason: failureReason()! });
        if (ownerRoots.has(origin.subject)) return Object.freeze({ kind: "overlap" as const });
      }
      return ownerOrigins.kind === "complete" && affected.kind === "complete"
        ? Object.freeze({ kind: "disjoint" as const })
        : Object.freeze({ kind: "unproven" as const, reason: "Error preservation requires complete owner and affected storage origins in the exact invocation context." });
    };
    const appendCallableRegions = (candidate: Node, invocation: Node | undefined, parent: SourceStorageBindings): boolean => {
      const selected = storage.executionRegionsFor(candidate, invocation, parent);
      const bindings = invocation === undefined ? { kind: "resolved" as const, bindings: parent }
        : storage.bindingsForInvocation(candidate, invocation, parent);
      if (selected.kind === "unresolved" || bindings.kind === "unresolved") {
        unresolved = selected.kind === "unresolved" ? selected.reason : bindings.kind === "unresolved" ? bindings.reason : undefined;
        return false;
      }
      for (const node of selected.nodes) pending.push({ node, bindings: bindings.bindings });
      return selected.nodes.length !== 0;
    };
    while (pending.length !== 0) {
      const { node, bindings } = pending.pop()!;
      const checked = visited.get(bindings) ?? new Set<Node>();
      if (checked.has(node)) continue;
      checked.add(node);
      visited.set(bindings, checked);
      if (!step()) return Object.freeze({ kind: "unresolved", reason: failureReason()! });
      if (ast.is.IsAwaitExpression(node) || ast.is.IsYieldExpression(node)) return Object.freeze({ kind: "invalidated" });
      const mutation = storage.mutationOwnerFor(node) ?? capturedStackTargets.get(node);
      if (mutation !== undefined) {
        const affected = overlapsOwner(mutation, bindings);
        if (affected.kind === "unresolved") return affected;
        if (affected.kind === "unproven") unproven = affected.reason;
        if (affected.kind === "overlap") return Object.freeze({ kind: "invalidated" });
      }
      if (storage.isAccessorInvocation(node)) {
        const implementations = storage.invocationImplementationsFor(node, bindings);
        if (implementations.kind === "unresolved") return implementations;
        if (!implementations.exact || implementations.nodes.length === 0)
          unproven = "An accessor invocation has no exact source mutation footprint.";
        for (const implementation of implementations.nodes) appendCallableRegions(implementation, node, bindings);
      }
      if ((ast.is.IsCallExpression(node) || ast.is.IsNewExpression(node)) && !pureInvocations.has(node) && !capturedStackTargets.has(node)) {
        const subject = storage.subject(node);
        if (subject.kind === "unresolved") return subject;
        const native = nativeSubjects.has(subject.subject) ? storage.closedOriginsFor(subject.subject, bindings) : undefined;
        if (native?.kind === "unresolved") return native;
        if (native?.kind === "open") unproven = "Native Error allocation requires complete checked constructor value provenance.";
        let opaque = false;
        if (ast.is.IsNewExpression(node)) {
          const constructor = Node_Expression(ast, node);
          if (constructor === undefined) return Object.freeze({ kind: "unresolved",
            reason: "Error invalidation requires the exact checked constructor expression." });
          const subject = storage.subjectFor(constructor);
          if (subject.kind === "unresolved") return subject;
          const origins = storage.closedOriginsFor(subject.subject, bindings);
          if (origins.kind === "unresolved") return origins;
          if (origins.kind === "open") {
            const arguments_ = storage.argumentTransportsFor(node);
            if (arguments_.kind === "unresolved") return arguments_;
            opaque = true;
            unproven = "Constructor mutation requires a closed actual class-value domain in the exact invocation context.";
          } else {
            const construction = storage.constructionFor(node, bindings);
            if (construction.kind === "unresolved") return construction;
            for (const alternative of construction.alternatives) {
              if (!step()) return Object.freeze({ kind: "unresolved", reason: failureReason()! });
              if (alternative.implementation !== undefined) for (const region of alternative.implementation.regions) {
                if (!step()) return Object.freeze({ kind: "unresolved", reason: failureReason()! });
                pending.push({ node: region, bindings: alternative.implementation.selection.bindings });
              }
              for (const entry of alternative.classes) for (const region of entry.regions) {
                if (!step()) return Object.freeze({ kind: "unresolved", reason: failureReason()! });
                pending.push({ node: region.node, bindings: region.selection.bindings });
              }
            }
          }
        } else {
          const implementations = storage.invocationImplementationsFor(node, bindings);
          if (implementations.kind === "unresolved") return implementations;
          let resolved = false;
          for (const candidate of implementations.nodes) {
            resolved = appendCallableRegions(candidate, node, bindings) || resolved;
            const reason = failureReason() ?? unresolved;
            if (reason !== undefined) return Object.freeze({ kind: "unresolved", reason });
          }
          opaque = !implementations.exact || !resolved;
        }
        if (opaque && (ast.is.IsNewExpression(node) || native?.kind !== "complete")) {
          const arguments_ = storage.invocationArgumentsFor(node);
          if (arguments_.kind === "unresolved") return arguments_;
          for (const argument of arguments_.nodes) {
            const argumentSubject = storage.subjectFor(argument);
            if (argumentSubject.kind === "unresolved") return argumentSubject;
            const origins = storage.boundOriginsFor(argumentSubject.subject, bindings);
            if (origins.kind === "unresolved") return origins;
            const affected = overlapsOwner(argumentSubject.subject, bindings);
            if (affected.kind === "unresolved") return affected;
            if (affected.kind === "unproven") unproven = affected.reason;
            if (affected.kind === "overlap")
              unproven = "An opaque native invocation can access the borrowed Error owner without an exact mutation footprint.";
            // Only a callable or class value handed to opaque code can run there; other values have no execution region.
            for (const candidate of origins.subjects) {
              if (sourceStorageHasOriginalCallableValue(candidate, ast) || candidate.kind === "value" &&
                (ast.is.IsClassDeclaration(candidate.node) || ast.is.IsClassExpression(candidate.node)))
                appendCallableRegions(candidate.node, undefined, bindings);
            }
          }
        }
      }
      forEachSourceImmediateEvaluationChild(ast, node, child => pending.push({ node: child, bindings }));
    }
    const reason = failureReason() ?? unresolved;
    return reason !== undefined ? Object.freeze({ kind: "unresolved", reason })
      : unproven !== undefined ? Object.freeze({ kind: "unproven", reason: unproven })
      : Object.freeze({ kind: "preserved" });
  };
}
