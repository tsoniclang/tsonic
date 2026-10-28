import type { Node, SourceFile, Type } from "@tsonic/tsts";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageSubject } from "../model/subjects.js";
import type { SourceStoragePhysicalMemberReceiver, SourceStorageScope } from "./scoped-model.js";

export interface SourceStoragePublication {
  readonly subject: SourceStorageSubject;
  readonly type: Type;
  readonly sourceFile: SourceFile;
  readonly exposure: Node;
  readonly writes: boolean;
  readonly kind: "external-write" | "opaque-write" | "unclassified-exposure";
  readonly externalEntry: boolean;
  readonly inputOwner?: SourceStorageSubject;
  readonly parent: SourceStoragePublication | undefined;
  readonly receiver: SourceStoragePhysicalMemberReceiver | undefined;
  readonly bindings: SourceStorageScope;
}

export function createSourceStorageDomainPublications(budget: SourceStorageBudget,
  coveredByPrefix: (ancestor: SourceStoragePublication, current: SourceStoragePublication) => boolean,
  emptyBindings: SourceStorageScope) {
  const pending: SourceStoragePublication[] = [];
  const admitted = new Map<SourceStorageSubject, Map<Type, Map<SourceStorageSubject | undefined, Map<Node, number>>>>();
  const scopedAdmissions = new Map<SourceStorageSubject, Map<SourceStorageScope, typeof admitted>>();
  const callables = new Map<Node, Set<Node>>();
  const rows = budget.createRows();
  let closed = false;
  return Object.freeze({
    callable(owner: Node, exposure: Node): boolean {
      if (closed) { budget.reject("Source storage publications require a live construction owner."); return false; }
      if (!budget.step()) return false;
      const exposures = callables.get(owner);
      if (exposures?.has(exposure) || !rows.add(exposures === undefined ? 2 : 1)) return false;
      const selected = exposures ?? new Set<Node>();
      selected.add(exposure);
      callables.set(owner, selected);
      return true;
    },
    add(subject: SourceStorageSubject, type: Type, sourceFile: SourceFile, exposure: Node, writes: boolean,
      kind: SourceStoragePublication["kind"], externalEntry: boolean, inputOwner: SourceStorageSubject | undefined,
      parent: SourceStoragePublication | undefined, receiver: SourceStoragePhysicalMemberReceiver | undefined,
      bindings: SourceStorageScope): void {
      if (closed) { budget.reject("Source storage publications require a live construction owner."); return; }
      if (!budget.step()) return;
      const scoped = receiver !== undefined || bindings !== emptyBindings;
      const contextSubject = receiver?.subject ?? subject;
      const contexts = scoped ? scopedAdmissions.get(contextSubject) : undefined;
      const existingAdmissions = scoped ? contexts?.get(bindings) : admitted;
      const types = existingAdmissions?.get(subject);
      const owners = types?.get(type);
      const exposures = owners?.get(inputOwner);
      const previous = exposures?.get(exposure);
      const phase = kind === "opaque-write" ? 4 : kind === "unclassified-exposure" ? 8 : 0;
      const flag = 1 << (phase + (externalEntry ? 2 : 0) + (writes ? 1 : 0));
      if (((previous ?? 0) & flag) !== 0) return;
      const publication: SourceStoragePublication = Object.freeze({ subject, type, sourceFile, exposure, writes, kind, externalEntry,
        ...(inputOwner === undefined ? {} : { inputOwner }), parent, receiver, bindings });
      for (let ancestor = parent; ancestor !== undefined; ancestor = ancestor.parent) {
        if (!budget.step()) return;
        if (ancestor.sourceFile === sourceFile && ancestor.exposure === exposure &&
          ancestor.writes === writes && ancestor.kind === kind && ancestor.externalEntry === externalEntry &&
          ancestor.inputOwner === inputOwner &&
          ancestor.bindings === bindings &&
          coveredByPrefix(ancestor, publication)) return;
      }
      if (!rows.add(2 + (parent === undefined ? 0 : 1) + (types === undefined ? 1 : 0) +
        (owners === undefined ? 1 : 0) + (exposures === undefined ? 1 : 0) + (previous === undefined ? 1 : 0) +
        (scoped ? (contexts === undefined ? 1 : 0) + (existingAdmissions === undefined ? 1 : 0) +
          (receiver === undefined ? 0 : 1) : 0))) return;
      const selectedTypes = types ?? new Map<Type, Map<SourceStorageSubject | undefined, Map<Node, number>>>();
      const selectedOwners = owners ?? new Map<SourceStorageSubject | undefined, Map<Node, number>>();
      const selectedExposures = exposures ?? new Map<Node, number>();
      selectedExposures.set(exposure, (previous ?? 0) | flag);
      selectedOwners.set(inputOwner, selectedExposures);
      selectedTypes.set(type, selectedOwners);
      const retainedAdmissions: typeof admitted = existingAdmissions ?? new Map();
      retainedAdmissions.set(subject, selectedTypes);
      if (scoped) {
        const retainedContexts = contexts ?? new Map<SourceStorageScope, typeof admitted>();
        retainedContexts.set(bindings, retainedAdmissions);
        scopedAdmissions.set(contextSubject, retainedContexts);
      }
      pending.push(publication);
    },
    size: (): number => pending.length,
    at: (index: number): SourceStoragePublication | undefined => pending[index],
    finish(): void {
      if (closed) return;
      closed = true;
      pending.length = 0;
      admitted.clear();
      scopedAdmissions.clear();
      callables.clear();
      rows.release();
    },
  });
}
