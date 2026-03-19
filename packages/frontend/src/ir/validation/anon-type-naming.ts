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
} from "./anon-type-shape-analysis.js";

import type { LoweringContext } from "./anon-type-ir-rewriting.js";

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
      // For optional properties (title?: string), make type nullable and don't require
      // For required properties (title: string), use required modifier
      const isOptional = m.isOptional ?? false;
      return {
        kind: "propertyDeclaration",
        name: m.name,
        type: isOptional ? addUndefinedToType(m.type) : m.type,
        initializer: undefined,
        emitAsAutoProperty: true,
        isStatic: false,
        isReadonly: m.isReadonly ?? false,
        accessibility: "public",
        isRequired: !isOptional, // C# 11 required modifier - must be set in object initializer
      };
    });
};

export const classMembersToInterfaceMembers = (
  members: readonly IrClassMember[]
): readonly IrInterfaceMember[] =>
  members.flatMap<IrInterfaceMember>((member) => {
    if (member.kind !== "propertyDeclaration" || !member.type) {
      return [];
    }

    return {
      kind: "propertySignature",
      name: member.name,
      type: member.type,
      isOptional: false,
      isReadonly: member.isReadonly,
    };
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

  const typeParamNames = new Set<string>();
  for (const member of objectType.members) {
    if (member.kind === "propertySignature") {
      collectTypeParameterNames(member.type, typeParamNames);
    } else if (member.kind === "methodSignature") {
      for (const p of member.parameters) {
        if (p.type) collectTypeParameterNames(p.type, typeParamNames);
      }
      if (member.returnType)
        collectTypeParameterNames(member.returnType, typeParamNames);
    }
  }
  const orderedTypeParams = Array.from(typeParamNames).sort();

  // Create a class declaration (not interface) so it can be instantiated
  const declaration: IrClassDeclaration = {
    kind: "classDeclaration",
    name,
    typeParameters:
      orderedTypeParams.length > 0
        ? orderedTypeParams.map(
            (tp): IrTypeParameter => ({
              kind: "typeParameter",
              name: tp,
            })
          )
        : undefined,
    superClass: undefined,
    implements: [],
    members: interfaceMembersToClassMembers(objectType.members),
    isExported: true, // Public to avoid inconsistent accessibility errors
    isStruct: false,
  };

  ctx.generatedDeclarations.push(declaration);
  return name;
};

export const isReusableStructuralCarrierName = (name: string): boolean =>
  name.startsWith("__Anon_") || /__\d+$/.test(name);

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
