export type TstsModuleClosureResolution = {
    readonly ok: true;
    readonly resolvedPath?: string | undefined;
} | {
    readonly ok: false;
    readonly message: string;
};
export type TstsModuleClosureResolver = (input: {
    readonly specifier: string;
    readonly containingFile: string;
}) => TstsModuleClosureResolution;
export type TstsModuleClosureDiagnostic = {
    readonly containingFile: string;
    readonly specifier: string;
    readonly message: string;
};
export type TstsModuleClosureEdge = {
    readonly from: string;
    readonly to: string;
    readonly specifier: string;
};
export type TstsModuleClosureResult = {
    readonly files: readonly string[];
    readonly dependencyEdges: readonly TstsModuleClosureEdge[];
    readonly diagnostics: readonly TstsModuleClosureDiagnostic[];
};
export type TstsModuleClosureOptions = {
    readonly seedFiles: readonly string[];
    readonly resolveModule: TstsModuleClosureResolver;
    readonly shouldIncludeResolvedFile?: (resolvedPath: string) => boolean;
    readonly shouldQueueResolvedFile?: (resolvedPath: string) => boolean;
    readonly shouldReportUnresolved?: (specifier: string, containingFile: string) => boolean;
};
export declare const collectTstsModuleClosure: (options: TstsModuleClosureOptions) => TstsModuleClosureResult;
//# sourceMappingURL=module-closure.d.ts.map