import type { ProviderExportDeclaration, ProviderTypeParameterDeclaration } from "./host.js";
export declare function getProviderExportContractKeyMap(moduleSpecifier: string, exports: readonly ProviderExportDeclaration[]): ReadonlyMap<string, string>;
export interface ProviderIncrementalExportContract {
    readonly sourceExportName: string;
    readonly typeArgumentCount?: number;
    readonly headerKey: string;
    readonly bodyKey?: string;
}
export declare function getProviderIncrementalExportContractMap(moduleSpecifier: string, exports: readonly ProviderExportDeclaration[]): ReadonlyMap<string, ProviderIncrementalExportContract>;
export declare function getProviderTypeParameterContractKey(parameter: ProviderTypeParameterDeclaration): string;
//# sourceMappingURL=provider-export-contract.d.ts.map