import type { ulong } from "../../../scalars.js";
import type { GoError } from "../../../compat.js";
export interface Stats {
    Total: ulong;
    Used: ulong;
    Cached: ulong;
    Free: ulong;
}
export declare function Get(): [Stats, GoError];
//# sourceMappingURL=memory.d.ts.map