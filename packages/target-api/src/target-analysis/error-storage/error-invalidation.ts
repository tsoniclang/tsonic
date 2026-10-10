import type { Node } from "@tsonic/tsts";
import { forEachSourceImmediateEvaluationChild } from "../../source-navigation/index.js";
import type { TargetSourceProgram } from "../../source-semantics/index.js";
import type { SourceStorageSubject } from "../source-storage/subjects.js";
import type { SourceStorageBindings, SourceStorageClosedOriginsSelection, SourceStorageQueries } from "../source-storage/types.js";
import type { SourceErrorStorageDemandQueries } from "./error-storage-demands.js";

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
    const pending = [{ node: expression, bindings: storage.emptyBindings }];
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
      ownerOrigins ??= storage.closedOriginsFor(selectedOwner.subject);
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
      const selected = storage.executionRegionsFor(candidate, invocation);
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
        if (implementations.nodes.length === 0) unproven = "An accessor invocation has no exact source mutation footprint.";
        for (const implementation of implementations.nodes) appendCallableRegions(implementation, node, bindings);
      }
      if ((ast.is.IsCallExpression(node) || ast.is.IsNewExpression(node)) && !pureInvocations.has(node) && !capturedStackTargets.has(node)) {
        const subject = storage.subject(node);
        if (subject.kind === "unresolved") return subject;
        const native = nativeSubjects.has(subject.subject) ? storage.closedOriginsFor(subject.subject, bindings) : undefined;
        if (native?.kind === "unresolved") return native;
        if (native?.kind === "open") unproven = "Native Error allocation requires complete checked constructor value provenance.";
        const implementations = storage.invocationImplementationsFor(node, bindings);
        if (implementations.kind === "unresolved") return implementations;
        let resolved = false;
        for (const candidate of implementations.nodes) resolved = appendCallableRegions(candidate, node, bindings) || resolved;
        if (ast.is.IsNewExpression(node)) {
          const regions = storage.instanceRegionsFor(node);
          if (regions.kind === "unresolved") return regions;
          for (const region of regions.regions) {
            const selected = storage.bindingsForInvocation(region.owner, node, bindings);
            if (selected.kind === "unresolved") return selected;
            pending.push({ node: region.node, bindings: selected.bindings });
          }
        }
        if (!resolved && native?.kind !== "complete") {
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
            for (const candidate of origins.subjects) {
              if (candidate.kind === "value") appendCallableRegions(candidate.node, undefined, bindings);
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
