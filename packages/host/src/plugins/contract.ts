import type { Result } from "../diag/contract.js";
import type { PackageId } from "../ids/contract.js";
import type {
  EffectFailure,
  JsonValue,
  PackageSnapshot,
  SelectedSurfaces,
  SelectedTarget,
  TargetSelection,
} from "../snapshot/contract.js";

export type PluginModule = object & { readonly identityKind: "loaded-plugin-module" };

export interface ModuleOwnership {
  readonly specifierPrefix: string;
  readonly providerId: string | null;
  readonly message: string | null;
}

export interface ProviderDescriptor {
  readonly id: string;
  readonly displayName: string;
  readonly moduleOwnership: readonly ModuleOwnership[];
}

export interface SurfaceDescriptor {
  readonly id: string;
  readonly displayName: string;
  readonly requiredSurfaces: readonly string[];
}

export interface TargetPluginDescriptor {
  readonly kind: "target";
  readonly package: PackageId;
  readonly id: string;
  readonly targetId: string;
  readonly displayName: string;
  readonly provider: ProviderDescriptor;
  readonly surfaces: readonly SurfaceDescriptor[];
}

export interface CapabilityDescriptor {
  readonly kind: "target-capability";
  readonly package: PackageId;
  readonly id: string;
  readonly targetId: string;
  readonly displayName: string;
  readonly requiredCapabilities: readonly string[];
  readonly requiredSurfaces: readonly string[];
  readonly moduleOwnership: readonly ModuleOwnership[];
}

export type PluginDescriptor = TargetPluginDescriptor | CapabilityDescriptor;

export interface PluginCatalogue {
  readonly descriptors: readonly PluginDescriptor[];
}

export interface PluginLoadRequest {
  readonly package: PackageId;
  readonly packageName: string;
  readonly packageRoot: string;
  readonly entry: string;
}

export interface LoadedPlugin {
  readonly request: PluginLoadRequest;
  readonly metadata: JsonValue;
}

export interface PluginModuleEntry {
  readonly package: PackageId;
  readonly entry: string;
  readonly module: PluginModule;
}

export interface PluginLoadCapture {
  readonly outcomes: readonly PluginLoadOutcome[];
  readonly modules: readonly PluginModuleEntry[];
}

export type PluginLoadOutcome =
  | { readonly kind: "loaded"; readonly plugin: LoadedPlugin }
  | {
      readonly kind: "failed";
      readonly request: PluginLoadRequest;
      readonly phase: "resolve" | "import" | "factory";
      readonly name: string;
      readonly message: string;
      readonly system: EffectFailure | null;
    };

export interface PluginLoadDeps {
  readonly pathStyle: "posix" | "windows";
}

export interface PluginDeps {
  readonly catalogue: PluginCatalogue;
}

export type PlanPluginLoads = (
  deps: PluginLoadDeps,
  packages: PackageSnapshot,
) => Result<readonly PluginLoadRequest[]>;

export type DescribePlugins = (
  deps: PluginLoadDeps,
  captured: readonly PluginLoadOutcome[],
) => Result<PluginCatalogue>;

export type SelectSurfaces = (
  deps: PluginDeps,
  target: TargetSelection,
) => Result<SelectedSurfaces>;

export type ActivateCapabilities = (
  deps: PluginDeps,
  selection: SelectedSurfaces,
  importedModuleSpecifiers: readonly string[],
) => Result<SelectedTarget>;

export interface PluginEffects {
  readonly load: (requests: readonly PluginLoadRequest[]) => Promise<PluginLoadCapture>;
}
