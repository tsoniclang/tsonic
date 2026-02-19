/**
 * Member access expression converters
 *
 * ALICE'S SPEC: All member type queries go through TypeSystem.typeOfMember().
 * Falls back to Binding-resolved MemberId only when the receiver type cannot
 * be normalized nominally (e.g., tsbindgen `$instance & __views` intersections).
 */

import * as ts from "typescript";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { IrMemberExpression, IrType, ComputedAccessKind } from "../../types.js";
import { getSourceSpan } from "./helpers.js";
import { convertExpression } from "../../expression-converter.js";
import type { ProgramContext } from "../../program-context.js";
import type { MemberId } from "../../type-system/index.js";
import type { MemberBinding } from "../../../program/bindings.js";
import { tsbindgenClrTypeNameToTsTypeName } from "../../../tsbindgen/names.js";
import { createDiagnostic } from "../../../types/diagnostic.js";
import { loadBindingsFromPath } from "../../../program/bindings.js";

/**
 * Fallback for getDeclaredPropertyType when TypeSystem can't resolve the member.
 * Uses TypeSystem.typeOfMemberId() to get member types for:
 * - Built-in types from globals (Array.Length, string.Length, etc.)
 * - CLR-bound types from tsbindgen
 * - Types with inherited members not in TypeRegistry
 *
 * ALICE'S SPEC: Uses TypeSystem as single source of truth.
 */
const getDeclaredPropertyTypeFallback = (
  node: ts.PropertyAccessExpression,
  ctx: ProgramContext
): IrType | undefined => {
  // ALICE'S SPEC: Use TypeSystem.typeOfMemberId() to get member type
  const typeSystem = ctx.typeSystem;

  // Resolve property member through Binding layer
  const memberId = ctx.binding.resolvePropertyAccess(node);
  if (!memberId) return undefined;

  // Use TypeSystem.typeOfMemberId() to get the member's declared type
  const memberType = typeSystem.typeOfMemberId(memberId);

  // If TypeSystem returns unknownType, treat as not found
  if (memberType.kind === "unknownType") {
    return undefined;
  }

  return memberType;
};

/**
 * Get the declared property type from a property access expression.
 *
 * ALICE'S SPEC: Uses TypeSystem.typeOfMember() as primary source.
 * Falls back to Binding for inherited members not in TypeRegistry.
 *
 * @param node - Property access expression node
 * @param receiverIrType - Already-computed IR type of the receiver (object) expression
 * @param ctx - ProgramContext for type system and binding access
 * @returns The deterministically computed property type
 */
const getDeclaredPropertyType = (
  node: ts.PropertyAccessExpression,
  receiverIrType: IrType | undefined,
  ctx: ProgramContext
): IrType | undefined => {
  const DEBUG = process.env.DEBUG_PROPERTY_TYPE === "1";
  const propertyName = node.name.text;

  if (DEBUG) {
    console.log(
      "[getDeclaredPropertyType]",
      propertyName,
      "on receiver:",
      receiverIrType
    );
  }

  // Try TypeSystem.typeOfMember() first
  const typeSystem = ctx.typeSystem;
  if (receiverIrType && receiverIrType.kind !== "unknownType") {
    const memberType = typeSystem.typeOfMember(receiverIrType, {
      kind: "byName",
      name: propertyName,
    });
    if (DEBUG) {
      console.log(
        "[getDeclaredPropertyType]",
        propertyName,
        "TypeSystem returned:",
        memberType
      );
    }
    // If TypeSystem returned a valid type (not unknownType), use it
    if (memberType.kind !== "unknownType") {
      return memberType;
    }
    // Fall through to Binding fallback
  }

  // Fallback: Use Binding for inherited members not in TypeRegistry
  // (e.g., Array.Length from Array$instance)
  const fallbackResult = getDeclaredPropertyTypeFallback(node, ctx);
  if (DEBUG) {
    console.log(
      "[getDeclaredPropertyType]",
      propertyName,
      "fallback returned:",
      fallbackResult
    );
  }
  return fallbackResult;
};

/**
 * Normalize a receiver type for computed access classification.
 *
 * This supports common TS shapes that appear at runtime:
 * - Nullish unions (`T | undefined` / `T | null | undefined`)
 * - tsbindgen-style intersection views (`T$instance & __T$views`, and primitives like
 *   `string & String$instance & __String$views`)
 *
 * The goal is to preserve deterministic proof behavior without heuristics.
 */
const normalizeForComputedAccess = (
  type: IrType | undefined
): IrType | undefined => {
  if (!type) return undefined;

  if (type.kind === "unionType") {
    const nonNullish = type.types.filter(
      (t) =>
        !(
          t.kind === "primitiveType" &&
          (t.name === "null" || t.name === "undefined")
        )
    );
    if (nonNullish.length === 1) {
      const only = nonNullish[0];
      return only ? normalizeForComputedAccess(only) : undefined;
    }
  }

  if (type.kind === "intersectionType") {
    const pick =
      type.types.find((t) => t.kind === "arrayType") ??
      type.types.find((t) => t.kind === "dictionaryType") ??
      type.types.find(
        (t) => t.kind === "primitiveType" && t.name === "string"
      ) ??
      type.types.find((t) => t.kind === "referenceType");

    return pick ? normalizeForComputedAccess(pick) : type;
  }

  return type;
};

/**
 * Classify computed member access for proof pass.
 * This determines whether Int32 proof is required for the index.
 *
 * Classification is based on IR type kinds, NOT string matching.
 * CLR indexers (arrays, List<T>, etc.) require Int32 proof for indices.
 *
 * IMPORTANT: If classification cannot be determined reliably for a CLR-bound
 * reference type, we conservatively assume `clrIndexer` (requires Int32 proof).
 * This is safer than allowing arbitrary dictionary access without proof.
 *
 * @param objectType - The inferred type of the object being accessed
 * @returns The access kind classification
 */
const classifyComputedAccess = (
  objectType: IrType | undefined,
  ctx: ProgramContext
): ComputedAccessKind => {
  const normalized = normalizeForComputedAccess(objectType);
  if (!normalized) return "unknown";
  objectType = normalized;

  // TypeScript array type (number[], T[], etc.)
  // Requires Int32 proof
  if (objectType.kind === "arrayType") {
    return "clrIndexer";
  }

  // IR dictionary type - this is the PRIMARY way to detect dictionaries
  // tsbindgen should emit dictionaryType for Record<K,V> and {[key: K]: V}
  if (objectType.kind === "dictionaryType") {
    return "dictionary";
  }

  // String character access: string[int]
  if (objectType.kind === "primitiveType" && objectType.name === "string") {
    return "stringChar";
  }

  if (objectType.kind === "referenceType") {
    const indexer = ctx.typeSystem.getIndexerInfo(objectType);
    if (!indexer) return "clrIndexer";
    return indexer.keyClrType === "System.Int32" ? "clrIndexer" : "dictionary";
  }

  return "unknown";
};

/**
 * Extract the type name from an inferred type for binding lookup.
 * Handles tsbindgen's naming convention where instance types are suffixed with $instance
 * (e.g., List_1$instance → List_1 for binding lookup)
 *
 * Also handles intersection types like `TypeName$instance & __TypeName$views`
 * which are common in tsbindgen-generated types. In this case, we look for
 * the $instance member and extract the type name from it.
 */
const extractTypeName = (
  inferredType: IrType | undefined
): string | undefined => {
  if (!inferredType) return undefined;

  // Handle common nullish unions like `Uri | undefined` by stripping null/undefined.
  // This enables CLR member binding after explicit null checks in source code.
  if (inferredType.kind === "unionType") {
    const nonNullish = inferredType.types.filter(
      (t) =>
        !(
          t.kind === "primitiveType" &&
          (t.name === "null" || t.name === "undefined")
        )
    );
    if (nonNullish.length === 1) {
      const only = nonNullish[0];
      return only ? extractTypeName(only) : undefined;
    }
  }

  // Handle primitive types - map to their CLR type names for binding lookup
  // This enables binding resolution for methods like string.Split(), number.ToString()
  if (inferredType.kind === "primitiveType") {
    switch (inferredType.name) {
      case "string":
        return "String"; // System.String
      case "number":
        return "Double"; // System.Double (TS number is double)
      case "boolean":
        return "Boolean"; // System.Boolean
      case "char":
        return "Char"; // System.Char
      default:
        return undefined;
    }
  }

  // Handle literal types - determine the CLR type from the value type
  // This enables binding resolution for string literals like "hello".Split(" ")
  if (inferredType.kind === "literalType") {
    const valueType = typeof inferredType.value;
    switch (valueType) {
      case "string":
        return "String"; // System.String
      case "number":
        return "Double"; // System.Double
      case "boolean":
        return "Boolean"; // System.Boolean
      default:
        return undefined;
    }
  }

  if (inferredType.kind === "referenceType") {
    const name = inferredType.name;

    // Strip $instance suffix from tsbindgen-generated type names
    // e.g., "List_1$instance" → "List_1" for binding lookup
    if (name.endsWith("$instance")) {
      return name.slice(0, -"$instance".length);
    }

    return name;
  }

  // Handle intersection types: TypeName$instance & __TypeName$views
  // This happens when TypeScript expands a type alias to its underlying intersection
  // during property access (e.g., listener.prefixes returns HttpListenerPrefixCollection
  // which is HttpListenerPrefixCollection$instance & __HttpListenerPrefixCollection$views)
  if (inferredType.kind === "intersectionType") {
    // Look for a member that ends with $instance - that's the main type
    for (const member of inferredType.types) {
      if (
        member.kind === "referenceType" &&
        member.name.endsWith("$instance")
      ) {
        // Found the $instance member, strip the suffix to get the type name
        return member.name.slice(0, -"$instance".length);
      }
    }

    // Fallback: look for any referenceType that's not a $views type
    for (const member of inferredType.types) {
      if (
        member.kind === "referenceType" &&
        !member.name.startsWith("__") &&
        !member.name.endsWith("$views")
      ) {
        return member.name;
      }
    }
  }

  return undefined;
};

/**
 * Resolve hierarchical binding for a member access
 * Handles namespace.type, type.member, directType.member, and instance.member patterns
 */
const resolveHierarchicalBinding = (
  object: ReturnType<typeof convertExpression>,
  propertyName: string,
  ctx: ProgramContext
): IrMemberExpression["memberBinding"] => {
  const registry = ctx.bindings;

  const toIrMemberBinding = (
    overloads: readonly MemberBinding[]
  ): IrMemberExpression["memberBinding"] => {
    const first = overloads[0];
    if (!first) return undefined;

    const getTargetKey = (m: MemberBinding): string =>
      `${m.binding.assembly}:${m.binding.type}::${m.binding.member}`;
    const targetKey = getTargetKey(first);
    if (overloads.some((m) => getTargetKey(m) !== targetKey)) {
      // Unsafe: overloads map to different CLR targets.
      return undefined;
    }

    const getModifiersKey = (m: MemberBinding): string => {
      const mods = m.parameterModifiers ?? [];
      if (mods.length === 0) return "";
      return [...mods]
        .slice()
        .sort((a, b) => a.index - b.index)
        .map((mod) => `${mod.index}:${mod.modifier}`)
        .join(",");
    };

    const modsKey = getModifiersKey(first);
    const modsConsistent = overloads.every(
      (m) => getModifiersKey(m) === modsKey
    );

    return {
      assembly: first.binding.assembly,
      type: first.binding.type,
      member: first.binding.member,
      // IMPORTANT: Only attach parameterModifiers if consistent across all overloads.
      // Overloads can differ in ref/out/in, and those must be selected at call time.
      parameterModifiers:
        modsConsistent &&
        first.parameterModifiers &&
        first.parameterModifiers.length > 0
          ? first.parameterModifiers
          : undefined,
      isExtensionMethod: first.isExtensionMethod,
    };
  };

  // Case 1: object is identifier → check if it's a namespace, then check if property is a type
  if (object.kind === "identifier") {
    const namespace = registry.getNamespace(object.name);
    if (namespace) {
      // Found namespace binding, check if property is a type within this namespace
      // Note: After schema swap, we look up by alias (TS identifier)
      const type = namespace.types.find((t) => t.alias === propertyName);
      if (type) {
        // This member access is namespace.type - we don't emit a member binding here
        // because we're just accessing a type, not calling a member
        return undefined;
      }
    }

    // Case 1b: object is a direct type import (like `Console` imported directly)
    // Check if the identifier is a type alias, and if so, look up the member
    // First try by local name, then by original name (handles aliased imports like `import { String as ClrString }`)
    const directType =
      registry.getType(object.name) ??
      (object.originalName ? registry.getType(object.originalName) : undefined);
    if (directType) {
      const overloads = registry.getMemberOverloads(
        directType.alias,
        propertyName
      );
      if (!overloads || overloads.length === 0) return undefined;
      return toIrMemberBinding(overloads);
    }
  }

  // Case 2: object is member expression with a type reference → check if property is a member
  if (object.kind === "memberAccess" && !object.isComputed) {
    // Walk up the chain to find if this is a type reference
    // For systemLinq.enumerable, the object is "systemLinq" and property is "enumerable"
    if (object.object.kind === "identifier") {
      const namespace = registry.getNamespace(object.object.name);
      if (namespace && typeof object.property === "string") {
        const type = namespace.types.find((t) => t.alias === object.property);
        if (type) {
          // The object is a type reference (namespace.type), now check if property is a member
          const overloads = registry.getMemberOverloads(
            type.alias,
            propertyName
          );
          if (!overloads || overloads.length === 0) return undefined;
          return toIrMemberBinding(overloads);
        }
      }
    }
  }

  // Case 3: Instance member access (e.g., numbers.add where numbers is List<T>)
  // Use the object's inferred type to look up the member binding
  const objectTypeName = extractTypeName(object.inferredType);

  if (objectTypeName) {
    // Look up member by type alias and property name
    const overloads = registry.getMemberOverloads(objectTypeName, propertyName);
    if (!overloads || overloads.length === 0) return undefined;
    return toIrMemberBinding(overloads);
  }

  return undefined;
};

const findNearestBindingsJson = (filePath: string): string | undefined => {
  let currentDir = dirname(filePath);
  while (true) {
    const candidate = join(currentDir, "bindings.json");
    if (existsSync(candidate)) return candidate;
    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) return undefined;
    currentDir = parentDir;
  }
};

const disambiguateOverloadsByDeclaringType = (
  overloads: readonly MemberBinding[],
  memberId: MemberId,
  declaringTypeTsName: string,
  ctx: ProgramContext
): readonly MemberBinding[] | undefined => {
  const declSourceFilePath = ctx.binding.getSourceFilePathOfMember(memberId);
  if (!declSourceFilePath) return undefined;

  const bindingsPath = findNearestBindingsJson(declSourceFilePath);
  if (!bindingsPath) return undefined;

  const raw = (() => {
    try {
      return JSON.parse(readFileSync(bindingsPath, "utf8")) as unknown;
    } catch {
      return undefined;
    }
  })();

  if (!raw || typeof raw !== "object") return undefined;
  const types = (raw as { readonly types?: unknown }).types;
  if (!Array.isArray(types)) return undefined;

  const typeEntry = types.find((t) => {
    if (!t || typeof t !== "object") return false;
    const clrName = (t as { readonly clrName?: unknown }).clrName;
    if (typeof clrName !== "string") return false;
    return tsbindgenClrTypeNameToTsTypeName(clrName) === declaringTypeTsName;
  }) as { readonly clrName?: unknown } | undefined;

  const expectedClrType =
    typeEntry && typeof typeEntry.clrName === "string"
      ? typeEntry.clrName
      : undefined;
  if (!expectedClrType) return undefined;

  const filtered = overloads.filter((m) => m.binding.type === expectedClrType);
  return filtered.length > 0 ? filtered : undefined;
};

/**
 * Resolve hierarchical binding for a member access using Binding-resolved MemberId.
 *
 * This is a fallback for cases where the receiver's inferredType is unavailable
 * (e.g., local variable typing inferred from a complex initializer), but TS can
 * still resolve the member symbol deterministically.
 *
 * Critical use case: CLR property casing (e.g., `.expression` → `.Expression`).
 */
const resolveHierarchicalBindingFromMemberId = (
  node: ts.PropertyAccessExpression,
  propertyName: string,
  ctx: ProgramContext
): IrMemberExpression["memberBinding"] => {
  const memberId = ctx.binding.resolvePropertyAccess(node);
  if (!memberId) return undefined;

  const declaringTypeName = ctx.binding.getDeclaringTypeNameOfMember(memberId);
  if (!declaringTypeName) return undefined;

  const normalizeDeclaringType = (name: string): string => {
    if (name.endsWith("$instance")) return name.slice(0, -"$instance".length);
    if (name.startsWith("__") && name.endsWith("$views")) {
      return name.slice("__".length, -"$views".length);
    }
    return name;
  };

  const typeAlias = normalizeDeclaringType(declaringTypeName);
  let overloadsAll = ctx.bindings.getMemberOverloads(typeAlias, propertyName);
  if (!overloadsAll || overloadsAll.length === 0) {
    const declSourceFilePath = ctx.binding.getSourceFilePathOfMember(memberId);
    const bindingsPath =
      declSourceFilePath !== undefined
        ? findNearestBindingsJson(declSourceFilePath)
        : undefined;

    // Airplane-grade: If we can locate the bindings.json that corresponds to the
    // tsbindgen declaration, load it on-demand and retry. This avoids relying on
    // "import closure" heuristics and ensures CLR binding lookup is based on the
    // declaration’s actual owning bindings.json.
    if (bindingsPath) {
      loadBindingsFromPath(ctx.bindings, bindingsPath);
      overloadsAll = ctx.bindings.getMemberOverloads(typeAlias, propertyName);
    }

    // Airplane-grade rule: If this member resolves to a tsbindgen declaration,
    // we MUST have a CLR binding; we must never guess member names via naming policy.
    //
    // We treat it as CLR-bound if:
    // - The declaring type is a tsbindgen extension interface (`__Ext_*`), OR
    // - We can locate a bindings.json near the declaration source file.
    const isClrBound =
      declaringTypeName.startsWith("__Ext_") || bindingsPath !== undefined;

    if (isClrBound && (!overloadsAll || overloadsAll.length === 0)) {
      ctx.diagnostics.push(
        createDiagnostic(
          "TSN4004",
          "error",
          `Missing CLR binding for '${typeAlias}.${propertyName}'.`,
          getSourceSpan(node),
          bindingsPath
            ? `No matching member binding was found in the loaded bindings for this tsbindgen declaration. (bindings.json: ${bindingsPath})`
            : "No matching member binding was found for this tsbindgen extension interface member."
        )
      );
    }

    return undefined;
  }

  let overloads: readonly MemberBinding[] = overloadsAll;
  const targetKeys = new Set(
    overloads.map(
      (m) => `${m.binding.assembly}:${m.binding.type}::${m.binding.member}`
    )
  );
  if (targetKeys.size > 1) {
    const disambiguated = disambiguateOverloadsByDeclaringType(
      overloads,
      memberId,
      typeAlias,
      ctx
    );
    if (disambiguated) {
      overloads = disambiguated;
    }
  }

  const first = overloads[0];
  if (!first) return undefined;

  const targetKey = `${first.binding.assembly}:${first.binding.type}::${first.binding.member}`;
  if (
    overloads.some(
      (m) =>
        `${m.binding.assembly}:${m.binding.type}::${m.binding.member}` !==
        targetKey
    )
  ) {
    const declSourceFilePath = ctx.binding.getSourceFilePathOfMember(memberId);
    const bindingsPath =
      declSourceFilePath !== undefined
        ? findNearestBindingsJson(declSourceFilePath)
        : undefined;

    // Only treat this as a CLR ambiguity when we can locate a bindings.json near the
    // TS declaration source (tsbindgen packages). Otherwise, fall back to "no binding"
    // and let local codepaths handle naming policy.
    if (bindingsPath) {
      const targets = [
        ...new Set(
          overloads.map((m) => `${m.binding.type}.${m.binding.member}`)
        ),
      ]
        .sort()
        .join(", ");

      ctx.diagnostics.push(
        createDiagnostic(
          "TSN4003",
          "error",
          `Ambiguous CLR binding for '${typeAlias}.${propertyName}'. Multiple CLR targets found: ${targets}.`,
          getSourceSpan(node),
          `This usually indicates multiple tsbindgen packages export the same TS type/member alias. Ensure the correct package is imported, or regenerate bindings to avoid collisions. (bindings.json: ${bindingsPath})`
        )
      );
    }
    return undefined;
  }

  const getModifiersKey = (m: MemberBinding): string => {
    const mods = m.parameterModifiers ?? [];
    if (mods.length === 0) return "";
    return [...mods]
      .slice()
      .sort((a, b) => a.index - b.index)
      .map((mod) => `${mod.index}:${mod.modifier}`)
      .join(",");
  };

  const modsKey = getModifiersKey(first);
  const modsConsistent = overloads.every((m) => getModifiersKey(m) === modsKey);

  return {
    assembly: first.binding.assembly,
    type: first.binding.type,
    member: first.binding.member,
    parameterModifiers:
      modsConsistent &&
      first.parameterModifiers &&
      first.parameterModifiers.length > 0
        ? first.parameterModifiers
        : undefined,
    isExtensionMethod: first.isExtensionMethod,
  };
};

/**
 * Resolve instance-style extension method bindings from tsbindgen's `ExtensionMethods` typing.
 *
 * tsbindgen emits extension methods as interface members on `__Ext_*` types, and users
 * opt in via `ExtensionMethods<TShape>`. At runtime those members do not exist, so we
 * must attach the underlying CLR binding so the emitter can lower the call to an
 * explicit static invocation.
 */
const resolveExtensionMethodsBinding = (
  node: ts.PropertyAccessExpression,
  propertyName: string,
  receiverType: IrType | undefined,
  ctx: ProgramContext
): IrMemberExpression["memberBinding"] => {
  const DEBUG_EXT = process.env.DEBUG_EXT_RESOLVE === "1";

  const memberId = ctx.binding.resolvePropertyAccess(node);
  if (!memberId) return undefined;

  const declaringTypeName = ctx.binding.getDeclaringTypeNameOfMember(memberId);
  if (!declaringTypeName || !declaringTypeName.startsWith("__Ext_")) {
    return undefined;
  }

  const callArgumentCount = (() => {
    const parent = node.parent;
    if (ts.isCallExpression(parent) && parent.expression === node) {
      return parent.arguments.length;
    }
    return undefined;
  })();

  const resolved =
    ctx.bindings.resolveExtensionMethod(
      declaringTypeName,
      propertyName,
      callArgumentCount
    ) ??
    (() => {
      if (!receiverType) return undefined;

      const info = ctx.bindings.getExtensionInterfaceInfo(declaringTypeName);
      if (!info) return undefined;

      if (DEBUG_EXT) {
        // eslint-disable-next-line no-console
        console.log("[ext-resolve] fallback", {
          declaringTypeName,
          propertyName,
          callArgumentCount,
          receiverType,
          namespaceKey: info.namespaceKey,
          receiverTypeName: info.receiverTypeName,
        });
      }

      // tsbindgen can place extension methods declared on *base* receiver types into
      // the effective `__Ext_*` surface for a *derived* receiver type (e.g.
      // IQueryable<T> includes Enumerable.ToArray/ToList). Our binding index is
      // keyed by the CLR-declared receiver type, so we must select the best
      // applicable receiver bucket based on assignability.
      //
      // Airplane-grade: when multiple receiver buckets are applicable, prefer the
      // most specific receiver type (closest to the actual receiver). If there is
      // no unique best candidate, treat as unresolved.
      const candidateBuckets: {
        readonly receiverTypeName: string;
        readonly receiverIrType: IrType;
        readonly binding: MemberBinding;
      }[] = [];

      const getArity = (typeName: string): number => {
        const m = typeName.match(/_(\\d+)$/);
        return m ? Number(m[1]) : 0;
      };

      const makeReceiverIrType = (
        receiverTypeName: string,
        actual: IrType
      ): IrType | undefined => {
        const arity = getArity(receiverTypeName);

        const actualArgs =
          actual.kind === "referenceType" ? (actual.typeArguments ?? []) : [];

        if (arity === 0) {
          return { kind: "referenceType", name: receiverTypeName };
        }

        if (actualArgs.length !== arity) {
          return undefined;
        }

        return {
          kind: "referenceType",
          name: receiverTypeName,
          typeArguments: actualArgs,
        };
      };

      const uniqueReceiverTypeNames = new Set<string>();
      const receiverTypeNames = ctx.bindings.getExtensionReceiverTypeNames(
        info.namespaceKey
      );

      // Evaluate buckets deterministically in lexicographic order so the behavior
      // is stable even if the underlying Map insertion order changes.
      receiverTypeNames
        .slice()
        .sort((a, b) => a.localeCompare(b))
        .forEach((receiverTypeName) => {
          if (uniqueReceiverTypeNames.has(receiverTypeName)) return;
          uniqueReceiverTypeNames.add(receiverTypeName);

          const fakeExtInterfaceName = `__Ext_${info.namespaceKey}_${receiverTypeName}`;
          const binding = ctx.bindings.resolveExtensionMethod(
            fakeExtInterfaceName,
            propertyName,
            callArgumentCount
          );
          if (!binding) return;

          const receiverIrType = makeReceiverIrType(
            receiverTypeName,
            receiverType
          );
          if (!receiverIrType) return;

          const assignable = ctx.typeSystem.isAssignableTo(
            receiverType,
            receiverIrType
          );
          if (DEBUG_EXT) {
            // eslint-disable-next-line no-console
            console.log("[ext-resolve] candidate", {
              receiverTypeName,
              receiverIrType,
              assignable,
              target: `${binding.binding.type}::${binding.binding.member}`,
            });
          }
          if (!assignable) return;

          candidateBuckets.push({ receiverTypeName, receiverIrType, binding });
        });

      if (candidateBuckets.length === 0) return undefined;
      if (candidateBuckets.length === 1) return candidateBuckets[0]?.binding;

      // Choose the most specific receiver bucket: a bucket whose receiver type is
      // assignable to all other candidate receiver types.
      const isMostSpecific = (i: number): boolean => {
        const t = candidateBuckets[i]?.receiverIrType;
        if (!t) return false;
        return candidateBuckets.every((other, j) => {
          if (i === j) return true;
          return ctx.typeSystem.isAssignableTo(t, other.receiverIrType);
        });
      };

      const mostSpecific = candidateBuckets
        .map((c, i) => ({ c, i }))
        .filter(({ i }) => isMostSpecific(i))
        .map(({ c }) => c);

      if (mostSpecific.length !== 1) return undefined;
      return mostSpecific[0]?.binding;
    })();
  if (!resolved) return undefined;

  // tsbindgen parameterModifiers indices include the extension receiver at index 0.
  // For instance-style calls, our call-site arguments exclude the receiver, so shift by -1.
  const shiftedModifiers = resolved.parameterModifiers
    ? resolved.parameterModifiers
        .map((m) => ({ index: m.index - 1, modifier: m.modifier }))
        .filter((m) => m.index >= 0)
    : undefined;

  return {
    assembly: resolved.binding.assembly,
    type: resolved.binding.type,
    member: resolved.binding.member,
    parameterModifiers:
      shiftedModifiers && shiftedModifiers.length > 0
        ? shiftedModifiers
        : undefined,
    isExtensionMethod: resolved.isExtensionMethod,
  };
};

/**
 * Derive element type from object type for element access.
 * - Array type → element type
 * - Dictionary type → value type
 * - String → string (single character)
 * - Other → undefined
 */
const deriveElementType = (
  objectType: IrType | undefined,
  ctx: ProgramContext
): IrType | undefined => {
  objectType = normalizeForComputedAccess(objectType);
  if (!objectType) return undefined;

  if (objectType.kind === "arrayType") {
    return objectType.elementType;
  }

  if (objectType.kind === "dictionaryType") {
    return objectType.valueType;
  }

  if (objectType.kind === "primitiveType" && objectType.name === "string") {
    // string[n] returns a single character (string in TS, char in C#)
    return { kind: "primitiveType", name: "string" };
  }

  if (
    objectType.kind === "referenceType" &&
    objectType.name === "Span" &&
    objectType.typeArguments &&
    objectType.typeArguments.length === 1
  ) {
    return objectType.typeArguments[0];
  }

  if (objectType.kind === "referenceType") {
    return ctx.typeSystem.getIndexerInfo(objectType)?.valueType;
  }

  return undefined;
};

/**
 * Convert property access or element access expression
 */
export const convertMemberExpression = (
  node: ts.PropertyAccessExpression | ts.ElementAccessExpression,
  ctx: ProgramContext
): IrMemberExpression => {
  const isOptional = node.questionDotToken !== undefined;
  const sourceSpan = getSourceSpan(node);

  if (ts.isPropertyAccessExpression(node)) {
    const object = convertExpression(node.expression, ctx, undefined);
    const propertyName = node.name.text;

    // Try to resolve hierarchical binding
    const memberBinding =
      resolveExtensionMethodsBinding(
        node,
        propertyName,
        object.inferredType,
        ctx
      ) ??
      resolveHierarchicalBindingFromMemberId(node, propertyName, ctx) ??
      resolveHierarchicalBinding(object, propertyName, ctx);

    // DETERMINISTIC TYPING: Property type comes from NominalEnv + TypeRegistry for
    // user-defined types (including inherited members), with fallback to Binding layer
    // for built-ins and CLR types.
    //
    // The receiver's inferredType enables NominalEnv to walk inheritance chains
    // and substitute type parameters correctly for inherited generic members.
    //
    // Built-ins like string.length work because globals declare them with proper types.
    // If getDeclaredPropertyType returns undefined, it means the property declaration
    // is missing - use unknownType as poison so validation can emit TSN5203.
    //
    // EXCEPTION: If memberBinding exists AND declaredType is undefined, return undefined.
    // This handles pure CLR-bound methods like Console.WriteLine that have no TS declaration.
    const declaredType = getDeclaredPropertyType(
      node,
      object.inferredType,
      ctx
    );

    // Hierarchical bindings: namespace.type is a static type reference, not a runtime
    // value. When this pattern is present in the binding manifest, avoid poisoning the
    // receiver with unknownType; the emitter uses "no inferredType" to classify the
    // receiver as a static type, enabling global::Type.Member emission.
    const isNamespaceTypeReference =
      object.kind === "identifier" &&
      ctx.bindings
        .getNamespace(object.name)
        ?.types.some((t) => t.alias === propertyName) === true;

    // DETERMINISTIC TYPING: Set inferredType for validation passes (like numeric proof).
    // The emitter uses memberBinding separately for C# casing (e.g., length -> Length).
    //
    // Priority order for inferredType:
    // 1. If declaredType exists, use it (covers built-ins like string.length -> int)
    // 2. If memberBinding exists but no declaredType, use undefined (pure CLR-bound)
    // 3. Otherwise, poison with unknownType for validation (TSN5203)
    //
    // Note: Both memberBinding AND inferredType can be set - they serve different purposes:
    // - memberBinding: used by emitter for C# member names
    // - inferredType: used by validation passes for type checking
    //
    // Class fields without explicit type annotations will emit TSN5203.
    // Users must add explicit types like `count: int = 0` instead of `count = 0`.
    const propertyInferredType = declaredType
      ? declaredType
      : isNamespaceTypeReference
        ? undefined
        : memberBinding
          ? undefined
          : { kind: "unknownType" as const };

    return {
      kind: "memberAccess",
      object,
      property: propertyName,
      isComputed: false,
      isOptional,
      inferredType: propertyInferredType,
      sourceSpan,
      memberBinding,
    };
  } else {
    // Element access (computed): obj[expr]
    const object = convertExpression(node.expression, ctx, undefined);

    // DETERMINISTIC TYPING: Use object's inferredType (not getInferredType)
    const objectType = object.inferredType;

    // Classify the access kind for proof pass
    // This determines whether Int32 proof is required for the index
    const accessKind = classifyComputedAccess(objectType, ctx);

    // Derive element type from object type
    const elementType = deriveElementType(objectType, ctx);

    return {
      kind: "memberAccess",
      object,
      property: convertExpression(node.argumentExpression, ctx, undefined),
      isComputed: true,
      isOptional,
      inferredType: elementType,
      sourceSpan,
      accessKind,
    };
  }
};
