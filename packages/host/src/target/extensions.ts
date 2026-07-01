import type { CompilerExtension, RequiredProviderModuleSpec } from "@tsonic/tsts";
import { createTsonicCoreSourceExtension } from "@tsonic/source-core";
import type {
  TargetProvider,
  TargetPack,
  TargetProviderPackageImplementation,
  TargetSelection,
  TargetSurfaceImplementation,
  TsonicProjectConfig,
} from "@tsonic/target-api";

export interface CreateTargetCompilerExtensionsOptions {
  readonly project: TsonicProjectConfig;
  readonly target: TargetSelection;
  readonly targetPack: TargetPack;
  readonly selectedPackages?: readonly TargetProviderPackageImplementation[];
  readonly selectedSurfaces?: readonly TargetSurfaceImplementation[];
}

export interface TargetCompilerExtensionComposition {
  readonly selectedPackages: readonly TargetProviderPackageImplementation[];
  readonly selectedSurfaces: readonly TargetSurfaceImplementation[];
  readonly extensions: readonly CompilerExtension[];
}

export type TargetSurfaceSelectionResult =
  | {
      readonly selectedSurfaces: readonly TargetSurfaceImplementation[];
    }
  | {
      readonly error: string;
    };

export type TargetProviderPackageSelectionResult =
  | {
      readonly selectedPackages: readonly TargetProviderPackageImplementation[];
    }
  | {
      readonly error: string;
    };

export function createTargetCompilerExtensions(options: CreateTargetCompilerExtensionsOptions): TargetCompilerExtensionComposition {
  const selectedPackages = options.selectedPackages === undefined
    ? getSelectedProviderPackageImplementations(options.targetPack, options.target)
    : validateSelectedProviderPackageComposition(options.targetPack, options.target, options.selectedPackages);
  const selectedSurfaces = options.selectedSurfaces === undefined
    ? getSelectedSurfaceImplementations(options.targetPack, options.target)
    : validateSelectedSurfaceComposition(options.targetPack, options.target, options.selectedSurfaces);
  const provider = requireTargetProvider(options.targetPack, options.target);
  const providerContext = {
    project: options.project,
    target: options.target,
    selectedPackages,
    selectedSurfaces,
  };
  const extensions = [
    createTsonicCoreSourceExtension(),
    ...provider.createExtensions(providerContext),
    ...selectedPackages.flatMap((providerPackage) =>
      providerPackage.createExtensions({
        project: options.project,
        target: options.target,
        targetPack: options.targetPack,
        selectedPackages,
        package: providerPackage,
      })
    ),
    ...selectedSurfaces.flatMap((surface) =>
      surface.createExtensions?.({
        ...providerContext,
        targetPack: options.targetPack,
        surface,
      }) ?? []
    ),
  ];
  return {
    selectedPackages,
    selectedSurfaces,
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
  selectedPackages?: readonly TargetProviderPackageImplementation[],
): readonly RequiredProviderModuleSpec[] {
  const selectedPackageIds = new Set((selectedPackages ?? getSelectedProviderPackageImplementations(targetPack, target))
    .map((providerPackage) => providerPackage.id));
  const specs: RequiredProviderModuleSpec[] = [];
  for (const ownership of targetPack.provider?.moduleOwnership ?? []) {
    specs.push({
      specifierPrefix: ownership.specifierPrefix,
      ...(ownership.providerId === undefined ? {} : { providerId: ownership.providerId }),
      target: target.id,
      message: ownership.message ??
        `target '${target.id}' provider must own provider module prefix '${ownership.specifierPrefix}' before it can be imported`,
    });
  }
  for (const providerPackage of targetPack.packages ?? []) {
    const packageSelected = selectedPackageIds.has(providerPackage.id);
    for (const ownership of providerPackage.moduleOwnership ?? []) {
      specs.push({
        specifierPrefix: ownership.specifierPrefix,
        ...(ownership.providerId === undefined ? {} : { providerId: ownership.providerId }),
        target: target.id,
        message: ownership.message ?? getProviderPackageModuleOwnershipMessage(target, providerPackage, ownership.specifierPrefix, packageSelected),
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

export function getSelectedProviderPackageImplementations(
  targetPack: TargetPack,
  target: TargetSelection,
): readonly TargetProviderPackageImplementation[] {
  const result = selectTargetProviderPackageImplementations(targetPack, target);
  if ("error" in result) {
    throw new Error(result.error);
  }
  return result.selectedPackages;
}

export function selectTargetProviderPackageImplementations(
  targetPack: TargetPack,
  target: TargetSelection,
): TargetProviderPackageSelectionResult {
  const requestedPackages = target.packages ?? [];
  const packageById = new Map<string, TargetProviderPackageImplementation>();
  for (const providerPackage of targetPack.packages ?? []) {
    if (packageById.has(providerPackage.id)) {
      return { error: `target '${target.id}' declares provider package '${providerPackage.id}' more than once` };
    }
    packageById.set(providerPackage.id, providerPackage);
  }
  const selectedIds = new Set<string>();
  const selectedPackages: TargetProviderPackageImplementation[] = [];
  for (const packageId of requestedPackages) {
    if (selectedIds.has(packageId)) {
      return { error: `target '${target.id}' requests provider package '${packageId}' more than once` };
    }
    const providerPackage = packageById.get(packageId);
    if (providerPackage === undefined) {
      return { error: `target '${target.id}' does not implement requested provider package '${packageId}'` };
    }
    selectedIds.add(packageId);
    selectedPackages.push(providerPackage);
  }
  for (const providerPackage of selectedPackages) {
    for (const requiredPackageId of providerPackage.requiredPackages ?? []) {
      if (!selectedIds.has(requiredPackageId)) {
        return { error: `target '${target.id}' provider package '${providerPackage.id}' requires provider package '${requiredPackageId}'` };
      }
    }
  }
  return { selectedPackages };
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

function validateSelectedProviderPackageComposition(
  targetPack: TargetPack,
  target: TargetSelection,
  selectedPackages: readonly TargetProviderPackageImplementation[],
): readonly TargetProviderPackageImplementation[] {
  const expectedPackages = getSelectedProviderPackageImplementations(targetPack, target);
  const hasExactComposition = selectedPackages.length === expectedPackages.length &&
    selectedPackages.every((providerPackage, index) => providerPackage === expectedPackages[index]);
  if (!hasExactComposition) {
    throw new Error(
      `target '${target.id}' selected provider package composition is stale or unowned; expected selected target pack packages ` +
        `[${formatProviderPackageIds(expectedPackages)}], received [${formatProviderPackageIds(selectedPackages)}]`,
    );
  }
  return selectedPackages;
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

function formatProviderPackageIds(providerPackages: readonly TargetProviderPackageImplementation[]): string {
  return providerPackages.map((providerPackage) => providerPackage.id).join(",");
}

function getProviderPackageModuleOwnershipMessage(
  target: TargetSelection,
  providerPackage: TargetProviderPackageImplementation,
  specifierPrefix: string,
  packageSelected: boolean,
): string {
  return packageSelected
    ? `target '${target.id}' selected provider package '${providerPackage.id}' must own provider module prefix '${specifierPrefix}' before it can be imported`
    : `target '${target.id}' provider package '${providerPackage.id}' must be selected to import provider module prefix '${specifierPrefix}'`;
}
