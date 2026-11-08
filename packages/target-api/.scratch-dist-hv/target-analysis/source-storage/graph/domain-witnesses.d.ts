import type { Node } from "@tsonic/tsts";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageSubject } from "../model/subjects.js";
import type { SourceStorageDomainBoundary } from "../model/types.js";
import type { SourceStorageScope } from "./scoped-model.js";
export interface SourceStorageDomainWitness extends Omit<SourceStorageDomainBoundary, "bindings"> {
    readonly creationBindings?: SourceStorageScope;
}
export declare function createSourceStorageDomainWitnesses(budget: SourceStorageBudget): Readonly<{
    hasInputs: () => boolean;
    add(subject: SourceStorageSubject | undefined, kind: SourceStorageDomainBoundary["kind"], exposure: Node, owner?: SourceStorageSubject, creationBindings?: SourceStorageScope): void;
    forSubject(subject: SourceStorageSubject, kind?: "external-input"): readonly SourceStorageDomainWitness[];
    inputOwners(subject: SourceStorageSubject): ReadonlySet<SourceStorageSubject | undefined>;
}>;
//# sourceMappingURL=domain-witnesses.d.ts.map