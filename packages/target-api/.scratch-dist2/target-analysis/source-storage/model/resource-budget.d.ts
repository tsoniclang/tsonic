import type { SourceStorageLimits } from "./types.js";
export interface SourceStorageRows {
    add(cost: number): boolean;
    release(): void;
}
export declare const defaultSourceStorageLimits: SourceStorageLimits;
export declare function createSourceStorageBudget(selection: SourceStorageLimits): Readonly<{
    limits: Readonly<{
        maximumNodes: number;
        maximumEdges: number;
        maximumSubjectRows: number;
        maximumTransportRows: number;
        maximumSteps: number;
    }>;
    failure: () => string | undefined;
    usage: () => Readonly<{
        nodes: number;
        edges: number;
        subjects: number;
        rows: number;
        peakRows: number;
        steps: number;
    }>;
    reject: (reason: string) => void;
    node: () => boolean;
    edge: () => boolean;
    subject: (cost: number) => boolean;
    row: () => boolean;
    createRows: () => SourceStorageRows;
    withRows<T>(collect: (rows: SourceStorageRows) => T): T;
    step: () => boolean;
}>;
export type SourceStorageBudget = ReturnType<typeof createSourceStorageBudget>;
//# sourceMappingURL=resource-budget.d.ts.map