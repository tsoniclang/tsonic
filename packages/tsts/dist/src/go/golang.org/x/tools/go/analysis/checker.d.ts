import type { GoError, GoSlice } from "../../../../../compat.js";
export interface Analyzer {
    Name?: string;
    Run?: (pass: unknown) => [unknown, GoError] | GoError;
}
export declare function Analyze(analyzers: GoSlice<Analyzer>, packages: GoSlice<unknown>): GoError;
//# sourceMappingURL=checker.d.ts.map