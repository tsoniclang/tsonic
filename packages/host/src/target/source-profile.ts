import {
  normalizeTargetSourceProfileSegment,
  tsonicSourceProfileVirtualDirectory,
} from "@tsonic/target-api";
import type {
  TargetCapabilityImplementation,
  TargetDiagnostic,
  TargetPack,
  TargetSelection,
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
  const provider = options.targetPack.provider;
  if (provider !== undefined) {
    appendDeclarations({
      files,
      diagnostics,
      seenPaths,
      projectRoot: options.projectRoot,
      ownerId: provider.id,
      source: provider.id,
      declarations: provider.sourceProfileContributions?.({
        project: options.project,
        target: options.target,
        targetPack: options.targetPack,
        selectedCapabilities: options.selectedCapabilities,
        selectedSurfaces: options.selectedSurfaces,
      })?.declarations ?? [],
    });
  }
  for (const capability of options.selectedCapabilities) {
    appendDeclarations({
      files,
      diagnostics,
      seenPaths,
      projectRoot: options.projectRoot,
      ownerId: capability.id,
      source: capability.id,
      declarations: capability.sourceProfileContributions?.({
        project: options.project,
        target: options.target,
        targetPack: options.targetPack,
        selectedCapabilities: options.selectedCapabilities,
        selectedSurfaces: options.selectedSurfaces,
        capability,
      })?.declarations ?? [],
    });
  }
  for (const surface of options.selectedSurfaces) {
    appendDeclarations({
      files,
      diagnostics,
      seenPaths,
      projectRoot: options.projectRoot,
      ownerId: surface.id,
      source: `${options.targetPack.id}:${surface.id}`,
      declarations: surface.sourceProfileContributions?.({
        project: options.project,
        target: options.target,
        targetPack: options.targetPack,
        selectedCapabilities: options.selectedCapabilities,
        selectedSurfaces: options.selectedSurfaces,
        surface,
      })?.declarations ?? [],
    });
  }
  return { files, diagnostics };
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
