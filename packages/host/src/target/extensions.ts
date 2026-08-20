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
  SelectedTargetCapabilityContributions,
  TargetCompositionContext,
  TargetPack,
  TargetProviderDescriptor,
  TargetSelection,
  TargetSourceCompilerContributions,
  TargetSurfaceImplementation,
  TsonicProjectConfig,
} from "@tsonic/target-api";
import type {
  TargetCapabilityContext,
  TargetCapabilityImplementation,
  TargetProviderModuleOwnership,
} from "@tsonic/target-api/provider";

export interface CreateTargetSourceCompilerCompositionOptions {
  readonly project: TsonicProjectConfig;
  readonly projectDirectory: string;
  readonly target: TargetSelection;
  readonly targetPack: TargetPack;
  readonly selectedCapabilities: readonly TargetCapabilityImplementation[];
  readonly selectedSurfaces: readonly TargetSurfaceImplementation[];
  readonly targetContributions: TargetSourceCompilerContributions;
}

export interface TargetSourceCompilerComposition {
  readonly semanticsModules: readonly SourceSemanticsModule[];
  readonly extensions: readonly CompilerExtension[];
}

export interface CaptureTargetCapabilityContributionsOptions {
  readonly project: TsonicProjectConfig;
  readonly projectDirectory: string;
  readonly target: TargetSelection;
  readonly selectedCapabilities: readonly TargetCapabilityImplementation[];
  readonly selectedSurfaces: readonly TargetSurfaceImplementation[];
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

export function captureTargetCapabilityContributions(
  options: CaptureTargetCapabilityContributionsOptions,
): readonly SelectedTargetCapabilityContributions[] {
  const context = createCompositionContext(options);
  return Object.freeze(options.selectedCapabilities.map((capability) => {
    const contributionContext: TargetCapabilityContext = Object.freeze({
      ...context,
      capability,
    });
    const contributions = capability.createTargetContributions?.(contributionContext) ?? [];
    if (!Array.isArray(contributions)) {
      throw new Error(
        `Target capability '${capability.id}' returned a non-array target contribution set.`,
      );
    }
    return Object.freeze({
      capabilityId: capability.id,
      moduleOwnership: Object.freeze([...capability.moduleOwnership]),
      contributions: Object.freeze([...contributions]),
    });
  }));
}

export function createTargetSourceCompilerComposition(
  options: CreateTargetSourceCompilerCompositionOptions,
): TargetSourceCompilerComposition {
  const context = createCompositionContext(options);
  const capabilityContributions = options.selectedCapabilities.map((capability) =>
    capability.sourceCompilerContributions?.(Object.freeze({
      ...context,
      capability,
    })) ?? {},
  );
  const surfaceContributions = options.selectedSurfaces.map((surface) =>
    surface.sourceCompilerContributions?.(Object.freeze({
      ...context,
      surface,
    })) ?? {},
  );
  const semanticsModules = Object.freeze([
    ...tsonicCoreSourceSemanticsModules(),
    ...(options.targetContributions.semanticsModules ?? []),
    ...capabilityContributions.flatMap((contribution) => contribution.semanticsModules ?? []),
    ...surfaceContributions.flatMap((contribution) => contribution.semanticsModules ?? []),
  ]);
  const extensions = Object.freeze([
    createSourceSemanticsExtension({ modules: semanticsModules }),
    createTsonicCoreSourceExtension(),
    ...(options.targetContributions.extensions ?? []),
    ...capabilityContributions.flatMap((contribution) => contribution.extensions ?? []),
    ...surfaceContributions.flatMap((contribution) => contribution.extensions ?? []),
  ]);
  return Object.freeze({ semanticsModules, extensions });
}

export function getTargetRequiredProviderModules(
  target: TargetSelection,
  provider: TargetProviderDescriptor,
  selectedCapabilities: readonly TargetCapabilityImplementation[],
): readonly RequiredProviderModuleSpec[] {
  const ownership = validateTargetModuleOwnership(
    target,
    provider,
    selectedCapabilities,
  );
  return Object.freeze(ownership.map((entry) => Object.freeze({
    specifierPrefix: entry.ownership.specifierPrefix,
    ...(entry.ownership.providerId === undefined ? {} : { providerId: entry.ownership.providerId }),
    message: entry.ownership.message ??
      `${entry.ownerKind} '${entry.ownerId}' for target '${target.id}' must own provider module prefix '${entry.ownership.specifierPrefix}' before it can be imported`,
  })));
}

export function validateTargetModuleOwnership(
  target: TargetSelection,
  provider: TargetProviderDescriptor,
  selectedCapabilities: readonly TargetCapabilityImplementation[],
): readonly TargetModuleOwnership[] {
  const declared: TargetModuleOwnership[] = [
    ...provider.moduleOwnership.map((ownership) => ({
      ownerId: provider.id,
      ownerKind: "target provider" as const,
      ownership,
    })),
    ...selectedCapabilities.flatMap((capability) => capability.moduleOwnership.map((ownership) => ({
      ownerId: capability.id,
      ownerKind: "target capability" as const,
      ownership,
    }))),
  ];
  const canonical: TargetModuleOwnership[] = [];
  for (const entry of declared) {
    let duplicate = false;
    for (const existing of canonical) {
      if (!moduleOwnershipOverlaps(existing.ownership.specifierPrefix, entry.ownership.specifierPrefix)) {
        continue;
      }
      if (existing.ownerId !== entry.ownerId) {
        throw new Error(
          `Ambiguous Tsonic provider ownership for target '${target.id}' and module prefixes '${existing.ownership.specifierPrefix}' (${existing.ownerId}) and '${entry.ownership.specifierPrefix}' (${entry.ownerId}).`,
        );
      }
      if (effectiveProviderId(existing) !== effectiveProviderId(entry)) {
        throw new Error(
          `Contradictory Tsonic provider ownership for target '${target.id}' and module prefixes '${existing.ownership.specifierPrefix}' and '${entry.ownership.specifierPrefix}' from '${entry.ownerId}'.`,
        );
      }
      if (existing.ownership.specifierPrefix === entry.ownership.specifierPrefix) {
        if (!sameModuleOwnership(existing.ownership, entry.ownership)) {
          throw new Error(
            `Contradictory Tsonic provider ownership metadata for target '${target.id}' and module prefix '${entry.ownership.specifierPrefix}' from '${entry.ownerId}'.`,
          );
        }
        duplicate = true;
        break;
      }
    }
    if (!duplicate) {
      canonical.push(entry);
    }
  }
  return Object.freeze([...canonical].sort(compareTargetModuleOwnership));
}

export interface TargetModuleOwnership {
  readonly ownerId: string;
  readonly ownerKind: "target provider" | "target capability";
  readonly ownership: TargetProviderModuleOwnership;
}

export function moduleSpecifierMatchesOwnership(specifier: string, specifierPrefix: string): boolean {
  if (specifier.startsWith(specifierPrefix) && /[:/]$/.test(specifierPrefix)) {
    return true;
  }
  return specifier === specifierPrefix || specifier.startsWith(`${specifierPrefix}/`);
}

export function moduleOwnershipOverlaps(left: string, right: string): boolean {
  return moduleSpecifierMatchesOwnership(left, right) ||
    moduleSpecifierMatchesOwnership(right, left);
}

export function selectInstalledTargetCapabilities(
  target: TargetSelection,
  installedCapabilities: readonly TargetCapabilityImplementation[],
  selectedSurfaces: readonly TargetSurfaceImplementation[] = [],
): TargetCapabilitySelectionResult {
  const selectedCapabilities: TargetCapabilityImplementation[] = [];
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
    for (const existing of selectedCapabilities) {
      for (const left of existing.moduleOwnership) {
        for (const right of capability.moduleOwnership) {
          if (moduleOwnershipOverlaps(left.specifierPrefix, right.specifierPrefix)) {
            return {
              error: `Ambiguous Tsonic capability ownership for target '${target.id}' and module prefixes '${left.specifierPrefix}' (${existing.id}) and '${right.specifierPrefix}' (${capability.id}).`,
            };
          }
        }
      }
    }
    selectedCapabilities.push(capability);
  }
  return { selectedCapabilities: Object.freeze(selectedCapabilities) };
}

export function selectTargetSurfaceImplementations(
  targetPack: TargetPack,
  target: TargetSelection,
): TargetSurfaceSelectionResult {
  const requestedSurfaces = target.surfaces ?? [];
  const surfaceById = new Map<string, TargetSurfaceImplementation>();
  for (const surface of targetPack.surfaces) {
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
  return { selectedSurfaces: Object.freeze(selectedSurfaces) };
}

function createCompositionContext(options: {
  readonly project: TsonicProjectConfig;
  readonly projectDirectory: string;
  readonly target: TargetSelection;
  readonly selectedCapabilities: readonly TargetCapabilityImplementation[];
  readonly selectedSurfaces: readonly TargetSurfaceImplementation[];
}): TargetCompositionContext {
  return Object.freeze({
    project: options.project,
    projectDirectory: options.projectDirectory,
    target: options.target,
    selectedCapabilityIds: Object.freeze(options.selectedCapabilities.map((capability) => capability.id)),
    selectedSurfaceIds: Object.freeze(options.selectedSurfaces.map((surface) => surface.id)),
  });
}

function sameModuleOwnership(
  left: TargetProviderModuleOwnership,
  right: TargetProviderModuleOwnership,
): boolean {
  return left.specifierPrefix === right.specifierPrefix &&
    left.providerId === right.providerId &&
    left.message === right.message;
}

function effectiveProviderId(entry: TargetModuleOwnership): string {
  return entry.ownership.providerId ?? entry.ownerId;
}

function compareTargetModuleOwnership(
  left: TargetModuleOwnership,
  right: TargetModuleOwnership,
): number {
  return right.ownership.specifierPrefix.length - left.ownership.specifierPrefix.length ||
    left.ownership.specifierPrefix.localeCompare(right.ownership.specifierPrefix) ||
    left.ownerId.localeCompare(right.ownerId) ||
    (left.ownership.providerId ?? "").localeCompare(right.ownership.providerId ?? "");
}
