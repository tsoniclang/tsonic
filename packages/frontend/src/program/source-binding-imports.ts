import type { Diagnostic } from "../types/diagnostic.js";
import { ok, type Result } from "../types/result.js";
import { resolveSourcePackageImport } from "../resolver/source-package-resolution.js";
import type { BindingRegistry, SimpleBindingDescriptor } from "./bindings.js";
import type { SurfaceMode } from "./types.js";

export const resolveSourceBindingFiles = (
  bindings: BindingRegistry,
  kinds: readonly SimpleBindingDescriptor["kind"][],
  containingFile: string,
  projectRoot: string,
  surface: SurfaceMode
): Result<readonly string[], Diagnostic> => {
  const kindSet = new Set(kinds);
  const seenImports = new Set<string>();
  const resolvedPaths: string[] = [];

  for (const [, descriptor] of bindings.getAllBindings()) {
    if (!kindSet.has(descriptor.kind)) {
      continue;
    }

    const sourceImport = descriptor.sourceImport;
    if (
      typeof sourceImport !== "string" ||
      sourceImport.length === 0 ||
      seenImports.has(sourceImport)
    ) {
      continue;
    }

    seenImports.add(sourceImport);

    const resolved = resolveSourcePackageImport(
      sourceImport,
      containingFile,
      surface,
      projectRoot
    );
    if (!resolved.ok) {
      return resolved;
    }

    if (resolved.value) {
      resolvedPaths.push(resolved.value.resolvedPath);
    }
  }

  return ok(resolvedPaths);
};
