/**
 * Main C# Emitter - Public API
 * Orchestrates code generation from IR
 */

import * as path from "node:path";
import { IrModule, Diagnostic } from "@tsonic/frontend";
import { EmitterOptions, JsonAotRegistry } from "./types.js";
import { emitModule } from "./core/module-emitter.js";
import { buildModuleMap } from "./core/module-map.js";
import { buildTypeMemberIndex } from "./core/type-member-index.js";
import { buildTypeAliasIndex } from "./core/type-alias-index.js";
import { validateNamingPolicyCollisions } from "./core/naming-collisions.js";
import { separateStatements } from "./core/module-emitter/separation.js";
import type { IrStatement } from "@tsonic/frontend";

/**
 * Result of batch emission
 */
export type EmitResult =
  | { readonly ok: true; readonly files: Map<string, string> }
  | { readonly ok: false; readonly errors: readonly Diagnostic[] };

type EmittedTypeDeclaration = Extract<
  IrStatement,
  | { kind: "classDeclaration" }
  | { kind: "interfaceDeclaration" }
  | { kind: "enumDeclaration" }
  | { kind: "typeAliasDeclaration" }
>;

type DuplicatePlanResult =
  | {
      readonly ok: true;
      readonly suppressed: ReadonlySet<string>;
      readonly canonicalLocalTypeTargets: ReadonlyMap<string, string>;
    }
  | { readonly ok: false; readonly errors: readonly Diagnostic[] };

const isRuntimeTypeDeclaration = (
  stmt: IrStatement
): stmt is EmittedTypeDeclaration => {
  if (stmt.kind === "classDeclaration") return true;
  if (stmt.kind === "interfaceDeclaration") return true;
  if (stmt.kind === "enumDeclaration") return true;
  return (
    stmt.kind === "typeAliasDeclaration" && stmt.type.kind === "objectType"
  );
};

const duplicateGroupKey = (namespace: string, name: string): string =>
  `${namespace}::${name}`;

const canonicalLocalTargetKey = (namespace: string, name: string): string =>
  `${namespace}::${name}`;

type CanonicalizableStructuralDeclaration = Extract<
  EmittedTypeDeclaration,
  { kind: "interfaceDeclaration" } | { kind: "typeAliasDeclaration" }
>;

const isCanonicalizableStructuralDeclaration = (
  stmt: EmittedTypeDeclaration
): stmt is CanonicalizableStructuralDeclaration => {
  if (stmt.kind === "interfaceDeclaration") return !stmt.isExported;
  if (stmt.kind === "typeAliasDeclaration") {
    return stmt.type.kind === "objectType" && !stmt.isExported;
  }
  return false;
};

const semanticSignature = (stmt: EmittedTypeDeclaration): string => {
  if (stmt.kind === "interfaceDeclaration") {
    return JSON.stringify({
      ...stmt,
      members: [...stmt.members].sort((a, b) => a.name.localeCompare(b.name)),
      extends: [...stmt.extends].sort((a, b) =>
        JSON.stringify(a).localeCompare(JSON.stringify(b))
      ),
    });
  }

  if (stmt.kind === "classDeclaration") {
    // Class member order is semantically significant: field initializers run in
    // declaration order. Only sort `implements` (order-independent) — preserve
    // member order to avoid false equivalence when initializer order differs.
    return JSON.stringify({
      ...stmt,
      implements: [...stmt.implements].sort((a, b) =>
        JSON.stringify(a).localeCompare(JSON.stringify(b))
      ),
    });
  }

  // Type aliases: sort objectType members if applicable
  if (stmt.kind === "typeAliasDeclaration" && stmt.type.kind === "objectType") {
    return JSON.stringify({
      ...stmt,
      type: {
        ...stmt.type,
        members: [...stmt.type.members].sort((a, b) =>
          a.name.localeCompare(b.name)
        ),
      },
    });
  }

  // Enums: do NOT sort — member order is semantically significant
  // (implicit values depend on order)
  return JSON.stringify(stmt);
};

const canonicalStructuralGroupKey = (
  stmt: CanonicalizableStructuralDeclaration
): string => {
  if (stmt.kind === "interfaceDeclaration") {
    return `iface::${stmt.name}::${JSON.stringify({
      typeParameters: stmt.typeParameters ?? [],
      extends: [...stmt.extends].sort((a, b) =>
        JSON.stringify(a).localeCompare(JSON.stringify(b))
      ),
      members: [...stmt.members].sort((a, b) => a.name.localeCompare(b.name)),
    })}`;
  }

  // Type alias with objectType — sort members
  if (stmt.type.kind === "objectType") {
    return `alias::${stmt.name}::${JSON.stringify({
      typeParameters: stmt.typeParameters ?? [],
      type: {
        ...stmt.type,
        members: [...stmt.type.members].sort((a, b) =>
          a.name.localeCompare(b.name)
        ),
      },
    })}`;
  }

  return `alias::${stmt.name}::${JSON.stringify({
    typeParameters: stmt.typeParameters ?? [],
    type: stmt.type,
  })}`;
};

const emittedDeclarationName = (stmt: EmittedTypeDeclaration): string => {
  if (stmt.kind === "typeAliasDeclaration" && stmt.type.kind === "objectType") {
    return `${stmt.name}__Alias`;
  }
  return stmt.name;
};

const suppressionKey = (
  filePath: string,
  stmt: EmittedTypeDeclaration
): string => `${filePath}::${stmt.kind}::${stmt.name}`;

const planDuplicateTypeSuppression = (
  modules: readonly IrModule[]
): DuplicatePlanResult => {
  const groups = new Map<
    string,
    Array<{
      readonly filePath: string;
      readonly namespace: string;
      readonly stmt: EmittedTypeDeclaration;
      readonly signature: string;
    }>
  >();
  const structuralGroups = new Map<
    string,
    Array<{
      readonly filePath: string;
      readonly namespace: string;
      readonly stmt: CanonicalizableStructuralDeclaration;
    }>
  >();

  for (const module of modules) {
    for (const stmt of module.body) {
      if (!isRuntimeTypeDeclaration(stmt)) continue;

      const key = duplicateGroupKey(module.namespace, stmt.name);
      const entries = groups.get(key) ?? [];
      entries.push({
        filePath: module.filePath,
        namespace: module.namespace,
        stmt,
        signature: semanticSignature(stmt),
      });
      groups.set(key, entries);

      if (isCanonicalizableStructuralDeclaration(stmt)) {
        const structuralKey = canonicalStructuralGroupKey(stmt);
        const structuralEntries = structuralGroups.get(structuralKey) ?? [];
        structuralEntries.push({
          filePath: module.filePath,
          namespace: module.namespace,
          stmt,
        });
        structuralGroups.set(structuralKey, structuralEntries);
      }
    }
  }

  const suppressed = new Set<string>();
  const canonicalLocalTypeTargets = new Map<string, string>();
  const errors: Diagnostic[] = [];

  for (const [key, entries] of groups) {
    if (entries.length <= 1) continue;
    const ordered = [...entries].sort((a, b) =>
      a.filePath.localeCompare(b.filePath)
    );
    const first = ordered[0];
    if (!first) continue;
    const firstSig = first.signature;

    for (let i = 1; i < ordered.length; i += 1) {
      const entry = ordered[i];
      if (!entry) continue;
      if (entry.signature === firstSig) {
        suppressed.add(suppressionKey(entry.filePath, entry.stmt));
        continue;
      }

      errors.push({
        code: "TSN3003",
        severity: "error",
        message:
          `Cross-module type declaration collision for '${key}'. ` +
          `Multiple files declare the same namespace/type name with different shapes: ` +
          `${first.filePath}, ${entry.filePath}.`,
        hint: "Rename one declaration or make the declarations shape-identical so the duplicate can be deduplicated deterministically.",
      });
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  for (const entries of structuralGroups.values()) {
    if (entries.length <= 1) continue;
    const ordered = [...entries].sort((a, b) =>
      a.filePath.localeCompare(b.filePath)
    );
    const canonical = ordered[0];
    if (!canonical) continue;
    const canonicalFqn = `${canonical.namespace}.${emittedDeclarationName(canonical.stmt)}`;

    for (let i = 1; i < ordered.length; i += 1) {
      const entry = ordered[i];
      if (!entry) continue;

      suppressed.add(suppressionKey(entry.filePath, entry.stmt));

      if (entry.namespace === canonical.namespace) {
        continue;
      }

      canonicalLocalTypeTargets.set(
        canonicalLocalTargetKey(entry.namespace, entry.stmt.name),
        canonicalFqn
      );
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, suppressed, canonicalLocalTypeTargets };
};

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
  const namingErrors = validateNamingPolicyCollisions(modules);
  if (namingErrors.length > 0) {
    return { ok: false, errors: namingErrors };
  }

  // Build module map for cross-file import resolution
  const moduleMapResult = buildModuleMap(modules);

  if (!moduleMapResult.ok) {
    return { ok: false, errors: moduleMapResult.errors };
  }

  const moduleMap = moduleMapResult.value;
  const exportMap = moduleMapResult.exportMap;
  const results = new Map<string, string>();
  const typeMemberIndex = buildTypeMemberIndex(modules);
  const typeAliasIndex = buildTypeAliasIndex(modules);
  const syntheticTypeNamespaces = buildSyntheticTypeNamespaceIndex(modules);
  const duplicatePlan = planDuplicateTypeSuppression(modules);
  if (!duplicatePlan.ok) {
    return { ok: false, errors: duplicatePlan.errors };
  }

  // Create JSON AOT registry only when NativeAOT JSON rewrite is enabled.
  const jsonAotRegistry: JsonAotRegistry | undefined = options.enableJsonAot
    ? {
        rootTypes: new Set<string>(),
        needsJsonAot: false,
      }
    : undefined;

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
  if (jsonAotRegistry?.needsJsonAot) {
    const rootNamespace = options.rootNamespace ?? "TsonicApp";
    const jsonCode = generateJsonAotFile(jsonAotRegistry, rootNamespace);
    results.set("__tsonic_json.g.cs", jsonCode);
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

const generateModuleContainerAttributeFile = (): string => {
  return `// <auto-generated/>
// Marker attribute for module container types.
// Used by tsbindgen to generate flattened named exports for module-level values.
// WARNING: Do not modify this file manually

namespace Tsonic.Internal
{
    [global::System.AttributeUsage(global::System.AttributeTargets.Class, Inherited = false, AllowMultiple = false)]
    internal sealed class ModuleContainerAttribute : global::System.Attribute { }
}
`;
};

/**
 * Generate the __tsonic_json.g.cs file for NativeAOT JSON support.
 * This file contains the JsonSerializerContext and options holder.
 */
const generateJsonAotFile = (
  registry: JsonAotRegistry,
  rootNamespace: string
): string => {
  const types = [...registry.rootTypes].sort();

  const attributes = types
    .map(
      (t) =>
        `    [global::System.Text.Json.Serialization.JsonSerializable(typeof(${t}))]`
    )
    .join("\n");

  return `// <auto-generated/>
// Generated by Tsonic for NativeAOT JSON serialization support
// WARNING: Do not modify this file manually

namespace ${rootNamespace}
{
    /// <summary>
    /// JsonSerializerContext for NativeAOT-compatible System.Text.Json serialization.
    /// Contains compile-time type metadata for all types used with JsonSerializer.
    /// </summary>
${attributes}
    internal partial class __TsonicJsonContext : global::System.Text.Json.Serialization.JsonSerializerContext { }

    /// <summary>
    /// Provides JsonSerializerOptions configured with the NativeAOT-compatible context.
    /// </summary>
    internal static class TsonicJson
    {
        internal static readonly global::System.Text.Json.JsonSerializerOptions Options = new global::System.Text.Json.JsonSerializerOptions
        {
            TypeInfoResolver = __TsonicJsonContext.Default,
            PropertyNameCaseInsensitive = true,
            PropertyNamingPolicy = global::System.Text.Json.JsonNamingPolicy.CamelCase,
            DictionaryKeyPolicy = global::System.Text.Json.JsonNamingPolicy.CamelCase
        };
    }
}
`;
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

// Re-export emitModule for backward compatibility
export { emitModule } from "./core/module-emitter.js";
