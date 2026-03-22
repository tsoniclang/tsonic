/**
 * Virtual Marking Pass
 *
 * For each method/property with isOverride=true in derived classes,
 * finds and marks the corresponding base class member with isVirtual=true.
 *
 * It also synthesizes bridge overrides for TypeScript-style same-name method
 * widening across TS class hierarchies. This preserves runtime dispatch for
 * patterns like:
 *
 *   class Base { write(chunk: unknown): unknown }
 *   class Derived extends Base {
 *     write(chunk: unknown, encoding?: string, cb?: () => void): boolean
 *   }
 *
 * In C#, a base-typed receiver would otherwise bind statically to the base
 * method because the widened derived signature cannot override directly.
 */

import {
  IrModule,
  IrClassDeclaration,
  IrStatement,
  IrClassMember,
  IrMethodDeclaration,
  IrParameter,
  IrType,
  stableIrTypeKey,
} from "../types.js";

export type VirtualMarkingResult = {
  readonly ok: true;
  readonly modules: readonly IrModule[];
};

/**
 * Run virtual marking pass on all modules.
 */
export const runVirtualMarkingPass = (
  modules: readonly IrModule[]
): VirtualMarkingResult => {
  // Build class registry: name -> class declaration
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

  const bridgePlans = new Map<string, BridgePlan>();
  const virtualMethods = new Set<string>(); // "ClassName.methodName"
  const virtualProperties = new Set<string>(); // "ClassName.propertyName"

  const normalizeBaseClassName = (raw: string): string => {
    // `Functor<T>` → `Functor`
    const withoutTypeArgs = raw.split("<")[0] ?? raw;
    // `Namespace.Functor` → `Functor`
    const simple = withoutTypeArgs.split(".").pop() ?? withoutTypeArgs;
    return simple.trim();
  };

  for (const classDecl of classRegistry.values()) {
    bridgePlans.set(classDecl.name, buildBridgePlan(classDecl, classRegistry));

    for (const member of classDecl.members) {
      if (
        member.kind === "methodDeclaration" &&
        member.isOverride &&
        !member.isStatic
      ) {
        // Find base class
        if (classDecl.superClass?.kind === "referenceType") {
          const baseClassName = normalizeBaseClassName(
            classDecl.superClass.name
          );
          virtualMethods.add(`${baseClassName}.${member.name}`);
        }
      }

      if (
        member.kind === "propertyDeclaration" &&
        member.isOverride &&
        !member.isStatic
      ) {
        if (classDecl.superClass?.kind === "referenceType") {
          const baseClassName = normalizeBaseClassName(
            classDecl.superClass.name
          );
          virtualProperties.add(`${baseClassName}.${member.name}`);
        }
      }
    }

    const bridgePlan = bridgePlans.get(classDecl.name);
    if (classDecl.superClass?.kind === "referenceType") {
      const baseClassName = normalizeBaseClassName(classDecl.superClass.name);
      for (const bridge of bridgePlan?.bridges ?? []) {
        virtualMethods.add(`${baseClassName}.${bridge.name}`);
      }
    }
  }

  // Transform modules to mark virtual methods
  const transformedModules = modules.map((module) => ({
    ...module,
    body: module.body.map((stmt) =>
      transformStatement(
        stmt,
        virtualMethods,
        virtualProperties,
        bridgePlans.get(stmt.kind === "classDeclaration" ? stmt.name : "")
      )
    ),
    exports: module.exports.map((exp) =>
      exp.kind === "declaration"
        ? {
            ...exp,
            declaration: transformStatement(
              exp.declaration,
              virtualMethods,
              virtualProperties,
              bridgePlans.get(
                exp.declaration.kind === "classDeclaration"
                  ? exp.declaration.name
                  : ""
              )
            ) as IrStatement,
          }
        : exp
    ),
  }));

  return { ok: true, modules: transformedModules };
};

type BridgePlan = {
  readonly bridges: readonly IrMethodDeclaration[];
  readonly shadowedMethodNames: ReadonlySet<string>;
};

const unknownType: IrType = { kind: "unknownType" };
const voidType: IrType = { kind: "voidType" };

const normalizeBaseClassName = (raw: string): string => {
  const withoutTypeArgs = raw.split("<")[0] ?? raw;
  const simple = withoutTypeArgs.split(".").pop() ?? withoutTypeArgs;
  return simple.trim();
};

const getMethodTypeKey = (type: IrType | undefined): string =>
  stableIrTypeKey(type ?? unknownType);

const parametersMatchForBridgePrefix = (
  baseParameter: IrParameter,
  derivedParameter: IrParameter
): boolean =>
  baseParameter.isRest === derivedParameter.isRest &&
  baseParameter.passing === derivedParameter.passing &&
  getMethodTypeKey(baseParameter.type) === getMethodTypeKey(derivedParameter.type);

const canOmitDerivedTrailingParameters = (
  parameters: readonly IrParameter[]
): boolean =>
  parameters.every(
    (parameter) =>
      parameter.isOptional ||
      parameter.initializer !== undefined ||
      parameter.isRest
  );

const buildBridgeArgument = (
  parameter: IrParameter
):
  | {
      readonly kind: "identifier";
      readonly name: string;
      readonly inferredType?: IrType;
    }
  | undefined => {
  if (parameter.pattern.kind !== "identifierPattern") {
    return undefined;
  }

  return {
    kind: "identifier",
    name: parameter.pattern.name,
    inferredType: parameter.type,
  };
};

const buildBridgeMethod = (
  classDecl: IrClassDeclaration,
  baseMethod: IrMethodDeclaration,
  derivedMethod: IrMethodDeclaration
): IrMethodDeclaration | undefined => {
  if (
    (baseMethod.typeParameters?.length ?? 0) > 0 ||
    (derivedMethod.typeParameters?.length ?? 0) > 0 ||
    baseMethod.parameters.length === derivedMethod.parameters.length ||
    derivedMethod.parameters.length < baseMethod.parameters.length
  ) {
    return undefined;
  }

  for (let index = 0; index < baseMethod.parameters.length; index += 1) {
    const baseParameter = baseMethod.parameters[index];
    const derivedParameter = derivedMethod.parameters[index];
    if (!baseParameter || !derivedParameter) {
      return undefined;
    }
    if (!parametersMatchForBridgePrefix(baseParameter, derivedParameter)) {
      return undefined;
    }
  }

  if (
    !canOmitDerivedTrailingParameters(
      derivedMethod.parameters.slice(baseMethod.parameters.length)
    )
  ) {
    return undefined;
  }

  const forwardedArgs: NonNullable<ReturnType<typeof buildBridgeArgument>>[] = [];
  for (const parameter of baseMethod.parameters) {
    const argument = buildBridgeArgument(parameter);
    if (!argument) {
      return undefined;
    }
    forwardedArgs.push(argument);
  }

  const callExpression = {
    kind: "call" as const,
    callee: {
      kind: "memberAccess" as const,
      object: {
        kind: "this" as const,
        inferredType: {
          kind: "referenceType" as const,
          name: classDecl.name,
        },
      },
      property: derivedMethod.name,
      isComputed: false,
      isOptional: false,
      inferredType: {
        kind: "functionType" as const,
        parameters: derivedMethod.parameters,
        returnType: derivedMethod.returnType ?? voidType,
      },
    },
    arguments: forwardedArgs,
    isOptional: false,
    parameterTypes: derivedMethod.parameters.map((parameter) => parameter.type),
    inferredType: derivedMethod.returnType ?? voidType,
  };

  const baseReturnType = baseMethod.returnType ?? voidType;
  const derivedReturnType = derivedMethod.returnType ?? voidType;
  const needsReturn = baseReturnType.kind !== "voidType";
  const returnValueExpression =
    derivedReturnType.kind === "voidType"
      ? {
          kind: "defaultof" as const,
          targetType: baseReturnType,
          inferredType: baseReturnType,
        }
      : getMethodTypeKey(baseReturnType) !== getMethodTypeKey(derivedReturnType)
        ? {
            kind: "typeAssertion" as const,
            expression: callExpression,
            targetType: baseReturnType,
            inferredType: baseReturnType,
          }
        : callExpression;

  const bodyStatements = needsReturn
    ? derivedReturnType.kind === "voidType"
      ? [
          {
            kind: "expressionStatement" as const,
            expression: callExpression,
          },
          {
            kind: "returnStatement" as const,
            expression: returnValueExpression,
          },
        ]
      : [
          {
            kind: "returnStatement" as const,
            expression: returnValueExpression,
          },
        ]
    : [
        {
          kind: "expressionStatement" as const,
          expression: callExpression,
        },
      ];

  return {
    kind: "methodDeclaration",
    name: baseMethod.name,
    typeParameters: baseMethod.typeParameters,
    parameters: baseMethod.parameters,
    returnType: baseMethod.returnType,
    body: {
      kind: "blockStatement",
      statements: bodyStatements,
    },
    isStatic: false,
    isAsync: derivedMethod.isAsync,
    isGenerator: false,
    accessibility: baseMethod.accessibility,
    isOverride: true,
  };
};

const buildBridgePlan = (
  classDecl: IrClassDeclaration,
  classRegistry: ReadonlyMap<string, IrClassDeclaration>
): BridgePlan => {
  if (classDecl.superClass?.kind !== "referenceType") {
    return { bridges: [], shadowedMethodNames: new Set<string>() };
  }

  const baseClass = classRegistry.get(
    normalizeBaseClassName(classDecl.superClass.name)
  );
  if (!baseClass) {
    return { bridges: [], shadowedMethodNames: new Set<string>() };
  }

  const baseMethods = baseClass.members.filter(
    (member): member is IrMethodDeclaration =>
      member.kind === "methodDeclaration" && !member.isStatic
  );
  const bridges: IrMethodDeclaration[] = [];
  const shadowedMethodNames = new Set<string>();

  for (const member of classDecl.members) {
    if (
      member.kind !== "methodDeclaration" ||
      member.isStatic ||
      member.isOverride
    ) {
      continue;
    }

    const sameNameBaseMethods = baseMethods.filter(
      (baseMethod) => baseMethod.name === member.name
    );
    if (sameNameBaseMethods.length === 0) {
      continue;
    }

    const methodBridges = sameNameBaseMethods
      .map((baseMethod) => buildBridgeMethod(classDecl, baseMethod, member))
      .filter((bridge): bridge is IrMethodDeclaration => bridge !== undefined);

    if (methodBridges.length === 0) {
      continue;
    }

    shadowedMethodNames.add(member.name);
    bridges.push(...methodBridges);
  }

  return { bridges, shadowedMethodNames };
};

const transformStatement = (
  stmt: IrStatement,
  virtualMethods: Set<string>,
  virtualProperties: Set<string>,
  bridgePlan?: BridgePlan
): IrStatement => {
  if (stmt.kind !== "classDeclaration") return stmt;

  const transformedMembers = stmt.members.map((member): IrClassMember => {
    if (member.kind !== "methodDeclaration") return member;
    if (member.isStatic || member.isOverride) return member;

    const key = `${stmt.name}.${member.name}`;
    const shouldShadow = bridgePlan?.shadowedMethodNames.has(member.name);
    if (virtualMethods.has(key)) {
      return {
        ...member,
        isVirtual: true,
        isShadow: shouldShadow ? true : member.isShadow,
      };
    }
    if (shouldShadow) {
      return { ...member, isShadow: true };
    }
    return member;
  });

  const transformedMembersWithProps = transformedMembers.map(
    (member): IrClassMember => {
      if (member.kind !== "propertyDeclaration") return member;
      if (member.isStatic || member.isOverride) return member;

      const key = `${stmt.name}.${member.name}`;
      if (virtualProperties.has(key)) {
        return { ...member, isVirtual: true };
      }
      return member;
    }
  );

  return {
    ...stmt,
    members: [...transformedMembersWithProps, ...(bridgePlan?.bridges ?? [])],
  };
};
