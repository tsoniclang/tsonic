import type { bool } from "@tsonic/core/types.js";
import type { GoError } from "./compat.js";
export interface GoUnwrappable {
    Unwrap?(): GoError | GoError[];
    Is?(target: GoError): bool;
    As?(target: unknown): bool;
}
export declare class errorString extends globalThis.Error {
    constructor(text: string);
}
export declare function New(text: string): GoError;
export declare function Is(err: GoError, target: GoError): bool;
export type TypeGuard<T> = (err: GoError) => err is T & GoError;
export declare function AsType<T>(err: GoError, guard: TypeGuard<T>): [T | undefined, bool];
//# sourceMappingURL=errors.d.ts.map