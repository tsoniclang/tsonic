import { IrInterfaceMember, IrType, stableIrTypeKey } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import { resolveLocalTypeInfo, resolveTypeAlias } from "./type-resolution.js";
import { UNKNOWN_TYPE } from "./runtime-union-shared.js";

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

const toRuntimeOrderingTypeKey = (type: IrType): string =>
  stableIrTypeKey(toRuntimeOrderingComparableType(type));

const buildRuntimeOrderingMemberKey = (member: IrInterfaceMember): string => {
  if (member.kind === "propertySignature") {
    return `prop:${member.name}:${member.isOptional ? "opt" : "req"}:${member.isReadonly ? "ro" : "rw"}:${toRuntimeOrderingTypeKey(member.type)}`;
  }

  const parameters = member.parameters.map(
    (parameter: (typeof member.parameters)[number]) =>
      toRuntimeOrderingTypeKey(parameter.type ?? UNKNOWN_TYPE)
  );
  return `method:${member.name}:${parameters.join(",")}:${member.parameters.length}:${toRuntimeOrderingTypeKey(member.returnType ?? UNKNOWN_TYPE)}`;
};

const buildRuntimeOrderingStructuralKey = (
  type: IrType,
  context: EmitterContext
): string | undefined => {
  const resolved = resolveTypeAlias(type, context);

  if (resolved.kind === "objectType") {
    return resolved.members
      .map((member) => buildRuntimeOrderingMemberKey(member))
      .sort()
      .join("|");
  }

  if (resolved.kind !== "referenceType") {
    return undefined;
  }

  if (resolved.structuralMembers && resolved.structuralMembers.length > 0) {
    return resolved.structuralMembers
      .map((member) => buildRuntimeOrderingMemberKey(member))
      .sort()
      .join("|");
  }

  const localInfo = resolveLocalTypeInfo(resolved, context)?.info;
  if (!localInfo) {
    return undefined;
  }

  if (localInfo.kind === "typeAlias" && localInfo.type.kind === "objectType") {
    return localInfo.type.members
      .map((member) => buildRuntimeOrderingMemberKey(member))
      .sort()
      .join("|");
  }

  if (localInfo.kind !== "class" && localInfo.kind !== "interface") {
    return undefined;
  }

  const members = localInfo.members
    .flatMap<Extract<IrType, { kind: "objectType" }>["members"][number]>(
      (member) => {
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
      }
    )
    .map((member) => buildRuntimeOrderingMemberKey(member))
    .sort();

  return members.length > 0 ? members.join("|") : undefined;
};

export const getRuntimeUnionMemberSortKey = (
  type: IrType,
  context: EmitterContext
): string =>
  buildRuntimeOrderingStructuralKey(type, context) ??
  toRuntimeOrderingTypeKey(resolveTypeAlias(type, context));
