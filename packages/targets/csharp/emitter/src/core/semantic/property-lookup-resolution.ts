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
import {
  canUseLocalTypeLookupCandidate,
  getLocalTypeLookupCandidates,
} from "./local-type-lookup.js";
import { getIdentifierTypeName } from "../format/backend-ast/utils.js";

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
  const imported = resolveImportedLocalTypeInfo(ref, context);
  if (imported) {
    return imported;
  }

  const currentModuleBareLocal = resolveCurrentModuleBareLocalTypeInfo(
    ref,
    context
  );
  if (currentModuleBareLocal) {
    return currentModuleBareLocal;
  }

  const scoped = resolveScopedLocalTypeInfo(ref, context);
  if (scoped || hasAuthoritativeScopedIdentity(ref)) {
    return scoped;
  }

  const lookupCandidates = getLocalTypeLookupCandidates(ref.name);

  for (const candidate of lookupCandidates) {
    const localHit = context.localTypes?.get(candidate.name);
    if (localHit && canUseLocalTypeLookupCandidate(localHit, candidate)) {
      return {
        info: localHit,
        namespace: context.moduleNamespace ?? context.options.rootNamespace,
        name: candidate.name,
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
  for (const candidate of lookupCandidates) {
    for (const m of moduleMap.values()) {
      const info = m.localTypes?.get(candidate.name);
      if (!info) continue;
      if (!canUseLocalTypeLookupCandidate(info, candidate)) continue;
      matches.push({ namespace: m.namespace, info, name: candidate.name });
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

  const rawFqn = getScopedReferenceIdentityCandidates(ref)[0];
  const fqn = rawFqn?.startsWith("global::")
    ? rawFqn.slice("global::".length)
    : rawFqn;
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

    const canonicalNamespace = namespace.toLocaleLowerCase("en-US");
    const canonicalScoped = matches.filter(
      (m) => m.namespace.toLocaleLowerCase("en-US") === canonicalNamespace
    );
    if (canonicalScoped.length === 1) {
      const scopedMatch = canonicalScoped[0];
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

const normalizeScopedTypeIdentity = (
  value: string | undefined
): string | undefined => {
  if (!value || !value.includes(".")) {
    return undefined;
  }
  return value.startsWith("global::") ? value.slice("global::".length) : value;
};

const sourceTypeIdScopedIdentity = (
  ref: Extract<IrType, { kind: "referenceType" }>
): string | undefined => {
  if (ref.typeId?.origin !== "source") {
    return undefined;
  }

  const separatorIndex = ref.typeId.stableId.indexOf(":");
  const stableQualifiedName =
    separatorIndex >= 0
      ? ref.typeId.stableId.slice(separatorIndex + 1)
      : undefined;
  return normalizeScopedTypeIdentity(stableQualifiedName);
};

const getScopedReferenceIdentityCandidates = (
  ref: Extract<IrType, { kind: "referenceType" }>
): readonly string[] => {
  const values =
    ref.typeId?.origin === "source"
      ? [
          sourceTypeIdScopedIdentity(ref),
          ref.typeId.sourceName.includes(".")
            ? ref.typeId.sourceName
            : undefined,
          ref.name.includes(".") ? ref.name : undefined,
          ref.typeId.externalName,
          ref.externalQualifiedName,
        ]
      : [
          ref.externalQualifiedName,
          ref.name.includes(".") ? ref.name : undefined,
          ref.typeId?.externalName,
        ];

  const candidates: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const normalized = normalizeScopedTypeIdentity(value);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    candidates.push(normalized);
  }
  return candidates;
};

const hasAuthoritativeScopedIdentity = (
  ref: Extract<IrType, { kind: "referenceType" }>
): boolean => getScopedReferenceIdentityCandidates(ref).length > 0;

const resolveCurrentModuleBareLocalTypeInfo = (
  ref: Extract<IrType, { kind: "referenceType" }>,
  context: EmitterContext
):
  | {
      readonly info: LocalTypeInfo;
      readonly namespace: string;
      readonly name: string;
    }
  | undefined => {
  if (ref.name.includes(".")) {
    return undefined;
  }

  const localHit = context.localTypes?.get(ref.name);
  if (!localHit) {
    return undefined;
  }

  return {
    info: localHit,
    namespace: context.moduleNamespace ?? context.options.rootNamespace,
    name: ref.name,
  };
};

const collectReferenceMemberNames = (
  ref: Extract<IrType, { kind: "referenceType" }>
): ReadonlySet<string> | undefined => {
  if (!ref.structuralMembers || ref.structuralMembers.length === 0) {
    return undefined;
  }
  return new Set(ref.structuralMembers.map((member) => member.name));
};

const collectLocalTypeMemberNames = (
  info: LocalTypeInfo
): ReadonlySet<string> | undefined => {
  if (info.kind === "interface" || info.kind === "class") {
    return new Set(
      info.members.flatMap((member) =>
        "name" in member && typeof member.name === "string"
          ? [member.name]
          : []
      )
    );
  }
  if (info.kind === "typeAlias" && info.type.kind === "objectType") {
    return new Set(info.type.members.map((member) => member.name));
  }
  return undefined;
};

const localTypeShapeIsCarriedByReference = (
  info: LocalTypeInfo,
  ref: Extract<IrType, { kind: "referenceType" }>
): boolean => {
  const referenceMembers = collectReferenceMemberNames(ref);
  const localMembers = collectLocalTypeMemberNames(info);
  if (!referenceMembers || !localMembers || localMembers.size === 0) {
    return false;
  }
  for (const memberName of localMembers) {
    if (!referenceMembers.has(memberName)) {
      return false;
    }
  }
  return true;
};

const leafName = (value: string | undefined): string | undefined => {
  if (!value || value.length === 0) {
    return undefined;
  }
  const normalized = value.startsWith("global::")
    ? value.slice("global::".length)
    : value;
  return normalized.split(".").pop() ?? normalized;
};

const getReferenceLeafNameCandidates = (
  ref: Extract<IrType, { kind: "referenceType" }>
): readonly string[] => {
  const candidates = new Set<string>();
  const add = (value: string | undefined): void => {
    const leaf = leafName(value);
    if (leaf) {
      candidates.add(leaf);
    }
  };

  add(ref.name);
  add(ref.externalQualifiedName);
  add(ref.typeId?.externalName);
  add(ref.typeId?.sourceName);

  return [...candidates];
};

const collectShapeMatchedLocalTypeCandidates = (
  ref: Extract<IrType, { kind: "referenceType" }>,
  context: EmitterContext
): readonly {
  readonly info: LocalTypeInfo;
  readonly namespace: string;
  readonly name: string;
}[] => {
  if (!collectReferenceMemberNames(ref)) {
    return [];
  }

  const currentNamespace =
    context.moduleNamespace ?? context.options.rootNamespace;
  const matches: {
    readonly info: LocalTypeInfo;
    readonly namespace: string;
    readonly name: string;
  }[] = [];
  const seen = new Set<string>();
  const addMatch = (
    namespace: string,
    name: string,
    info: LocalTypeInfo
  ): void => {
    const key = `${namespace}::${name}`;
    if (seen.has(key) || !localTypeShapeIsCarriedByReference(info, ref)) {
      return;
    }
    seen.add(key);
    matches.push({ namespace, name, info });
  };

  for (const leaf of getReferenceLeafNameCandidates(ref)) {
    for (const candidate of getLocalTypeLookupCandidates(leaf)) {
      const localHit = context.localTypes?.get(candidate.name);
      if (localHit && canUseLocalTypeLookupCandidate(localHit, candidate)) {
        addMatch(currentNamespace, candidate.name, localHit);
      }

      for (const moduleInfo of context.options.moduleMap?.values() ?? []) {
        const moduleHit = moduleInfo.localTypes?.get(candidate.name);
        if (!moduleHit || !canUseLocalTypeLookupCandidate(moduleHit, candidate)) {
          continue;
        }
        addMatch(moduleInfo.namespace, candidate.name, moduleHit);
      }
    }
  }

  return matches;
};

const resolveScopedLocalTypeInfo = (
  ref: Extract<IrType, { kind: "referenceType" }>,
  context: EmitterContext
):
  | {
      readonly info: LocalTypeInfo;
      readonly namespace: string;
      readonly name: string;
    }
  | undefined => {
  const moduleMap = context.options.moduleMap;
  const currentNamespace = context.moduleNamespace ?? context.options.rootNamespace;
  const canonicalCurrentNamespace =
    currentNamespace.toLocaleLowerCase("en-US");
  const matches: {
    readonly info: LocalTypeInfo;
    readonly namespace: string;
    readonly name: string;
  }[] = [];

  for (const scopedIdentity of getScopedReferenceIdentityCandidates(ref)) {
    const namespace = scopedIdentity.slice(0, scopedIdentity.lastIndexOf("."));
    const name = scopedIdentity.slice(scopedIdentity.lastIndexOf(".") + 1);
    if (!namespace || !name) {
      continue;
    }
    const canonicalNamespace = namespace.toLocaleLowerCase("en-US");

    if (canonicalNamespace === canonicalCurrentNamespace) {
      const localHit = context.localTypes?.get(name);
      if (localHit) {
        matches.push({ info: localHit, namespace: currentNamespace, name });
      }
    }

    if (!moduleMap) {
      continue;
    }

    for (const moduleInfo of moduleMap.values()) {
      if (
        moduleInfo.namespace.toLocaleLowerCase("en-US") !== canonicalNamespace
      ) {
        continue;
      }
      const info = moduleInfo.localTypes?.get(name);
      if (info) {
        matches.push({ info, namespace: moduleInfo.namespace, name });
      }
    }
  }

  const scopedShapeMatch = matches.find((match) =>
    localTypeShapeIsCarriedByReference(match.info, ref)
  );
  if (scopedShapeMatch) {
    return scopedShapeMatch;
  }

  const shapeMatches = collectShapeMatchedLocalTypeCandidates(ref, context);
  if (shapeMatches.length === 1) {
    return shapeMatches[0];
  }

  return matches[0] ?? undefined;
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
  add(ref.externalQualifiedName);
  add(ref.typeId?.sourceName);
  add(ref.typeId?.externalName);

  for (const value of [...candidates]) {
    if (!value.includes(".")) continue;
    add(value.split(".").pop());
  }

  return [...candidates];
};

const resolveQualifiedLocalTypeInfo = (
  qualifiedName: string,
  context: EmitterContext
):
  | {
      readonly info: LocalTypeInfo;
      readonly namespace: string;
      readonly name: string;
    }
  | undefined => {
  const normalized = qualifiedName.startsWith("global::")
    ? qualifiedName.slice("global::".length)
    : qualifiedName;
  if (!normalized.includes(".")) {
    return undefined;
  }

  const namespace = normalized.slice(0, normalized.lastIndexOf("."));
  const name = normalized.slice(normalized.lastIndexOf(".") + 1);
  if (!namespace || !name) {
    return undefined;
  }

  const currentNamespace =
    context.moduleNamespace ?? context.options.rootNamespace;
  if (
    namespace.toLocaleLowerCase("en-US") ===
    currentNamespace.toLocaleLowerCase("en-US")
  ) {
    const localHit = context.localTypes?.get(name);
    if (localHit) {
      return { info: localHit, namespace: currentNamespace, name };
    }
  }

  for (const moduleInfo of context.options.moduleMap?.values() ?? []) {
    if (
      moduleInfo.namespace.toLocaleLowerCase("en-US") !==
      namespace.toLocaleLowerCase("en-US")
    ) {
      continue;
    }
    const info = moduleInfo.localTypes?.get(name);
    if (info) {
      return { info, namespace: moduleInfo.namespace, name };
    }
  }

  return undefined;
};

const resolveImportedLocalTypeInfo = (
  ref: Extract<IrType, { kind: "referenceType" }>,
  context: EmitterContext
):
  | {
      readonly info: LocalTypeInfo;
      readonly namespace: string;
      readonly name: string;
    }
  | undefined => {
  if (ref.name.includes(".")) {
    return undefined;
  }

  const binding = context.importBindings?.get(ref.name);
  if (binding?.kind !== "type") {
    return undefined;
  }

  const importedTypeName = getIdentifierTypeName(binding.typeAst);
  return importedTypeName
    ? resolveQualifiedLocalTypeInfo(importedTypeName, context)
    : undefined;
};

const getBindingScopedReference = (
  binding: FrontendTypeBinding,
  ref: Extract<IrType, { kind: "referenceType" }>
): Extract<IrType, { kind: "referenceType" }> => ({
  ...ref,
  name: binding.alias,
  externalQualifiedName: binding.name,
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
    const cycleKey = type.externalQualifiedName ?? type.name;
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

  if (type.kind === "intersectionType") {
    for (const member of type.types) {
      const propertyType = resolvePropertyType(
        member,
        propertyName,
        context,
        visitedTypes
      );
      if (propertyType) {
        return propertyType;
      }
    }
    return undefined;
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
