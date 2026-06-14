import type { int } from "@tsonic/core/types.js";
import type { GoError } from "../compat.js";
import type { Writer } from "../io.js";
export interface Profile {
    WriteTo(writer: Writer, debug: int): GoError;
}
export declare function Lookup(name: string): Profile | undefined;
export declare function StartCPUProfile(writer: Writer): GoError;
export declare function StopCPUProfile(): void;
//# sourceMappingURL=pprof.d.ts.map