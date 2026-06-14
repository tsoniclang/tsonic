import type { LoweringModulePlan } from "@tsonic/frontend";

export type EmitterConfig = {
  readonly projectRoot: string;
  readonly outputDir: string;
  readonly moduleMap: ReadonlyMap<string, string>;
  readonly typeRoots: readonly string[];
};

export type EmitDiagnostic = {
  readonly code: string;
  readonly message: string;
  readonly filePath?: string;
  readonly line?: number;
};

export type ModuleEmitResult = {
  readonly fileName: string;
  readonly content: string;
  readonly diagnostics: readonly EmitDiagnostic[];
};

export type EmitterContract = {
  readonly emitModule: (
    module: LoweringModulePlan,
    config: EmitterConfig
  ) => ModuleEmitResult;
  readonly fileExtension: string;
  readonly backendName: string;
};
