import type { ProviderDeclarationModel, ProviderTypeParameterDeclaration } from "./host.js";
export interface ProviderDeclarationModelGraphMetrics {
    readonly physicalNodeAndArrayEntryCount: number;
    readonly physicalScalarCodeUnitCount: number;
    readonly expandedSemanticNodeAndArrayEntryCount: number;
    readonly expandedSemanticScalarCodeUnitCount: number;
}
export type ProviderDeclarationModelGraphValidation = {
    readonly kind: "valid";
    readonly model: ProviderDeclarationModel;
    readonly metrics: ProviderDeclarationModelGraphMetrics;
} | {
    readonly kind: "invalid";
    readonly reason: "shape" | "cycle" | "depth" | "complexity";
    readonly path: string;
    readonly firstPath?: string;
    readonly depth: number;
    readonly limit?: number;
};
export declare function validateProviderDeclarationModelGraph(value: unknown): ProviderDeclarationModelGraphValidation;
export declare function canonicalizeProviderAbiModel(model: ProviderDeclarationModel): ProviderDeclarationModel;
export declare function canonicalizeProviderAbiTypeParameter(parameter: ProviderTypeParameterDeclaration): ProviderTypeParameterDeclaration;
//# sourceMappingURL=provider-model-graph.d.ts.map