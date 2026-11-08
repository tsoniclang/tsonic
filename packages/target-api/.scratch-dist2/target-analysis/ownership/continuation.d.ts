import type { Node } from "@tsonic/tsts";
import type { SourceDeclarationOwnershipRows, SourceDeclarationPendingOperation } from "./model.js";
export type SourceContinuationState<Witness = SourceDeclarationPendingOperation> = ReadonlySet<Witness>;
export interface SourceContinuationLattice<Witness = SourceDeclarationPendingOperation> {
    empty(): SourceContinuationState<Witness>;
    join(left: SourceContinuationState<Witness>, right: SourceContinuationState<Witness>): SourceContinuationState<Witness> | undefined;
    equals(left: SourceContinuationState<Witness>, right: SourceContinuationState<Witness>): boolean;
}
export declare function createSourceContinuationTransfer<Witness = SourceDeclarationPendingOperation>(budget: {
    step(): boolean;
    createRows(): SourceDeclarationOwnershipRows;
    failure(): string | undefined;
}): Readonly<{
    lattice: SourceContinuationLattice<Witness>;
    suspend(state: SourceContinuationState<Witness>, witness: Witness): SourceContinuationState<Witness> | undefined;
    read(state: SourceContinuationState<Witness>, reference: Node, visit: (pending: Witness, reference: Node) => boolean): boolean;
    release(): void;
}>;
export type SourceContinuationTransfer<Witness = SourceDeclarationPendingOperation> = ReturnType<typeof createSourceContinuationTransfer<Witness>>;
//# sourceMappingURL=continuation.d.ts.map