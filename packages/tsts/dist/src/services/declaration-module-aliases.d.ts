export type TstsDeclarationModuleAlias = {
    readonly targetSpecifier: string;
    readonly declarationFile: string;
};
export type TstsDeclarationGlobalImport = {
    readonly globalName: string;
    readonly targetSpecifier: string;
    readonly exportName: string;
    readonly declarationFile: string;
};
export declare const discoverTstsDeclarationModuleAliases: (declarationFiles: readonly string[]) => ReadonlyMap<string, TstsDeclarationModuleAlias>;
export declare const discoverTstsDeclarationGlobalImports: (declarationFiles: readonly string[]) => readonly TstsDeclarationGlobalImport[];
//# sourceMappingURL=declaration-module-aliases.d.ts.map