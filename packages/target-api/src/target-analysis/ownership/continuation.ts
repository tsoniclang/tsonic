import type { Node } from "@tsonic/tsts";
import type { SourceOwnershipBudget, SourcePendingOperation } from "./model.js";

export type SourceContinuationState<Witness = SourcePendingOperation> = ReadonlySet<Witness>;

export interface SourceContinuationLattice<Witness = SourcePendingOperation> {
  empty(): SourceContinuationState<Witness>;
  join(left: SourceContinuationState<Witness>, right: SourceContinuationState<Witness>): SourceContinuationState<Witness> | undefined;
  equals(left: SourceContinuationState<Witness>, right: SourceContinuationState<Witness>): boolean;
}

export function createSourceContinuationTransfer<Witness = SourcePendingOperation>(budget: SourceOwnershipBudget) {
  const rows = budget.createRows();
  const empty: SourceContinuationState<Witness> = new Set();
  const lattice: SourceContinuationLattice<Witness> = Object.freeze({
    empty: () => empty,
    join(left: SourceContinuationState<Witness>, right: SourceContinuationState<Witness>) {
      if (!budget.step()) return undefined;
      if (left === right || right.size === 0) return left;
      if (left.size === 0) return right;
      let result: Set<Witness> | undefined;
      for (const witness of right) {
        if (!budget.step()) return undefined;
        if (left.has(witness)) continue;
        if (result === undefined) {
          if (!rows.add(1 + left.size)) return undefined;
          result = new Set(left);
        }
        if (!rows.add(1)) return undefined;
        result.add(witness);
      }
      return result ?? left;
    },
    equals(left: SourceContinuationState<Witness>, right: SourceContinuationState<Witness>) {
      if (left === right) return true;
      if (left.size !== right.size) return false;
      for (const witness of left) {
        if (!budget.step() || !right.has(witness)) return false;
      }
      return true;
    },
  });
  return Object.freeze({
    lattice,
    suspend(state: SourceContinuationState<Witness>, witness: Witness): SourceContinuationState<Witness> | undefined {
      if (!budget.step()) return undefined;
      if (state.has(witness)) return state;
      if (!rows.add(1 + state.size + 1)) return undefined;
      const selected = new Set(state);
      selected.add(witness);
      return selected;
    },
    read(state: SourceContinuationState<Witness>, reference: Node,
      visit: (pending: Witness, reference: Node) => boolean): boolean {
      for (const pending of state) {
        if (!budget.step() || !visit(pending, reference)) return false;
      }
      return budget.failure() === undefined;
    },
    release(): void { rows.release(); },
  });
}

export type SourceContinuationTransfer<Witness = SourcePendingOperation> = ReturnType<typeof createSourceContinuationTransfer<Witness>>;
