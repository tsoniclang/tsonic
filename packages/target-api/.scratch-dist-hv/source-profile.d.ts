export declare const tsonicSourceProfileVirtualDirectory = ".tsonic/source-profiles";
export interface TargetSourceProfileDeclaration {
    readonly fileName: string;
    readonly text: string;
}
export interface TargetSourceDeclarationPolicy {
    readonly bundledLibraries?: readonly string[];
    readonly installedDeclarations?: "package-contract";
}
export interface TargetSourceProfileContributions {
    readonly declarations?: readonly TargetSourceProfileDeclaration[];
    readonly declarationPolicy?: TargetSourceDeclarationPolicy;
}
export declare function targetSourceProfileDeclaration(fileName: string, text: string): TargetSourceProfileDeclaration;
export declare function normalizeTargetSourceProfileSegment(value: string): string;
export declare function isTsonicSourceProfileDeclarationPath(fileName: string, ownerId?: string): boolean;
//# sourceMappingURL=source-profile.d.ts.map