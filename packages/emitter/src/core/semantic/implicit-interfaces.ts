import {
  getIrMemberPublicName,
  substituteIrType,
  type IrClassMember,
  type IrInterfaceMember,
  type IrType,
} from "@tsonic/frontend";
import type { EmitterContext, LocalTypeInfo } from "../../types.js";
import { resolveLocalTypeInfo } from "./type-resolution.js";
import { substituteTypeArgs } from "./type-substitution.js";
import { getClrIdentityKey } from "./clr-type-identity.js";
import { areIrTypesEquivalent } from "./type-equivalence.js";

type InterfaceCandidate = {
  readonly namespace: string;
  readonly name: string;
  readonly info: Extract<LocalTypeInfo, { kind: "interface" }>;
};

export type CompatibleInterfacePropertyMatch = {
  readonly interfaceMember: Extract<
    IrInterfaceMember,
    { kind: "propertySignature" }
  >;
  readonly classMember: Extract<IrClassMember, { kind: "propertyDeclaration" }>;
};

export type CompatibleInterfaceMethodMatch = {
  readonly interfaceMember: Extract<
    IrInterfaceMember,
    { kind: "methodSignature" }
  >;
  readonly classMember: Extract<IrClassMember, { kind: "methodDeclaration" }>;
};

export type CompatibleInterfaceMatch = {
  readonly namespace: string;
  readonly name: string;
  readonly ref: Extract<IrType, { kind: "referenceType" }>;
  readonly info: Extract<LocalTypeInfo, { kind: "interface" }>;
  readonly isExplicit: boolean;
  readonly propertyMatches: readonly CompatibleInterfacePropertyMatch[];
  readonly methodMatches: readonly CompatibleInterfaceMethodMatch[];
};

const VOID_TYPE: IrType = { kind: "voidType" };

const getReferenceLeafName = (
  ref: Extract<IrType, { kind: "referenceType" }>
): string => {
  if (ref.typeId?.tsName) {
    const leaf = ref.typeId.tsName.split(".").pop();
    if (leaf) return leaf;
  }
  if (ref.resolvedClrType) {
    const leaf = ref.resolvedClrType.split(".").pop();
    if (leaf) return leaf;
  }
  return ref.name.split(".").pop() ?? ref.name;
};

const buildCanonicalInterfaceRef = (
  namespace: string,
  name: string,
  sourceRef?: Extract<IrType, { kind: "referenceType" }>
): Extract<IrType, { kind: "referenceType" }> => ({
  ...sourceRef,
  kind: "referenceType",
  name,
  resolvedClrType:
    sourceRef?.typeId?.clrName ??
    (sourceRef?.resolvedClrType &&
    getClrIdentityKey(
      sourceRef.resolvedClrType,
      sourceRef.typeArguments?.length ?? 0
    ) !==
      getClrIdentityKey(sourceRef.name, sourceRef.typeArguments?.length ?? 0)
      ? sourceRef.resolvedClrType
      : undefined) ??
    `${namespace}.${name}`,
});

const isInterfaceMarkerProperty = (
  member: IrInterfaceMember
): member is Extract<IrInterfaceMember, { kind: "propertySignature" }> =>
  member.kind === "propertySignature" &&
  member.name.startsWith("__tsonic_iface_");

const specializeInterfaceMember = (
  member: IrInterfaceMember,
  typeParameterNames: readonly string[],
  typeArguments: readonly IrType[]
): IrInterfaceMember => {
  if (member.kind === "propertySignature") {
    return {
      ...member,
      type: substituteTypeArgs(member.type, typeParameterNames, typeArguments),
    };
  }

  return {
    ...member,
    parameters: member.parameters.map((parameter) => ({
      ...parameter,
      type: parameter.type
        ? substituteTypeArgs(parameter.type, typeParameterNames, typeArguments)
        : undefined,
    })),
    returnType: member.returnType
      ? substituteTypeArgs(member.returnType, typeParameterNames, typeArguments)
      : undefined,
  };
};

const getInterfaceCompatibilityInfo = (
  info: Extract<LocalTypeInfo, { kind: "interface" }>,
  ref?: Extract<IrType, { kind: "referenceType" }>
): Extract<LocalTypeInfo, { kind: "interface" }> => {
  const filteredMembers = info.members.filter(
    (member) => !isInterfaceMarkerProperty(member)
  );
  const typeArguments = ref?.typeArguments ?? [];
  if (info.typeParameters.length === 0 || typeArguments.length === 0) {
    return filteredMembers === info.members
      ? info
      : { ...info, members: filteredMembers };
  }

  return {
    ...info,
    members: filteredMembers.map((member) =>
      specializeInterfaceMember(member, info.typeParameters, typeArguments)
    ),
    extends: info.extends.map((base) =>
      substituteTypeArgs(base, info.typeParameters, typeArguments)
    ),
  };
};

const isPublicInstanceClassMember = (member: IrClassMember): boolean => {
  if (member.kind === "constructorDeclaration") return false;
  if (member.isStatic) return false;
  if (
    member.accessibility === "private" ||
    member.accessibility === "protected"
  ) {
    return false;
  }
  return true;
};

const typeKeyEquals = (
  source: IrType | undefined,
  target: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!source || !target) return source === target;
  return areIrTypesEquivalent(source, target, context);
};

const buildCanonicalMethodTypeSubstitution = (
  typeParameters: readonly { readonly name: string }[] | undefined
): ReadonlyMap<string, IrType> | undefined => {
  if (!typeParameters || typeParameters.length === 0) {
    return undefined;
  }

  const substitution = new Map<string, IrType>();
  for (let index = 0; index < typeParameters.length; index += 1) {
    const typeParameter = typeParameters[index];
    if (!typeParameter) continue;
    substitution.set(typeParameter.name, {
      kind: "typeParameterType",
      name: `__method_${index}`,
    });
  }
  return substitution;
};

const canonicalizeMethodType = (
  type: IrType | undefined,
  typeParameters: readonly { readonly name: string }[] | undefined
): IrType | undefined => {
  const substitution = buildCanonicalMethodTypeSubstitution(typeParameters);
  if (!type || !substitution || substitution.size === 0) {
    return type;
  }
  return substituteIrType(type, substitution);
};

const getPublicInstanceClassMembers = (
  info: Extract<LocalTypeInfo, { kind: "class" }>
): readonly IrClassMember[] => info.members.filter(isPublicInstanceClassMember);

const findCompatibleProperty = (
  members: readonly IrClassMember[],
  target: Extract<IrInterfaceMember, { kind: "propertySignature" }>,
  usedIndices: Set<number>,
  context: EmitterContext
): Extract<IrClassMember, { kind: "propertyDeclaration" }> | undefined => {
  for (let index = 0; index < members.length; index += 1) {
    if (usedIndices.has(index)) continue;
    const member = members[index];
    if (member?.kind !== "propertyDeclaration") continue;
    if (member.name !== target.name) continue;
    if (!typeKeyEquals(member.type, target.type, context)) continue;
    usedIndices.add(index);
    return member;
  }
  return undefined;
};

const findCompatibleMethod = (
  members: readonly IrClassMember[],
  target: Extract<IrInterfaceMember, { kind: "methodSignature" }>,
  usedIndices: Set<number>,
  context: EmitterContext
): Extract<IrClassMember, { kind: "methodDeclaration" }> | undefined => {
  const targetName = getIrMemberPublicName(target);
  const targetTypeParameters = target.typeParameters;
  const targetReturnType = canonicalizeMethodType(
    target.returnType ?? VOID_TYPE,
    targetTypeParameters
  );

  for (let index = 0; index < members.length; index += 1) {
    if (usedIndices.has(index)) continue;
    const member = members[index];
    if (member?.kind !== "methodDeclaration") continue;
    if (getIrMemberPublicName(member) !== targetName) continue;
    if (
      (member.typeParameters?.length ?? 0) !==
      (targetTypeParameters?.length ?? 0)
    ) {
      continue;
    }
    if (member.parameters.length !== target.parameters.length) {
      continue;
    }

    const memberTypeParameters = member.typeParameters;
    let parametersMatch = true;
    for (
      let paramIndex = 0;
      paramIndex < member.parameters.length;
      paramIndex += 1
    ) {
      const sourceParam = member.parameters[paramIndex];
      const targetParam = target.parameters[paramIndex];
      if (!sourceParam || !targetParam) {
        parametersMatch = false;
        break;
      }

      if (
        sourceParam.isOptional !== targetParam.isOptional ||
        sourceParam.isRest !== targetParam.isRest ||
        sourceParam.passing !== targetParam.passing
      ) {
        parametersMatch = false;
        break;
      }

      if (
        !typeKeyEquals(
          canonicalizeMethodType(sourceParam.type, memberTypeParameters),
          canonicalizeMethodType(targetParam.type, targetTypeParameters),
          context
        )
      ) {
        parametersMatch = false;
        break;
      }
    }

    if (!parametersMatch) {
      continue;
    }

    if (
      !typeKeyEquals(
        canonicalizeMethodType(
          member.returnType ?? VOID_TYPE,
          memberTypeParameters
        ),
        targetReturnType,
        context
      )
    ) {
      continue;
    }

    usedIndices.add(index);
    return member;
  }

  return undefined;
};

const collectCompatibleMembers = (
  classInfo: Extract<LocalTypeInfo, { kind: "class" }>,
  interfaceInfo: Extract<LocalTypeInfo, { kind: "interface" }>,
  context: EmitterContext
):
  | {
      readonly propertyMatches: readonly CompatibleInterfacePropertyMatch[];
      readonly methodMatches: readonly CompatibleInterfaceMethodMatch[];
    }
  | undefined => {
  const classMembers = getPublicInstanceClassMembers(classInfo);
  const propertyMatches: CompatibleInterfacePropertyMatch[] = [];
  const methodMatches: CompatibleInterfaceMethodMatch[] = [];
  const usedPropertyIndices = new Set<number>();
  const usedMethodIndices = new Set<number>();

  for (const member of interfaceInfo.members) {
    if (member.kind === "propertySignature") {
      const classMember = findCompatibleProperty(
        classMembers,
        member,
        usedPropertyIndices,
        context
      );
      if (!classMember) return undefined;
      propertyMatches.push({ interfaceMember: member, classMember });
      continue;
    }

    const classMember = findCompatibleMethod(
      classMembers,
      member,
      usedMethodIndices,
      context
    );
    if (!classMember) return undefined;
    methodMatches.push({ interfaceMember: member, classMember });
  }

  return { propertyMatches, methodMatches };
};

const collectInterfaceCandidates = (
  className: string,
  context: EmitterContext
): readonly InterfaceCandidate[] => {
  const candidates = new Map<string, InterfaceCandidate>();
  const currentNamespace =
    context.moduleNamespace ?? context.options.rootNamespace;

  const pushCandidates = (
    namespace: string,
    localTypes: ReadonlyMap<string, LocalTypeInfo> | undefined
  ): void => {
    if (!localTypes) return;
    for (const [name, info] of localTypes) {
      if (name === className || info.kind !== "interface") continue;
      if ((info.typeParameters?.length ?? 0) > 0) continue;
      candidates.set(`${namespace}::${name}`, { namespace, name, info });
    }
  };

  pushCandidates(currentNamespace, context.localTypes);
  for (const moduleInfo of context.options.moduleMap?.values() ?? []) {
    pushCandidates(moduleInfo.namespace, moduleInfo.localTypes);
  }

  return Array.from(candidates.values());
};

const resolveExplicitInterfaceMatches = (
  classInfo: Extract<LocalTypeInfo, { kind: "class" }>,
  explicitImplements: readonly IrType[],
  context: EmitterContext
): readonly CompatibleInterfaceMatch[] => {
  const results: CompatibleInterfaceMatch[] = [];

  for (const impl of explicitImplements) {
    if (impl.kind !== "referenceType") continue;

    const resolved = resolveLocalTypeInfo(impl, context);
    if (!resolved || resolved.info.kind !== "interface") continue;

    const name = getReferenceLeafName(impl);
    const compatibilityInfo = getInterfaceCompatibilityInfo(
      resolved.info,
      impl
    );
    const matches = collectCompatibleMembers(
      classInfo,
      compatibilityInfo,
      context
    );
    if (!matches) continue;

    results.push({
      namespace: resolved.namespace,
      name,
      ref: buildCanonicalInterfaceRef(resolved.namespace, name, impl),
      info: compatibilityInfo,
      isExplicit: true,
      propertyMatches: matches.propertyMatches,
      methodMatches: matches.methodMatches,
    });
  }

  return results;
};

export const resolveCompatibleImplementedInterfaces = (
  className: string,
  explicitImplements: readonly IrType[],
  context: EmitterContext
): readonly CompatibleInterfaceMatch[] => {
  const currentNamespace =
    context.moduleNamespace ?? context.options.rootNamespace;
  const localInfo = context.localTypes?.get(className);
  if (!localInfo || localInfo.kind !== "class") return [];

  const resolved = new Map<string, CompatibleInterfaceMatch>();
  for (const match of resolveExplicitInterfaceMatches(
    localInfo,
    explicitImplements,
    context
  )) {
    resolved.set(`${match.namespace}::${match.name}`, match);
  }

  for (const candidate of collectInterfaceCandidates(className, context)) {
    const key = `${candidate.namespace}::${candidate.name}`;
    if (resolved.has(key)) continue;

    const matches = collectCompatibleMembers(
      localInfo,
      candidate.info,
      context
    );
    if (!matches) continue;

    resolved.set(key, {
      namespace: candidate.namespace,
      name: candidate.name,
      ref: buildCanonicalInterfaceRef(candidate.namespace, candidate.name),
      info: candidate.info,
      isExplicit: false,
      propertyMatches: matches.propertyMatches,
      methodMatches: matches.methodMatches,
    });
  }

  return Array.from(resolved.values()).map((match) =>
    match.namespace === currentNamespace
      ? {
          ...match,
          ref: buildCanonicalInterfaceRef(
            match.namespace,
            match.name,
            match.ref
          ),
        }
      : match
  );
};

export const inferImplicitImplementedInterfaces = (
  className: string,
  explicitImplements: readonly IrType[],
  context: EmitterContext
): readonly IrType[] =>
  resolveCompatibleImplementedInterfaces(className, explicitImplements, context)
    .filter((match) => !match.isExplicit)
    .map((match) => match.ref);
