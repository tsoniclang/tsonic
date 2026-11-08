import type { Node, SourceFile } from "@tsonic/tsts";
import type { SourceTypeDescriptor } from "../../../source-semantics/descriptor-model.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageSubject } from "../model/subjects.js";
import type { SourceStorageProjectionReceiver, SourceStorageScope } from "./scoped-model.js";
export interface SourceStoragePublication {
    readonly subject: SourceStorageSubject;
    readonly type: SourceTypeDescriptor;
    readonly sourceFile: SourceFile;
    readonly exposure: Node;
    readonly writes: boolean;
    readonly kind: "external-write" | "opaque-write" | "unclassified-exposure";
    readonly externalEntry: boolean;
    readonly inputOwner?: SourceStorageSubject;
    readonly receiver: SourceStorageProjectionReceiver | undefined;
    readonly bindings: SourceStorageScope;
}
export declare function createSourceStorageDomainPublications(budget: SourceStorageBudget, emptyBindings: SourceStorageScope): Readonly<{
    callable(owner: Node, exposure: Node): boolean;
    add(subject: SourceStorageSubject, type: SourceTypeDescriptor, sourceFile: SourceFile, exposure: Node, writes: boolean, kind: SourceStoragePublication["kind"], externalEntry: boolean, inputOwner: SourceStorageSubject | undefined, receiver: SourceStorageProjectionReceiver | undefined, bindings: SourceStorageScope): void;
    size: () => number;
    at: (index: number) => SourceStoragePublication | undefined;
    finish(): void;
}>;
//# sourceMappingURL=domain-publications.d.ts.map