/**
 * Hierarchical binding resolution for member access expressions.
 *
 * Handles namespace.type, type.member, directType.member, and instance.member
 * patterns using the BindingRegistry.
 *
 * Split from binding-resolution.ts for file-size compliance (< 500 LOC).
 */

import {
  getTstsContainingSourceFile,
  getTstsIdentifierText,
  hasTstsAmbientModifier,
  isTstsExternalModuleSourceFile,
  TstsSyntax,
  type TstsNode,
} from "@tsonic/tsts";
import { IrMemberExpression } from "../../../types.js";
import { convertExpression } from "../../../expression-converter.js";
import type { ProgramContext } from "../../../program-context.js";
import type { MemberBinding } from "../../../../program/bindings.js";
import { tsbindgenTargetTypeNameToTsTypeName } from "../../../../tsbindgen/names.js";
import { extractTypeName } from "./member-resolution.js";
import { extractRawExternalBindingsPayload } from "../../../../program/external-binding-payload.js";

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
  const isImportLikeDeclaration = (decl: TstsNode): boolean =>
    decl.Kind === TstsSyntax.KindImportClause ||
    decl.Kind === TstsSyntax.KindImportSpecifier ||
    decl.Kind === TstsSyntax.KindNamespaceImport ||
    decl.Kind === TstsSyntax.KindImportEqualsDeclaration;

  const isAmbientGlobalDeclaration = (decl: TstsNode): boolean => {
    const sourceFile = getTstsContainingSourceFile(decl);
    const isDeclarationModuleGlobal = (() => {
      for (
        let current: TstsNode | undefined = decl.Parent;
        current;
        current = current.Parent
      ) {
        if (
          current.Kind === TstsSyntax.KindModuleDeclaration &&
          getTstsIdentifierText(TstsSyntax.Node_Name(current)) === "global"
        ) {
          return true;
        }
      }

      return false;
    })();

    if (isDeclarationModuleGlobal) {
      return true;
    }

    return (
      (sourceFile?.IsDeclarationFile === true &&
        !isTstsExternalModuleSourceFile(sourceFile)) ||
      hasTstsAmbientModifier(decl)
    );
  };

  const isTypeLikeIdentifierName = (name: string | undefined): boolean =>
    typeof name === "string" && /^[A-Z]/.test(name);

  const shouldUseSimpleIdentifierBinding = (): boolean => {
    if (object.kind !== "identifier") return false;
    if (!object.declId) return true;

    const declarationNodes = ctx.binding.getDeclarationNodesOfDecl(
      object.declId
    );

    if (declarationNodes.length === 0) {
      return true;
    }

    if (declarationNodes.some(isImportLikeDeclaration)) {
      return false;
    }

    return declarationNodes.every(isAmbientGlobalDeclaration);
  };

  const tryResolveOwnerMemberBinding = (
    ownerAliasOrTargetType: string | undefined,
    preferredTargetOwner?: string
  ): IrMemberExpression["memberBinding"] => {
    if (!ownerAliasOrTargetType) return undefined;
    const overloads = registry.getMemberOverloads(
      ownerAliasOrTargetType,
      propertyName,
      preferredTargetOwner ?? ownerAliasOrTargetType
    );
    if (!overloads || overloads.length === 0) return undefined;
    return toIrMemberBinding(overloads);
  };

  const getAliasesForExactTargetType = (
    targetType: string,
    preference: "instance" | "static"
  ): readonly string[] => {
    const aliases = [...ctx.bindings.getTypesMap().values()]
      .filter((type) => type.name === targetType)
      .map((type) => type.alias)
      .sort((left, right) => {
        const leftStatic = left.endsWith("$static");
        const rightStatic = right.endsWith("$static");
        if (leftStatic !== rightStatic) {
          return preference === "static"
            ? leftStatic
              ? -1
              : 1
            : leftStatic
              ? 1
              : -1;
        }
        return left.localeCompare(right);
      });

    return [...new Set(aliases)];
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
      pushCandidate("Array");
      return candidates;
    }

    if (inferredType.kind === "referenceType") {
      const simpleName =
        inferredType.name.split(".").pop() ?? inferredType.name;
      if (
        simpleName === "Array" ||
        simpleName === "ReadonlyArray" ||
        simpleName === "ArrayLike"
      ) {
        pushCandidate("Array");
        return candidates;
      }
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

  const getPreferredInstanceOwnerTargetType = (
    ownerAlias: string
  ): string | undefined => {
    const type = registry.getType(ownerAlias);
    if (type) {
      return type.name;
    }

    const descriptor = registry.getExactBinding(ownerAlias);
    if (!descriptor) return undefined;
    return descriptor.type;
  };

  const toIrMemberBinding = (
    overloads: readonly MemberBinding[]
  ): IrMemberExpression["memberBinding"] => {
    const first = overloads[0];
    if (!first) return undefined;

    const getTargetKey = (m: MemberBinding): string =>
      `${m.binding.ownerIdentity}:${m.binding.type}::${m.binding.member}`;
    const targetKey = getTargetKey(first);
    if (overloads.some((m) => getTargetKey(m) !== targetKey)) {
      // Unsafe: overloads map to different target members.
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
      ownerIdentity: first.binding.ownerIdentity,
      type: first.binding.type,
      member: first.binding.member,
      receiverExpectedType: first.receiverExpectedType,
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
    if (shouldUseSimpleIdentifierBinding()) {
      const simpleBinding = ctx.bindings.getExactBindingByKind(
        object.name,
        "global"
      );

      if (simpleBinding?.staticType) {
        const staticCandidates = [
          ...getAliasesForExactTargetType(simpleBinding.staticType, "static"),
          simpleBinding.staticType,
          tsbindgenTargetTypeNameToTsTypeName(simpleBinding.staticType),
        ].filter(
          (candidate): candidate is string => typeof candidate === "string"
        );

        for (const candidate of staticCandidates) {
          const staticBinding = tryResolveOwnerMemberBinding(
            candidate,
            simpleBinding.staticType
          );
          if (staticBinding) {
            return staticBinding;
          }
        }
      }

      if (simpleBinding) {
        const instanceCandidates = [
          ...getAliasesForExactTargetType(simpleBinding.type, "instance"),
          simpleBinding.type,
          tsbindgenTargetTypeNameToTsTypeName(simpleBinding.type),
        ].filter(
          (candidate): candidate is string => typeof candidate === "string"
        );

        for (const candidate of instanceCandidates) {
          const instanceBinding = tryResolveOwnerMemberBinding(
            candidate,
            simpleBinding.type
          );
          if (instanceBinding) {
            return instanceBinding;
          }
        }
      }

      if (simpleBinding) {
        const sourceOwnedAliases = [
          simpleBinding.type
            ? tsbindgenTargetTypeNameToTsTypeName(simpleBinding.type)
            : undefined,
          simpleBinding.staticType
            ? tsbindgenTargetTypeNameToTsTypeName(simpleBinding.staticType)
            : undefined,
        ].filter(
          (candidate): candidate is string => typeof candidate === "string"
        );

        if (
          sourceOwnedAliases.some((alias) =>
            ctx.bindings.hasSourceOwnedTypeAlias(alias)
          )
        ) {
          return undefined;
        }
      }
    }

    const resolvedTargetBinding = tryResolveOwnerMemberBinding(
      object.providerQualifiedName
    );
    if (resolvedTargetBinding) {
      return resolvedTargetBinding;
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
    // First try by local name, then by original name (handles aliased imports).
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
    const overloads = registry.getMemberOverloads(
      objectTypeName,
      propertyName,
      getPreferredInstanceOwnerTargetType(objectTypeName)
    );
    if (!overloads || overloads.length === 0) continue;
    return toIrMemberBinding(overloads);
  }

  return undefined;
};

export const resolveExpectedTargetTypeFromBindings = (
  raw: Record<string, unknown>,
  declaringTypeTsName: string
): string | undefined => {
  const matchesDeclaringTsName = (targetTypeName: string): boolean => {
    const tsName = tsbindgenTargetTypeNameToTsTypeName(targetTypeName);
    return tsName === declaringTypeTsName;
  };

  const externalPayload = extractRawExternalBindingsPayload(raw);
  if (externalPayload) {
    const matchingTargetTypes = new Set<string>();
    for (const t of externalPayload.types) {
      const targetName = t.targetName;
      if (typeof targetName !== "string") continue;
      if (matchesDeclaringTsName(targetName)) {
        matchingTargetTypes.add(targetName);
      }
    }

    if (matchingTargetTypes.size === 1) {
      const [only] = matchingTargetTypes;
      return only;
    }
    return undefined;
  }

  const sourceSurface =
    raw.sourceSurface &&
    typeof raw.sourceSurface === "object" &&
    !Array.isArray(raw.sourceSurface)
      ? (raw.sourceSurface as { readonly bindings?: unknown })
      : undefined;
  const bindings = sourceSurface?.bindings;
  if (!bindings || typeof bindings !== "object" || Array.isArray(bindings)) {
    return undefined;
  }

  const matchingTargetTypes = new Set<string>();
  for (const descriptor of Object.values(bindings)) {
    if (!descriptor || typeof descriptor !== "object") continue;
    const targetType = (descriptor as { readonly type?: unknown }).type;
    if (typeof targetType !== "string") continue;
    if (matchesDeclaringTsName(targetType)) {
      matchingTargetTypes.add(targetType);
    }
  }

  if (matchingTargetTypes.size === 1) {
    const [only] = matchingTargetTypes;
    return only;
  }
  return undefined;
};
