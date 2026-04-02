import {
  getIrMemberPublicName,
  stableIrTypeKey,
  substituteIrType,
  type IrClassMember,
  type IrInterfaceMember,
  type IrType,
} from "@tsonic/frontend";
import type { EmitterContext, LocalTypeInfo } from "../../types.js";
import { resolveLocalTypeInfo } from "./type-resolution.js";

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
  name: string
): Extract<IrType, { kind: "referenceType" }> => ({
  kind: "referenceType",
  name,
  resolvedClrType: `${namespace}.${name}`,
});

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
  target: IrType | undefined
): boolean => {
  if (!source || !target) return source === target;
  return stableIrTypeKey(source) === stableIrTypeKey(target);
};

const buildCanonicalMethodTypeSubstitution = (
  typeParameters:
    | readonly { readonly name: string }[]
    | undefined
):
  | ReadonlyMap<string, IrType>
  | undefined => {
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
  typeParameters:
    | readonly { readonly name: string }[]
    | undefined
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
  usedIndices: Set<number>
): Extract<IrClassMember, { kind: "propertyDeclaration" }> | undefined => {
  for (let index = 0; index < members.length; index += 1) {
    if (usedIndices.has(index)) continue;
    const member = members[index];
    if (member?.kind !== "propertyDeclaration") continue;
    if (member.name !== target.name) continue;
    if (!typeKeyEquals(member.type, target.type)) continue;
    usedIndices.add(index);
    return member;
  }
  return undefined;
};

const findCompatibleMethod = (
  members: readonly IrClassMember[],
  target: Extract<IrInterfaceMember, { kind: "methodSignature" }>,
  usedIndices: Set<number>
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
    for (let paramIndex = 0; paramIndex < member.parameters.length; paramIndex += 1) {
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
          canonicalizeMethodType(targetParam.type, targetTypeParameters)
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
        canonicalizeMethodType(member.returnType ?? VOID_TYPE, memberTypeParameters),
        targetReturnType
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
  interfaceInfo: Extract<LocalTypeInfo, { kind: "interface" }>
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
        usedPropertyIndices
      );
      if (!classMember) return undefined;
      propertyMatches.push({ interfaceMember: member, classMember });
      continue;
    }

    const classMember = findCompatibleMethod(
      classMembers,
      member,
      usedMethodIndices
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
    const matches = collectCompatibleMembers(classInfo, resolved.info);
    if (!matches) continue;

    results.push({
      namespace: resolved.namespace,
      name,
      ref: buildCanonicalInterfaceRef(resolved.namespace, name),
      info: resolved.info,
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

    const matches = collectCompatibleMembers(localInfo, candidate.info);
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
          ref: buildCanonicalInterfaceRef(match.namespace, match.name),
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
