import type { Node } from "@tsonic/tsts";
import type { SourceOwnershipBudget, SourcePendingOperation } from "./model.js";

export type SourceContinuationState = ReadonlySet<SourcePendingOperation>;

export interface SourceContinuationLattice {
  empty(): SourceContinuationState;
  join(left: SourceContinuationState, right: SourceContinuationState): SourceContinuationState | undefined;
  equals(left: SourceContinuationState, right: SourceContinuationState): boolean;
}

export function createSourceContinuationTransfer(budget: SourceOwnershipBudget) {
  const rows = budget.createRows();
  const empty: SourceContinuationState = new Set();
  const lattice: SourceContinuationLattice = Object.freeze({
    empty: () => empty,
    join(left: SourceContinuationState, right: SourceContinuationState) {
      if (!budget.step()) return undefined;
      if (left === right || right.size === 0) return left;
      if (left.size === 0) return right;
      let result: Set<SourcePendingOperation> | undefined;
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
    equals(left: SourceContinuationState, right: SourceContinuationState) {
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
    suspend(state: SourceContinuationState, witness: SourcePendingOperation): SourceContinuationState | undefined {
      if (!budget.step()) return undefined;
      if (state.has(witness)) return state;
      if (!rows.add(1 + state.size + 1)) return undefined;
      const selected = new Set(state);
      selected.add(witness);
      return selected;
    },
    read(state: SourceContinuationState, reference: Node,
      visit: (pending: SourcePendingOperation, reference: Node) => boolean): boolean {
      for (const pending of state) {
        if (!budget.step() || !visit(pending, reference)) return false;
      }
      return budget.failure() === undefined;
    },
    release(): void { rows.release(); },
  });
}

export type SourceContinuationTransfer = ReturnType<typeof createSourceContinuationTransfer>;
