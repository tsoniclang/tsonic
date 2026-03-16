/**
 * Main C# Emitter - Public API
 * Orchestrates code generation from IR
 */

import * as path from "node:path";
import { IrModule, Diagnostic, stableIrTypeKey } from "@tsonic/frontend";
import { EmitterOptions, JsonAotRegistry } from "./types.js";
import { emitModule } from "./core/format/module-emitter.js";
import { buildModuleMap } from "./core/semantic/module-map.js";
import { buildTypeMemberIndex } from "./core/semantic/type-member-index.js";
import { buildTypeAliasIndex } from "./core/semantic/type-alias-index.js";
import { validateNamingPolicyCollisions } from "./core/semantic/naming-collisions.js";
import { separateStatements } from "./core/format/module-emitter/separation.js";
import { printCompilationUnit } from "./core/format/backend-ast/printer.js";
import {
  identifierType as buildIdentifierType,
  qualifiedName,
} from "./core/format/backend-ast/builders.js";
import type { IrStatement } from "@tsonic/frontend";
import type {
  CSharpAttributeAst,
  CSharpCompilationUnitAst,
  CSharpExpressionAst,
  CSharpMemberAst,
  CSharpTriviaAst,
  CSharpTypeAst,
} from "./core/format/backend-ast/types.js";

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

const stableCircularStringify = (value: unknown): string => {
  const seen = new WeakMap<object, number>();
  let nextId = 0;

  const normalize = (current: unknown): unknown => {
    if (current === null) return null;
    if (typeof current !== "object") return current;

    const existing = seen.get(current);
    if (existing !== undefined) {
      return { $ref: existing };
    }

    const id = nextId;
    nextId += 1;
    seen.set(current, id);

    if (Array.isArray(current)) {
      return current.map((entry) => normalize(entry));
    }

    const normalized: Record<string, unknown> = { $id: id };
    for (const key of Object.keys(current).sort()) {
      if (key === "sourceSpan") continue;
      normalized[key] = normalize((current as Record<string, unknown>)[key]);
    }
    return normalized;
  };

  return JSON.stringify(normalize(value));
};

const semanticSignature = (stmt: EmittedTypeDeclaration): string => {
  if (stmt.kind === "interfaceDeclaration") {
    return stableCircularStringify({
      ...stmt,
      members: [...stmt.members].sort((a, b) => a.name.localeCompare(b.name)),
      extends: [...stmt.extends].sort((a, b) =>
        stableIrTypeKey(a).localeCompare(stableIrTypeKey(b))
      ),
    });
  }

  if (stmt.kind === "classDeclaration") {
    // Class member order is semantically significant: field initializers run in
    // declaration order. Only sort `implements` (order-independent) — preserve
    // member order to avoid false equivalence when initializer order differs.
    return stableCircularStringify({
      ...stmt,
      implements: [...stmt.implements].sort((a, b) =>
        stableIrTypeKey(a).localeCompare(stableIrTypeKey(b))
      ),
    });
  }

  // Type aliases: sort objectType members if applicable
  if (stmt.kind === "typeAliasDeclaration" && stmt.type.kind === "objectType") {
    return stableCircularStringify({
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
  return stableCircularStringify(stmt);
};

const canonicalStructuralGroupKey = (
  stmt: CanonicalizableStructuralDeclaration
): string => {
  if (stmt.kind === "interfaceDeclaration") {
    return `iface::${stmt.name}::${stableCircularStringify({
      typeParameters: stmt.typeParameters ?? [],
      extends: [...stmt.extends].sort((a, b) =>
        stableIrTypeKey(a).localeCompare(stableIrTypeKey(b))
      ),
      members: [...stmt.members].sort((a, b) => a.name.localeCompare(b.name)),
    })}`;
  }

  // Type alias with objectType — sort members
  if (stmt.type.kind === "objectType") {
    return `alias::${stmt.name}::${stableCircularStringify({
      typeParameters: stmt.typeParameters ?? [],
      type: {
        ...stmt.type,
        members: [...stmt.type.members].sort((a, b) =>
          a.name.localeCompare(b.name)
        ),
      },
    })}`;
  }

  return `alias::${stmt.name}::${stableCircularStringify({
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
        rootTypes: new Map(),
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

const commentLine = (text: string): CSharpTriviaAst => ({
  kind: "singleLineCommentTrivia",
  text,
});

const blankLineTrivia = (): CSharpTriviaAst => ({
  kind: "blankLineTrivia",
});

const identifierType = (
  name: string,
  typeArguments?: readonly CSharpTypeAst[]
): CSharpTypeAst => buildIdentifierType(name, typeArguments);

const typeRef = (type: CSharpTypeAst): CSharpExpressionAst => ({
  kind: "typeReferenceExpression",
  type,
});

const memberAccess = (
  expression: CSharpExpressionAst,
  memberName: string
): CSharpExpressionAst => ({
  kind: "memberAccessExpression",
  expression,
  memberName,
});

const assignment = (
  left: CSharpExpressionAst,
  right: CSharpExpressionAst
): CSharpExpressionAst => ({
  kind: "assignmentExpression",
  operatorToken: "=",
  left,
  right,
});

const generatedFileLeadingTrivia = (
  ...lines: readonly string[]
): readonly CSharpTriviaAst[] => [...lines.map(commentLine), blankLineTrivia()];

const generateModuleContainerAttributeFile = (): string => {
  const attributeUsageType = identifierType(
    "global::System.AttributeUsageAttribute"
  );
  const attributeTargetsType = identifierType(
    "global::System.AttributeTargets"
  );
  const systemAttributeType = identifierType("global::System.Attribute");

  const markerAttribute: CSharpAttributeAst = {
    type: attributeUsageType,
    arguments: [
      memberAccess(typeRef(attributeTargetsType), "Class"),
      assignment(
        { kind: "identifierExpression", identifier: "Inherited" },
        { kind: "booleanLiteralExpression", value: false }
      ),
      assignment(
        { kind: "identifierExpression", identifier: "AllowMultiple" },
        { kind: "booleanLiteralExpression", value: false }
      ),
    ],
  };

  const unit: CSharpCompilationUnitAst = {
    kind: "compilationUnit",
    leadingTrivia: generatedFileLeadingTrivia(
      "<auto-generated/>",
      "Marker attribute for module container types.",
      "Used by tsbindgen to generate flattened named exports for module-level values.",
      "WARNING: Do not modify this file manually"
    ),
    usings: [],
    members: [
      {
        kind: "namespaceDeclaration",
        name: qualifiedName("Tsonic.Internal"),
        members: [
          {
            kind: "classDeclaration",
            attributes: [markerAttribute],
            modifiers: ["internal", "sealed"],
            name: "ModuleContainerAttribute",
            baseType: systemAttributeType,
            interfaces: [],
            members: [],
          },
        ],
      },
    ],
  };

  return printCompilationUnit(unit);
};

/**
 * Generate the __tsonic_json.g.cs file for NativeAOT JSON support.
 * This file contains the JsonSerializerContext and options holder.
 */
const generateJsonAotFile = (
  registry: JsonAotRegistry,
  rootNamespace: string
): string => {
  const types = [...registry.rootTypes.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, typeAst]) => typeAst);

  const jsonSerializableType = identifierType(
    "global::System.Text.Json.Serialization.JsonSerializableAttribute"
  );
  const jsonSerializerContextType = identifierType(
    "global::System.Text.Json.Serialization.JsonSerializerContext"
  );
  const jsonSerializerOptionsType = identifierType(
    "global::System.Text.Json.JsonSerializerOptions"
  );
  const jsonNamingPolicyType = identifierType(
    "global::System.Text.Json.JsonNamingPolicy"
  );
  const jsonSerializableAttributes: readonly CSharpAttributeAst[] = types.map(
    (typeAst) => ({
      type: jsonSerializableType,
      arguments: [{ kind: "typeofExpression", type: typeAst }],
    })
  );

  const optionsField: CSharpMemberAst = {
    kind: "fieldDeclaration",
    attributes: [],
    modifiers: ["internal", "static", "readonly"],
    type: jsonSerializerOptionsType,
    name: "Options",
    initializer: {
      kind: "objectCreationExpression",
      type: jsonSerializerOptionsType,
      arguments: [],
      initializer: [
        assignment(
          { kind: "identifierExpression", identifier: "TypeInfoResolver" },
          memberAccess(
            typeRef(identifierType("__TsonicJsonContext")),
            "Default"
          )
        ),
        assignment(
          {
            kind: "identifierExpression",
            identifier: "PropertyNameCaseInsensitive",
          },
          { kind: "booleanLiteralExpression", value: true }
        ),
        assignment(
          { kind: "identifierExpression", identifier: "PropertyNamingPolicy" },
          memberAccess(typeRef(jsonNamingPolicyType), "CamelCase")
        ),
        assignment(
          { kind: "identifierExpression", identifier: "DictionaryKeyPolicy" },
          memberAccess(typeRef(jsonNamingPolicyType), "CamelCase")
        ),
      ],
    },
  };

  const unit: CSharpCompilationUnitAst = {
    kind: "compilationUnit",
    leadingTrivia: generatedFileLeadingTrivia(
      "<auto-generated/>",
      "Generated by Tsonic for NativeAOT JSON serialization support",
      "WARNING: Do not modify this file manually"
    ),
    usings: [],
    members: [
      {
        kind: "namespaceDeclaration",
        name: qualifiedName(rootNamespace),
        members: [
          {
            kind: "classDeclaration",
            attributes: jsonSerializableAttributes,
            modifiers: ["internal", "partial"],
            name: "__TsonicJsonContext",
            baseType: jsonSerializerContextType,
            interfaces: [],
            members: [],
          },
          {
            kind: "classDeclaration",
            attributes: [],
            modifiers: ["internal", "static"],
            name: "TsonicJson",
            interfaces: [],
            members: [optionsField],
          },
        ],
      },
    ],
  };

  return printCompilationUnit(unit);
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
