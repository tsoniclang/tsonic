import {
  createSourceSemanticsExtension,
} from "@tsonic/tsts";
import type {
  CompilerExtension,
  RequiredProviderModuleSpec,
  SourceSemanticsModule,
} from "@tsonic/tsts";
import {
  createTsonicCoreSourceExtension,
  tsonicCoreSourceSemanticsModules,
} from "@tsonic/source-core";
import type {
  TargetProvider,
  TargetPack,
  TargetCapabilityImplementation,
  TargetSelection,
  TargetSurfaceImplementation,
  TsonicProjectConfig,
} from "@tsonic/target-api";

export interface CreateTargetSourceCompilerCompositionOptions {
  readonly project: TsonicProjectConfig;
  readonly projectDirectory: string;
  readonly target: TargetSelection;
  readonly targetPack: TargetPack;
  readonly selectedCapabilities?: readonly TargetCapabilityImplementation[];
  readonly selectedSurfaces?: readonly TargetSurfaceImplementation[];
}

export interface TargetSourceCompilerComposition {
  readonly selectedCapabilities: readonly TargetCapabilityImplementation[];
  readonly selectedSurfaces: readonly TargetSurfaceImplementation[];
  readonly semanticsModules: readonly SourceSemanticsModule[];
  readonly extensions: readonly CompilerExtension[];
}

export type TargetSurfaceSelectionResult =
  | {
      readonly selectedSurfaces: readonly TargetSurfaceImplementation[];
    }
  | {
      readonly error: string;
    };

export type TargetCapabilitySelectionResult =
  | {
      readonly selectedCapabilities: readonly TargetCapabilityImplementation[];
    }
  | {
      readonly error: string;
    };

export function createTargetSourceCompilerComposition(
  options: CreateTargetSourceCompilerCompositionOptions,
): TargetSourceCompilerComposition {
  const selectedSurfaces = options.selectedSurfaces === undefined
    ? getSelectedSurfaceImplementations(options.targetPack, options.target)
    : validateSelectedSurfaceComposition(options.targetPack, options.target, options.selectedSurfaces);
  const selectedCapabilities = options.selectedCapabilities ?? [];
  const provider = requireTargetProvider(options.targetPack, options.target);
  const providerContext = {
    project: options.project,
    projectDirectory: options.projectDirectory,
    target: options.target,
    targetPack: options.targetPack,
    selectedCapabilities,
    selectedSurfaces,
  };
  const providerContributions = provider.sourceCompilerContributions(providerContext);
  const capabilityContributions = selectedCapabilities.map((capability) =>
    capability.sourceCompilerContributions?.({
      project: options.project,
      target: options.target,
      targetPack: options.targetPack,
      selectedCapabilities,
      selectedSurfaces,
      capability,
    }) ?? {}
  );
  const surfaceContributions = selectedSurfaces.map((surface) =>
    surface.sourceCompilerContributions?.({
      ...providerContext,
      surface,
    }) ?? {}
  );
  const semanticsModules = Object.freeze([
    ...tsonicCoreSourceSemanticsModules(),
    ...(providerContributions.semanticsModules ?? []),
    ...capabilityContributions.flatMap((contribution) => contribution.semanticsModules ?? []),
    ...surfaceContributions.flatMap((contribution) => contribution.semanticsModules ?? []),
  ]);
  const extensions = Object.freeze([
    createSourceSemanticsExtension({ modules: semanticsModules }),
    createTsonicCoreSourceExtension(),
    ...(providerContributions.extensions ?? []),
    ...capabilityContributions.flatMap((contribution) => contribution.extensions ?? []),
    ...surfaceContributions.flatMap((contribution) => contribution.extensions ?? []),
  ]);
  return {
    selectedCapabilities,
    selectedSurfaces,
    semanticsModules,
    extensions,
  };
}

export function requireTargetProvider(targetPack: TargetPack, target: TargetSelection): TargetProvider {
  const provider = targetPack.provider;
  if (provider === undefined) {
    throw new Error(getMissingTargetProviderMessage(target));
  }
  return provider;
}

export function getMissingTargetProviderMessage(target: TargetSelection): string {
  return `target '${target.id}' does not declare a provider; Tsonic requires provider-composed TSTS facts before backend emission`;
}

export function getTargetRequiredProviderModules(
  targetPack: TargetPack,
  target: TargetSelection,
  selectedCapabilities: readonly TargetCapabilityImplementation[] = [],
): readonly RequiredProviderModuleSpec[] {
  const specs: RequiredProviderModuleSpec[] = [];
  for (const ownership of targetPack.provider?.moduleOwnership ?? []) {
    specs.push({
      specifierPrefix: ownership.specifierPrefix,
      ...(ownership.providerId === undefined ? {} : { providerId: ownership.providerId }),
      message: ownership.message ??
        `target '${target.id}' provider must own provider module prefix '${ownership.specifierPrefix}' before it can be imported`,
    });
  }
  for (const capability of selectedCapabilities) {
    for (const ownership of capability.moduleOwnership ?? []) {
      specs.push({
        specifierPrefix: ownership.specifierPrefix,
      ...(ownership.providerId === undefined ? {} : { providerId: ownership.providerId }),
      message: ownership.message ?? `installed capability '${capability.id}' for target '${target.id}' must own provider module prefix '${ownership.specifierPrefix}' before it can be imported`,
      });
    }
  }
  return specs;
}

export function getSelectedSurfaceImplementations(
  targetPack: TargetPack,
  target: TargetSelection,
): readonly TargetSurfaceImplementation[] {
  const result = selectTargetSurfaceImplementations(targetPack, target);
  if ("error" in result) {
    throw new Error(result.error);
  }
  return result.selectedSurfaces;
}

export function getSelectedTargetCapabilities(
  target: TargetSelection,
  installedCapabilities: readonly TargetCapabilityImplementation[],
  selectedSurfaces: readonly TargetSurfaceImplementation[] = [],
): readonly TargetCapabilityImplementation[] {
  const result = selectInstalledTargetCapabilities(target, installedCapabilities, selectedSurfaces);
  if ("error" in result) {
    throw new Error(result.error);
  }
  return result.selectedCapabilities;
}

export function selectInstalledTargetCapabilities(
  target: TargetSelection,
  installedCapabilities: readonly TargetCapabilityImplementation[],
  selectedSurfaces: readonly TargetSurfaceImplementation[] = [],
): TargetCapabilitySelectionResult {
  const selectedCapabilities: TargetCapabilityImplementation[] = [];
  const moduleOwners = new Map<string, string>();
  const selectedCapabilityIds = new Set(installedCapabilities
    .filter((capability) => capability.targetId === target.id)
    .map((capability) => capability.id));
  const selectedSurfaceIds = new Set(selectedSurfaces.map((surface) => surface.id));
  for (const capability of installedCapabilities) {
    if (capability.targetId !== target.id) {
      continue;
    }
    for (const requiredSurfaceId of capability.requiredSurfaces ?? []) {
      if (!selectedSurfaceIds.has(requiredSurfaceId)) {
        return { error: `installed capability '${capability.id}' for target '${target.id}' requires surface '${requiredSurfaceId}'` };
      }
    }
    for (const requiredCapabilityId of capability.requiredCapabilities ?? []) {
      if (!selectedCapabilityIds.has(requiredCapabilityId)) {
        return { error: `installed capability '${capability.id}' for target '${target.id}' requires capability '${requiredCapabilityId}'` };
      }
    }
    for (const ownership of capability.moduleOwnership) {
      const previousOwner = moduleOwners.get(ownership.specifierPrefix);
      if (previousOwner !== undefined) {
        return { error: `Ambiguous Tsonic capability ownership for target '${target.id}' and module '${ownership.specifierPrefix}': ${previousOwner}, ${capability.id}` };
      }
      moduleOwners.set(ownership.specifierPrefix, capability.id);
    }
    selectedCapabilities.push(capability);
  }
  return { selectedCapabilities };
}

export function moduleSpecifierMatchesOwnership(specifier: string, specifierPrefix: string): boolean {
  if (specifier.startsWith(specifierPrefix) && /[:/]$/.test(specifierPrefix)) {
    return true;
  }
  return specifier === specifierPrefix || specifier.startsWith(`${specifierPrefix}/`);
}

export function selectTargetSurfaceImplementations(
  targetPack: TargetPack,
  target: TargetSelection,
): TargetSurfaceSelectionResult {
  const requestedSurfaces = target.surfaces ?? [];
  const surfaceById = new Map<string, TargetSurfaceImplementation>();
  for (const surface of targetPack.surfaces ?? []) {
    if (surfaceById.has(surface.id)) {
      return { error: `target '${target.id}' declares surface '${surface.id}' more than once` };
    }
    surfaceById.set(surface.id, surface);
  }
  const selectedIds = new Set<string>();
  const selectedSurfaces: TargetSurfaceImplementation[] = [];
  for (const surfaceId of requestedSurfaces) {
    if (selectedIds.has(surfaceId)) {
      return { error: `target '${target.id}' requests surface '${surfaceId}' more than once` };
    }
    const surface = surfaceById.get(surfaceId);
    if (surface === undefined) {
      return { error: `target '${target.id}' does not implement requested surface '${surfaceId}'` };
    }
    selectedIds.add(surfaceId);
    selectedSurfaces.push(surface);
  }
  for (const surface of selectedSurfaces) {
    for (const requiredSurfaceId of surface.requiredSurfaces ?? []) {
      if (!selectedIds.has(requiredSurfaceId)) {
        return { error: `target '${target.id}' surface '${surface.id}' requires surface '${requiredSurfaceId}'` };
      }
    }
  }
  return { selectedSurfaces };
}

function validateSelectedSurfaceComposition(
  targetPack: TargetPack,
  target: TargetSelection,
  selectedSurfaces: readonly TargetSurfaceImplementation[],
): readonly TargetSurfaceImplementation[] {
  const expectedSurfaces = getSelectedSurfaceImplementations(targetPack, target);
  const hasExactComposition = selectedSurfaces.length === expectedSurfaces.length &&
    selectedSurfaces.every((surface, index) => surface === expectedSurfaces[index]);
  if (!hasExactComposition) {
    throw new Error(
      `target '${target.id}' selected surface composition is stale or unowned; expected selected target pack surfaces ` +
        `[${formatSurfaceIds(expectedSurfaces)}], received [${formatSurfaceIds(selectedSurfaces)}]`,
    );
  }
  return selectedSurfaces;
}

function formatSurfaceIds(surfaces: readonly TargetSurfaceImplementation[]): string {
  return surfaces.map((surface) => surface.id).join(",");
}
