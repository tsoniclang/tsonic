import type { Node, SourceFile, Type } from "@tsonic/tsts";
import type { SourceStorageBudget } from "./resource-budget.js";
import type { SourceStorageSubject } from "./subjects.js";

export interface SourceStoragePublication {
  readonly subject: SourceStorageSubject;
  readonly type: Type;
  readonly sourceFile: SourceFile;
  readonly exposure: Node;
  readonly writes: boolean;
  readonly kind: "external-write" | "opaque-write" | "unclassified-exposure";
  readonly externalEntry: boolean;
  readonly inputOwner?: SourceStorageSubject;
}

export function createSourceStorageDomainPublications(budget: SourceStorageBudget) {
  const pending: SourceStoragePublication[] = [];
  const admitted = new Map<SourceStorageSubject, Map<Type, Map<SourceStorageSubject | undefined, number>>>();
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
      kind: SourceStoragePublication["kind"], externalEntry: boolean, inputOwner?: SourceStorageSubject): void {
      if (closed) { budget.reject("Source storage publications require a live construction owner."); return; }
      if (!budget.step()) return;
      const types = admitted.get(subject);
      const owners = types?.get(type);
      const previous = owners?.get(inputOwner);
      const phase = kind === "opaque-write" ? 4 : kind === "unclassified-exposure" ? 8 : 0;
      const flag = 1 << (phase + (externalEntry ? 2 : 0) + (writes ? 1 : 0));
      if (((previous ?? 0) & flag) !== 0) return;
      if (!rows.add(2 + (types === undefined ? 1 : 0) + (owners === undefined ? 1 : 0) + (previous === undefined ? 1 : 0))) return;
      const selectedTypes = types ?? new Map<Type, Map<SourceStorageSubject | undefined, number>>();
      const selectedOwners = owners ?? new Map<SourceStorageSubject | undefined, number>();
      selectedOwners.set(inputOwner, (previous ?? 0) | flag);
      selectedTypes.set(type, selectedOwners);
      admitted.set(subject, selectedTypes);
      pending.push(Object.freeze({ subject, type, sourceFile, exposure, writes, kind, externalEntry,
        ...(inputOwner === undefined ? {} : { inputOwner }) }));
    },
    size: (): number => pending.length,
    at: (index: number): SourceStoragePublication | undefined => pending[index],
    finish(): void {
      if (closed) return;
      closed = true;
      pending.length = 0;
      admitted.clear();
      callables.clear();
      rows.release();
    },
  });
}
