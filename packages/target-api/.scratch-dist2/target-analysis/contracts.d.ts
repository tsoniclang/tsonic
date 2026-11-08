export interface TargetContractRevision<Contract> {
    readonly contract: Contract;
    readonly dependencies: readonly string[];
}
export type TargetContractEvaluation<Contract, Failure = never> = {
    readonly kind: "resolved";
    readonly revision: TargetContractRevision<Contract>;
} | {
    readonly kind: "deferred";
    readonly dependencies: readonly string[];
    readonly reason: string;
} | {
    readonly kind: "rejected";
    readonly reason: string;
    readonly cause?: Failure;
};
export interface TargetContractEvaluationContext<Contract> {
    get(id: string): Contract | undefined;
    revision(id: string): number | undefined;
}
export interface TargetContractFixedPointRequest<Contract, Failure = never> {
    readonly roots: readonly string[];
    readonly evaluate: (id: string, context: TargetContractEvaluationContext<Contract>) => TargetContractEvaluation<Contract, Failure>;
    readonly equals?: (left: Contract, right: Contract) => boolean;
    readonly maximumContracts?: number;
    readonly maximumRevisionsPerContract?: number;
    readonly maximumEvaluations?: number;
}
export interface TargetContractProgram<Contract> {
    readonly ids: readonly string[];
    get(id: string): Contract | undefined;
    revision(id: string): number | undefined;
    dependencies(id: string): readonly string[];
    dependents(id: string): readonly string[];
}
export interface TargetContractFailure<Failure = never> {
    readonly contractId?: string;
    readonly reason: string;
    readonly cause?: Failure;
}
export type TargetContractFixedPointResult<Contract, Failure = never> = {
    readonly kind: "resolved";
    readonly program: TargetContractProgram<Contract>;
} | {
    readonly kind: "rejected";
    readonly failures: readonly TargetContractFailure<Failure>[];
};
export declare function resolveTargetContractFixedPoint<Contract, Failure = never>(request: TargetContractFixedPointRequest<Contract, Failure>): TargetContractFixedPointResult<Contract, Failure>;
//# sourceMappingURL=contracts.d.ts.map