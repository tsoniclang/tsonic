/**
 * Anonymous Type Naming & Member Conversion
 *
 * Named type generation, object-to-class member conversion, and behavioral
 * object type name creation for anonymous type lowering.
 */

import type {
  IrInterfaceMember,
  IrObjectType,
  IrClassDeclaration,
  IrInterfaceDeclaration,
  IrClassMember,
  IrTypeParameter,
  IrExpression,
  IrPropertyDeclaration,
} from "../types.js";

import {
  collectTypeParameterNames,
  computeShapeSignature,
  generateShapeHash,
  generateModuleHash,
  addUndefinedToType,
  normalizeStructuralPropertySignature,
  stripUndefinedFromType,
} from "./anon-type-shape-analysis.js";

import type { LoweringContext } from "./anon-type-ir-rewriting.js";
import type { IrAnonymousStructuralDeclaration } from "./anon-type-lower-types.js";

export const structuralMembersContainMethod = (
  members: readonly IrInterfaceMember[]
): boolean => members.some((member) => member.kind === "methodSignature");

const createStructuralTypeParameters = (
  members: readonly IrInterfaceMember[]
): readonly IrTypeParameter[] | undefined => {
  const typeParamNames = new Set<string>();
  for (const member of members) {
    if (member.kind === "propertySignature") {
      collectTypeParameterNames(member.type, typeParamNames);
      continue;
    }
    for (const parameter of member.parameters) {
      if (parameter.type)
        collectTypeParameterNames(parameter.type, typeParamNames);
    }
    if (member.returnType) {
      collectTypeParameterNames(member.returnType, typeParamNames);
    }
  }

  const orderedTypeParams = Array.from(typeParamNames).sort();
  return orderedTypeParams.length > 0
    ? orderedTypeParams.map(
        (typeParamName): IrTypeParameter => ({
          kind: "typeParameter",
          name: typeParamName,
        })
      )
    : undefined;
};

export const createAnonymousStructuralDeclaration = (
  name: string,
  members: readonly IrInterfaceMember[],
  typeParameters = createStructuralTypeParameters(members)
): IrAnonymousStructuralDeclaration => {
  if (structuralMembersContainMethod(members)) {
    const declaration: IrInterfaceDeclaration = {
      kind: "interfaceDeclaration",
      name,
      typeParameters,
      extends: [],
      members,
      isExported: true,
      isStruct: false,
    };
    return declaration;
  }

  const declaration: IrClassDeclaration = {
    kind: "classDeclaration",
    name,
    typeParameters,
    superClass: undefined,
    implements: [],
    members: interfaceMembersToClassMembers(members),
    isExported: true,
    isStruct: false,
  };
  return declaration;
};

/**
 * Convert interface members to class property declarations
 */
export const interfaceMembersToClassMembers = (
  members: readonly IrInterfaceMember[]
): readonly IrClassMember[] => {
  return members
    .filter(
      (m): m is Extract<typeof m, { kind: "propertySignature" }> =>
        m.kind === "propertySignature"
    )
    .map((m): IrPropertyDeclaration => {
      const normalizedMember = normalizeStructuralPropertySignature(m);
      const isOptional = normalizedMember.isOptional;
      return {
        kind: "propertyDeclaration",
        name: normalizedMember.name,
        type: isOptional
          ? addUndefinedToType(normalizedMember.type)
          : normalizedMember.type,
        initializer: undefined,
        emitAsAutoProperty: true,
        isStatic: false,
        isReadonly: normalizedMember.isReadonly ?? false,
        accessibility: "public",
        isRequired: !isOptional,
      };
    });
};

export const classMembersToInterfaceMembers = (
  members: readonly IrClassMember[]
): readonly IrInterfaceMember[] =>
  members.flatMap<IrInterfaceMember>((member) => {
    if (
      member.kind === "propertyDeclaration" &&
      member.type &&
      member.accessibility === "public" &&
      !member.isStatic
    ) {
      const strippedType = stripUndefinedFromType(member.type);
      const isOptional = strippedType !== member.type;
      return {
        kind: "propertySignature",
        name: member.name,
        type: isOptional ? strippedType : member.type,
        isOptional,
        isReadonly: member.isReadonly,
      };
    }

    if (
      member.kind === "methodDeclaration" &&
      member.accessibility === "public" &&
      !member.isStatic
    ) {
      return {
        kind: "methodSignature",
        name: member.name,
        typeParameters: member.typeParameters,
        parameters: member.parameters,
        returnType: member.returnType,
        overloadFamily: member.overloadFamily,
      };
    }

    return [];
  });

/**
 * Get or create a generated type name for an object type shape
 */
export const getOrCreateTypeName = (
  objectType: IrObjectType,
  ctx: LoweringContext
): string => {
  const signature = computeShapeSignature(objectType);
  const existing = ctx.shapeToName.get(signature);
  if (existing) {
    return existing;
  }

  // Generate name with module hash prefix to avoid collisions across modules
  const moduleHash = generateModuleHash(ctx.moduleFilePath);
  const shapeHash = generateShapeHash(signature);
  // Keep a stable compiler-synthesized prefix for cross-module type tracking.
  // Dependency/soundness passes treat __Anon_* as compiler-generated types.
  const name = `__Anon_${moduleHash}_${shapeHash}`;
  ctx.shapeToName.set(signature, name);

  ctx.generatedDeclarations.push(
    createAnonymousStructuralDeclaration(name, objectType.members)
  );
  return name;
};

export const isReusableStructuralCarrierName = (name: string): boolean =>
  name.startsWith("__Anon_") || name.startsWith("__Rest_");

export const getOrCreateBehavioralObjectTypeName = (
  objectType: IrObjectType,
  behaviorMembers: readonly IrClassMember[],
  sourceLocation: IrExpression["sourceSpan"] | undefined,
  ctx: LoweringContext
): string => {
  const moduleHash = generateModuleHash(ctx.moduleFilePath);
  const locationKey = sourceLocation
    ? `${sourceLocation.file}:${sourceLocation.line}:${sourceLocation.column}`
    : `${ctx.moduleFilePath}:behavior`;
  const behaviorSignature = [
    "behavior",
    locationKey,
    computeShapeSignature(objectType),
    ...behaviorMembers.map((member) =>
      member.kind === "methodDeclaration"
        ? `method:${member.name}`
        : member.kind === "propertyDeclaration"
          ? `property:${member.name}`
          : `ctor:${member.parameters.length}`
    ),
  ].join("|");

  const existing = ctx.shapeToName.get(behaviorSignature);
  if (existing) {
    return existing;
  }

  const name = `__Anon_${moduleHash}_${generateShapeHash(behaviorSignature)}`;
  ctx.shapeToName.set(behaviorSignature, name);

  const behaviorPropertyNames = new Set(
    behaviorMembers
      .filter(
        (
          member
        ): member is Extract<IrClassMember, { kind: "propertyDeclaration" }> =>
          member.kind === "propertyDeclaration"
      )
      .map((member) => member.name)
  );

  const generatedMembers: IrClassMember[] = [
    ...interfaceMembersToClassMembers(objectType.members).filter(
      (member) =>
        member.kind !== "propertyDeclaration" ||
        !behaviorPropertyNames.has(member.name)
    ),
    ...behaviorMembers,
  ];

  ctx.generatedDeclarations.push({
    kind: "classDeclaration",
    name,
    typeParameters: undefined,
    superClass: undefined,
    implements: [],
    members: generatedMembers,
    isExported: true,
    isStruct: false,
  });

  return name;
};
