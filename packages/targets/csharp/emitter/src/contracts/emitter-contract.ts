import type {
  CSharpLoweringModulePlan,
  EmitterOptions,
  ModuleEmitResult,
} from "../types.js";

export type EmitterContract = {
  readonly emitModule: (
    module: CSharpLoweringModulePlan,
    options?: Partial<EmitterOptions>
  ) => ModuleEmitResult;
  readonly fileExtension: "cs";
  readonly backendName: "csharp";
};
