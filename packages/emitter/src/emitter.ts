/**
 * Main C# Emitter - Public API
 * Orchestrates code generation from IR
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
  let needsDynamicOps = false;

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
    if (code.includes("global::Tsonic.Internal.DynamicOps.")) {
      needsDynamicOps = true;
    }
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

  if (needsDynamicOps) {
    results.set("__tsonic_dynamic.g.cs", generateDynamicOpsFile());
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

const generateDynamicOpsFile = (): string => {
  return `// <auto-generated/>
// Runtime helper for deterministic lowering of explicit TypeScript 'any' operations.
// WARNING: Do not modify this file manually
#nullable enable

namespace Tsonic.Internal
{
    internal static class DynamicOps
    {
        public static object? Get(object? target, object? key)
        {
            if (target is null || key is null) return null;

            if (target is global::Tsonic.Runtime.DynamicObject dyn && key is string dynKey)
            {
                return dyn.GetProperty<object?>(dynKey);
            }

            if (target is global::System.Collections.Generic.IDictionary<string, object?> dict && key is string dictKey)
            {
                return dict.TryGetValue(dictKey, out var value) ? value : null;
            }

            if (target is global::System.Collections.IDictionary nonGenericDict)
            {
                return nonGenericDict.Contains(key) ? nonGenericDict[key] : null;
            }

            if (target is global::System.Array array)
            {
                var index = ToInt32(key);
                if (index < 0 || index >= array.Length) return null;
                return array.GetValue(index);
            }

            if (target is global::System.Collections.IList list)
            {
                var index = ToInt32(key);
                if (index < 0 || index >= list.Count) return null;
                return list[index];
            }

            return null;
        }

        public static object? Set(object? target, object? key, object? value)
        {
            if (target is null) throw new global::System.InvalidOperationException("Cannot set property on null/undefined dynamic value.");
            if (key is null) throw new global::System.InvalidOperationException("Dynamic property key cannot be null.");

            if (target is global::Tsonic.Runtime.DynamicObject dyn && key is string dynKey)
            {
                dyn.SetProperty(dynKey, value);
                return value;
            }

            if (target is global::System.Collections.Generic.IDictionary<string, object?> dict && key is string dictKey)
            {
                dict[dictKey] = value;
                return value;
            }

            if (target is global::System.Collections.IDictionary nonGenericDict)
            {
                nonGenericDict[key] = value;
                return value;
            }

            if (target is global::System.Array array)
            {
                var index = ToInt32(key);
                array.SetValue(value, index);
                return value;
            }

            if (target is global::System.Collections.IList list)
            {
                var index = ToInt32(key);
                list[index] = value;
                return value;
            }

            throw new global::System.InvalidOperationException("Dynamic set failed for target/key.");
        }

        public static object? Assign(object? target, object? key, string op, object? value)
        {
            if (op == "=") return Set(target, key, value);
            if (op.Length < 2 || !op.EndsWith("=", global::System.StringComparison.Ordinal))
            {
                throw new global::System.NotSupportedException($"Dynamic assignment operator '{op}' is not supported.");
            }

            var binaryOp = op.Substring(0, op.Length - 1);
            var current = Get(target, key);
            var next = Binary(binaryOp, current, value);
            return Set(target, key, next);
        }

        public static object? Invoke(object? callee, object?[] args, bool optional)
        {
            if (callee is null)
            {
                if (optional) return null;
                throw new global::System.InvalidOperationException("Cannot call null/undefined dynamic value.");
            }

            if (callee is global::System.Delegate del)
            {
                return del.DynamicInvoke(args);
            }

            throw new global::System.InvalidOperationException($"Dynamic value of type '{callee.GetType().FullName}' is not callable.");
        }

        public static object? InvokeMember(object? target, object? key, object?[] args, bool optional)
        {
            if (target is null)
            {
                if (optional) return null;
                throw new global::System.InvalidOperationException("Cannot call member on null/undefined dynamic value.");
            }

            if (key is string name)
            {
                if (target is global::Tsonic.Runtime.DynamicObject dyn)
                {
                    var dynMember = dyn.GetProperty<object?>(name);
                    return Invoke(dynMember, args, optional: false);
                }
            }

            var callee = Get(target, key);
            return Invoke(callee, args, optional: false);
        }

        public static object? Binary(string op, object? left, object? right)
        {
            return op switch
            {
                "+" => Add(left, right),
                "-" => ToNumber(left) - ToNumber(right),
                "*" => ToNumber(left) * ToNumber(right),
                "/" => ToNumber(left) / ToNumber(right),
                "%" => ToNumber(left) % ToNumber(right),
                "===" => StrictEquals(left, right),
                "!==" => !StrictEquals(left, right),
                "==" => LooseEquals(left, right),
                "!=" => !LooseEquals(left, right),
                ">" => ToNumber(left) > ToNumber(right),
                "<" => ToNumber(left) < ToNumber(right),
                ">=" => ToNumber(left) >= ToNumber(right),
                "<=" => ToNumber(left) <= ToNumber(right),
                "&&" => ToBoolean(left) && ToBoolean(right),
                "||" => ToBoolean(left) || ToBoolean(right),
                "&" => ToInt64(left) & ToInt64(right),
                "|" => ToInt64(left) | ToInt64(right),
                "^" => ToInt64(left) ^ ToInt64(right),
                "<<" => ToInt32(left) << ToInt32(right),
                ">>" => ToInt32(left) >> ToInt32(right),
                "instanceof" => right is global::System.Type runtimeType && targetIsInstanceOf(left, runtimeType),
                "in" => HasKey(right, left),
                _ => throw new global::System.NotSupportedException($"Dynamic binary operator '{op}' is not supported.")
            };
        }

        public static object? Unary(string op, object? value)
        {
            return op switch
            {
                "+" => ToNumber(value),
                "-" => -ToNumber(value),
                "!" => !ToBoolean(value),
                "~" => ~ToInt64(value),
                _ => throw new global::System.NotSupportedException($"Dynamic unary operator '{op}' is not supported.")
            };
        }

        private static bool targetIsInstanceOf(object? target, global::System.Type type) =>
            target != null && type.IsInstanceOfType(target);

        private static object? Add(object? left, object? right)
        {
            if (left is string || right is string) return ToJsString(left) + ToJsString(right);
            return ToNumber(left) + ToNumber(right);
        }

        private static bool HasKey(object? target, object? key)
        {
            if (target is null || key is null) return false;

            if (target is global::Tsonic.Runtime.DynamicObject dyn && key is string dynKey)
            {
                return dyn.HasProperty(dynKey);
            }

            if (target is global::System.Collections.Generic.IDictionary<string, object?> dict && key is string dictKey)
            {
                return dict.ContainsKey(dictKey);
            }

            if (target is global::System.Collections.IDictionary nonGenericDict)
            {
                return nonGenericDict.Contains(key);
            }

            return false;
        }

        private static bool StrictEquals(object? left, object? right)
        {
            if (left is null || right is null) return left is null && right is null;

            if (IsNumeric(left) && IsNumeric(right))
            {
                return ToNumber(left).Equals(ToNumber(right));
            }

            if (left.GetType() != right.GetType()) return false;
            return left.Equals(right);
        }

        private static bool LooseEquals(object? left, object? right)
        {
            if (StrictEquals(left, right)) return true;
            if (left is null && right is null) return true;
            if (left is null || right is null) return false;

            if (IsNumeric(left) && right is string) return ToNumber(left).Equals(ToNumber(right));
            if (left is string && IsNumeric(right)) return ToNumber(left).Equals(ToNumber(right));
            if (left is bool || right is bool) return ToNumber(left).Equals(ToNumber(right));

            return false;
        }

        private static bool ToBoolean(object? value)
        {
            if (value is null) return false;
            return value switch
            {
                bool b => b,
                string s => s.Length != 0,
                double d => !double.IsNaN(d) && d != 0.0d,
                float f => !float.IsNaN(f) && f != 0.0f,
                byte b8 => b8 != 0,
                sbyte i8 => i8 != 0,
                short i16 => i16 != 0,
                ushort u16 => u16 != 0,
                int i32 => i32 != 0,
                uint u32 => u32 != 0,
                long i64 => i64 != 0L,
                ulong u64 => u64 != 0UL,
                decimal dec => dec != 0m,
                _ => true,
            };
        }

        private static bool IsNumeric(object value) =>
            value is byte or sbyte or short or ushort or int or uint or long or ulong or float or double or decimal;

        private static double ToNumber(object? value)
        {
            if (value is null) return 0d;
            if (value is bool b) return b ? 1d : 0d;
            if (value is string s)
            {
                return double.TryParse(
                    s,
                    global::System.Globalization.NumberStyles.Float,
                    global::System.Globalization.CultureInfo.InvariantCulture,
                    out var parsed)
                    ? parsed
                    : double.NaN;
            }
            if (value is char c) return c;
            if (IsNumeric(value))
            {
                return global::System.Convert.ToDouble(value, global::System.Globalization.CultureInfo.InvariantCulture);
            }

            return double.NaN;
        }

        private static int ToInt32(object? value) =>
            global::System.Convert.ToInt32(ToNumber(value), global::System.Globalization.CultureInfo.InvariantCulture);

        private static long ToInt64(object? value) =>
            global::System.Convert.ToInt64(ToNumber(value), global::System.Globalization.CultureInfo.InvariantCulture);

        private static string ToJsString(object? value)
        {
            if (value is null) return "";
            if (value is bool b) return b ? "true" : "false";
            if (value is string s) return s;
            return global::System.Convert.ToString(value, global::System.Globalization.CultureInfo.InvariantCulture) ?? "";
        }
    }
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

// Re-export emitModule from barrel
export { emitModule } from "./core/format/module-emitter.js";
