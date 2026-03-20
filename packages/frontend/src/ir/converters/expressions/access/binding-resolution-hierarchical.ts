/**
 * Hierarchical binding resolution for member access expressions.
 *
 * Handles namespace.type, type.member, directType.member, and instance.member
 * patterns using the BindingRegistry.
 *
 * Split from binding-resolution.ts for file-size compliance (< 500 LOC).
 */

import { IrMemberExpression } from "../../../types.js";
import { convertExpression } from "../../../expression-converter.js";
import type { ProgramContext } from "../../../program-context.js";
import type { MemberBinding } from "../../../../program/bindings.js";
import { tsbindgenClrTypeNameToTsTypeName } from "../../../../tsbindgen/names.js";
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
  const isTypeLikeIdentifierName = (name: string | undefined): boolean =>
    typeof name === "string" && /^[A-Z]/.test(name);

  const tryResolveOwnerMemberBinding = (
    ownerAliasOrClrType: string | undefined,
    allowCaseInsensitiveFallback = true
  ): IrMemberExpression["memberBinding"] => {
    if (!ownerAliasOrClrType) return undefined;
    const overloads = registry.getMemberOverloads(
      ownerAliasOrClrType,
      propertyName,
      allowCaseInsensitiveFallback,
      ownerAliasOrClrType
    );
    if (!overloads || overloads.length === 0) return undefined;
    return toIrMemberBinding(overloads);
  };

  const getWrapperBindingCandidates = (): readonly string[] => {
    const inferredType = object.inferredType;
    if (!inferredType) return [];

    const candidates: string[] = [];
    const pushCandidate = (name: string): void => {
      if (!candidates.includes(name)) {
        candidates.push(name);
      }
    };

    if (
      inferredType.kind === "arrayType" ||
      inferredType.kind === "tupleType"
    ) {
      if (ctx.surface === "@tsonic/js") {
        pushCandidate("JSArray");
      }
      pushCandidate("Array");
      return candidates;
    }

    if (inferredType.kind === "primitiveType") {
      if (inferredType.name === "string") {
        pushCandidate("String");
      }
      if (inferredType.name === "number") {
        pushCandidate("Number");
      }
      if (inferredType.name === "boolean") {
        pushCandidate("Boolean");
      }
      return candidates;
    }

    if (inferredType.kind === "literalType") {
      if (typeof inferredType.value === "string") {
        pushCandidate("String");
      }
      if (typeof inferredType.value === "number") {
        pushCandidate("Number");
      }
      if (typeof inferredType.value === "boolean") {
        pushCandidate("Boolean");
      }
    }

    return candidates;
  };

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
      kind: first.kind,
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
      emitSemantics: first.emitSemantics,
    };
  };

  // Case 1: object is identifier → check if it's a namespace, then check if property is a type
  if (object.kind === "identifier") {
    const simpleBinding = ctx.bindings.getExactBinding(object.name);

    if (simpleBinding?.staticType) {
      const staticBinding =
        tryResolveOwnerMemberBinding(simpleBinding.staticType, false) ??
        tryResolveOwnerMemberBinding(
          tsbindgenClrTypeNameToTsTypeName(simpleBinding.staticType),
          false
        );
      if (staticBinding) {
        return staticBinding;
      }
    }

    if (simpleBinding) {
      const instanceBinding =
        tryResolveOwnerMemberBinding(simpleBinding.type, false) ??
        tryResolveOwnerMemberBinding(
          tsbindgenClrTypeNameToTsTypeName(simpleBinding.type),
          false
        );
      if (instanceBinding) {
        return instanceBinding;
      }
    }

    const resolvedClrBinding = tryResolveOwnerMemberBinding(
      object.resolvedClrType
    );
    if (resolvedClrBinding) {
      return resolvedClrBinding;
    }

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
    if (
      isTypeLikeIdentifierName(object.name) ||
      isTypeLikeIdentifierName(object.originalName)
    ) {
      const directType =
        registry.getType(object.name) ??
        (object.originalName
          ? registry.getType(object.originalName)
          : undefined);
      if (directType) {
        const overloads = registry.getMemberOverloads(
          directType.alias,
          propertyName
        );
        if (!overloads || overloads.length === 0) return undefined;
        return toIrMemberBinding(overloads);
      }
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
  // Use the object's inferred type, plus any surface wrapper bindings, to look
  // up the member binding deterministically.
  const objectTypeCandidates = [
    ...getWrapperBindingCandidates(),
    extractTypeName(object.inferredType),
  ].filter((candidate): candidate is string => typeof candidate === "string");

  for (const objectTypeName of objectTypeCandidates) {
    const overloads = registry.getMemberOverloads(objectTypeName, propertyName);
    if (!overloads || overloads.length === 0) continue;
    return toIrMemberBinding(overloads);
  }

  return undefined;
};

export const resolveExpectedClrTypeFromBindings = (
  raw: Record<string, unknown>,
  declaringTypeTsName: string
): string | undefined => {
  const matchesDeclaringTsName = (clrTypeName: string): boolean => {
    const tsName = tsbindgenClrTypeNameToTsTypeName(clrTypeName);
    return (
      tsName === declaringTypeTsName ||
      tsName.toLowerCase() === declaringTypeTsName.toLowerCase()
    );
  };

  // tsbindgen/full manifest shape
  const types = raw.types;
  if (Array.isArray(types)) {
    const matchingClrTypes = new Set<string>();
    for (const t of types) {
      if (!t || typeof t !== "object") continue;
      const clrName = (t as { readonly clrName?: unknown }).clrName;
      if (typeof clrName !== "string") continue;
      if (matchesDeclaringTsName(clrName)) {
        matchingClrTypes.add(clrName);
      }
    }

    if (matchingClrTypes.size === 1) {
      const [only] = matchingClrTypes;
      return only;
    }
    return undefined;
  }

  // simple manifest shape: { bindings: { name: { type: "Namespace.Type" } } }
  const bindings = raw.bindings;
  if (!bindings || typeof bindings !== "object" || Array.isArray(bindings)) {
    return undefined;
  }

  const matchingClrTypes = new Set<string>();
  for (const descriptor of Object.values(bindings)) {
    if (!descriptor || typeof descriptor !== "object") continue;
    const clrType = (descriptor as { readonly type?: unknown }).type;
    if (typeof clrType !== "string") continue;
    if (matchesDeclaringTsName(clrType)) {
      matchingClrTypes.add(clrType);
    }
  }

  if (matchingClrTypes.size === 1) {
    const [only] = matchingClrTypes;
    return only;
  }
  return undefined;
};
