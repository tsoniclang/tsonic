/**
 * Property and member lookup through type hierarchies, binding registries, and type-member indices.
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
import { resolveTypeAlias, stripNullish } from "./nullish-value-helpers.js";
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

export const resolveLocalTypeInfoWithoutBindings = (
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

/**
 * Recursive interface property collection.
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
