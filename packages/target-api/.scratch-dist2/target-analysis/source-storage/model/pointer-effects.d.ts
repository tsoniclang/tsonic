import type { SourceRefusal } from "../../../public/source/facts.js";
import type { SourcePointerOperationRecord } from "../../../public/source/selections.js";
import type { SourceStorageCallEffect } from "./types.js";
/** The storage effect of a native pointer marker call, from the Host pointer-operation record (facts.selections.pointerOperation). */
export declare function sourceStoragePointerCallEffect(operation: SourcePointerOperationRecord | SourceRefusal | undefined): SourceStorageCallEffect | undefined;
//# sourceMappingURL=pointer-effects.d.ts.map