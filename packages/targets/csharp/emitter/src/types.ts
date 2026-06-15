import type {
  Diagnostic,
  LoweringDeclarationPlan,
  LoweringExternalBindingReferencePlan,
  LoweringModulePlan,
  LoweringTypeRefPlan,
} from "@tsonic/frontend";
import type { CSharpEmitterTargetId } from "./target.js";
import type { ExternalBindingMetadataIndex } from "./rendering/external-bindings.js";

export type CSharpLoweringModulePlan =
  LoweringModulePlan<CSharpEmitterTargetId>;

export type EmitterOptions = {
  readonly rootNamespace?: string;
  readonly entryPointPath?: string;
  readonly referenceModules?: readonly CSharpLoweringModulePlan[];
  readonly libraries?: readonly string[];
  readonly bindingMetadataRoots?: readonly string[];
  readonly externalBindingMetadata?: ExternalBindingMetadataIndex;
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
  currentReturnType?: LoweringTypeRefPlan;
  currentDefaultedParameters?: ReadonlyMap<string, string>;
  currentTypeParameters?: ReadonlySet<string>;
  readonly allocateTempName: (prefix: string) => string;
  readonly getStructuralTypeName: (type: LoweringTypeRefPlan) => string;
  readonly externalBindingTargetName: (
    binding: LoweringExternalBindingReferencePlan
  ) => string | undefined;
  readonly overrideMemberAccessibility: (
    heritageTypes: readonly LoweringTypeRefPlan[],
    member: LoweringDeclarationPlan
  ) => LoweringDeclarationPlan["accessibility"] | undefined;
  readonly reportUnsupported: (
    feature: string,
    sourceKindName: string,
    sourceText: string
  ) => void;
};
