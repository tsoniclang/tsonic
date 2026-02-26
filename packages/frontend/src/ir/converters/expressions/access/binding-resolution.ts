/**
 * Binding resolution for member access expressions
 *
 * Hierarchical binding lookup, extension method resolution, and
 * MemberId-based fallback binding for CLR property casing.
 */

import * as ts from "typescript";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { IrMemberExpression } from "../../../types.js";
import { getSourceSpan } from "../helpers.js";
import { convertExpression } from "../../../expression-converter.js";
import type { ProgramContext } from "../../../program-context.js";
import type { MemberId } from "../../../type-system/index.js";
import type { MemberBinding } from "../../../../program/bindings.js";
import { tsbindgenClrTypeNameToTsTypeName } from "../../../../tsbindgen/names.js";
import { createDiagnostic } from "../../../../types/diagnostic.js";
import { loadBindingsFromPath } from "../../../../program/bindings.js";
import { extractTypeName } from "./member-resolution.js";

/**
 * Resolve hierarchical binding for a member access
 * Handles namespace.type, type.member, directType.member, and instance.member patterns
 */
export const resolveHierarchicalBinding = (
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
export const resolveHierarchicalBindingFromMemberId = (
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
    // declaration's actual owning bindings.json.
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
export const resolveExtensionMethodsBinding = (
  node: ts.PropertyAccessExpression,
  propertyName: string,
  ctx: ProgramContext
): IrMemberExpression["memberBinding"] => {
  const memberId = ctx.binding.resolvePropertyAccess(node);
  if (!memberId) return undefined;

  const declaringTypeName = ctx.binding.getDeclaringTypeNameOfMember(memberId);
  if (!declaringTypeName) return undefined;

  const callArgumentCount = (() => {
    const parent = node.parent;
    if (ts.isCallExpression(parent) && parent.expression === node) {
      return parent.arguments.length;
    }
    return undefined;
  })();

  // Debug/diagnostic context for airplane-grade failures.
  // These are populated during resolution and surfaced only if resolution fails.
  let sigDeclaringTypeNameForError: string | undefined;
  let namespaceKeyForError: string | undefined;
  let receiverTypeNameForError: string | undefined;

  const resolved = (() => {
    const parent = node.parent;
    if (!ts.isCallExpression(parent) || parent.expression !== node)
      return undefined;

    const sigId = ctx.binding.resolveCallSignature(parent);
    if (!sigId) return undefined;

    // IMPORTANT (airplane-grade): the same TS member name can exist in multiple extension
    // namespaces (e.g., BCL async LINQ and EF Core both define ToArrayAsync). When the
    // receiver expression is not an identifier, `resolvePropertyAccess` can key the member
    // entry off the member symbol itself, which merges declarations. Always anchor to the
    // resolved signature's declaring type to choose the correct CLR extension binding.
    const sigDeclaringTypeName =
      ctx.binding.getDeclaringTypeNameOfSignature(sigId);
    sigDeclaringTypeNameForError = sigDeclaringTypeName;
    if (!sigDeclaringTypeName) return undefined;

    // Extension method bucket format: methods emitted on `__Ext_*` interfaces.
    if (sigDeclaringTypeName.startsWith("__Ext_")) {
      return ctx.bindings.resolveExtensionMethod(
        sigDeclaringTypeName,
        propertyName,
        callArgumentCount
      );
    }

    // New format: extension methods emitted on method-table interfaces:
    //   interface __TsonicExtMethods_System_Linq { Where(this: IQueryable_1<T>, ...): ... }
    if (sigDeclaringTypeName.startsWith("__TsonicExtMethods_")) {
      const namespaceKey = sigDeclaringTypeName.slice(
        "__TsonicExtMethods_".length
      );
      namespaceKeyForError = namespaceKey;
      if (!namespaceKey) return undefined;

      const thisTypeNode = ctx.binding.getThisTypeNodeOfSignature(sigId);
      if (!thisTypeNode) return undefined;

      const extractReceiverTypeName = (
        typeNode: ts.TypeNode
      ): string | undefined => {
        let current = typeNode;
        while (ts.isParenthesizedTypeNode(current)) current = current.type;

        if (ts.isTypeReferenceNode(current)) {
          const tn = current.typeName;
          if (ts.isIdentifier(tn)) return tn.text;
          if (ts.isQualifiedName(tn)) return tn.right.text;
        }

        return undefined;
      };

      const receiverTypeName = extractReceiverTypeName(thisTypeNode);
      receiverTypeNameForError = receiverTypeName;
      if (!receiverTypeName) return undefined;

      return ctx.bindings.resolveExtensionMethodByKey(
        namespaceKey,
        receiverTypeName,
        propertyName,
        callArgumentCount
      );
    }

    return undefined;
  })();

  if (!resolved) {
    // Airplane-grade: if the TS surface indicates this member comes from an extension-method
    // module, failing to attach a CLR binding would emit an instance call that cannot exist
    // at runtime. Treat as a hard error rather than miscompiling.
    if (
      declaringTypeName.startsWith("__Ext_") ||
      declaringTypeName.startsWith("__TsonicExtMethods_")
    ) {
      const detail = [
        sigDeclaringTypeNameForError
          ? `Resolved signature declares: '${sigDeclaringTypeNameForError}'.`
          : "Resolved signature declaring type: <unknown>.",
        namespaceKeyForError
          ? `Namespace key: '${namespaceKeyForError}'.`
          : "Namespace key: <unknown>.",
        receiverTypeNameForError
          ? `Receiver type: '${receiverTypeNameForError}'.`
          : "Receiver type: <unknown>.",
      ].join(" ");

      ctx.diagnostics.push(
        createDiagnostic(
          "TSN4004",
          "error",
          `Failed to resolve CLR extension-method binding for '${propertyName}' on '${declaringTypeName}'. ${detail}`,
          getSourceSpan(node),
          "This indicates a mismatch between the generated .d.ts surface and bindings.json extension metadata. Regenerate bindings and ensure the correct packages are installed."
        )
      );
    }
    return undefined;
  }

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
