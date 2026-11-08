import type { SourceAnalysisProgram } from "../../analysis-program.js";
import type { Node } from "@tsonic/tsts";
import type { SourceStorageBudget, SourceStorageRows } from "../model/resource-budget.js";
import type { SourceStorageCallbackEntry } from "../model/types.js";
import type { SourceStorageSubjectQuery } from "../model/subjects.js";
import { type SourceStorageInvocationInputSelectionQuery, type SourceStorageInvocationInputQuery } from "../graph/invocation-inputs.js";
import type { SourceStorageEquation, SourceStorageFrame, SourceStorageReference, SourceStorageInputFrontier, SourceStorageReduction, SourceStorageScope, SourceStorageTerm } from "../graph/scoped-model.js";
export declare function createSourceStorageScopeFrames(input: {
    readonly source: SourceAnalysisProgram;
    readonly budget: SourceStorageBudget;
    readonly rows: SourceStorageRows;
    readonly subject: SourceStorageSubjectQuery;
    readonly inputSlotsFor: SourceStorageInvocationInputSelectionQuery;
    readonly invocationInputs: SourceStorageInvocationInputQuery;
    readonly identity: (value: object) => number;
    readonly callbackKey: (callback: SourceStorageCallbackEntry | undefined) => string;
}): Readonly<{
    frameFor: (candidate: Node, invocation: Node, parent: SourceStorageScope, captured: SourceStorageScope, equation?: SourceStorageEquation, callback?: SourceStorageCallbackEntry) => SourceStorageFrame | undefined;
    enterApplication: (term: Extract<SourceStorageTerm, {
        readonly kind: "application";
    }>, candidate: Node, callee: SourceStorageReference | SourceStorageInputFrontier) => SourceStorageReduction | undefined;
    declarationFor: (owner: Node, parent: SourceStorageScope) => SourceStorageFrame | undefined;
}>;
//# sourceMappingURL=scope-frames.d.ts.map