import { createTargetRegistry } from "@tsonic/target-api";
import type { TargetDiagnostic, TargetCapabilityImplementation, TargetRegistry, TsonicTargetPlugin } from "@tsonic/target-api";

export interface InstalledTsonicPluginRegistry {
  readonly targets: readonly TsonicTargetPlugin[];
  readonly capabilities: readonly TargetCapabilityImplementation[];
  readonly diagnostics: readonly TargetDiagnostic[];
  createTargetRegistry(): TargetRegistry;
}

export function createInstalledTsonicPluginRegistry(
  targets: readonly TsonicTargetPlugin[],
  capabilities: readonly TargetCapabilityImplementation[],
): InstalledTsonicPluginRegistry {
  const diagnostics: TargetDiagnostic[] = [];
  const targetById = new Map<string, TsonicTargetPlugin>();
  for (const target of targets) {
    const previous = targetById.get(target.targetId);
    if (previous !== undefined) {
      diagnostics.push({
        code: "TSONIC_PLUGIN_DUPLICATE_TARGET",
        category: "error",
        source: "tsonic-host",
        message: `Target id '${target.targetId}' is provided by multiple installed Tsonic target plugins: ${previous.id}, ${target.id}.`,
      });
      continue;
    }
    targetById.set(target.targetId, target);
  }
  return {
    targets,
    capabilities,
    diagnostics,
    createTargetRegistry(): TargetRegistry {
      return createTargetRegistry([...targetById.values()].map((target) => target.createTargetPack()));
    },
  };
}
