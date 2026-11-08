import type { TargetArtifactContract, TargetArtifactDependency, TargetArtifactContractGraphOptions, TargetArtifactContractRejection, TargetArtifactContractGraphResult, NormalizedContract, NormalizedDependencySet, TargetArtifactContractGraphLimits } from "./contract-graph-model.js";
export declare function resolveLimits(options: TargetArtifactContractGraphOptions): {
    readonly kind: "resolved";
    readonly limits: TargetArtifactContractGraphLimits;
} | {
    readonly kind: "rejected";
    readonly reason: string;
};
export declare function normalizeContract<Facet extends string>(contract: TargetArtifactContract<Facet>, limits: TargetArtifactContractGraphLimits): {
    readonly kind: "resolved";
    readonly contract: NormalizedContract<Facet>;
} | {
    readonly kind: "rejected";
    readonly result: TargetArtifactContractRejection;
};
export declare function normalizeDependencies<Facet extends string>(dependencies: readonly TargetArtifactDependency<Facet>[], limits: TargetArtifactContractGraphLimits): {
    readonly kind: "resolved";
    readonly dependencies: NormalizedDependencySet<Facet>;
} | {
    readonly kind: "rejected";
    readonly result: TargetArtifactContractRejection;
};
export declare function changedContractFacets<Facet extends string>(current: ReadonlyMap<Facet, string> | undefined, next: ReadonlyMap<Facet, string>): readonly Facet[];
export declare function dependencySetsEqual<Facet extends string>(left: ReadonlyMap<string, TargetArtifactDependency<Facet>>, right: ReadonlyMap<string, TargetArtifactDependency<Facet>>): boolean;
export declare function dependencyKey(owner: string, facet: string): string;
export declare function validateIdentity(value: unknown, label: string, maximumCodeUnits: number): string | undefined;
export declare function checkedAdd(left: number, right: number): number | undefined;
export declare function checkedReplaceTotal(total: number, previous: number, next: number): number | undefined;
export declare function accepted<Facet extends string>(changedFacets: readonly Facet[], contractChanged: boolean, dependenciesChanged: boolean): TargetArtifactContractGraphResult<Facet>;
export declare function rejectedInvalid(reason: string): TargetArtifactContractRejection;
export declare function rejectedBudget(reason: string): TargetArtifactContractRejection;
//# sourceMappingURL=contract-normalization.d.ts.map