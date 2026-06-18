import type { bool } from "@tsonic/core/types.js";
import type { GoChan, GoError } from "./compat.js";
import { Time } from "./time.js";
export declare const Canceled: GoError;
export type CancelFunc = () => void;
export type CancelCauseFunc = (cause: GoError) => void;
export interface Context {
    Deadline(): [Time, bool];
    Done(): GoChan<EmptyStruct, "receive"> | undefined;
    Err(): GoError;
    Value(key: unknown): unknown;
}
type EmptyStruct = {
    readonly __tsgoEmpty?: never;
};
export declare function Background(): Context;
export declare function TODO(): Context;
export declare function WithValue(parent: Context, key: unknown, val: unknown): Context;
export {};
//# sourceMappingURL=context.d.ts.map