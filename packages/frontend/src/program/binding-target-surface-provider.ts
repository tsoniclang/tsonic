import type {
  TargetExportSymbol,
  TargetImportResolution,
  TargetSurfaceArtifacts,
  TargetSurfaceProvider,
} from "../symbols/index.js";
import type { BindingRegistry } from "./binding-registry.js";
import { createTargetSurfaceArtifactsFromBindings } from "./target-surface-artifacts.js";
import type { BackendTargetId } from "../ir/types.js";
import { moduleSymbolIdFromStableId } from "../symbols/index.js";

export type BindingTargetSurfaceProviderOptions = {
  readonly targetId: BackendTargetId;
  readonly bindings: BindingRegistry;
};

export const createBindingTargetSurfaceProvider = (
  options: BindingTargetSurfaceProviderOptions
): TargetSurfaceProvider => ({
  targetId: options.targetId,
  resolveImport: (specifier: string): TargetImportResolution => {
    const moduleBinding = options.bindings.getBindingByKind(specifier, "module");
    if (!moduleBinding || moduleBinding.kind !== "module") {
      return { kind: "notTargetSurface" };
    }

    const moduleSymbolId = moduleSymbolIdFromStableId(
      `${moduleBinding.assembly}:${moduleBinding.type}`
    );
    return {
      kind: "targetSurface",
      moduleSymbolId,
      exports: new Map<string, TargetExportSymbol>(),
    };
  },
  getArtifacts: (): TargetSurfaceArtifacts =>
    createTargetSurfaceArtifactsFromBindings(options.bindings),
});
