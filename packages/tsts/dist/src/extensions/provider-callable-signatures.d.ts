import type { ProviderDeclarationModel, ProviderExportDeclaration, ProviderMemberDeclaration, ProviderParameterDeclaration, ProviderTypeExpression } from "./host.js";
export type ProviderFunctionTypeExpression = Extract<ProviderTypeExpression, {
    readonly kind: "function";
}>;
export interface ProviderRenderedFunctionSignature {
    readonly marker: number;
    readonly exportId: string;
    readonly memberId?: string;
    readonly signatureId: string;
    readonly parameters: readonly ProviderParameterDeclaration[];
}
export declare const providerFunctionSignatureMarkerMaximumLength: number;
export declare function createProviderRenderedFunctionSignature(declaration: ProviderExportDeclaration, member: ProviderMemberDeclaration | undefined, signature: ProviderFunctionTypeExpression, marker: number): ProviderRenderedFunctionSignature;
export declare function renderProviderFunctionSignatureMarker(marker: number): string;
export declare function parseProviderFunctionSignatureMarker(sourceText: string): number | undefined;
export declare function hasUniqueProviderCallableIdentities(model: ProviderDeclarationModel): boolean;
//# sourceMappingURL=provider-callable-signatures.d.ts.map