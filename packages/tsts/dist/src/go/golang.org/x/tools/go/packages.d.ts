import type { int } from "@tsonic/core/types.js";
import type { GoError, GoSlice } from "../../../../compat.js";
export type LoadMode = int;
export declare const NeedName: LoadMode;
export declare const NeedFiles: LoadMode;
export declare const NeedCompiledGoFiles: LoadMode;
export declare const NeedImports: LoadMode;
export declare const NeedTypes: LoadMode;
export declare const NeedSyntax: LoadMode;
export declare const LoadAllSyntax: LoadMode;
export interface Config {
    Mode?: LoadMode;
    Dir?: string;
    Env?: GoSlice<string>;
}
export interface Package {
    ID: string;
    Name: string;
    PkgPath: string;
    GoFiles: GoSlice<string>;
    CompiledGoFiles: GoSlice<string>;
    Imports: Map<string, Package>;
    Errors: GoSlice<Error>;
}
export declare function Load(config: Config | undefined, ...patterns: GoSlice<string>): [GoSlice<Package>, GoError];
//# sourceMappingURL=packages.d.ts.map