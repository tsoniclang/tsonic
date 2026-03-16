/**
 * Type resolution helpers for generic null/default handling
 *
 * Provides:
 * - containsTypeParameter: Check if type contains any type parameter
 * - substituteTypeArgs: Substitute type arguments into a type
 * - getPropertyType: Look up property type from contextual type
 * - stripNullish: Remove null/undefined from union types
 * - splitRuntimeNullishUnionMembers: Treat TS runtime-absence members
 *   (null/undefined/void) as nullish for emission decisions
 * - isDefinitelyValueType: Check if type is a C# value type
 */

import type {
  IrType,
  IrInterfaceMember,
  IrClassMember,
  IrPropertyDeclaration,
  IrPropertySignature, // NEW: needed for union-member matching
  TypeBinding as FrontendTypeBinding,
} from "@tsonic/frontend";
import { normalizedUnionType, stableIrTypeKey } from "@tsonic/frontend";
import type { LocalTypeInfo, EmitterContext } from "../../types.js";

/**
 * Check if a type contains any type parameter.
 *
 * Uses IR kind "typeParameterType" only.
 *
 * @param type - The IR type to check
 * @returns true if the type contains a type parameter
 */
const containsTypeParameterImpl = (
  type: IrType,
  visited: WeakSet<object>
): boolean => {
  if (visited.has(type)) {
    return false;
  }
  visited.add(type);

  switch (type.kind) {
    case "typeParameterType":
      // New IR kind - always a type parameter
      return true;

    case "referenceType":
      // Recurse into type arguments
      if (type.typeArguments) {
        return type.typeArguments.some((arg) =>
          containsTypeParameterImpl(arg, visited)
        );
      }
      return false;

    case "arrayType":
      return containsTypeParameterImpl(type.elementType, visited);

    case "dictionaryType":
      return (
        containsTypeParameterImpl(type.keyType, visited) ||
        containsTypeParameterImpl(type.valueType, visited)
      );

    case "unionType":
    case "intersectionType":
      return type.types.some((t) => containsTypeParameterImpl(t, visited));

    case "tupleType":
      return type.elementTypes.some((t) =>
        containsTypeParameterImpl(t, visited)
      );

    case "functionType":
      if (containsTypeParameterImpl(type.returnType, visited)) {
        return true;
      }
      return type.parameters.some(
        (p) => p.type && containsTypeParameterImpl(p.type, visited)
      );

    case "objectType":
      return type.members.some((m) => {
        if (m.kind === "propertySignature") {
          return containsTypeParameterImpl(m.type, visited);
        }
        if (m.kind === "methodSignature") {
          if (
            m.returnType &&
            containsTypeParameterImpl(m.returnType, visited)
          ) {
            return true;
          }
          return m.parameters.some(
            (p) => p.type && containsTypeParameterImpl(p.type, visited)
          );
        }
        return false;
      });

    case "primitiveType":
    case "literalType":
    case "anyType":
    case "unknownType":
    case "voidType":
    case "neverType":
      return false;

    default: {
      // Exhaustive check - this will error if a new IR type kind is added
      const exhaustive: never = type;
      void exhaustive;
      return false;
    }
  }
};

export const containsTypeParameter = (type: IrType): boolean =>
  containsTypeParameterImpl(type, new WeakSet<object>());

/**
 * Substitute type arguments into a type.
 *
 * @param type - The type to substitute into
 * @param typeParamNames - List of type parameter names (in order)
 * @param typeArgs - List of type arguments (in order, parallel to typeParamNames)
 * @returns The type with type parameters substituted
 */
export const substituteTypeArgs = (
  type: IrType,
  typeParamNames: readonly string[],
  typeArgs: readonly IrType[]
): IrType => {
  // Build mapping from name to type
  const mapping = new Map<string, IrType>();
  for (let i = 0; i < typeParamNames.length && i < typeArgs.length; i++) {
    const name = typeParamNames[i];
    const arg = typeArgs[i];
    if (name !== undefined && arg !== undefined) {
      mapping.set(name, arg);
    }
  }

  return substituteType(type, mapping);
};

/**
 * Internal helper for type substitution
 */
const substituteType = (
  type: IrType,
  mapping: ReadonlyMap<string, IrType>,
  visited: Map<object, IrType> = new Map<object, IrType>()
): IrType => {
  const existing = visited.get(type);
  if (existing) {
    return existing;
  }

  switch (type.kind) {
    case "typeParameterType": {
      const substitution = mapping.get(type.name);
      return substitution ?? type;
    }

    case "referenceType": {
      // Recurse into type arguments
      if (type.typeArguments) {
        const clone = {
          ...type,
          typeArguments: [],
        } as any;
        visited.set(type, clone);
        clone.typeArguments = type.typeArguments.map((arg) =>
          substituteType(arg, mapping, visited)
        );
        return clone as IrType;
      }
      return type;
    }

    case "arrayType": {
      const clone = {
        ...type,
        elementType: type.elementType,
      } as any;
      visited.set(type, clone);
      clone.elementType = substituteType(type.elementType, mapping, visited);
      return clone as IrType;
    }

    case "dictionaryType": {
      const clone = {
        ...type,
        keyType: type.keyType,
        valueType: type.valueType,
      } as any;
      visited.set(type, clone);
      clone.keyType = substituteType(type.keyType, mapping, visited);
      clone.valueType = substituteType(type.valueType, mapping, visited);
      return clone as IrType;
    }

    case "unionType": {
      const clone = {
        ...type,
        types: [],
      } as any;
      visited.set(type, clone);
      clone.types = type.types.map((t) => substituteType(t, mapping, visited));
      return clone as IrType;
    }

    case "tupleType": {
      const clone = {
        ...type,
        elementTypes: [],
      } as any;
      visited.set(type, clone);
      clone.elementTypes = type.elementTypes.map((t) =>
        substituteType(t, mapping, visited)
      );
      return clone as IrType;
    }

    case "intersectionType": {
      const clone = {
        ...type,
        types: [],
      } as any;
      visited.set(type, clone);
      clone.types = type.types.map((t) => substituteType(t, mapping, visited));
      return clone as IrType;
    }

    case "functionType": {
      const clone = {
        ...type,
        returnType: type.returnType,
        parameters: [],
      } as any;
      visited.set(type, clone);
      clone.returnType = substituteType(type.returnType, mapping, visited);
      clone.parameters = type.parameters.map((p) =>
        p.type ? { ...p, type: substituteType(p.type, mapping, visited) } : p
      );
      return clone as IrType;
    }

    case "objectType": {
      const clone = {
        ...type,
        members: [],
      } as any;
      visited.set(type, clone);
      clone.members = type.members.map((m) => {
        if (m.kind === "propertySignature") {
          return { ...m, type: substituteType(m.type, mapping, visited) };
        }
        if (m.kind === "methodSignature") {
          return {
            ...m,
            returnType: m.returnType
              ? substituteType(m.returnType, mapping, visited)
              : undefined,
            parameters: m.parameters.map((p) =>
              p.type
                ? { ...p, type: substituteType(p.type, mapping, visited) }
                : p
            ),
          };
        }
        return m;
      });
      return clone as IrType;
    }

    case "primitiveType":
    case "literalType":
    case "anyType":
    case "unknownType":
    case "voidType":
    case "neverType":
      return type;

    default: {
      const exhaustive: never = type;
      void exhaustive;
      return type;
    }
  }
};

export const matchesTypeofTag = (
  type: IrType,
  tag: string,
  context: EmitterContext
): boolean => {
  const resolved = resolveTypeAlias(type, context);

  if (resolved.kind === "literalType") {
    switch (tag) {
      case "string":
        return typeof resolved.value === "string";
      case "number":
        return typeof resolved.value === "number";
      case "boolean":
        return typeof resolved.value === "boolean";
      default:
        return false;
    }
  }

  if (resolved.kind !== "primitiveType") {
    return false;
  }

  switch (tag) {
    case "string":
      return resolved.name === "string";
    case "number":
      return resolved.name === "number" || resolved.name === "int";
    case "boolean":
      return resolved.name === "boolean";
    case "undefined":
      return resolved.name === "undefined";
    default:
      return false;
  }
};

const genericTypeofTarget = (tag: string): IrType | undefined => {
  switch (tag) {
    case "string":
      return { kind: "primitiveType", name: "string" };
    case "number":
      return { kind: "primitiveType", name: "number" };
    case "boolean":
      return { kind: "primitiveType", name: "boolean" };
    case "undefined":
      return { kind: "primitiveType", name: "undefined" };
    default:
      return undefined;
  }
};

export const narrowTypeByNotTypeofTag = (
  currentType: IrType | undefined,
  tag: string,
  context: EmitterContext
): IrType | undefined => {
  if (!currentType) return undefined;

  if (currentType.kind === "unionType") {
    const kept = currentType.types.filter(
      (member): member is IrType =>
        !!member && !matchesTypeofTag(member, tag, context)
    );
    if (kept.length === 0) return undefined;
    if (kept.length === 1) return kept[0];
    return normalizedUnionType(kept);
  }

  return matchesTypeofTag(currentType, tag, context) ? undefined : currentType;
};

export const narrowTypeByTypeofTag = (
  currentType: IrType | undefined,
  tag: string,
  context: EmitterContext
): IrType | undefined => {
  if (!currentType) return genericTypeofTarget(tag);

  if (currentType.kind === "unionType") {
    const kept = currentType.types.filter(
      (member): member is IrType =>
        !!member && matchesTypeofTag(member, tag, context)
    );
    if (kept.length === 0) return genericTypeofTarget(tag);
    if (kept.length === 1) return kept[0];
    return normalizedUnionType(kept);
  }

  return matchesTypeofTag(currentType, tag, context)
    ? currentType
    : genericTypeofTarget(tag);
};

/**
 * Look up property type from a contextual type.
 *
 * This handles:
 * - Local types (class/interface/typeAlias) via localTypes map
 * - Type alias chasing (follows alias.type until reaching a concrete type)
 * - Interface extends resolution (searches base interfaces)
 * - Generic type argument substitution
 *
 * @param contextualType - The contextual type (e.g., Result<T>)
 * @param propertyName - The property name to look up
 * @param context - Emitter context with localTypes
 * @returns The property type after substitution, or undefined if not found
 */
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

/**
 * Internal helper for property type resolution with cycle detection
 */
export const resolveLocalTypeInfo = (
  ref: Extract<IrType, { kind: "referenceType" }>,
  context: EmitterContext
): { readonly info: LocalTypeInfo; readonly namespace: string } | undefined => {
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

const resolveLocalTypeInfoWithoutBindings = (
  ref: Extract<IrType, { kind: "referenceType" }>,
  context: EmitterContext
): { readonly info: LocalTypeInfo; readonly namespace: string } | undefined => {
  const lookupName = ref.name.includes(".")
    ? (ref.name.split(".").pop() ?? ref.name)
    : ref.name;

  const localHit = context.localTypes?.get(lookupName);
  if (localHit) {
    return {
      info: localHit,
      namespace: context.moduleNamespace ?? context.options.rootNamespace,
    };
  }

  const moduleMap = context.options.moduleMap;
  if (!moduleMap) return undefined;

  const matches: {
    readonly namespace: string;
    readonly info: LocalTypeInfo;
  }[] = [];
  for (const m of moduleMap.values()) {
    const info = m.localTypes?.get(lookupName);
    if (!info) continue;
    matches.push({ namespace: m.namespace, info });
  }

  if (matches.length === 0) return undefined;
  if (matches.length === 1) {
    const onlyMatch = matches[0];
    if (!onlyMatch) {
      return undefined;
    }
    return { info: onlyMatch.info, namespace: onlyMatch.namespace };
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

const resolveBindingBackedReferenceType = (
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

const resolveBindingBackedPropertySignatures = (
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
const resolvePropertyType = (
  type: IrType,
  propertyName: string,
  context: EmitterContext,
  visitedTypes: readonly string[]
): IrType | undefined => {
  // Handle reference types (most common case)
  if (type.kind === "referenceType") {
    const typeInfoResult = resolveLocalTypeInfo(type, context);
    if (!typeInfoResult) {
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
const findPropertyInMembers = (
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

const withOptionalUndefined = (type: IrType, isOptional: boolean): IrType => {
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

const stripGlobalPrefix = (name: string): string =>
  name.startsWith("global::") ? name.slice("global::".length) : name;

const getTypeMemberIndexCandidates = (
  ref: Extract<IrType, { kind: "referenceType" }>,
  context: EmitterContext
): readonly string[] | undefined => {
  const index = context.options.typeMemberIndex;
  if (!index) return undefined;

  if (ref.resolvedClrType) {
    return [stripGlobalPrefix(ref.resolvedClrType)];
  }

  if (ref.name.includes(".")) {
    return [ref.name];
  }

  const matches: string[] = [];
  for (const fqn of index.keys()) {
    if (fqn.endsWith(`.${ref.name}`) || fqn.endsWith(`.${ref.name}__Alias`)) {
      matches.push(fqn);
    }
  }

  if (matches.length <= 1) {
    return matches;
  }

  const list = matches.sort().join(", ");
  throw new Error(
    `ICE: Ambiguous type member index entry for '${ref.name}'. Candidates: ${list}`
  );
};

export const hasDeterministicPropertyMembership = (
  type: IrType,
  propertyName: string,
  context: EmitterContext
): boolean | undefined => {
  const resolved = resolveTypeAlias(stripNullish(type), context);

  if (resolved.kind === "objectType") {
    return resolved.members.some(
      (member) =>
        member.kind === "propertySignature" && member.name === propertyName
    );
  }

  if (resolved.kind !== "referenceType") {
    return undefined;
  }

  if (resolved.structuralMembers?.length) {
    return resolved.structuralMembers.some(
      (member) =>
        member.kind === "propertySignature" && member.name === propertyName
    );
  }

  if (getPropertyType(resolved, propertyName, context)) {
    return true;
  }

  const knownProps = getAllPropertySignatures(resolved, context);
  if (knownProps) {
    return knownProps.some((member) => member.name === propertyName);
  }

  const localInfo = resolveLocalTypeInfo(resolved, context)?.info;
  if (localInfo?.kind === "class") {
    return localInfo.members.some(
      (member) =>
        (member.kind === "propertyDeclaration" ||
          member.kind === "methodDeclaration") &&
        member.name === propertyName
    );
  }

  const candidates = getTypeMemberIndexCandidates(resolved, context);
  if (!candidates || candidates.length === 0) {
    return undefined;
  }

  return candidates.some((fqn) => {
    const perType = context.options.typeMemberIndex?.get(fqn);
    return perType?.has(propertyName) ?? false;
  });
};

/**
 * Get all property signatures for a type, including inherited interface members.
 *
 * Notes:
 * - Only supports referenceType → local interface lookup (synthetic union members are always interfaces).
 * - Derived members override base members by name.
 * - Cycle-safe via visitedTypes.
 */
export const getAllPropertySignatures = (
  type: IrType,
  context: EmitterContext
): readonly IrPropertySignature[] | undefined => {
  // We only expect nominal reference types here (Result__0<T,E>, etc.)
  if (type.kind !== "referenceType") return undefined;

  const typeInfoResult = resolveLocalTypeInfo(type, context);
  if (!typeInfoResult) {
    return resolveBindingBackedPropertySignatures(type, context);
  }
  const typeInfo = typeInfoResult.info;
  if (!typeInfo || typeInfo.kind !== "interface") return undefined;

  // Collect into a map so derived overrides base by name deterministically
  const propMap = new Map<string, IrPropertySignature>();

  collectInterfaceProps(type, typeInfo, context, propMap, []);
  return [...propMap.values()];
};

type StructuralShapeMember = {
  readonly name: string;
  readonly isOptional: boolean;
  readonly typeKey: string;
};

const sortStructuralShape = (
  members: readonly StructuralShapeMember[]
): readonly StructuralShapeMember[] =>
  [...members].sort((left, right) => left.name.localeCompare(right.name));

const structuralShapesEqual = (
  left: readonly StructuralShapeMember[],
  right: readonly StructuralShapeMember[]
): boolean =>
  left.length === right.length &&
  left.every(
    (member, index) =>
      member.name === right[index]?.name &&
      member.isOptional === right[index]?.isOptional &&
      member.typeKey === right[index]?.typeKey
  );

const getObjectTypeStructuralShape = (
  type: Extract<IrType, { kind: "objectType" }>
): readonly StructuralShapeMember[] | undefined => {
  if (type.members.some((member) => member.kind === "methodSignature")) {
    return undefined;
  }

  return sortStructuralShape(
    type.members
      .filter(
        (
          member
        ): member is Extract<typeof member, { kind: "propertySignature" }> =>
          member.kind === "propertySignature"
      )
      .map((member) => ({
        name: member.name,
        isOptional: member.isOptional,
        typeKey: stableIrTypeKey(member.type),
      }))
  );
};

const getLocalTypeInfoStructuralShape = (
  info: LocalTypeInfo,
  context: EmitterContext
): readonly StructuralShapeMember[] | undefined => {
  switch (info.kind) {
    case "typeAlias": {
      const resolved = resolveTypeAlias(info.type, context);
      if (resolved.kind !== "objectType") {
        return undefined;
      }
      return getObjectTypeStructuralShape(resolved);
    }

    case "interface": {
      if (info.members.some((member) => member.kind === "methodSignature")) {
        return undefined;
      }
      return sortStructuralShape(
        info.members
          .filter(
            (
              member
            ): member is Extract<
              typeof member,
              { kind: "propertySignature" }
            > => member.kind === "propertySignature"
          )
          .map((member) => ({
            name: member.name,
            isOptional: member.isOptional,
            typeKey: stableIrTypeKey(member.type),
          }))
      );
    }

    case "class": {
      if (info.members.some((member) => member.kind === "methodDeclaration")) {
        return undefined;
      }

      const propertyMembers = info.members.filter(
        (member): member is IrPropertyDeclaration =>
          member.kind === "propertyDeclaration" && member.type !== undefined
      );

      return sortStructuralShape(
        propertyMembers.map((member) => ({
          name: member.name,
          isOptional: false,
          typeKey: stableIrTypeKey(member.type!),
        }))
      );
    }

    case "enum":
      return undefined;
  }
};

type StructuralReferenceCandidate = {
  readonly dedupeKey: string;
  readonly isCurrentLocal: boolean;
  readonly isCurrentNamespace: boolean;
  readonly ref: Extract<IrType, { kind: "referenceType" }>;
};

const isStructurallyEmittedLocalTypeInfo = (
  info: LocalTypeInfo | undefined
): boolean => {
  if (!info) {
    return false;
  }

  switch (info.kind) {
    case "typeAlias":
      return info.type.kind === "objectType";
    case "interface":
      return true;
    case "class":
      return info.members.every(
        (member) => member.kind !== "methodDeclaration"
      );
    case "enum":
      return false;
  }
};

/**
 * Resolve an inline/object structural type to a canonical emitted nominal reference
 * when the current compilation already declares an equivalent structural type.
 *
 * This is used in emitter-side contextual type paths that must emit a CLR type name
 * (for example JSArray<T> wrapper element types or nominal object construction),
 * but sometimes receive an objectType after alias resolution. When we can prove that
 * object shape matches an existing structural alias/interface/class, we preserve the
 * canonical emitted reference instead of letting raw objectType reach type emission.
 */
export const resolveStructuralReferenceType = (
  type: IrType,
  context: EmitterContext
): IrType | undefined => {
  const stripped = stripNullish(type);

  if (stripped.kind === "referenceType") {
    const directLocalType = resolveLocalTypeInfoWithoutBindings(
      stripped,
      context
    )?.info;
    if (isStructurallyEmittedLocalTypeInfo(directLocalType)) {
      return stripped;
    }

    const rebound = resolveBindingBackedReferenceType(stripped, context);
    const reboundLocalType = rebound
      ? resolveLocalTypeInfoWithoutBindings(rebound, context)?.info
      : undefined;
    if (rebound && isStructurallyEmittedLocalTypeInfo(reboundLocalType)) {
      return rebound;
    }
  }

  const resolved = resolveTypeAlias(stripped, context);
  if (resolved.kind !== "objectType") {
    return undefined;
  }

  const targetShape = getObjectTypeStructuralShape(resolved);
  if (!targetShape || targetShape.length === 0) {
    return undefined;
  }

  const currentNamespace =
    context.moduleNamespace ?? context.options.rootNamespace;
  const candidates: StructuralReferenceCandidate[] = [];
  const seenKeys = new Set<string>();

  const pushCandidate = (
    typeName: string,
    namespace: string,
    info: LocalTypeInfo,
    isCurrentLocal: boolean
  ): void => {
    const shape = getLocalTypeInfoStructuralShape(info, context);
    if (!shape || !structuralShapesEqual(shape, targetShape)) {
      return;
    }

    const emittedName =
      info.kind === "typeAlias" ? `${typeName}__Alias` : typeName;
    const resolvedClrType =
      isCurrentLocal && namespace === currentNamespace
        ? undefined
        : `${namespace}.${emittedName}`;
    const dedupeKey = resolvedClrType ?? `${namespace}.${emittedName}`;
    if (seenKeys.has(dedupeKey)) {
      return;
    }
    seenKeys.add(dedupeKey);

    candidates.push({
      dedupeKey,
      isCurrentLocal,
      isCurrentNamespace: namespace === currentNamespace,
      ref: resolvedClrType
        ? {
            kind: "referenceType",
            name: typeName,
            resolvedClrType,
          }
        : {
            kind: "referenceType",
            name: typeName,
          },
    });
  };

  if (context.localTypes) {
    for (const [typeName, info] of context.localTypes.entries()) {
      pushCandidate(typeName, currentNamespace, info, true);
    }
  }

  if (context.options.moduleMap) {
    for (const module of context.options.moduleMap.values()) {
      if (!module.localTypes) continue;
      for (const [typeName, info] of module.localTypes.entries()) {
        pushCandidate(typeName, module.namespace, info, false);
      }
    }
  }

  const currentLocalMatches = candidates.filter(
    (candidate) => candidate.isCurrentLocal
  );
  if (currentLocalMatches.length === 1) {
    return currentLocalMatches[0]?.ref;
  }
  if (currentLocalMatches.length > 1) {
    return undefined;
  }

  const currentNamespaceMatches = candidates.filter(
    (candidate) => candidate.isCurrentNamespace
  );
  if (currentNamespaceMatches.length === 1) {
    return currentNamespaceMatches[0]?.ref;
  }
  if (currentNamespaceMatches.length > 1) {
    return undefined;
  }

  return candidates.length === 1 ? candidates[0]?.ref : undefined;
};

export const normalizeStructuralEmissionType = (
  type: IrType,
  context: EmitterContext
): IrType => {
  const cache = new Map<IrType, IrType>();
  const active = new Set<IrType>();

  const normalize = (current: IrType): IrType => {
    const rebound = resolveStructuralReferenceType(current, context);
    if (rebound) {
      return rebound;
    }

    if (active.has(current)) {
      return current;
    }

    const cached = cache.get(current);
    if (cached) {
      return cached;
    }

    active.add(current);

    const normalized = (() => {
      switch (current.kind) {
        case "referenceType": {
          const typeArguments = current.typeArguments?.map(normalize);
          const hasChanged =
            !!typeArguments &&
            typeArguments.some(
              (argument, index) => argument !== current.typeArguments?.[index]
            );
          return hasChanged
            ? {
                ...current,
                typeArguments,
              }
            : current;
        }
        case "arrayType": {
          const elementType = normalize(current.elementType);
          const tuplePrefixElementTypes = current.tuplePrefixElementTypes?.map(
            normalize
          );
          const tupleRestElementType = current.tupleRestElementType
            ? normalize(current.tupleRestElementType)
            : undefined;
          const hasChanged =
            elementType !== current.elementType ||
            (!!tuplePrefixElementTypes &&
              tuplePrefixElementTypes.some(
                (element, index) =>
                  element !== current.tuplePrefixElementTypes?.[index]
              )) ||
            tupleRestElementType !== current.tupleRestElementType;
          return hasChanged
            ? {
                ...current,
                elementType,
                ...(tuplePrefixElementTypes
                  ? { tuplePrefixElementTypes }
                  : {}),
                ...(tupleRestElementType
                  ? { tupleRestElementType }
                  : {}),
              }
            : current;
        }
        case "tupleType": {
          const elementTypes = current.elementTypes.map(normalize);
          return elementTypes.some(
            (element, index) => element !== current.elementTypes[index]
          )
            ? { ...current, elementTypes }
            : current;
        }
        case "functionType": {
          const parameters = current.parameters.map((parameter) =>
            parameter.type
              ? {
                  ...parameter,
                  type: normalize(parameter.type),
                }
              : parameter
          );
          const returnType = normalize(current.returnType);
          const hasChanged =
            returnType !== current.returnType ||
            parameters.some((parameter, index) => parameter !== current.parameters[index]);
          return hasChanged
            ? {
                ...current,
                parameters,
                returnType,
              }
            : current;
        }
        case "objectType": {
          const members = current.members.map((member) => {
            switch (member.kind) {
              case "propertySignature": {
                const memberType = normalize(member.type);
                return memberType !== member.type
                  ? {
                      ...member,
                      type: memberType,
                    }
                  : member;
              }
              case "methodSignature": {
                const parameters = member.parameters.map((parameter) =>
                  parameter.type
                    ? {
                        ...parameter,
                        type: normalize(parameter.type),
                      }
                    : parameter
                );
                const returnType = member.returnType
                  ? normalize(member.returnType)
                  : undefined;
                const typeParameters = member.typeParameters?.map((typeParameter) =>
                  typeParameter.constraint || typeParameter.default
                    ? {
                        ...typeParameter,
                        ...(typeParameter.constraint
                          ? {
                              constraint: normalize(typeParameter.constraint),
                            }
                          : {}),
                        ...(typeParameter.default
                          ? {
                              default: normalize(typeParameter.default),
                            }
                          : {}),
                      }
                    : typeParameter
                );
                const hasChanged =
                  parameters.some(
                    (parameter, index) => parameter !== member.parameters[index]
                  ) ||
                  returnType !== member.returnType ||
                  (!!typeParameters &&
                    typeParameters.some(
                      (typeParameter, index) =>
                        typeParameter !== member.typeParameters?.[index]
                    ));
                return hasChanged
                  ? {
                      ...member,
                      parameters,
                      ...(returnType ? { returnType } : {}),
                      ...(typeParameters ? { typeParameters } : {}),
                    }
                  : member;
              }
            }
          });
          return members.some((member, index) => member !== current.members[index])
            ? { ...current, members }
            : current;
        }
        case "dictionaryType": {
          const keyType = normalize(current.keyType);
          const valueType = normalize(current.valueType);
          return keyType !== current.keyType || valueType !== current.valueType
            ? {
                ...current,
                keyType,
                valueType,
              }
            : current;
        }
        case "unionType":
        case "intersectionType": {
          const types = current.types.map(normalize);
          return types.some((member, index) => member !== current.types[index])
            ? {
                ...current,
                types,
              }
            : current;
        }
        case "primitiveType":
        case "typeParameterType":
        case "literalType":
        case "anyType":
        case "unknownType":
        case "voidType":
        case "neverType":
          return current;
      }
    })();

    cache.set(current, normalized);
    active.delete(current);
    return normalized;
  };

  return normalize(type);
};

/**
 * Internal: collect interface props + props from extends (cycle-safe).
 *
 * Ordering is important:
 * - Add own members first (so they override bases).
 * - Then walk extends for missing names.
 */
const collectInterfaceProps = (
  ref: Extract<IrType, { kind: "referenceType" }>,
  typeInfo: Extract<LocalTypeInfo, { kind: "interface" }>,
  context: EmitterContext,
  out: Map<string, IrPropertySignature>,
  visitedTypes: readonly string[]
): void => {
  // Prevent cycles
  const cycleKey = ref.resolvedClrType ?? ref.name;
  if (visitedTypes.includes(cycleKey)) return;
  const nextVisited = [...visitedTypes, cycleKey];

  // Add own properties first (derived overrides base)
  for (const m of typeInfo.members) {
    if (m.kind === "propertySignature") {
      out.set(m.name, m);
    }
  }

  // Walk base interfaces
  for (const base of typeInfo.extends) {
    if (base.kind !== "referenceType") continue;
    const baseInfoResult = resolveLocalTypeInfo(base, context);
    const baseInfo = baseInfoResult?.info;
    if (!baseInfo || baseInfo.kind !== "interface") continue;

    // Recurse. If derived already set the name, we keep the derived one.
    const basePropMap = new Map<string, IrPropertySignature>();
    collectInterfaceProps(base, baseInfo, context, basePropMap, nextVisited);

    for (const [name, sig] of basePropMap.entries()) {
      if (!out.has(name)) {
        out.set(name, sig);
      }
    }
  }
};

/**
 * Select the best union member type to instantiate for an object literal.
 *
 * Example:
 *   type Result<T,E> = Result__0<T,E> | Result__1<T,E>
 *   return { ok: true, value }  // keys: ["ok","value"]
 * → choose Result__0<T,E>
 *
 * Matching rules (conservative):
 * - Only considers union members that are referenceTypes to local interfaces or classes.
 * - Object literal keys must be a subset of the candidate's property names.
 * - All *required* (non-optional) candidate properties must be present in the literal.
 *
 * Scoring (pick "most specific" deterministically):
 * 1) Fewer extra properties (candidateProps - literalKeys)
 * 2) More required properties (prefer tighter required shape)
 * 3) Fewer total properties
 * 4) Lexicographic by type name (stable tie-break)
 */
export const selectUnionMemberForObjectLiteral = (
  unionType: Extract<IrType, { kind: "unionType" }>,
  literalKeys: readonly string[],
  context: EmitterContext
): Extract<IrType, { kind: "referenceType" }> | undefined => {
  // Normalize keys (defensive: dedupe)
  const keySet = new Set(literalKeys.filter((k) => k.length > 0));
  const keys = [...keySet];

  type Candidate = {
    ref: Extract<IrType, { kind: "referenceType" }>;
    allProps: Set<string>;
    requiredProps: Set<string>;
  };

  const candidates: Candidate[] = [];

  for (const member of unionType.types) {
    if (member.kind !== "referenceType") continue;

    // If a union member is itself an alias, chase once (rare, but safe)
    const resolved = resolveTypeAlias(member, context);
    const ref =
      resolved.kind === "referenceType" ? resolved : (member as typeof member);

    const infoResult = resolveLocalTypeInfo(ref, context);
    const info = infoResult?.info;
    if (!info) continue;

    // Interface members: use property signatures (includes inherited interfaces).
    if (info.kind === "interface") {
      const props = getAllPropertySignatures(ref, context);
      if (!props) continue;

      const allProps = new Set(props.map((p) => p.name));
      const requiredProps = new Set(
        props.filter((p) => !p.isOptional).map((p) => p.name)
      );

      candidates.push({ ref, allProps, requiredProps });
      continue;
    }

    // Class members: use property declarations.
    // Anonymous object literal synthesis (TSN7403) emits DTO-like classes with `required` properties,
    // so unions over synthesized shapes must be matched here (not only interfaces).
    if (info.kind === "class") {
      const props = info.members.filter(
        (m) => m.kind === "propertyDeclaration"
      );
      const allProps = new Set(props.map((p) => p.name));
      const requiredProps = new Set(
        props.filter((p) => p.isRequired).map((p) => p.name)
      );

      candidates.push({ ref, allProps, requiredProps });
      continue;
    }
  }

  // Filter by match rules
  const matches = candidates.filter((c) => {
    // literal keys must exist on candidate
    for (const k of keys) {
      if (!c.allProps.has(k)) return false;
    }
    // candidate required props must be provided by literal
    for (const r of c.requiredProps) {
      if (!keySet.has(r)) return false;
    }
    return true;
  });

  if (matches.length === 0) return undefined;
  const firstMatch = matches[0];
  if (matches.length === 1 && firstMatch) return firstMatch.ref;

  // Pick best by score
  matches.sort((a, b) => {
    const aTotal = a.allProps.size;
    const bTotal = b.allProps.size;

    const aExtra = aTotal - keySet.size;
    const bExtra = bTotal - keySet.size;

    if (aExtra !== bExtra) return aExtra - bExtra; // fewer extras is better

    const aReq = a.requiredProps.size;
    const bReq = b.requiredProps.size;
    if (aReq !== bReq) return bReq - aReq; // more required is better

    if (aTotal !== bTotal) return aTotal - bTotal; // fewer total props is better

    return a.ref.name.localeCompare(b.ref.name); // stable tie-break
  });

  const best = matches[0];
  return best ? best.ref : undefined;
};

/**
 * Find property type in class members
 */
const findPropertyInClassMembers = (
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

/**
 * Strip null and undefined from a union type.
 *
 * Used when we need the non-nullable base type, e.g., for object instantiation
 * where `new T? { ... }` is invalid C# but `new T { ... }` is valid.
 *
 * @param type - The type to strip nullish from
 * @returns The non-nullish base type, or the original type if not a nullable union
 */
export const stripNullish = (type: IrType): IrType => {
  if (type.kind !== "unionType") return type;

  const nonNullish = type.types.filter(
    (t) =>
      !(
        t.kind === "primitiveType" &&
        (t.name === "null" || t.name === "undefined")
      )
  );

  // Single non-nullish type: return it (e.g., T | null → T)
  if (nonNullish.length === 1 && nonNullish[0]) {
    return nonNullish[0];
  }

  // Multi-type union or no non-nullish types: return original
  return type;
};

/**
 * Runtime-absence members in TypeScript unions.
 *
 * `void` is a type-level way of saying "the runtime value is undefined".
 * For C# emission we must treat `void` exactly like `undefined` / `null`
 * when deciding whether a union can be represented as a nullable type.
 */
export const isRuntimeNullishType = (type: IrType): boolean =>
  type.kind === "voidType" ||
  (type.kind === "primitiveType" &&
    (type.name === "null" || type.name === "undefined"));

/**
 * Split a union into runtime-nullish members and non-nullish members.
 *
 * Returns `undefined` for non-union types.
 */
export const splitRuntimeNullishUnionMembers = (
  type: IrType
):
  | {
      readonly hasRuntimeNullish: boolean;
      readonly nonNullishMembers: readonly IrType[];
    }
  | undefined => {
  if (type.kind !== "unionType") {
    return undefined;
  }

  const nonNullishMembers = type.types.filter((member) => {
    return !isRuntimeNullishType(member);
  });

  const canonicalUnion =
    nonNullishMembers.length <= 1
      ? undefined
      : normalizedUnionType(nonNullishMembers);
  const canonicalMembers =
    nonNullishMembers.length <= 1
      ? nonNullishMembers
      : canonicalUnion?.kind === "unionType"
        ? canonicalUnion.types
        : canonicalUnion
          ? [canonicalUnion]
          : nonNullishMembers;

  return {
    hasRuntimeNullish: nonNullishMembers.length !== type.types.length,
    nonNullishMembers: canonicalMembers,
  };
};

/**
 * True when a type is purely structural/type-only at runtime.
 *
 * Type assertions to these targets must be erased rather than emitted as
 * CLR casts, because there is no meaningful runtime conversion.
 */
export const isTypeOnlyStructuralTarget = (
  type: IrType,
  context: EmitterContext
): boolean => {
  const resolved = resolveTypeAlias(stripNullish(type), context);

  if (resolved.kind === "dictionaryType") {
    return true;
  }

  if (resolved.kind === "objectType") {
    return true;
  }

  if (resolved.kind !== "referenceType") {
    return false;
  }

  if (isCompilerGeneratedStructuralCarrierType(resolved)) {
    return true;
  }

  if (resolved.resolvedClrType) {
    return false;
  }

  const localInfo = resolveLocalTypeInfo(resolved, context)?.info;
  if (
    localInfo?.kind === "class" &&
    !isCompilerGeneratedStructuralCarrierType(resolved)
  ) {
    return false;
  }

  if (resolved.structuralMembers && resolved.structuralMembers.length > 0) {
    return true;
  }

  if (localInfo?.kind === "interface") {
    return true;
  }

  if (localInfo?.kind === "typeAlias") {
    return isTypeOnlyStructuralTarget(localInfo.type, context);
  }

  const inheritedProps = getAllPropertySignatures(resolved, context);
  return inheritedProps !== undefined && inheritedProps.length > 0;
};

const isCompilerGeneratedStructuralCarrierType = (
  type: Extract<IrType, { kind: "referenceType" }>
): boolean => {
  const simpleName = type.name.split(".").pop() ?? type.name;
  const clrSimpleName = type.resolvedClrType?.split(".").pop();
  const isCarrierName = (name: string | undefined): boolean =>
    !!name && (name.startsWith("__Anon_") || name.startsWith("__Rest_"));

  return isCarrierName(simpleName) || isCarrierName(clrSimpleName);
};

/**
 * Known CLR struct types that are value types.
 */
const CLR_VALUE_TYPES = new Set([
  "global::System.DateTime",
  "global::System.DateOnly",
  "global::System.TimeOnly",
  "global::System.TimeSpan",
  "global::System.Guid",
  "global::System.Decimal",
  "System.DateTime",
  "System.DateOnly",
  "System.TimeOnly",
  "System.TimeSpan",
  "System.Guid",
  "System.Decimal",
]);

/**
 * Check if a type is definitely a C# value type.
 *
 * Value types require `default` instead of `null` in object initializers
 * because `null` cannot be assigned to non-nullable value types.
 *
 * @param type - The type to check (should be non-nullish, use stripNullish first)
 * @returns true if the type is a known value type
 */
export const isDefinitelyValueType = (type: IrType): boolean => {
  // Strip nullish first if caller forgot
  const base = stripNullish(type);

  // Primitive value types (number → double, int → int, boolean → bool, char → char)
  if (base.kind === "primitiveType") {
    return ["number", "int", "boolean", "char"].includes(base.name);
  }

  if (base.kind === "tupleType") {
    return true;
  }

  // Known CLR struct types
  if (base.kind === "referenceType") {
    const clr = base.resolvedClrType;
    if (clr && CLR_VALUE_TYPES.has(clr)) {
      return true;
    }
  }

  return false;
};

/**
 * Resolve the element type of an array-like IR type after alias/nullish expansion.
 *
 * This is used by emission paths that need the element contract of rest parameters
 * or contextual array expressions even when the surface type is spelled through
 * local aliases or ReadonlyArray-style wrappers.
 */
export const getArrayLikeElementType = (
  type: IrType | undefined,
  context: EmitterContext
): IrType | undefined => {
  if (!type) return undefined;

  const resolved = resolveTypeAlias(stripNullish(type), context);
  if (resolved.kind === "arrayType") {
    return resolved.elementType;
  }
  if (resolved.kind === "tupleType") {
    if (resolved.elementTypes.length === 1) {
      return resolved.elementTypes[0];
    }
    return undefined;
  }
  if (
    resolved.kind === "referenceType" &&
    (resolved.name === "Array" ||
      resolved.name === "ReadonlyArray" ||
      resolved.name === "JSArray") &&
    resolved.typeArguments?.length === 1
  ) {
    return resolved.typeArguments[0];
  }

  return undefined;
};

/**
 * Resolve a type alias to its underlying type.
 *
 * If the type is a reference type that points to a type alias,
 * returns the underlying type with type arguments substituted.
 *
 * @param type - The type to resolve
 * @param context - Emitter context with localTypes map
 * @returns The resolved underlying type, or the original type if not an alias
 */
export const resolveTypeAlias = (
  type: IrType,
  context: EmitterContext
): IrType => {
  if (type.kind !== "referenceType") {
    return type;
  }

  const localTypeInfo = context.localTypes?.get(type.name);
  if (localTypeInfo?.kind === "typeAlias") {
    // Substitute type arguments if present
    if (type.typeArguments && type.typeArguments.length > 0) {
      return substituteTypeArgs(
        localTypeInfo.type,
        localTypeInfo.typeParameters,
        type.typeArguments
      );
    }

    return localTypeInfo.type;
  }

  const aliasIndex = context.options.typeAliasIndex;
  if (!aliasIndex) {
    return type;
  }

  const stripGlobalPrefix = (name: string): string =>
    name.startsWith("global::") ? name.slice("global::".length) : name;

  const name = stripGlobalPrefix(type.name);
  const aliasEntry = name.includes(".")
    ? aliasIndex.byFqn.get(name)
    : (() => {
        const matches = aliasIndex.byName.get(name) ?? [];

        if (matches.length === 0) return undefined;
        if (matches.length === 1) return matches[0];

        const candidates = matches
          .map((m) => m.fqn)
          .sort()
          .join(", ");
        throw new Error(
          `ICE: Ambiguous type alias reference '${name}'. Candidates: ${candidates}`
        );
      })();

  if (!aliasEntry) {
    return type;
  }

  if (type.typeArguments && type.typeArguments.length > 0) {
    return substituteTypeArgs(
      aliasEntry.type,
      aliasEntry.typeParameters,
      type.typeArguments
    );
  }

  return aliasEntry.type;
};

/**
 * Find the index of a union member that matches a predicate target type.
 *
 * Used for union narrowing: given `isUser(account)` where account is `Union<User, Admin>`,
 * find which member index (0 or 1) corresponds to User.
 *
 * @param unionType - The union type to search
 * @param target - The predicate target type to find
 * @param context - Emitter context
 * @returns The 0-based index of the matching member, or undefined if not found
 */
export const findUnionMemberIndex = (
  unionType: Extract<IrType, { kind: "unionType" }>,
  target: IrType,
  context: EmitterContext
): number | undefined => {
  const canonicalUnion = normalizedUnionType(unionType.types);
  const unionMembers =
    canonicalUnion.kind === "unionType"
      ? canonicalUnion.types
      : [canonicalUnion];
  const resolvedTarget = resolveTypeAlias(stripNullish(target), context);
  const matchesPredicateTarget = (
    member: IrType,
    candidate: IrType
  ): boolean => {
    const resolvedMember = resolveTypeAlias(stripNullish(member), context);
    const resolvedCandidate = resolveTypeAlias(
      stripNullish(candidate),
      context
    );

    if (
      resolvedMember.kind === "anyType" ||
      resolvedCandidate.kind === "anyType"
    ) {
      return true;
    }

    if (resolvedMember.kind === "literalType") {
      if (resolvedCandidate.kind === "literalType") {
        return resolvedMember.value === resolvedCandidate.value;
      }
      if (resolvedCandidate.kind === "primitiveType") {
        return (
          (typeof resolvedMember.value === "string" &&
            resolvedCandidate.name === "string") ||
          (typeof resolvedMember.value === "number" &&
            (resolvedCandidate.name === "number" ||
              resolvedCandidate.name === "int")) ||
          (typeof resolvedMember.value === "boolean" &&
            resolvedCandidate.name === "boolean")
        );
      }
    }

    if (resolvedMember.kind === "primitiveType") {
      if (resolvedCandidate.kind === "primitiveType") {
        return resolvedMember.name === resolvedCandidate.name;
      }
      if (resolvedCandidate.kind === "literalType") {
        return matchesPredicateTarget(resolvedCandidate, resolvedMember);
      }
    }

    if (
      resolvedMember.kind === "arrayType" &&
      resolvedCandidate.kind === "arrayType"
    ) {
      return matchesPredicateTarget(
        resolvedMember.elementType,
        resolvedCandidate.elementType
      );
    }

    if (
      resolvedMember.kind === "tupleType" &&
      resolvedCandidate.kind === "tupleType"
    ) {
      if (
        resolvedMember.elementTypes.length !==
        resolvedCandidate.elementTypes.length
      ) {
        return false;
      }
      return resolvedMember.elementTypes.every((elementType, index) => {
        const other = resolvedCandidate.elementTypes[index];
        return other ? matchesPredicateTarget(elementType, other) : false;
      });
    }

    if (
      resolvedMember.kind === "referenceType" &&
      resolvedCandidate.kind === "referenceType"
    ) {
      if (resolvedMember.name !== resolvedCandidate.name) {
        return false;
      }
      const memberArgs = resolvedMember.typeArguments ?? [];
      const candidateArgs = resolvedCandidate.typeArguments ?? [];
      if (memberArgs.length !== candidateArgs.length) {
        return memberArgs.length === 0 || candidateArgs.length === 0;
      }
      return memberArgs.every((memberArg, index) => {
        const candidateArg = candidateArgs[index];
        return candidateArg
          ? matchesPredicateTarget(memberArg, candidateArg)
          : false;
      });
    }

    return false;
  };

  for (let i = 0; i < unionMembers.length; i++) {
    const m = unionMembers[i];
    if (m && matchesPredicateTarget(m, resolvedTarget)) {
      return i;
    }
  }
  return undefined;
};

export const unionMemberMatchesTarget = (
  member: IrType,
  candidate: IrType,
  context: EmitterContext
): boolean => {
  const resolvedCandidate = resolveTypeAlias(stripNullish(candidate), context);
  const wrapper = {
    kind: "unionType",
    types: [member],
  } as const satisfies Extract<IrType, { kind: "unionType" }>;
  return findUnionMemberIndex(wrapper, resolvedCandidate, context) === 0;
};
