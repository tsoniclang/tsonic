import type { Diagnostic } from "../types/diagnostic.js";
import { ok, type Result } from "../types/result.js";
import {
  resolveSourcePackageImport,
  resolveSourcePackageImportFromPackageRoot,
} from "../resolver/source-package-resolution.js";
import type { BindingRegistry, SimpleBindingDescriptor } from "./bindings.js";
import type { SurfaceMode } from "./types.js";

const findAuthoritativePackageRootForImport = (
  importSpecifier: string,
  authoritativeTsonicPackageRoots:
    | ReadonlyMap<string, string>
    | undefined
): string | undefined => {
  if (!authoritativeTsonicPackageRoots) {
    return undefined;
  }

  let bestMatch: string | undefined;
  for (const [packageName, packageRoot] of authoritativeTsonicPackageRoots) {
    if (
      importSpecifier === packageName ||
      importSpecifier.startsWith(`${packageName}/`)
    ) {
      if (!bestMatch || packageName.length > bestMatch.length) {
        bestMatch = packageName;
      }
      if (packageName === importSpecifier) {
        return packageRoot;
      }
    }
  }

  return bestMatch
    ? authoritativeTsonicPackageRoots.get(bestMatch)
    : undefined;
};

export const resolveSourceBindingFiles = (
  bindings: BindingRegistry,
  kinds: readonly SimpleBindingDescriptor["kind"][],
  containingFile: string,
  projectRoot: string,
  surface: SurfaceMode,
  authoritativeTsonicPackageRoots?: ReadonlyMap<string, string>
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

    const authoritativePackageRoot = findAuthoritativePackageRootForImport(
      sourceImport,
      authoritativeTsonicPackageRoots
    );
    const resolved =
      authoritativePackageRoot !== undefined
        ? resolveSourcePackageImportFromPackageRoot(
            sourceImport,
            authoritativePackageRoot,
            surface,
            projectRoot
          )
        : resolveSourcePackageImport(
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
