import {
  normalizeTargetSourceProfileSegment,
  tsonicSourceProfileVirtualDirectory,
} from "@tsonic/target-api";
import type {
  TargetCapabilityImplementation,
  TargetDiagnostic,
  TargetPack,
  TargetSelection,
  TargetSourceDeclarationPolicy,
  TargetSourceProfileDeclaration,
  TargetSurfaceImplementation,
  TsonicProjectConfig,
} from "@tsonic/target-api";
import { join } from "node:path";

export interface TargetSourceProfileFile {
  readonly path: string;
  readonly text: string;
  readonly ownerId: string;
}

export interface CollectedTargetSourceProfile {
  readonly files: readonly TargetSourceProfileFile[];
  readonly declarationPolicy: TargetSourceDeclarationPolicy;
  readonly diagnostics: readonly TargetDiagnostic[];
}

export interface CollectTargetSourceProfileOptions {
  readonly project: TsonicProjectConfig;
  readonly projectRoot: string;
  readonly target: TargetSelection;
  readonly targetPack: TargetPack;
  readonly selectedCapabilities: readonly TargetCapabilityImplementation[];
  readonly selectedSurfaces: readonly TargetSurfaceImplementation[];
}

export function collectTargetSourceProfileContributions(options: CollectTargetSourceProfileOptions): CollectedTargetSourceProfile {
  const files: TargetSourceProfileFile[] = [];
  const diagnostics: TargetDiagnostic[] = [];
  const seenPaths = new Map<string, string>();
  const bundledLibraries = new Set<string>();
  let installedDeclarations: TargetSourceDeclarationPolicy["installedDeclarations"];
  const provider = options.targetPack.provider;
  if (provider !== undefined) {
    const contribution = provider.sourceProfileContributions?.({
      project: options.project,
      target: options.target,
      targetPack: options.targetPack,
      selectedCapabilities: options.selectedCapabilities,
      selectedSurfaces: options.selectedSurfaces,
    });
    appendDeclarations({
      files,
      diagnostics,
      seenPaths,
      projectRoot: options.projectRoot,
      ownerId: provider.id,
      source: provider.id,
      declarations: contribution?.declarations ?? [],
    });
    installedDeclarations = appendDeclarationPolicy({
      bundledLibraries,
      diagnostics,
      installedDeclarations,
      ownerId: provider.id,
      policy: contribution?.declarationPolicy,
    });
  }
  for (const capability of options.selectedCapabilities) {
    const contribution = capability.sourceProfileContributions?.({
      project: options.project,
      target: options.target,
      targetPack: options.targetPack,
      selectedCapabilities: options.selectedCapabilities,
      selectedSurfaces: options.selectedSurfaces,
      capability,
    });
    appendDeclarations({
      files,
      diagnostics,
      seenPaths,
      projectRoot: options.projectRoot,
      ownerId: capability.id,
      source: capability.id,
      declarations: contribution?.declarations ?? [],
    });
    installedDeclarations = appendDeclarationPolicy({
      bundledLibraries,
      diagnostics,
      installedDeclarations,
      ownerId: capability.id,
      policy: contribution?.declarationPolicy,
    });
  }
  for (const surface of options.selectedSurfaces) {
    const contribution = surface.sourceProfileContributions?.({
      project: options.project,
      target: options.target,
      targetPack: options.targetPack,
      selectedCapabilities: options.selectedCapabilities,
      selectedSurfaces: options.selectedSurfaces,
      surface,
    });
    appendDeclarations({
      files,
      diagnostics,
      seenPaths,
      projectRoot: options.projectRoot,
      ownerId: surface.id,
      source: `${options.targetPack.id}:${surface.id}`,
      declarations: contribution?.declarations ?? [],
    });
    installedDeclarations = appendDeclarationPolicy({
      bundledLibraries,
      diagnostics,
      installedDeclarations,
      ownerId: `${options.targetPack.id}:${surface.id}`,
      policy: contribution?.declarationPolicy,
    });
  }
  return {
    files,
    declarationPolicy: {
      ...(bundledLibraries.size === 0 ? {} : { bundledLibraries: [...bundledLibraries].sort() }),
      ...(installedDeclarations === undefined ? {} : { installedDeclarations }),
    },
    diagnostics,
  };
}

function appendDeclarationPolicy(options: {
  readonly bundledLibraries: Set<string>;
  readonly diagnostics: TargetDiagnostic[];
  readonly installedDeclarations: TargetSourceDeclarationPolicy["installedDeclarations"];
  readonly ownerId: string;
  readonly policy: TargetSourceDeclarationPolicy | undefined;
}): TargetSourceDeclarationPolicy["installedDeclarations"] {
  const policy = options.policy;
  if (policy === undefined) {
    return options.installedDeclarations;
  }
  if (policy.installedDeclarations !== undefined && policy.installedDeclarations !== "package-contract") {
    options.diagnostics.push({
      code: "TARGET_SOURCE_PROFILE",
      category: "error",
      message: `Source declaration policy from '${options.ownerId}' has unsupported installedDeclarations value '${String(policy.installedDeclarations)}'.`,
      source: options.ownerId,
    });
  }
  for (const library of policy.bundledLibraries ?? []) {
    if (typeof library !== "string" || !/^lib(?:\.[a-z0-9-]+)*\.d\.ts$/u.test(library)) {
      options.diagnostics.push({
        code: "TARGET_SOURCE_PROFILE",
        category: "error",
        message: `Bundled source declaration '${String(library)}' from '${options.ownerId}' must be a canonical lib.*.d.ts file name.`,
        source: options.ownerId,
      });
      continue;
    }
    options.bundledLibraries.add(library);
  }
  return policy.installedDeclarations === "package-contract"
    ? "package-contract"
    : options.installedDeclarations;
}

function appendDeclarations(options: {
  readonly files: TargetSourceProfileFile[];
  readonly diagnostics: TargetDiagnostic[];
  readonly seenPaths: Map<string, string>;
  readonly projectRoot: string;
  readonly ownerId: string;
  readonly source: string;
  readonly declarations: readonly TargetSourceProfileDeclaration[];
}): void {
  for (const declaration of options.declarations) {
    if (!declaration.fileName.endsWith(".d.ts")) {
      options.diagnostics.push({
        code: "TARGET_SOURCE_PROFILE",
        category: "error",
        message: `Source profile declaration '${declaration.fileName}' from '${options.source}' must be a .d.ts file.`,
        source: options.source,
      });
      continue;
    }
    if (declaration.fileName.includes("/") || declaration.fileName.includes("\\") || declaration.fileName === "." || declaration.fileName === "..") {
      options.diagnostics.push({
        code: "TARGET_SOURCE_PROFILE",
        category: "error",
        message: `Source profile declaration '${declaration.fileName}' from '${options.source}' must be a file name, not a path.`,
        source: options.source,
      });
      continue;
    }
    const ownerSegment = normalizeTargetSourceProfileSegment(options.ownerId);
    const fullPath = join(options.projectRoot, tsonicSourceProfileVirtualDirectory, ownerSegment, declaration.fileName).split("\\").join("/");
    const previousOwner = options.seenPaths.get(fullPath);
    if (previousOwner !== undefined) {
      options.diagnostics.push({
        code: "TARGET_SOURCE_PROFILE",
        category: "error",
        message: `Source profile declaration path '${fullPath}' is contributed by both '${previousOwner}' and '${options.source}'.`,
        source: options.source,
      });
      continue;
    }
    options.seenPaths.set(fullPath, options.source);
    options.files.push({
      path: fullPath,
      text: declaration.text,
      ownerId: options.ownerId,
    });
  }
}
