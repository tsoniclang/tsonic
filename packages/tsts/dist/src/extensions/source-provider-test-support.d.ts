import type { GoPtr } from "../go/compat.js";
import type { Node } from "../internal/ast/ast.js";
import { type CompilerExtension, type ExtensionDiagnostic, type ProviderDeclarationModel, type ProviderDeclarationRequest, type ProviderModuleContext, type ProviderModuleResolution, type SourceDeclarationProvider } from "./index.js";
export declare const testCoreDeclarations: string;
export declare const testNoLibCompilerOptions: Readonly<{
    noLib: true;
    module: "esnext";
    moduleResolution: "bundler";
}>;
export declare function sourceProviderExtension(models: ReadonlyMap<string, ProviderDeclarationModel>, options?: {
    readonly extensionId?: string;
    readonly providerId?: string;
    readonly declarationMaterialization?: SourceDeclarationProvider["declarationMaterialization"];
    readonly packageName?: string;
    readonly packageVersion?: string;
    readonly onContext?: (specifier: string, context: ProviderModuleContext) => void;
    readonly getDeclarationModel?: (resolution: ProviderModuleResolution, model: ProviderDeclarationModel, request: ProviderDeclarationRequest) => ProviderDeclarationModel | ExtensionDiagnostic;
}): CompilerExtension;
export declare function sourceProviderCompilerExtension(provider: SourceDeclarationProvider, extensionId?: string): CompilerExtension;
export declare function testProviderIdentity(id: string): {
    readonly id: string;
    readonly version: "1.0.0";
    readonly extensionContractVersion: "tsts.source-provider.2";
};
export declare function testProviderModel(moduleSpecifier: string, providerModuleId: string, exports?: ProviderDeclarationModel["exports"]): ProviderDeclarationModel;
export declare function findNodes(root: GoPtr<Node>, children: (node: GoPtr<Node>) => readonly GoPtr<Node>[], predicate: (node: GoPtr<Node>) => boolean): readonly GoPtr<Node>[];
//# sourceMappingURL=source-provider-test-support.d.ts.map