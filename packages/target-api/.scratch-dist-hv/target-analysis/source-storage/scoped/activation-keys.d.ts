import type { SourceAnalysisProgram } from "../../analysis-program.js";
import type { Node } from "@tsonic/tsts";
import type { SourceStorageContextFootprint } from "../graph/context-footprints.js";
import type { SourceStorageActivation, SourceStorageFrame, SourceStorageScope, SourceStorageScopeParameter } from "../graph/scoped-model.js";
import type { SourceStorageBudget, SourceStorageRows } from "../model/resource-budget.js";
import type { SourceStorageSubject, SourceStorageSubjectQuery } from "../model/subjects.js";
import type { SourceStorageCallbackEntry } from "../model/types.js";
export interface SourceStorageCreationContext {
    readonly footprints: {
        select(subject: SourceStorageSubject): SourceStorageContextFootprint | undefined;
    };
    ownerFor(subject: SourceStorageSubject): Node | undefined;
}
export declare function sourceStorageActivationOwner(source: SourceAnalysisProgram, enclosing: (node: Node) => Node | undefined, subject: SourceStorageSubject): Node | undefined;
export declare function createSourceStorageActivationKeys(budget: SourceStorageBudget, rows: SourceStorageRows, queries: {
    readonly empty: SourceStorageFrame;
    readonly subject: SourceStorageSubjectQuery;
    identity(value: object): number;
    callbackKey(callback: SourceStorageCallbackEntry | undefined): string;
    owningScope(scope: SourceStorageScope, owner: Node): SourceStorageScope | undefined;
    applyScope(scope: SourceStorageScope, substitutions: ReadonlyMap<SourceStorageScopeParameter, SourceStorageScope>): SourceStorageScope | undefined;
    declarationFor(owner: Node, parent: SourceStorageScope): SourceStorageFrame | undefined;
}, context: SourceStorageCreationContext): (scope: SourceStorageScope) => SourceStorageActivation | undefined;
//# sourceMappingURL=activation-keys.d.ts.map