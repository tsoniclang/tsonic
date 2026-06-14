import type { GoError } from "../../../compat.js";
import type { Context } from "../../../context.js";
export declare class Group {
    private err;
    Go(fn: () => GoError): void;
    Wait(): GoError;
}
export declare function WithContext(ctx: Context): [Group, Context];
//# sourceMappingURL=errgroup.d.ts.map