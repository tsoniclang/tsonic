import type { IrInterfaceMember, IrType } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import { resolveLocalTypeInfo, resolveTypeAlias } from "./type-resolution.js";
import { UNKNOWN_TYPE } from "./runtime-union-shared.js";
import { tryContextualTypeIdentityKey } from "./deterministic-type-keys.js";

const toRuntimeOrderingComparableType = (type: IrType): IrType => {
  if (type.kind === "literalType") {
    if (typeof type.value === "string") {
      return { kind: "primitiveType", name: "string" };
    }
    if (typeof type.value === "number") {
      return { kind: "primitiveType", name: "number" };
    }
    if (typeof type.value === "boolean") {
      return { kind: "primitiveType", name: "boolean" };
    }
  }

  if (type.kind === "unionType") {
    return {
      ...type,
      types: type.types.map((member) =>
        toRuntimeOrderingComparableType(member)
      ),
    };
  }

  return type;
};

const toRuntimeOrderingTypeKey = (
  type: IrType,
  context: EmitterContext
): string | undefined =>
  tryContextualTypeIdentityKey(toRuntimeOrderingComparableType(type), context);

const buildRuntimeOrderingMemberKey = (
  member: IrInterfaceMember,
  context: EmitterContext
): string | undefined => {
  if (member.kind === "propertySignature") {
    const typeKey = toRuntimeOrderingTypeKey(member.type, context);
    return typeKey
      ? `prop:${member.name}:${member.isOptional ? "opt" : "req"}:${
          member.isReadonly ? "ro" : "rw"
        }:${typeKey}`
      : undefined;
  }

  const parameters: string[] = [];
  for (const parameter of member.parameters) {
    const parameterKey = toRuntimeOrderingTypeKey(
      parameter.type ?? UNKNOWN_TYPE,
      context
    );
    if (!parameterKey) {
      return undefined;
    }
    parameters.push(parameterKey);
  }
  const returnKey = toRuntimeOrderingTypeKey(
    member.returnType ?? UNKNOWN_TYPE,
    context
  );
  return returnKey
    ? `method:${member.name}:${parameters.join(",")}:${member.parameters.length}:${returnKey}`
    : undefined;
};

const buildRuntimeOrderingMemberSignature = (
  members: readonly IrInterfaceMember[],
  context: EmitterContext
): string | undefined => {
  const keys: string[] = [];
  for (const member of members) {
    const key = buildRuntimeOrderingMemberKey(member, context);
    if (!key) {
      return undefined;
    }
    keys.push(key);
  }

  return keys.sort().join("|");
};

const buildRuntimeOrderingStructuralKey = (
  type: IrType,
  context: EmitterContext
): string | undefined => {
  const resolved = resolveTypeAlias(type, context);

  if (resolved.kind === "objectType") {
    return buildRuntimeOrderingMemberSignature(resolved.members, context);
  }

  if (resolved.kind !== "referenceType") {
    return undefined;
  }

  if (resolved.structuralMembers && resolved.structuralMembers.length > 0) {
    return buildRuntimeOrderingMemberSignature(
      resolved.structuralMembers,
      context
    );
  }

  const localInfo = resolveLocalTypeInfo(resolved, context)?.info;
  if (!localInfo) {
    return undefined;
  }

  if (localInfo.kind === "typeAlias" && localInfo.type.kind === "objectType") {
    return buildRuntimeOrderingMemberSignature(localInfo.type.members, context);
  }

  if (localInfo.kind !== "class" && localInfo.kind !== "interface") {
    return undefined;
  }

  const members = localInfo.members.flatMap<
    Extract<IrType, { kind: "objectType" }>["members"][number]
  >((member) => {
    if (member.kind === "propertyDeclaration" && member.type) {
      return [
        {
          kind: "propertySignature" as const,
          name: member.name,
          type: member.type,
          isOptional: false,
          isReadonly: member.isReadonly ?? false,
        },
      ];
    }
    if (member.kind === "propertySignature") {
      return [member];
    }
    if (member.kind === "methodDeclaration") {
      return [
        {
          kind: "methodSignature" as const,
          name: member.name,
          parameters: member.parameters,
          returnType: member.returnType ?? UNKNOWN_TYPE,
        },
      ];
    }
    if (member.kind === "methodSignature") {
      return [member];
    }
    return [];
  });

  return members.length > 0
    ? buildRuntimeOrderingMemberSignature(members, context)
    : undefined;
};

export const getRuntimeUnionMemberSortKey = (
  type: IrType,
  context: EmitterContext
): string =>
  buildRuntimeOrderingStructuralKey(type, context) ??
  toRuntimeOrderingTypeKey(resolveTypeAlias(type, context), context) ??
  "opaque";
