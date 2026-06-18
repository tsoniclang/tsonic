import type { bool, int } from "@tsonic/core/types.js";
import type { GoError, GoSlice } from "./compat.js";
export declare const ContinueOnError: int;
export interface FlagValue<T> {
    value: T;
}
export declare class FlagSet {
    readonly name: string;
    readonly errorHandling: int;
    private readonly flags;
    constructor(name: string, errorHandling: int);
    String(name: string, value: string, _usage: string): FlagValue<string>;
    Bool(name: string, value: bool, _usage: string): FlagValue<bool>;
    Parse(args: GoSlice<string>): GoError;
}
export declare const CommandLine: FlagSet;
export declare function NewFlagSet(name: string, errorHandling: int): FlagSet;
export declare function String(name: string, value: string, usage: string): FlagValue<string>;
export declare function Bool(name: string, value: bool, usage: string): FlagValue<bool>;
export declare function Parse(args?: GoSlice<string>): GoError;
export declare function Usage(): void;
//# sourceMappingURL=flag.d.ts.map