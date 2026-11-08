import type { Node } from "@tsonic/tsts";
import type { SourceProgramSemantics } from "./semantics-types.js";
import { type SourceHostPresence } from "./queries.js";
/** The intrinsic nullish constituents of the value read at a node. */
export interface SourceHostNullishComponents {
    /** A constituent is the intrinsic `null`. */
    readonly null: boolean;
    /** A constituent is the intrinsic `undefined`, or `void` (admitted as absence exactly like `undefined`, WP0 A11). */
    readonly undefined: boolean;
    /**
     * Every constituent was classified. false: the checker has no type at the read, or a constituent is opaque (`any`,
     * `unknown`, a type variable or deferred generic type whose values may include null or undefined). An incomplete
     * answer proves only the intrinsics it found; a missing intrinsic is then NOT evidence of absence.
     */
    readonly complete: boolean;
    /**
     * The presence of the same read under the one absence classifier (queries.ts `sourceHostPresence`: null, undefined and
     * a void union arm are absence; a bare void is not). undefined: the checker has no type at the read. The presence
     * witness (`SourceHostInput.presence`) is this field, so presence and the null/undefined split are one read (Q104, R4).
     */
    readonly presence: SourceHostPresence | undefined;
}
/** One reader per program adapter (its lifetime, I5). */
export declare function createSourceHostNullishComponents(semantics: SourceProgramSemantics): (node: Node) => SourceHostNullishComponents;
//# sourceMappingURL=nullish-components.d.ts.map