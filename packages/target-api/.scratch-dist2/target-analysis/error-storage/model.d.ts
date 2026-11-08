import type { Node } from "@tsonic/tsts";
import type { SourceTypeDescriptor } from "../../source-semantics/descriptor-model.js";
import type { SourceStorageSubject } from "../source-storage/model/subjects.js";
import type { SourceStorageClosedOriginsSelection } from "../source-storage/model/types.js";
export type SourceErrorStorageDemand = {
    readonly kind: "immutable";
} | {
    readonly kind: "writable";
    readonly writes: readonly Node[];
} | {
    readonly kind: "unresolved";
    readonly reason: string;
};
interface SourceErrorStorageOrigin {
    readonly node: Node;
    readonly type: SourceTypeDescriptor;
}
export interface SourceErrorStorageDemandQueries {
    readonly retainedBoundaries: readonly Node[];
    readonly nativeConstructors: readonly SourceStorageSubject[];
    readonly fieldWrites: readonly Node[];
    storageFor(subject: SourceStorageSubject): SourceErrorStorageDemand;
    isNativeConstructor(subject: Node): boolean;
    receivesWritableNative(subject: SourceStorageSubject): boolean;
    storageOriginsFor(subject: SourceStorageSubject): {
        readonly kind: "resolved";
        readonly origins: readonly SourceErrorStorageOrigin[];
    } | {
        readonly kind: "unresolved";
        readonly reason: string;
    };
    closedStorageOriginsFor(subject: SourceStorageSubject): SourceStorageClosedOriginsSelection;
    invalidationFor(owner: Node, expression: Node, pureInvocations: ReadonlySet<Node>): {
        readonly kind: "preserved" | "invalidated";
    } | {
        readonly kind: "unresolved" | "unproven";
        readonly reason: string;
    };
}
export {};
//# sourceMappingURL=model.d.ts.map