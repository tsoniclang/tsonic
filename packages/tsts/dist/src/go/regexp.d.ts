import type { bool, int } from "@tsonic/core/types.js";
import type { GoError, GoSlice } from "./compat.js";
export declare class Regexp {
    private readonly pattern;
    private readonly jsSource;
    private readonly ignoreCase;
    constructor(pattern: string);
    private compileFlags;
    String(): string;
    MatchString(s: string): bool;
    FindStringSubmatch(s: string): GoSlice<string> | undefined;
    private findAllStringIndex;
    Split(s: string, n: int): GoSlice<string> | undefined;
    ReplaceAllStringFunc(src: string, repl: (match: string) => string): string;
}
export declare function Compile(expr: string): [Regexp | undefined, GoError];
export declare function MustCompile(str: string): Regexp;
//# sourceMappingURL=regexp.d.ts.map