import {
  stableIrTypeKey,
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
  readonly interfaceMember: Extract<IrInterfaceMember, { kind: "propertySignature" }>;
  readonly classMember: Extract<IrClassMember, { kind: "propertyDeclaration" }>;
};

export type CompatibleInterfaceMethodMatch = {
  readonly interfaceMember: Extract<IrInterfaceMember, { kind: "methodSignature" }>;
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
  if (member.accessibility === "private" || member.accessibility === "protected") {
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

const isTypeStructurallyAssignable = (
  source: IrType | undefined,
  target: IrType | undefined
): boolean => {
  if (!source || !target) return source === target;
  if (typeKeyEquals(source, target)) return true;

  if (target.kind === "unionType") {
    return target.types.some((member) =>
      member ? isTypeStructurallyAssignable(source, member) : false
    );
  }

  if (source.kind === "unionType") {
    return source.types.every((member) =>
      member ? isTypeStructurallyAssignable(member, target) : false
    );
  }

  if (
    target.kind === "referenceType" &&
    target.name === "object" &&
    source.kind !== "voidType" &&
    source.kind !== "neverType"
  ) {
    return true;
  }

  if (source.kind === "referenceType" && target.kind === "referenceType") {
    const sameName =
      source.name === target.name ||
      (source.resolvedClrType &&
        target.resolvedClrType &&
        source.resolvedClrType === target.resolvedClrType);
    if (sameName) {
      const sourceArgs = source.typeArguments ?? [];
      const targetArgs = target.typeArguments ?? [];
      if (sourceArgs.length !== targetArgs.length) return false;
      return sourceArgs.every((arg, index) => {
        const targetArg = targetArgs[index];
        return targetArg ? isTypeStructurallyAssignable(arg, targetArg) : false;
      });
    }
  }

  if (source.kind === "functionType" && target.kind === "functionType") {
    if (source.parameters.length !== target.parameters.length) return false;
    for (let index = 0; index < source.parameters.length; index += 1) {
      const sourceParam = source.parameters[index];
      const targetParam = target.parameters[index];
      if (!sourceParam || !targetParam) return false;
      if (
        sourceParam.isOptional !== targetParam.isOptional ||
        sourceParam.isRest !== targetParam.isRest ||
        sourceParam.passing !== targetParam.passing
      ) {
        return false;
      }
      if (
        !isTypeStructurallyAssignable(targetParam.type, sourceParam.type) ||
        !isTypeStructurallyAssignable(sourceParam.type, targetParam.type)
      ) {
        return false;
      }
    }

    return isTypeStructurallyAssignable(source.returnType, target.returnType);
  }

  return false;
};

const getPublicInstanceClassMembers = (
  info: Extract<LocalTypeInfo, { kind: "class" }>
): readonly IrClassMember[] => info.members.filter(isPublicInstanceClassMember);

const findCompatibleProperty = (
  members: readonly IrClassMember[],
  target: Extract<IrInterfaceMember, { kind: "propertySignature" }>
): Extract<IrClassMember, { kind: "propertyDeclaration" }> | undefined =>
  members.find(
    (
      member
    ): member is Extract<IrClassMember, { kind: "propertyDeclaration" }> =>
      member.kind === "propertyDeclaration" &&
      member.name === target.name &&
      isTypeStructurallyAssignable(member.type, target.type)
  );

const findCompatibleMethod = (
  members: readonly IrClassMember[],
  target: Extract<IrInterfaceMember, { kind: "methodSignature" }>
): Extract<IrClassMember, { kind: "methodDeclaration" }> | undefined =>
  members.find((member): member is Extract<IrClassMember, { kind: "methodDeclaration" }> => {
    if (member.kind !== "methodDeclaration" || member.name !== target.name) {
      return false;
    }

    if ((member.typeParameters?.length ?? 0) !== (target.typeParameters?.length ?? 0)) {
      return false;
    }

    if (member.parameters.length !== target.parameters.length) {
      return false;
    }

    for (let index = 0; index < member.parameters.length; index += 1) {
      const sourceParam = member.parameters[index];
      const targetParam = target.parameters[index];
      if (!sourceParam || !targetParam) return false;

      if (
        sourceParam.isOptional !== targetParam.isOptional ||
        sourceParam.isRest !== targetParam.isRest ||
        sourceParam.passing !== targetParam.passing
      ) {
        return false;
      }

      if (
        !isTypeStructurallyAssignable(targetParam.type, sourceParam.type) ||
        !isTypeStructurallyAssignable(sourceParam.type, targetParam.type)
      ) {
        return false;
      }
    }

    return isTypeStructurallyAssignable(
      member.returnType ?? VOID_TYPE,
      target.returnType ?? VOID_TYPE
    );
  });

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

  for (const member of interfaceInfo.members) {
    if (member.kind === "propertySignature") {
      const classMember = findCompatibleProperty(classMembers, member);
      if (!classMember) return undefined;
      propertyMatches.push({ interfaceMember: member, classMember });
      continue;
    }

    const classMember = findCompatibleMethod(classMembers, member);
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
  const currentNamespace = context.moduleNamespace ?? context.options.rootNamespace;

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
  const currentNamespace = context.moduleNamespace ?? context.options.rootNamespace;
  const localInfo = context.localTypes?.get(className);
  if (!localInfo || localInfo.kind !== "class") return [];

  const resolved = new Map<string, CompatibleInterfaceMatch>();
  for (const match of resolveExplicitInterfaceMatches(localInfo, explicitImplements, context)) {
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
      ? { ...match, ref: buildCanonicalInterfaceRef(match.namespace, match.name) }
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
