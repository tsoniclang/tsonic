import type { Diagnostic, LoweringModulePlan } from "@tsonic/frontend";
import type { CSharpEmitterTargetId } from "./target.js";

export type CSharpLoweringModulePlan =
  LoweringModulePlan<CSharpEmitterTargetId>;

export type EmitterOptions = {
  readonly rootNamespace?: string;
  readonly entryPointPath?: string;
  readonly referenceModules?: readonly CSharpLoweringModulePlan[];
  readonly libraries?: readonly string[];
  readonly surface?: string;
};

export type EmitResult =
  | { readonly ok: true; readonly files: Map<string, string> }
  | { readonly ok: false; readonly errors: readonly Diagnostic[] };

export type ModuleEmitResult =
  | { readonly ok: true; readonly code: string }
  | { readonly ok: false; readonly errors: readonly Diagnostic[] };

export type RenderContext = {
  readonly diagnostics: Diagnostic[];
  readonly reportUnsupported: (
    feature: string,
    sourceKindName: string,
    sourceText: string
  ) => void;
};
