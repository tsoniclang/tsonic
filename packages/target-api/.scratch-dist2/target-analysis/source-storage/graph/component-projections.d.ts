import type { AstReader } from "@tsonic/tsts";
import type { SourceTypeDescriptor } from "../../../source-semantics/descriptor-model.js";
import type { SourceAnalysisProgram } from "../../analysis-program.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageProjection } from "../model/subjects.js";
export declare function sourceStorageProjectComponents(origin: readonly SourceStorageProjection[], from: SourceTypeDescriptor, to: SourceTypeDescriptor, remaining: readonly SourceStorageProjection[], source: Pick<SourceAnalysisProgram, "ast" | "facts">, ast: AstReader, budget: SourceStorageBudget, collect: (projection: readonly SourceStorageProjection[]) => void): void;
//# sourceMappingURL=component-projections.d.ts.map