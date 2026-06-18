import type { bool } from "@tsonic/core/types.js";
import type { TB } from "../../testing.js";
export interface TestingT extends TB {
}
export type Comparison = () => string | undefined | bool;
export declare function Assert(t: TestingT, comparison: unknown, ...msgAndArgs: Array<unknown>): void;
export declare function Check(t: TestingT, comparison: unknown, ...msgAndArgs: Array<unknown>): bool;
export declare function DeepEqual(t: TestingT, actual: unknown, expected: unknown, ...msgAndArgs: Array<unknown>): void;
export declare function Equal(t: TestingT, actual: unknown, expected: unknown, ...msgAndArgs: Array<unknown>): void;
export declare function Error(t: TestingT, err: Error | undefined, expected: string, ...msgAndArgs: Array<unknown>): void;
export declare function ErrorContains(t: TestingT, err: Error | undefined, expected: string, ...msgAndArgs: Array<unknown>): void;
export declare function NilError(t: TestingT, err: Error | undefined, ...msgAndArgs: Array<unknown>): void;
//# sourceMappingURL=assert.d.ts.map