/**
 * Main C# Emitter - Public API
 * Orchestrates code generation from IR
 *
 * Heavy-lifting helpers live in:
 *   - duplicate-type-suppression.ts
 *   - generated-files.ts
 */

import * as path from "node:path";
import { IrModule, Diagnostic } from "@tsonic/frontend";
import { EmitterOptions, JsonAotRegistry } from "./types.js";
import { emitModule } from "./core/format/module-emitter.js";
import { buildModuleMap } from "./core/semantic/module-map.js";
import { buildTypeMemberIndex } from "./core/semantic/type-member-index.js";
import { buildTypeAliasIndex } from "./core/semantic/type-alias-index.js";
import { validateNamingPolicyCollisions } from "./core/semantic/naming-collisions.js";
import { separateStatements } from "./core/format/module-emitter/separation.js";
import { planDuplicateTypeSuppression } from "./duplicate-type-suppression.js";
import {
  generateArrayInteropFile,
  generateModuleContainerAttributeFile,
  generateJsonAotFile,
  generateJsonRuntimeFile,
} from "./generated-files.js";

/**
 * Result of batch emission
 */
export type EmitResult =
  | { readonly ok: true; readonly files: Map<string, string> }
  | { readonly ok: false; readonly errors: readonly Diagnostic[] };

/**
 * Emit a complete C# file from an IR module
 */
export const emitCSharpFile = (
  module: IrModule,
  options: Partial<EmitterOptions> = {}
): string => {
  return emitModule(module, options);
};

/**
 * Batch emit multiple IR modules.
 * Returns an error if there are file name collisions after normalization.
 */
export const emitCSharpFiles = (
  modules: readonly IrModule[],
  options: Partial<EmitterOptions> = {}
): EmitResult => {
  const referenceModules = options.referenceModules ?? modules;
  const namingErrors = validateNamingPolicyCollisions(modules);
  if (namingErrors.length > 0) {
    return { ok: false, errors: namingErrors };
  }

  // Build module map for cross-file import resolution
  const moduleMapResult = buildModuleMap(referenceModules);

  if (!moduleMapResult.ok) {
    return { ok: false, errors: moduleMapResult.errors };
  }

  const moduleMap = moduleMapResult.value;
  const exportMap = moduleMapResult.exportMap;
  const results = new Map<string, string>();
  const typeMemberIndex = buildTypeMemberIndex(referenceModules);
  const typeAliasIndex = buildTypeAliasIndex(referenceModules);
  const syntheticTypeNamespaces =
    buildSyntheticTypeNamespaceIndex(referenceModules);
  const duplicatePlan = planDuplicateTypeSuppression(modules);
  if (!duplicatePlan.ok) {
    return { ok: false, errors: duplicatePlan.errors };
  }

  const jsonAotRegistry: JsonAotRegistry = {
    rootTypes: new Map(),
    needsJsonAot: false,
    needsRuntimeJsonSupport: false,
  };

  // Detect whether we emitted any module static container classes.
  // If so, we must include the ModuleContainerAttribute definition so those
  // emitted attributes compile in the final assembly.
  const needsModuleContainerAttribute = modules.some((m) => {
    const { staticContainerMembers } = separateStatements(m);
    return staticContainerMembers.length > 0;
  });

  // Find common root directory for all *source* modules.
  // Synthetic compiler-generated modules (e.g., __tsonic/*) should not affect the
  // relative output layout for user sources.
  const commonRoot = findCommonRoot(
    modules.map((m) => m.filePath).filter((p) => !p.startsWith("__tsonic/"))
  );

  for (const module of modules) {
    // Create relative path from common root
    const relativePath = module.filePath.startsWith(commonRoot)
      ? module.filePath.slice(commonRoot.length).replace(/^\//, "")
      : module.filePath;
    const outputPath = relativePath.replace(/\.ts$/, ".cs");

    // Mark this module as entry point if it matches the entry point path
    // Use path normalization for robust comparison across platforms
    const isEntryPoint = !!(
      options.entryPointPath &&
      isPathMatch(module.filePath, options.entryPointPath)
    );
    const moduleOptions = {
      ...options,
      isEntryPoint,
      currentModuleFilePath: module.filePath,
      moduleMap, // Pass module map to each module emission
      exportMap, // Pass export map for re-export resolution
      suppressedTypeDeclarations: duplicatePlan.suppressed,
      canonicalLocalTypeTargets: duplicatePlan.canonicalLocalTypeTargets,
      typeMemberIndex, // Pass type member index for member naming policy
      typeAliasIndex, // Pass type alias index for cross-module alias resolution
      syntheticTypeNamespaces, // Synthetic cross-module type resolution (e.g. __tsonic/* anon types)
      jsonAotRegistry, // Pass JSON AOT registry for type collection
    };
    const code = emitModule(module, moduleOptions);
    results.set(outputPath, code);
  }

  // Generate __tsonic_json.g.cs if any JsonSerializer calls were detected
  if (jsonAotRegistry.needsJsonAot) {
    const rootNamespace = options.rootNamespace ?? "TsonicApp";
    const jsonCode = generateJsonAotFile(jsonAotRegistry, rootNamespace);
    results.set("__tsonic_json.g.cs", jsonCode);
  }

  if (jsonAotRegistry.needsRuntimeJsonSupport) {
    const rootNamespace = options.rootNamespace ?? "TsonicApp";
    const jsonRuntimeCode = generateJsonRuntimeFile(rootNamespace);
    results.set("__tsonic_json_runtime.g.cs", jsonRuntimeCode);
  }

  if (
    [...results.values()].some((code) =>
      code.includes("global::Tsonic.Internal.ArrayInterop.WrapArray")
    )
  ) {
    results.set("__tsonic_array_interop.g.cs", generateArrayInteropFile());
  }

  // Generate __tsonic_module_containers.g.cs if any module emitted a static container.
  // This provides the marker attribute used by tsbindgen to discover module containers
  // and generate flattened named exports for their public static members.
  if (needsModuleContainerAttribute) {
    results.set(
      "__tsonic_module_containers.g.cs",
      generateModuleContainerAttributeFile()
    );
  }

  return { ok: true, files: results };
};

const buildSyntheticTypeNamespaceIndex = (
  modules: readonly IrModule[]
): ReadonlyMap<string, string> => {
  const map = new Map<string, string>();

  for (const m of modules) {
    if (!m.filePath.startsWith("__tsonic/")) continue;

    for (const stmt of m.body) {
      switch (stmt.kind) {
        case "classDeclaration":
        case "interfaceDeclaration":
        case "enumDeclaration":
        case "typeAliasDeclaration": {
          const existing = map.get(stmt.name);
          if (existing && existing !== m.namespace) {
            // This should never happen: synthetic types must have unique names.
            // Keep the first to preserve determinism.
            continue;
          }
          map.set(stmt.name, m.namespace);
          break;
        }
      }
    }
  }

  return map;
};

/**
 * Find the common root directory for a set of file paths
 */
const findCommonRoot = (paths: readonly string[]): string => {
  if (paths.length === 0) return "";
  if (paths.length === 1) {
    const firstPath = paths[0];
    if (!firstPath) return "";
    const lastSlash = firstPath.lastIndexOf("/");
    return lastSlash >= 0 ? firstPath.slice(0, lastSlash + 1) : "";
  }

  // Split all paths into segments
  const segments = paths.map((p) => p.split("/"));
  const firstSegments = segments[0];
  if (!firstSegments) return "";

  const minLength = Math.min(...segments.map((s) => s.length));

  let commonLength = 0;
  for (let i = 0; i < minLength; i++) {
    const segment = firstSegments[i];
    if (segment && segments.every((s) => s[i] === segment)) {
      commonLength = i + 1;
    } else {
      break;
    }
  }

  return firstSegments.slice(0, commonLength).join("/") + "/";
};

/**
 * Check if a module path matches an entry point path.
 * Handles both relative and absolute paths, and normalizes path separators.
 *
 * @param modulePath - Path from the IR module (may be relative or absolute)
 * @param entryPointPath - Entry point path from config (typically absolute)
 */
const isPathMatch = (modulePath: string, entryPointPath: string): boolean => {
  // Normalize both paths to use forward slashes and resolve any . or ..
  const normalizedModule = path.normalize(modulePath).replace(/\\/g, "/");
  const normalizedEntryPoint = path
    .normalize(entryPointPath)
    .replace(/\\/g, "/");

  // Exact match (both absolute or both relative with same base)
  if (normalizedModule === normalizedEntryPoint) {
    return true;
  }

  // Check if entryPointPath ends with modulePath (for relative module paths)
  // This handles the case where modulePath is "index.ts" and entryPointPath is "/path/to/index.ts"
  if (normalizedEntryPoint.endsWith("/" + normalizedModule)) {
    return true;
  }

  // Check if the basename matches (last resort for edge cases)
  // e.g., both "/a/b/index.ts" and "src/index.ts" have basename "index.ts"
  const moduleBase = path.basename(normalizedModule);
  const entryPointBase = path.basename(normalizedEntryPoint);
  if (moduleBase === entryPointBase) {
    // Only match by basename if the directory structure also matches
    // Get the parent directory name to avoid false positives
    const moduleDir = path.dirname(normalizedModule);
    const entryPointDir = path.dirname(normalizedEntryPoint);

    // If module is just a filename (no directory), it's a match
    if (moduleDir === "." || moduleDir === "") {
      return true;
    }

    // Check if the entry point dir ends with the module's directory structure
    if (
      entryPointDir.endsWith(moduleDir) ||
      entryPointDir.endsWith("/" + moduleDir)
    ) {
      return true;
    }
  }

  return false;
};

// Re-export emitModule from barrel
export { emitModule } from "./core/format/module-emitter.js";
