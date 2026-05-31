import type { IrInterfaceMember, IrType } from "@tsonic/frontend";
import type { EmitterContext, LocalTypeInfo } from "../../types.js";
import { structuralInterfaceContractKey } from "./local-types.js";
import { stripNullish } from "./nullish-value-helpers.js";
import { resolveLocalTypeInfo } from "./property-lookup-resolution.js";
import { substituteTypeArgs } from "./type-substitution.js";

export type EffectiveInterfaceMember = {
  readonly member: IrInterfaceMember;
  readonly declaringType?: Extract<IrType, { kind: "referenceType" }>;
};

const interfaceMemberKey = (member: IrInterfaceMember): string =>
  `${member.kind}:${member.name}`;

const specializeInterfaceMember = (
  member: IrInterfaceMember,
  typeParameterNames: readonly string[],
  typeArguments: readonly IrType[]
): IrInterfaceMember => {
  if (typeParameterNames.length === 0 || typeArguments.length === 0) {
    return member;
  }

  if (member.kind === "propertySignature") {
    return {
      ...member,
      type: substituteTypeArgs(member.type, typeParameterNames, typeArguments),
    };
  }

  return {
    ...member,
    parameters: member.parameters.map((parameter) =>
      parameter.type
        ? {
            ...parameter,
            type: substituteTypeArgs(
              parameter.type,
              typeParameterNames,
              typeArguments
            ),
          }
        : parameter
    ),
    returnType: member.returnType
      ? substituteTypeArgs(member.returnType, typeParameterNames, typeArguments)
      : undefined,
  };
};

const localInterfaceInfoEmitsAsNativeInner = (
  localInfo: LocalTypeInfo | undefined,
  namespace: string | undefined,
  name: string | undefined,
  context: EmitterContext,
  visited: Set<string>
): boolean => {
  if (!localInfo || localInfo.kind !== "interface") {
    return false;
  }

  const key =
    namespace !== undefined && name !== undefined
      ? structuralInterfaceContractKey(namespace, name)
      : undefined;
  if (key && visited.has(key)) {
    return false;
  }
  if (key) {
    visited.add(key);
  }

  if (localInfo.members.some((member) => member.kind === "methodSignature")) {
    return true;
  }

  if (
    namespace !== undefined &&
    name !== undefined &&
    context.options.structuralInterfaceContracts?.has(
      structuralInterfaceContractKey(namespace, name)
    ) === true
  ) {
    return true;
  }

  if (localInfo.extends.length > 1) {
    return true;
  }

  for (const extended of localInfo.extends) {
    if (extended.kind !== "referenceType") {
      continue;
    }
    const resolved = resolveLocalTypeInfo(extended, context);
    if (
      resolved?.info.kind === "interface" &&
      localInterfaceInfoEmitsAsNativeInner(
        resolved.info,
        resolved.namespace,
        resolved.name,
        context,
        visited
      )
    ) {
      return true;
    }
  }

  return false;
};

export const localInterfaceInfoEmitsAsNative = (
  localInfo: LocalTypeInfo | undefined,
  namespace: string | undefined,
  name: string | undefined,
  context: EmitterContext
): boolean =>
  localInterfaceInfoEmitsAsNativeInner(
    localInfo,
    namespace,
    name,
    context,
    new Set<string>()
  );

export const referenceTypeEmitsAsNativeInterface = (
  type: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!type) {
    return false;
  }

  const stripped = stripNullish(type);
  if (stripped.kind !== "referenceType") {
    return false;
  }

  const resolvedLocal = resolveLocalTypeInfo(stripped, context);
  return localInterfaceInfoEmitsAsNativeInner(
    resolvedLocal?.info,
    resolvedLocal?.namespace,
    resolvedLocal?.name,
    context,
    new Set<string>()
  );
};

export const collectEffectiveInterfaceMemberEntries = (
  info: Extract<LocalTypeInfo, { kind: "interface" }>,
  context: EmitterContext,
  sourceRef?: Extract<IrType, { kind: "referenceType" }>,
  visited: WeakSet<object> = new WeakSet<object>()
): readonly EffectiveInterfaceMember[] => {
  if (visited.has(info)) {
    return [];
  }
  visited.add(info);

  const typeArguments = sourceRef?.typeArguments ?? [];
  const membersByKey = new Map<string, EffectiveInterfaceMember>();
  const setMember = (entry: EffectiveInterfaceMember): void => {
    membersByKey.set(interfaceMemberKey(entry.member), entry);
  };

  for (const extended of info.extends) {
    if (extended.kind !== "referenceType") {
      continue;
    }

    const specializedExtended =
      typeArguments.length > 0
        ? substituteTypeArgs(extended, info.typeParameters, typeArguments)
        : extended;
    if (specializedExtended.kind !== "referenceType") {
      continue;
    }

    const resolved = resolveLocalTypeInfo(specializedExtended, context);
    if (!resolved || resolved.info.kind !== "interface") {
      continue;
    }

    for (const inherited of collectEffectiveInterfaceMemberEntries(
      resolved.info,
      context,
      specializedExtended,
      visited
    )) {
      setMember(inherited);
    }
  }

  for (const member of info.members) {
    if (membersByKey.has(interfaceMemberKey(member))) {
      continue;
    }
    setMember({
      member: specializeInterfaceMember(
        member,
        info.typeParameters,
        typeArguments
      ),
      declaringType: sourceRef,
    });
  }

  return [...membersByKey.values()];
};

export const collectEffectiveInterfaceMembers = (
  info: Extract<LocalTypeInfo, { kind: "interface" }>,
  context: EmitterContext,
  sourceRef?: Extract<IrType, { kind: "referenceType" }>
): readonly IrInterfaceMember[] =>
  collectEffectiveInterfaceMemberEntries(info, context, sourceRef).map(
    (entry) => entry.member
  );
