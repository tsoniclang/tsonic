import type { IrInterfaceMember, IrType } from "@tsonic/frontend";
import type { EmitterContext, LocalTypeInfo } from "../../types.js";
import {
  getArrayLikeElementType,
  isRuntimeNullishType,
  resolveTypeAlias,
  stripNullish,
} from "./nullish-value-helpers.js";
import { resolveLocalTypeInfo } from "./property-lookup-resolution.js";
import { substituteTypeArgs } from "./type-substitution.js";

type ArrayType = Extract<IrType, { kind: "arrayType" }>;

const withOptionalUndefined = (type: IrType, isOptional: boolean): IrType => {
  if (!isOptional) return type;
  if (
    type.kind === "unionType" &&
    type.types.some((member) => isRuntimeNullishType(member))
  ) {
    return type;
  }
  return {
    kind: "unionType",
    types: [type, { kind: "primitiveType", name: "undefined" }],
  };
};

const propertyFromMembers = (
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

const memberListIsPropertyOnly = (
  members: readonly IrInterfaceMember[]
): boolean => members.every((member) => member.kind === "propertySignature");

const directArrayCarrier = (
  type: IrType,
  context: EmitterContext
): ArrayType | undefined => {
  const elementType = getArrayLikeElementType(type, context);
  return elementType
    ? { kind: "arrayType", elementType, origin: "explicit" }
    : undefined;
};

export const resolveArrayOverlayCarrierType = (
  type: IrType | undefined,
  context: EmitterContext,
  visited: ReadonlySet<string> = new Set<string>()
): ArrayType | undefined => {
  if (!type) return undefined;

  const resolved = resolveTypeAlias(stripNullish(type), context);
  const direct = directArrayCarrier(resolved, context);
  if (direct) return direct;

  if (resolved.kind === "intersectionType") {
    let carrier: ArrayType | undefined;
    for (const member of resolved.types) {
      const memberCarrier = resolveArrayOverlayCarrierType(
        member,
        context,
        visited
      );
      if (!memberCarrier) continue;
      if (carrier) return undefined;
      carrier = memberCarrier;
    }
    return carrier;
  }

  if (resolved.kind !== "referenceType") {
    return undefined;
  }

  const resolvedLocal = resolveLocalTypeInfo(resolved, context);
  if (!resolvedLocal || resolvedLocal.info.kind !== "interface") {
    return undefined;
  }

  const key = `${resolvedLocal.namespace}:${resolvedLocal.name}`;
  if (visited.has(key)) {
    return undefined;
  }
  const nextVisited = new Set(visited);
  nextVisited.add(key);

  const info = resolvedLocal.info;
  if (!memberListIsPropertyOnly(info.members)) {
    return undefined;
  }

  let carrier: ArrayType | undefined;
  for (const extended of info.extends) {
    const specialized =
      resolved.typeArguments && resolved.typeArguments.length > 0
        ? substituteTypeArgs(
            extended,
            info.typeParameters,
            resolved.typeArguments
          )
        : extended;
    const extendedCarrier = resolveArrayOverlayCarrierType(
      specialized,
      context,
      nextVisited
    );
    if (!extendedCarrier) continue;
    if (carrier) return undefined;
    carrier = extendedCarrier;
  }

  return carrier;
};

const resolvePropertyFromReference = (
  type: Extract<IrType, { kind: "referenceType" }>,
  propertyName: string,
  context: EmitterContext,
  visited: ReadonlySet<string>
): IrType | undefined => {
  const resolvedLocal = resolveLocalTypeInfo(type, context);
  if (!resolvedLocal || resolvedLocal.info.kind !== "interface") {
    return type.structuralMembers?.length
      ? propertyFromMembers(type.structuralMembers, propertyName)
      : undefined;
  }

  const key = `${resolvedLocal.namespace}:${resolvedLocal.name}`;
  if (visited.has(key)) {
    return undefined;
  }
  const nextVisited = new Set(visited);
  nextVisited.add(key);

  const info = resolvedLocal.info;
  const ownProperty = propertyFromMembers(info.members, propertyName);
  if (ownProperty) {
    return type.typeArguments && type.typeArguments.length > 0
      ? substituteTypeArgs(ownProperty, info.typeParameters, type.typeArguments)
      : ownProperty;
  }

  for (const extended of info.extends) {
    const specialized =
      type.typeArguments && type.typeArguments.length > 0
        ? substituteTypeArgs(extended, info.typeParameters, type.typeArguments)
        : extended;
    if (resolveArrayOverlayCarrierType(specialized, context, nextVisited)) {
      continue;
    }
    const inherited = resolveArrayOverlayPropertyType(
      specialized,
      propertyName,
      context,
      nextVisited
    );
    if (inherited) return inherited;
  }

  return undefined;
};

export const resolveArrayOverlayPropertyType = (
  type: IrType | undefined,
  propertyName: string,
  context: EmitterContext,
  visited: ReadonlySet<string> = new Set<string>()
): IrType | undefined => {
  if (!type) return undefined;

  const resolved = resolveTypeAlias(stripNullish(type), context);
  if (resolved.kind === "objectType") {
    return propertyFromMembers(resolved.members, propertyName);
  }

  if (resolved.kind === "intersectionType") {
    for (const member of resolved.types) {
      if (resolveArrayOverlayCarrierType(member, context, visited)) {
        continue;
      }
      const propertyType = resolveArrayOverlayPropertyType(
        member,
        propertyName,
        context,
        visited
      );
      if (propertyType) return propertyType;
    }
    return undefined;
  }

  if (resolved.kind === "referenceType") {
    return resolvePropertyFromReference(
      resolved,
      propertyName,
      context,
      visited
    );
  }

  return undefined;
};

export const localInterfaceInfoIsArrayOverlay = (
  info: LocalTypeInfo | undefined,
  context: EmitterContext
): boolean => {
  if (
    !info ||
    info.kind !== "interface" ||
    !memberListIsPropertyOnly(info.members)
  ) {
    return false;
  }

  let hasCarrier = false;
  for (const extended of info.extends) {
    const carrier = resolveArrayOverlayCarrierType(extended, context);
    if (carrier) {
      if (hasCarrier) return false;
      hasCarrier = true;
    }
  }

  return hasCarrier;
};
