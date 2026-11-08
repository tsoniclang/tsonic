export type TargetId = string;
export type TargetSurfaceId = string;
export type TargetSelectionOptions = Readonly<Record<string, unknown>>;
export interface TargetSelection {
    readonly id: TargetId;
    readonly surfaces?: readonly TargetSurfaceId[];
    readonly options?: TargetSelectionOptions;
}
export interface TsonicProjectConfig {
    readonly entryPoint: string;
    readonly rootFiles?: readonly string[];
    readonly rootDir?: string;
    readonly outDir?: string;
    readonly cacheDir?: string;
    readonly targets: readonly TargetSelection[];
}
export declare function isValidTargetId(value: string): value is TargetId;
export declare function isValidTargetSurfaceId(value: string): value is TargetSurfaceId;
export declare function getTargetIdValidationMessage(subject: string): string;
//# sourceMappingURL=config.d.ts.map