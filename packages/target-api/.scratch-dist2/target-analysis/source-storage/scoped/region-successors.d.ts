import type { SourceAnalysisProgram } from "../../analysis-program.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import { type SourceStorageTerm, type SourceStorageReduction } from "../graph/scoped-model.js";
import type { SourceStorageScopedTransport } from "./scoped-transport.js";
import type { createSourceStorageExecutionReachability, createSourceStorageInputExecutions } from "./execution-reachability.js";
import type { createSourceStorageExecutionContext } from "./execution-context.js";
import type { createSourceStoragePointerValues } from "./pointer-values.js";
interface SourceStorageRegionSuccessorContext extends Pick<ReturnType<typeof createSourceStorageExecutionContext>, "application" | "leaf"> {
    readonly source: SourceAnalysisProgram;
    readonly budget: SourceStorageBudget;
    readonly transport: SourceStorageScopedTransport;
    readonly reachability: ReturnType<typeof createSourceStorageExecutionReachability>;
    readonly nativeInputExecutions: ReturnType<typeof createSourceStorageInputExecutions>["nativeInputExecutions"];
    readonly pointerValues: Pick<ReturnType<typeof createSourceStoragePointerValues>, "execution">;
}
export declare function createSourceStorageRegionSuccessors(context: SourceStorageRegionSuccessorContext): (term: Extract<SourceStorageTerm, {
    readonly kind: "region";
}>) => SourceStorageReduction | undefined;
export {};
//# sourceMappingURL=region-successors.d.ts.map