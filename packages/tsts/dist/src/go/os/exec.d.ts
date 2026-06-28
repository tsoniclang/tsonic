import type { GoError, GoSlice } from "../compat.js";
export declare class Cmd {
    Path: string;
    Args: GoSlice<string>;
    Dir: string;
    Env: GoSlice<string> | undefined;
    constructor(name: string, args: GoSlice<string>);
    Run(): GoError;
    Output(): [GoSlice<number>, GoError];
    CombinedOutput(): [GoSlice<number>, GoError];
    String(): string;
}
export declare function Command(name: string, ...arg: GoSlice<string>): Cmd;
export declare function LookPath(file: string): [string, GoError];
//# sourceMappingURL=exec.d.ts.map