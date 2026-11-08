import type { ExtensionFactKey, ExtensionFactSubject, Node, SourceDeclarationProvider } from "@tsonic/tsts";
/** A provider-declared call: an exported function signature or a member signature of an exported type. */
export type TargetProviderSourceCallSelector = {
    readonly kind: "export-signature";
    readonly providerId: string;
    readonly providerVersion: string;
    readonly providerModuleId: string;
    readonly exportId: string;
    readonly signatureId: string;
} | {
    readonly kind: "member-signature";
    readonly providerId: string;
    readonly providerVersion: string;
    readonly providerModuleId: string;
    readonly exportId: string;
    readonly memberId: string;
    readonly memberStatic: boolean;
    readonly signatureId: string;
};
/** The provider export names of a safety module (`unsafe`, `safety` and the builder exports). */
export interface TargetSourceSafetyProviderNames {
    readonly moduleSpecifier: string;
    readonly unsafeContextExport: string;
    readonly safetyExport: string;
    readonly safetyBuilderExport: string;
    readonly safetyMemberBuilderExport: string;
}
/** The unsafe-context fact the Host analysis publishes for a selected `unsafe` call. */
export type TargetSourceUnsafeContextFact = {
    readonly kind: "expression";
    readonly expression: Node;
} | {
    readonly kind: "remaining-block";
};
export type TargetSourceSafetyContract = "requires-unsafe" | "safe";
export type TargetSourceSafetyMemberKind = "indexer" | "method" | "property";
export type TargetSourceSafetyApplicationPlacement = "declaration" | "constructor" | "getter" | "setter";
interface TargetSourceSafetyBuilderFactBase {
    readonly applicationTarget: ExtensionFactSubject;
    readonly selectedMember?: ExtensionFactSubject;
    readonly selectedMemberDeclaration?: Node;
    readonly selectedMemberDeclarations?: readonly Node[];
    readonly applicationMemberKind?: TargetSourceSafetyMemberKind;
    readonly applicationPlacement: TargetSourceSafetyApplicationPlacement;
}
/** The safety-builder fact the Host analysis publishes for a selected builder call. */
export type TargetSourceSafetyBuilderFact = (TargetSourceSafetyBuilderFactBase & {
    readonly kind: "builder-state";
}) | (TargetSourceSafetyBuilderFactBase & {
    readonly kind: "application";
    readonly contract: TargetSourceSafetyContract;
});
/** The Host unsafe-context analysis over a provider's `unsafe` calls, with the target's fact key and diagnostic codes. */
export interface TargetSourceUnsafeContextAnalysis {
    readonly kind: "unsafe-context";
    readonly blockSelector: TargetProviderSourceCallSelector;
    readonly expressionSelector: TargetProviderSourceCallSelector;
    readonly factKey: ExtensionFactKey<TargetSourceUnsafeContextFact>;
    readonly invalidPositionCode: string;
    readonly invalidPositionNumber: number;
    readonly factWriteCode: string;
    readonly factWriteNumber: number;
}
/** The Host safety-builder analysis over a provider's safety module calls, with the target's fact key and codes. */
export interface TargetSourceSafetyBuilderAnalysis {
    readonly kind: "safety-builder";
    readonly providerId: string;
    readonly providerVersion: string;
    readonly providerModuleId: string;
    readonly names: TargetSourceSafetyProviderNames;
    readonly factKey: ExtensionFactKey<TargetSourceSafetyBuilderFact>;
    readonly diagnosticPrefix: string;
    readonly diagnosticNumberBase: number;
}
/** A Host provider-call analysis a contribution requests. The Host owns and runs every analysis. */
export type TargetSourceProviderCallAnalysis = TargetSourceUnsafeContextAnalysis | TargetSourceSafetyBuilderAnalysis;
/**
 * One source extension a target, surface or provider capability contributes: its identity, the extensions it runs
 * after, the source declaration providers it registers, and the Host provider-call analyses it requests (their facts
 * are written under this extension's identity).
 */
export interface TargetSourceExtensionContribution {
    readonly identity: {
        readonly id: string;
        readonly version: string;
    };
    /** Extension ids this extension depends on and runs after. */
    readonly dependsOn?: readonly string[];
    readonly declarationProviders?: readonly SourceDeclarationProvider[];
    readonly providerCallAnalyses?: readonly TargetSourceProviderCallAnalysis[];
}
export {};
//# sourceMappingURL=source-extensions.d.ts.map