import type { SourceAnalysisProgram } from "../../analysis-program.js";
import type { Node } from "@tsonic/tsts";
import type { SourceStorageBudget } from "./resource-budget.js";
import type { SourceStorageUnresolved } from "./types.js";
import type { SourceStorageSubject } from "./subjects.js";
export interface SourceStorageClassValue<Bindings> {
    readonly subject: SourceStorageSubject;
    readonly bindings: Bindings;
}
export interface SourceStorageClassLineage<Bindings> {
    readonly classes: readonly SourceStorageClassValue<Bindings>[];
    readonly complete: boolean;
    readonly implementation: Node | undefined;
    readonly nativeBase: (SourceStorageClassValue<Bindings> & {
        readonly constructors: readonly Node[];
    }) | undefined;
}
export declare function sourceStorageClassLineages<Bindings>(source: SourceAnalysisProgram, budget: SourceStorageBudget, values: ReadonlySet<SourceStorageClassValue<Bindings>> | undefined, queries: {
    subjectFor(node: Node | undefined): SourceStorageSubject | undefined;
    nativeConstructorsFor(subject: SourceStorageSubject): readonly Node[] | undefined;
    valuesFor(subject: SourceStorageSubject, bindings: Bindings): ReadonlySet<SourceStorageClassValue<Bindings>> | undefined;
}, mode?: "heritage"): readonly SourceStorageClassLineage<Bindings>[] | undefined;
export declare function sourceStorageInstanceCaptures<Bindings>(source: SourceAnalysisProgram, budget: SourceStorageBudget, candidate: Node, values: ReadonlySet<SourceStorageClassValue<Bindings>> | undefined, queries: {
    subjectFor(node: Node | undefined): SourceStorageSubject | undefined;
    nativeConstructorsFor(subject: SourceStorageSubject): readonly Node[] | undefined;
    valuesFor(subject: SourceStorageSubject, bindings: Bindings): ReadonlySet<SourceStorageClassValue<Bindings>> | undefined;
}): ReadonlySet<SourceStorageClassValue<Bindings>> | undefined;
export declare function sourceStorageAllocations<Bindings>(source: SourceAnalysisProgram, budget: SourceStorageBudget, invocation: Node, bindings: Bindings, receiverOriginsFor: (owner: Node, bindings: Bindings) => SourceStorageUnresolved | readonly {
    readonly subject: SourceStorageSubject;
    readonly bindings: Bindings;
}[]): SourceStorageUnresolved | {
    readonly kind: "resolved";
    readonly allocations: readonly {
        readonly call: Node;
        readonly callerBindings: Bindings;
    }[];
};
//# sourceMappingURL=construction.d.ts.map