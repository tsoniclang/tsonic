/**
 * Property lookup resolution through type hierarchies, binding registries, and type-member indices.
 *
 * Core property type resolution:
 * - getPropertyType: Public entry point for property type lookup
 * - resolveLocalTypeInfo: Resolve reference type to local type info
 * - resolveLocalTypeInfoWithoutBindings: Direct local type resolution
 * - resolveBindingBackedReferenceType: Resolve via bindings registry
 * - resolvePropertyType: Internal recursive property resolution
 * - findPropertyInMembers / findPropertyInClassMembers: Member lookup
 * - withOptionalUndefined: Optional property type wrapping
 */

import type {
  IrType,
  IrInterfaceMember,
  IrClassMember,
  IrPropertySignature,
  TypeBinding as FrontendTypeBinding,
} from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import type { LocalTypeInfo } from "../../emitter-types/core.js";
import { substituteTypeArgs } from "./structural-resolution.js";

export const getPropertyType = (
  contextualType: IrType | undefined,
  propertyName: string,
  context: EmitterContext
): IrType | undefined => {
  if (!contextualType) {
    return undefined;
  }

  return resolvePropertyType(contextualType, propertyName, context, []);
};

export const resolveLocalTypeInfo = (
  ref: Extract<IrType, { kind: "referenceType" }>,
  context: EmitterContext
):
  | {
      readonly info: LocalTypeInfo;
      readonly namespace: string;
      readonly name: string;
    }
  | undefined => {
  const direct = resolveLocalTypeInfoWithoutBindings(ref, context);
  if (direct) {
    return direct;
  }

  const rebound = resolveBindingBackedReferenceType(ref, context);
  if (!rebound) {
    return undefined;
  }

  return resolveLocalTypeInfoWithoutBindings(rebound, context);
};

export const resolveLocalTypeInfoWithoutBindings = (
  ref: Extract<IrType, { kind: "referenceType" }>,
  context: EmitterContext
):
  | {
      readonly info: LocalTypeInfo;
      readonly namespace: string;
      readonly name: string;
    }
  | undefined => {
  const simpleLookupName = ref.name.includes(".")
    ? (ref.name.split(".").pop() ?? ref.name)
    : ref.name;
  const lookupCandidates = new Set<string>([simpleLookupName]);
  if (simpleLookupName.endsWith("$instance")) {
    const baseName = simpleLookupName.slice(0, -"$instance".length);
    if (baseName.length > 0) {
      lookupCandidates.add(baseName);
      const unsuffixedBaseName = baseName.replace(/_\d+$/, "");
      if (unsuffixedBaseName.length > 0) {
        lookupCandidates.add(unsuffixedBaseName);
      }
    }
  }

  for (const lookupName of lookupCandidates) {
    const localHit = context.localTypes?.get(lookupName);
    if (localHit) {
      return {
        info: localHit,
        namespace: context.moduleNamespace ?? context.options.rootNamespace,
        name: lookupName,
      };
    }
  }

  const moduleMap = context.options.moduleMap;
  if (!moduleMap) return undefined;

  const matches: {
    readonly namespace: string;
    readonly info: LocalTypeInfo;
    readonly name: string;
  }[] = [];
  for (const lookupName of lookupCandidates) {
    for (const m of moduleMap.values()) {
      const info = m.localTypes?.get(lookupName);
      if (!info) continue;
      matches.push({ namespace: m.namespace, info, name: lookupName });
    }
  }

  if (matches.length === 0) return undefined;
  if (matches.length === 1) {
    const onlyMatch = matches[0];
    if (!onlyMatch) {
      return undefined;
    }
    return {
      info: onlyMatch.info,
      namespace: onlyMatch.namespace,
      name: onlyMatch.name,
    };
  }

  const fqn =
    ref.resolvedClrType ?? (ref.name.includes(".") ? ref.name : undefined);
  if (fqn && fqn.includes(".")) {
    const namespace = fqn.slice(0, fqn.lastIndexOf("."));
    const scoped = matches.filter((m) => m.namespace === namespace);
    if (scoped.length === 1) {
      const scopedMatch = scoped[0];
      if (!scopedMatch) {
        return undefined;
      }
      return {
        info: scopedMatch.info,
        namespace: scopedMatch.namespace,
        name: scopedMatch.name,
      };
    }
  }

  return undefined;
};

const getReferenceBindingLookupCandidates = (
  ref: Extract<IrType, { kind: "referenceType" }>
): readonly string[] => {
  const candidates = new Set<string>();
  const add = (value: string | undefined): void => {
    if (value && value.length > 0) {
      candidates.add(value);
    }
  };

  add(ref.name);
  add(ref.resolvedClrType);
  add(ref.typeId?.tsName);
  add(ref.typeId?.clrName);

  for (const value of [...candidates]) {
    if (!value.includes(".")) continue;
    add(value.split(".").pop());
  }

  return [...candidates];
};

const getBindingScopedReference = (
  binding: FrontendTypeBinding,
  ref: Extract<IrType, { kind: "referenceType" }>
): Extract<IrType, { kind: "referenceType" }> => ({
  ...ref,
  name: binding.alias,
  resolvedClrType: binding.name,
});

export const resolveBindingBackedReferenceType = (
  ref: Extract<IrType, { kind: "referenceType" }>,
  context: EmitterContext
): Extract<IrType, { kind: "referenceType" }> | undefined => {
  const registry = context.bindingsRegistry;
  if (!registry || registry.size === 0) {
    return undefined;
  }

  for (const candidate of getReferenceBindingLookupCandidates(ref)) {
    const binding = registry.get(candidate);
    if (!binding) continue;

    const scopedRef = getBindingScopedReference(binding, ref);
    const localInfo = resolveLocalTypeInfoWithoutBindings(scopedRef, context);
    if (localInfo) {
      return scopedRef;
    }
  }

  return undefined;
};

const resolveBindingBackedPropertyType = (
  ref: Extract<IrType, { kind: "referenceType" }>,
  propertyName: string,
  context: EmitterContext
): IrType | undefined => {
  const registry = context.bindingsRegistry;
  if (!registry || registry.size === 0) {
    return undefined;
  }

  for (const candidate of getReferenceBindingLookupCandidates(ref)) {
    const binding = registry.get(candidate);
    if (!binding) continue;

    const member = binding.members.find(
      (candidateMember) =>
        candidateMember.kind === "property" &&
        candidateMember.alias === propertyName
    );
    if (!member?.semanticType) continue;

    return withOptionalUndefined(
      member.semanticType,
      member.semanticOptional === true
    );
  }

  return undefined;
};

export const resolveBindingBackedPropertySignatures = (
  ref: Extract<IrType, { kind: "referenceType" }>,
  context: EmitterContext
): readonly IrPropertySignature[] | undefined => {
  const registry = context.bindingsRegistry;
  if (!registry || registry.size === 0) {
    return undefined;
  }

  for (const candidate of getReferenceBindingLookupCandidates(ref)) {
    const binding = registry.get(candidate);
    if (!binding) continue;

    const properties = binding.members
      .filter(
        (
          candidateMember
        ): candidateMember is typeof candidateMember & {
          readonly semanticType: IrType;
        } =>
          candidateMember.kind === "property" &&
          candidateMember.semanticType !== undefined
      )
      .map(
        (member): IrPropertySignature => ({
          kind: "propertySignature",
          name: member.alias,
          type: withOptionalUndefined(
            member.semanticType,
            member.semanticOptional === true
          ),
          isOptional: member.semanticOptional === true,
          isReadonly: false,
        })
      );

    if (properties.length > 0) {
      return properties;
    }
  }

  return undefined;
};

/**
 * Internal helper for property type resolution with cycle detection
 */
export const resolvePropertyType = (
  type: IrType,
  propertyName: string,
  context: EmitterContext,
  visitedTypes: readonly string[]
): IrType | undefined => {
  // Handle reference types (most common case)
  if (type.kind === "referenceType") {
    const typeInfoResult = resolveLocalTypeInfo(type, context);
    if (!typeInfoResult) {
      // Fall back to structural members carried directly on the reference node.
      // These are checked after registry lookup to preserve type parameter
      // substitution from the registry path (structural members lack it).
      if (type.structuralMembers?.length) {
        const structProp = findPropertyInMembers(
          type.structuralMembers,
          propertyName
        );
        if (structProp) return structProp;
      }
      return resolveBindingBackedPropertyType(type, propertyName, context);
    }
    const typeInfo = typeInfoResult.info;

    // Prevent cycles
    const cycleKey = type.resolvedClrType ?? type.name;
    if (visitedTypes.includes(cycleKey)) {
      return undefined;
    }
    const newVisited = [...visitedTypes, cycleKey];

    // Chase type alias
    if (typeInfo.kind === "typeAlias") {
      const substituted = type.typeArguments
        ? substituteTypeArgs(
            typeInfo.type,
            typeInfo.typeParameters,
            type.typeArguments
          )
        : typeInfo.type;
      return resolvePropertyType(
        substituted,
        propertyName,
        context,
        newVisited
      );
    }

    // Look up property in interface
    if (typeInfo.kind === "interface") {
      // Search own members first
      const prop = findPropertyInMembers(typeInfo.members, propertyName);
      if (prop) {
        return type.typeArguments
          ? substituteTypeArgs(
              prop,
              typeInfo.typeParameters,
              type.typeArguments
            )
          : prop;
      }

      // Search extended interfaces
      for (const base of typeInfo.extends) {
        const baseProp = resolvePropertyType(
          base,
          propertyName,
          context,
          newVisited
        );
        if (baseProp) {
          return type.typeArguments
            ? substituteTypeArgs(
                baseProp,
                typeInfo.typeParameters,
                type.typeArguments
              )
            : baseProp;
        }
      }
      return undefined;
    }

    // Look up property in class
    if (typeInfo.kind === "class") {
      const prop = findPropertyInClassMembers(typeInfo.members, propertyName);
      if (prop) {
        return type.typeArguments
          ? substituteTypeArgs(
              prop,
              typeInfo.typeParameters,
              type.typeArguments
            )
          : prop;
      }
      return undefined;
    }

    return undefined;
  }

  // Handle object types directly
  if (type.kind === "objectType") {
    return findPropertyInMembers(type.members, propertyName);
  }

  return undefined;
};

/**
 * Find property type in interface members
 */
export const findPropertyInMembers = (
  members: readonly IrInterfaceMember[],
  propertyName: string
): IrType | undefined => {
  for (const member of members) {
    if (member.kind === "propertySignature" && member.name === propertyName) {
      return withOptionalUndefined(member.type, member.isOptional);
    }
  }
  return undefined;
};

export const withOptionalUndefined = (
  type: IrType,
  isOptional: boolean
): IrType => {
  if (!isOptional) return type;
  if (
    type.kind === "unionType" &&
    type.types.some((t) => t.kind === "primitiveType" && t.name === "undefined")
  ) {
    return type;
  }
  return {
    kind: "unionType",
    types: [type, { kind: "primitiveType", name: "undefined" }],
  };
};

/**
 * Find property type in class members
 */
export const findPropertyInClassMembers = (
  members: readonly IrClassMember[],
  propertyName: string
): IrType | undefined => {
  for (const member of members) {
    if (member.kind === "propertyDeclaration" && member.name === propertyName) {
      return member.type;
    }
  }
  return undefined;
};
