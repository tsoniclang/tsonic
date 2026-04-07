/**
 * Virtual Marking Pass
 *
 * Recomputes local TypeScript class override/shadow relationships after all IR
 * collection passes have attached final emitted member names. This pass is the
 * single source of truth for local class hierarchies:
 * - no legacy overload helper bridges
 * - no widened-signature compatibility bridges
 * - no source-name-only matching
 *
 * A derived member overrides a local base member only when the emitted CLR name
 * and full signature match exactly after base-class type-argument substitution.
 * Otherwise, a same-name local member is marked as shadowing.
 */

import {
  getIrMemberPublicName,
  IrClassDeclaration,
  IrClassMember,
  IrMethodDeclaration,
  IrModule,
  IrParameter,
  IrPropertyDeclaration,
  IrStatement,
  IrType,
  stableIrTypeKey,
  substituteIrType,
} from "../types.js";
import { stripNullishForInference } from "../type-system/type-system-state-helpers.js";

export type VirtualMarkingResult = {
  readonly ok: true;
  readonly modules: readonly IrModule[];
};

type MemberOverrideUpdate = {
  readonly isOverride?: true;
  readonly isShadow?: true;
};

type LocalOverridePlan = {
  readonly methodUpdates: ReadonlyMap<number, MemberOverrideUpdate>;
  readonly propertyUpdates: ReadonlyMap<number, MemberOverrideUpdate>;
  readonly baseClassName?: string;
  readonly overriddenBaseMethodIndices: ReadonlySet<number>;
  readonly overriddenBasePropertyIndices: ReadonlySet<number>;
};

type IndexedMethod = {
  readonly index: number;
  readonly member: IrMethodDeclaration;
};

type IndexedProperty = {
  readonly index: number;
  readonly member: IrPropertyDeclaration;
};

const VOID_TYPE: IrType = { kind: "voidType" };

const normalizeBaseClassName = (raw: string): string => {
  const withoutTypeArgs = raw.split("<")[0] ?? raw;
  const simple = withoutTypeArgs.split(".").pop() ?? withoutTypeArgs;
  return simple.trim();
};

const buildClassTypeSubstitution = (
  baseClass: IrClassDeclaration,
  superClass: IrClassDeclaration["superClass"]
): ReadonlyMap<string, IrType> | undefined => {
  const typeParameters = baseClass.typeParameters ?? [];
  if (typeParameters.length === 0) {
    return undefined;
  }

  if (
    !superClass ||
    superClass.kind !== "referenceType" ||
    !superClass.typeArguments ||
    superClass.typeArguments.length !== typeParameters.length
  ) {
    return undefined;
  }

  const substitution = new Map<string, IrType>();
  for (let index = 0; index < typeParameters.length; index += 1) {
    const typeParameter = typeParameters[index];
    const typeArgument = superClass.typeArguments[index];
    if (!typeParameter || !typeArgument) {
      return undefined;
    }
    substitution.set(typeParameter.name, typeArgument);
  }
  return substitution;
};

const buildCanonicalMethodTypeSubstitution = (
  typeParameters:
    | readonly { readonly name: string }[]
    | undefined
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
  methodTypeParameters:
    | readonly { readonly name: string }[]
    | undefined,
  classSubstitution?: ReadonlyMap<string, IrType>
): IrType | undefined => {
  if (!type) {
    return undefined;
  }

  let current = type;
  if (classSubstitution && classSubstitution.size > 0) {
    current = substituteIrType(current, classSubstitution);
  }

  const methodSubstitution =
    buildCanonicalMethodTypeSubstitution(methodTypeParameters);
  if (!methodSubstitution || methodSubstitution.size === 0) {
    return current;
  }

  return substituteIrType(current, methodSubstitution);
};

const buildSelfTypeSubstitution = (
  classDecl: IrClassDeclaration,
  instantiatedType: Extract<IrType, { kind: "referenceType" }>
): ReadonlyMap<string, IrType> | undefined => {
  const typeParameters = classDecl.typeParameters ?? [];
  if (typeParameters.length === 0) {
    return undefined;
  }

  if (
    !instantiatedType.typeArguments ||
    instantiatedType.typeArguments.length !== typeParameters.length
  ) {
    return undefined;
  }

  const substitution = new Map<string, IrType>();
  for (let index = 0; index < typeParameters.length; index += 1) {
    const typeParameter = typeParameters[index];
    const typeArgument = instantiatedType.typeArguments[index];
    if (!typeParameter || !typeArgument) {
      return undefined;
    }
    substitution.set(typeParameter.name, typeArgument);
  }

  return substitution;
};

const typesEqual = (left: IrType | undefined, right: IrType | undefined): boolean => {
  if (!left || !right) {
    return left === right;
  }
  return stableIrTypeKey(left) === stableIrTypeKey(right);
};

const isLocalReferenceSubtype = (
  derivedType: IrType | undefined,
  baseType: IrType | undefined,
  classRegistry: ReadonlyMap<string, IrClassDeclaration>
): boolean => {
  if (!derivedType || !baseType) {
    return false;
  }

  if (typesEqual(derivedType, baseType)) {
    return true;
  }

  if (derivedType.kind !== "referenceType" || baseType.kind !== "referenceType") {
    return false;
  }

  const derivedClass = classRegistry.get(normalizeBaseClassName(derivedType.name));
  if (!derivedClass?.superClass || derivedClass.superClass.kind !== "referenceType") {
    return false;
  }

  const selfSubstitution = buildSelfTypeSubstitution(derivedClass, derivedType);
  const instantiatedSuper =
    selfSubstitution && selfSubstitution.size > 0
      ? substituteIrType(derivedClass.superClass, selfSubstitution)
      : derivedClass.superClass;

  return isLocalReferenceSubtype(instantiatedSuper, baseType, classRegistry);
};

const parametersExactlyMatch = (
  baseParameter: IrParameter,
  derivedParameter: IrParameter,
  baseMethodTypeParameters:
    | readonly { readonly name: string }[]
    | undefined,
  derivedMethodTypeParameters:
    | readonly { readonly name: string }[]
    | undefined,
  classSubstitution?: ReadonlyMap<string, IrType>
): boolean =>
  baseParameter.isOptional === derivedParameter.isOptional &&
  baseParameter.isRest === derivedParameter.isRest &&
  baseParameter.passing === derivedParameter.passing &&
  typesEqual(
    canonicalizeMethodType(
      baseParameter.type,
      baseMethodTypeParameters,
      classSubstitution
    ),
    canonicalizeMethodType(
      derivedParameter.type,
      derivedMethodTypeParameters
    )
  );

const methodsExactlyMatch = (
  baseMethod: IrMethodDeclaration,
  derivedMethod: IrMethodDeclaration,
  classRegistry: ReadonlyMap<string, IrClassDeclaration>,
  classSubstitution?: ReadonlyMap<string, IrType>
): boolean => {
  if (getIrMemberPublicName(baseMethod) !== getIrMemberPublicName(derivedMethod)) {
    return false;
  }

  const baseTypeParameters = baseMethod.typeParameters;
  const derivedTypeParameters = derivedMethod.typeParameters;
  if ((baseTypeParameters?.length ?? 0) !== (derivedTypeParameters?.length ?? 0)) {
    return false;
  }

  if (baseMethod.parameters.length !== derivedMethod.parameters.length) {
    return false;
  }

  for (let index = 0; index < baseMethod.parameters.length; index += 1) {
    const baseParameter = baseMethod.parameters[index];
    const derivedParameter = derivedMethod.parameters[index];
    if (!baseParameter || !derivedParameter) {
      return false;
    }
    if (
      !parametersExactlyMatch(
        baseParameter,
        derivedParameter,
        baseTypeParameters,
        derivedTypeParameters,
        classSubstitution
      )
    ) {
      return false;
    }
  }

  const canonicalBaseReturn = canonicalizeMethodType(
    baseMethod.returnType ?? VOID_TYPE,
    baseTypeParameters,
    classSubstitution
  );
  const canonicalDerivedReturn = canonicalizeMethodType(
    derivedMethod.returnType ?? VOID_TYPE,
    derivedTypeParameters
  );

  return (
    typesEqual(canonicalBaseReturn, canonicalDerivedReturn) ||
    isLocalReferenceSubtype(
      canonicalDerivedReturn,
      canonicalBaseReturn,
      classRegistry
    )
  );
};

const propertiesExactlyMatch = (
  baseProperty: IrPropertyDeclaration,
  derivedProperty: IrPropertyDeclaration,
  classRegistry: ReadonlyMap<string, IrClassDeclaration>,
  classSubstitution?: ReadonlyMap<string, IrType>
): boolean => {
  if (baseProperty.name !== derivedProperty.name) {
    return false;
  }

  const baseType =
    classSubstitution && baseProperty.type
      ? substituteIrType(baseProperty.type, classSubstitution)
      : baseProperty.type;
  const canonicalBaseType = baseType
    ? (stripNullishForInference(baseType) ?? baseType)
    : baseType;
  const canonicalDerivedType = derivedProperty.type
    ? (stripNullishForInference(derivedProperty.type) ?? derivedProperty.type)
    : derivedProperty.type;

  return (
    typesEqual(canonicalBaseType, canonicalDerivedType) ||
    isLocalReferenceSubtype(
      canonicalDerivedType,
      canonicalBaseType,
      classRegistry
    )
  );
};

const buildEmptyPlan = (): LocalOverridePlan => ({
  methodUpdates: new Map<number, MemberOverrideUpdate>(),
  propertyUpdates: new Map<number, MemberOverrideUpdate>(),
  overriddenBaseMethodIndices: new Set<number>(),
  overriddenBasePropertyIndices: new Set<number>(),
});

const analyzeLocalOverrides = (
  classDecl: IrClassDeclaration,
  classRegistry: ReadonlyMap<string, IrClassDeclaration>
): LocalOverridePlan => {
  if (classDecl.superClass?.kind !== "referenceType") {
    return buildEmptyPlan();
  }

  const baseClassName = normalizeBaseClassName(classDecl.superClass.name);
  const baseClass = classRegistry.get(baseClassName);
  if (!baseClass) {
    return buildEmptyPlan();
  }

  const methodUpdates = new Map<number, MemberOverrideUpdate>();
  const propertyUpdates = new Map<number, MemberOverrideUpdate>();
  const overriddenBaseMethodIndices = new Set<number>();
  const overriddenBasePropertyIndices = new Set<number>();
  const classSubstitution = buildClassTypeSubstitution(
    baseClass,
    classDecl.superClass
  );

  const baseMethods: IndexedMethod[] = [];
  const baseProperties: IndexedProperty[] = [];
  for (let index = 0; index < baseClass.members.length; index += 1) {
    const member = baseClass.members[index];
    if (!member) {
      continue;
    }

    if (member.kind === "methodDeclaration") {
      if (member.isStatic) {
        continue;
      }
      baseMethods.push({ index, member });
      continue;
    }

    if (member.kind === "propertyDeclaration") {
      if (member.isStatic) {
        continue;
      }
      baseProperties.push({ index, member });
    }
  }

  for (let index = 0; index < classDecl.members.length; index += 1) {
    const member = classDecl.members[index];
    if (!member) {
      continue;
    }

    if (member.kind === "methodDeclaration") {
      if (member.isStatic) {
        continue;
      }
      const sameNameBaseMethods = baseMethods.filter(
        (baseMethod) =>
          getIrMemberPublicName(baseMethod.member) ===
          getIrMemberPublicName(member)
      );
      if (sameNameBaseMethods.length === 0) {
        continue;
      }

      const matchedBaseMethod = sameNameBaseMethods.find((baseMethod) =>
        methodsExactlyMatch(
          baseMethod.member,
          member,
          classRegistry,
          classSubstitution
        )
      );
      if (matchedBaseMethod) {
        methodUpdates.set(index, { isOverride: true });
        overriddenBaseMethodIndices.add(matchedBaseMethod.index);
      } else {
        methodUpdates.set(index, { isShadow: true });
      }
      continue;
    }

    if (member.kind === "propertyDeclaration") {
      if (member.isStatic) {
        continue;
      }
      const sameNameBaseProperties = baseProperties.filter(
        (baseProperty) => baseProperty.member.name === member.name
      );
      if (sameNameBaseProperties.length === 0) {
        continue;
      }

      const matchedBaseProperty = sameNameBaseProperties.find((baseProperty) =>
        propertiesExactlyMatch(
          baseProperty.member,
          member,
          classRegistry,
          classSubstitution
        )
      );
      if (matchedBaseProperty) {
        propertyUpdates.set(index, { isOverride: true });
        overriddenBasePropertyIndices.add(matchedBaseProperty.index);
      } else {
        propertyUpdates.set(index, { isShadow: true });
      }
    }
  }

  return {
    methodUpdates,
    propertyUpdates,
    baseClassName,
    overriddenBaseMethodIndices,
    overriddenBasePropertyIndices,
  };
};

const applyMethodUpdate = (
  member: IrMethodDeclaration,
  update: MemberOverrideUpdate | undefined,
  isVirtual: boolean
): IrMethodDeclaration => {
  if (!update && !isVirtual) {
    return member;
  }

  const {
    isOverride: _oldOverride,
    isShadow: _oldShadow,
    isVirtual: _oldVirtual,
    ...rest
  } = member;

  return {
    ...rest,
    ...(update?.isOverride ? { isOverride: true } : {}),
    ...(update?.isShadow ? { isShadow: true } : {}),
    ...(isVirtual || member.isVirtual ? { isVirtual: true } : {}),
  };
};

const applyPropertyUpdate = (
  member: IrPropertyDeclaration,
  update: MemberOverrideUpdate | undefined,
  isVirtual: boolean
): IrPropertyDeclaration => {
  if (!update && !isVirtual) {
    return member;
  }

  const {
    isOverride: _oldOverride,
    isShadow: _oldShadow,
    isVirtual: _oldVirtual,
    ...rest
  } = member;

  return {
    ...rest,
    ...(update?.isOverride ? { isOverride: true } : {}),
    ...(update?.isShadow ? { isShadow: true } : {}),
    ...(isVirtual || member.isVirtual ? { isVirtual: true } : {}),
  };
};

const transformStatement = (
  stmt: IrStatement,
  overridePlans: ReadonlyMap<string, LocalOverridePlan>,
  virtualMethodIndices: ReadonlyMap<string, ReadonlySet<number>>,
  virtualPropertyIndices: ReadonlyMap<string, ReadonlySet<number>>
): IrStatement => {
  if (stmt.kind !== "classDeclaration") {
    return stmt;
  }

  const plan = overridePlans.get(stmt.name);
  const methodVirtuals = virtualMethodIndices.get(stmt.name);
  const propertyVirtuals = virtualPropertyIndices.get(stmt.name);

  const transformedMembers = stmt.members.map((member, index): IrClassMember => {
    if (member.kind === "methodDeclaration") {
      return applyMethodUpdate(
        member,
        plan?.methodUpdates.get(index),
        methodVirtuals?.has(index) ?? false
      );
    }

    if (member.kind === "propertyDeclaration") {
      return applyPropertyUpdate(
        member,
        plan?.propertyUpdates.get(index),
        propertyVirtuals?.has(index) ?? false
      );
    }

    return member;
  });

  return {
    ...stmt,
    members: transformedMembers,
  };
};

/**
 * Run virtual marking pass on all modules.
 */
export const runVirtualMarkingPass = (
  modules: readonly IrModule[]
): VirtualMarkingResult => {
  const classRegistry = new Map<string, IrClassDeclaration>();

  for (const module of modules) {
    for (const stmt of module.body) {
      if (stmt.kind === "classDeclaration") {
        classRegistry.set(stmt.name, stmt);
      }
    }
    for (const exp of module.exports) {
      if (
        exp.kind === "declaration" &&
        exp.declaration.kind === "classDeclaration"
      ) {
        classRegistry.set(exp.declaration.name, exp.declaration);
      }
    }
  }

  const overridePlans = new Map<string, LocalOverridePlan>();
  const virtualMethodIndices = new Map<string, Set<number>>();
  const virtualPropertyIndices = new Map<string, Set<number>>();

  for (const classDecl of classRegistry.values()) {
    const plan = analyzeLocalOverrides(classDecl, classRegistry);
    overridePlans.set(classDecl.name, plan);

    if (!plan.baseClassName) {
      continue;
    }

    if (plan.overriddenBaseMethodIndices.size > 0) {
      const indices =
        virtualMethodIndices.get(plan.baseClassName) ?? new Set<number>();
      for (const index of plan.overriddenBaseMethodIndices) {
        indices.add(index);
      }
      virtualMethodIndices.set(plan.baseClassName, indices);
    }

    if (plan.overriddenBasePropertyIndices.size > 0) {
      const indices =
        virtualPropertyIndices.get(plan.baseClassName) ?? new Set<number>();
      for (const index of plan.overriddenBasePropertyIndices) {
        indices.add(index);
      }
      virtualPropertyIndices.set(plan.baseClassName, indices);
    }
  }

  const transformedModules = modules.map((module) => ({
    ...module,
    body: module.body.map((stmt) =>
      transformStatement(
        stmt,
        overridePlans,
        virtualMethodIndices,
        virtualPropertyIndices
      )
    ),
    exports: module.exports.map((exp) =>
      exp.kind === "declaration"
        ? {
            ...exp,
            declaration: transformStatement(
              exp.declaration,
              overridePlans,
              virtualMethodIndices,
              virtualPropertyIndices
            ) as IrStatement,
          }
        : exp
    ),
  }));

  return { ok: true, modules: transformedModules };
};
