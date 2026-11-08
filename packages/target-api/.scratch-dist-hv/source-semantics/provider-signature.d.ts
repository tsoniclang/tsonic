import type { Node, ProviderSignatureDeclaration, ProviderTypeParameterDeclaration, ReadonlySourceFactResolver } from "@tsonic/tsts";
export type SourceProviderSignatureSelection = {
    readonly kind: "available";
    readonly signature: ProviderSignatureDeclaration;
    readonly typeParameters: readonly SourceProviderTypeParameterSelection[];
} | {
    readonly kind: "invalid";
    readonly reason: string;
};
export interface SourceProviderTypeParameterSelection {
    readonly scope: "export" | "signature";
    readonly ownerId: string;
    readonly index: number;
    readonly parameter: ProviderTypeParameterDeclaration;
}
export declare function selectSourceProviderSignature(facts: ReadonlySourceFactResolver, declaration: Node | undefined): SourceProviderSignatureSelection | undefined;
//# sourceMappingURL=provider-signature.d.ts.map