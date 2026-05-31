import { createHash } from "node:crypto";
import type { IrExpression, IrInterfaceMember, IrType } from "@tsonic/frontend";
import type { EmitterContext, ModuleIdentity } from "../types.js";
import { emitTypeAst } from "../type-emitter.js";
import { emitExpressionAst } from "../expression-emitter.js";
import { emitParameters } from "../statements/classes/parameters.js";
import { emitCSharpName } from "../naming-policy.js";
import {
  identifierType,
  nullableType,
} from "../core/format/backend-ast/builders.js";
import { printType } from "../core/format/backend-ast/printer-precedence.js";
import type {
  CSharpExpressionAst,
  CSharpTypeAst,
} from "../core/format/backend-ast/types.js";
import type { InterfaceObjectAdapterMember } from "../types.js";
import {
  resolveLocalTypeInfo,
  stripNullish,
} from "../core/semantic/type-resolution.js";
import {
  collectEffectiveInterfaceMemberEntries,
  referenceTypeEmitsAsNativeInterface,
  type EffectiveInterfaceMember,
} from "../core/semantic/native-interfaces.js";
import { isMutablePropertySlot } from "../core/semantic/mutable-storage-helpers.js";
import { getDeterministicObjectKeyName } from "./object-helpers.js";
import { normalizeValueSlotType } from "../core/semantic/value-slot-types.js";

type ObjectProperty = Extract<
  Extract<IrExpression, { kind: "object" }>["properties"][number],
  { kind: "property" }
>;

type AdapterMemberPlan = {
  readonly interfaceMember: Exclude<
    EffectiveInterfaceMember["member"],
    { readonly name: string; readonly kind: "indexSignature" }
  >;
  readonly declaringType?: Extract<IrType, { kind: "referenceType" }>;
  readonly property?: ObjectProperty;
  readonly expectedValueType: IrType;
};

const VOID_TYPE: IrType = { kind: "voidType" };

const adapterClassNameForKey = (key: string): string =>
  `__TsonicInterfaceObjectAdapter_${createHash("sha256")
    .update(key)
    .digest("hex")
    .slice(0, 16)}`;

const adapterTypeAst = (
  namespaceName: string,
  className: string,
  typeArguments: readonly CSharpTypeAst[] = []
): CSharpTypeAst =>
  identifierType(
    namespaceName.length > 0
      ? `global::${namespaceName}.${className}`
      : className,
    typeArguments.length > 0 ? typeArguments : undefined
  );

const memberStorageName = (index: number): string => `__tsonic_member_${index}`;

const isInterfaceMarkerMember = (member: IrInterfaceMember): boolean =>
  member.kind === "propertySignature" &&
  member.name.startsWith("__tsonic_iface_");

const functionTypeForMethod = (
  member: Extract<IrInterfaceMember, { kind: "methodSignature" }>
): IrType => ({
  kind: "functionType",
  typeParameters: member.typeParameters,
  parameters: member.parameters,
  returnType: member.returnType ?? VOID_TYPE,
});

const getMemberExpectedValueType = (member: IrInterfaceMember): IrType => {
  if (member.kind === "propertySignature") {
    return member.type;
  }
  return functionTypeForMethod(member);
};

const interfaceMemberHasSetter = (
  member: Extract<
    AdapterMemberPlan["interfaceMember"],
    { kind: "propertySignature" }
  >,
  declaringType: Extract<IrType, { kind: "referenceType" }> | undefined,
  fallbackInterface: Extract<IrType, { kind: "referenceType" }>,
  context: EmitterContext
): boolean =>
  !member.isReadonly ||
  isMutablePropertySlot(
    (declaringType ?? fallbackInterface).name,
    member.name,
    context
  );

const buildAdapterKey = (
  interfaceTypeAst: CSharpTypeAst,
  typeParameters: readonly string[],
  members: readonly InterfaceObjectAdapterMember[]
): string =>
  [
    printType(interfaceTypeAst),
    typeParameters.length > 0
      ? `typeparams:${typeParameters.join(",")}`
      : "typeparams:",
    ...members.map((member) =>
      member.kind === "method"
        ? [
            "method",
            printType(member.explicitInterface),
            member.name,
            printType(member.delegateType),
            printType(member.returnType),
            ...member.parameters.map((parameter) => printType(parameter.type)),
          ].join(":")
        : [
            "property",
            printType(member.explicitInterface),
            member.name,
            printType(member.valueType),
            member.isWritable ? "w" : "r",
          ].join(":")
    ),
  ].join("|");

const emitAdapterTypeAst = (
  type: IrType,
  context: EmitterContext
): [CSharpTypeAst, EmitterContext] => {
  const [typeAst, nextContext] = emitTypeAst(type, {
    ...context,
    qualifyLocalTypes: true,
  });
  return [
    typeAst,
    { ...nextContext, qualifyLocalTypes: context.qualifyLocalTypes },
  ];
};

const findModuleByLocalType = (
  context: EmitterContext,
  namespaceName: string,
  typeName: string
): ModuleIdentity | undefined => {
  for (const moduleInfo of context.options.moduleMap?.values() ?? []) {
    if (
      moduleInfo.namespace === namespaceName &&
      moduleInfo.localTypes?.has(typeName)
    ) {
      return moduleInfo;
    }
  }
  return undefined;
};

const interfaceMemberTypeContext = (
  interfaceType: Extract<IrType, { kind: "referenceType" }>,
  context: EmitterContext
): EmitterContext => {
  const resolved = resolveLocalTypeInfo(interfaceType, context);
  if (!resolved) {
    return context;
  }

  const moduleInfo = findModuleByLocalType(
    context,
    resolved.namespace,
    resolved.name
  );
  return {
    ...context,
    moduleNamespace: resolved.namespace,
    localTypes: moduleInfo?.localTypes ?? context.localTypes,
    publicLocalTypes: moduleInfo?.publicLocalTypes ?? context.publicLocalTypes,
  };
};

const restoreAdapterContext = (
  nextContext: EmitterContext,
  consumerContext: EmitterContext
): EmitterContext => ({
  ...nextContext,
  moduleNamespace: consumerContext.moduleNamespace,
  moduleStaticClassName: consumerContext.moduleStaticClassName,
  localTypes: consumerContext.localTypes,
  publicLocalTypes: consumerContext.publicLocalTypes,
  typeParameters: consumerContext.typeParameters,
  typeParamConstraints: consumerContext.typeParamConstraints,
  typeParameterNameMap: consumerContext.typeParameterNameMap,
  declaringTypeName: consumerContext.declaringTypeName,
  declaringTypeParameterNames: consumerContext.declaringTypeParameterNames,
  declaringTypeParameterNameMap: consumerContext.declaringTypeParameterNameMap,
  qualifyLocalTypes: consumerContext.qualifyLocalTypes,
});

const collectInterfaceMemberPlans = (
  expr: Extract<IrExpression, { kind: "object" }>,
  members: readonly EffectiveInterfaceMember[]
): readonly AdapterMemberPlan[] | undefined => {
  const properties = new Map<string, ObjectProperty>();
  for (const property of expr.properties) {
    if (property.kind === "spread") {
      return undefined;
    }
    const keyName = getDeterministicObjectKeyName(property.key);
    if (!keyName) {
      return undefined;
    }
    if (!properties.has(keyName)) {
      properties.set(keyName, property);
    }
  }

  const plans: AdapterMemberPlan[] = [];
  const seenMemberNames = new Set<string>();
  for (const entry of members) {
    const member = entry.member;
    if (isInterfaceMarkerMember(member)) {
      continue;
    }
    if (seenMemberNames.has(member.name)) {
      return undefined;
    }
    seenMemberNames.add(member.name);

    const property = properties.get(member.name);
    if (!property) {
      if (member.kind !== "propertySignature" || !member.isOptional) {
        return undefined;
      }
      plans.push({
        interfaceMember: member,
        declaringType: entry.declaringType,
        expectedValueType: getMemberExpectedValueType(member),
      });
      continue;
    }
    plans.push({
      interfaceMember: member,
      declaringType: entry.declaringType,
      property,
      expectedValueType: getMemberExpectedValueType(member),
    });
  }

  return plans.length > 0 ? plans : undefined;
};

const collectReferencedTypeParameterNames = (
  types: readonly IrType[],
  context: EmitterContext
): readonly string[] => {
  const inScope = context.typeParameters;
  if (!inScope || inScope.size === 0) {
    return [];
  }

  const result: string[] = [];
  const seenNames = new Set<string>();
  const seenTypes = new WeakSet<object>();
  const add = (name: string): void => {
    if (!inScope.has(name)) return;
    const rendered = context.typeParameterNameMap?.get(name) ?? name;
    if (seenNames.has(rendered)) return;
    seenNames.add(rendered);
    result.push(rendered);
  };

  const visit = (type: IrType | undefined): void => {
    if (!type) return;
    if (typeof type === "object" && type !== null) {
      if (seenTypes.has(type)) return;
      seenTypes.add(type);
    }

    switch (type.kind) {
      case "typeParameterType":
        add(type.name);
        return;
      case "referenceType":
        for (const arg of type.typeArguments ?? []) visit(arg);
        for (const member of type.structuralMembers ?? []) {
          if (member.kind === "propertySignature") {
            visit(member.type);
            continue;
          }
          for (const param of member.parameters) visit(param.type);
          visit(member.returnType);
        }
        return;
      case "arrayType":
        visit(type.elementType);
        return;
      case "tupleType":
        for (const element of type.elementTypes) visit(element);
        return;
      case "functionType":
        for (const param of type.parameters) visit(param.type);
        visit(type.returnType);
        return;
      case "objectType":
        for (const member of type.members) {
          if (member.kind === "propertySignature") {
            visit(member.type);
            continue;
          }
          for (const param of member.parameters) visit(param.type);
          visit(member.returnType);
        }
        return;
      case "dictionaryType":
        visit(type.keyType);
        visit(type.valueType);
        return;
      case "unionType":
      case "intersectionType":
        for (const nested of type.types) visit(nested);
        return;
      case "primitiveType":
      case "literalType":
      case "anyType":
      case "unknownType":
      case "voidType":
      case "neverType":
        return;
    }
  };

  for (const type of types) visit(type);
  return result;
};

export const tryEmitInterfaceObjectAdapter = (
  expr: Extract<IrExpression, { kind: "object" }>,
  context: EmitterContext,
  targetType: IrType | undefined
): [CSharpExpressionAst, EmitterContext] | undefined => {
  if (!targetType) {
    return undefined;
  }

  const strippedTarget = stripNullish(targetType);
  if (strippedTarget.kind !== "referenceType") {
    return undefined;
  }

  const resolved = resolveLocalTypeInfo(strippedTarget, context);
  if (!resolved || resolved.info.kind !== "interface") {
    return undefined;
  }
  if (!referenceTypeEmitsAsNativeInterface(strippedTarget, context)) {
    return undefined;
  }

  const memberPlans = collectInterfaceMemberPlans(
    expr,
    collectEffectiveInterfaceMemberEntries(
      resolved.info,
      context,
      strippedTarget
    )
  );
  if (!memberPlans) {
    return undefined;
  }

  let currentContext = context;
  const adapterTypeParameterNames = collectReferencedTypeParameterNames(
    [strippedTarget, ...memberPlans.map((plan) => plan.expectedValueType)],
    currentContext
  );
  const adapterTypeArguments = adapterTypeParameterNames.map((name) =>
    identifierType(name)
  );
  const [interfaceTypeAst, interfaceContext] = emitAdapterTypeAst(
    strippedTarget,
    currentContext
  );
  currentContext = interfaceContext;
  const safeInterfaceTypeAst =
    interfaceTypeAst.kind === "nullableType"
      ? interfaceTypeAst.underlyingType
      : interfaceTypeAst;

  const adapterMembers: InterfaceObjectAdapterMember[] = [];
  const argumentsAst: CSharpExpressionAst[] = [];

  for (let index = 0; index < memberPlans.length; index += 1) {
    const plan = memberPlans[index];
    if (!plan) continue;

    if (plan.interfaceMember.kind === "propertySignature") {
      const [explicitInterfaceAst, explicitInterfaceContext] =
        emitAdapterTypeAst(
          plan.declaringType ?? strippedTarget,
          currentContext
        );
      currentContext = explicitInterfaceContext;
      const memberTypeContext = interfaceMemberTypeContext(
        plan.declaringType ?? strippedTarget,
        currentContext
      );
      const [baseValueTypeAst, valueTypeContext] = emitAdapterTypeAst(
        normalizeValueSlotType(plan.interfaceMember.type),
        memberTypeContext
      );
      currentContext = restoreAdapterContext(valueTypeContext, currentContext);
      const valueTypeAst = plan.interfaceMember.isOptional
        ? nullableType(baseValueTypeAst)
        : baseValueTypeAst;
      const [valueAst, valueContext] = plan.property
        ? emitExpressionAst(
            plan.property.value,
            currentContext,
            plan.expectedValueType
          )
        : ([
            { kind: "defaultExpression", type: valueTypeAst },
            currentContext,
          ] as const);
      currentContext = valueContext;
      argumentsAst.push(valueAst);
      adapterMembers.push({
        kind: "property",
        name: emitCSharpName(
          plan.interfaceMember.name,
          "properties",
          currentContext
        ),
        storageName: memberStorageName(index),
        explicitInterface: explicitInterfaceAst,
        valueType: valueTypeAst,
        isWritable: interfaceMemberHasSetter(
          plan.interfaceMember,
          plan.declaringType,
          strippedTarget,
          currentContext
        ),
      });
      continue;
    }

    if (!plan.property) {
      return undefined;
    }

    const [valueAst, valueContext] = emitExpressionAst(
      plan.property.value,
      currentContext,
      plan.expectedValueType
    );
    currentContext = valueContext;
    argumentsAst.push(valueAst);

    const [explicitInterfaceAst, explicitInterfaceContext] =
      emitAdapterTypeAst(
        plan.declaringType ?? strippedTarget,
        currentContext
      );
    currentContext = explicitInterfaceContext;
    const methodType = functionTypeForMethod(plan.interfaceMember);
    const memberTypeContext = interfaceMemberTypeContext(
      plan.declaringType ?? strippedTarget,
      currentContext
    );
    const [delegateTypeAst, delegateTypeContext] = emitAdapterTypeAst(
      methodType,
      memberTypeContext
    );
    currentContext = restoreAdapterContext(delegateTypeContext, currentContext);
    const [returnTypeAst, returnTypeContext] = emitAdapterTypeAst(
      plan.interfaceMember.returnType ?? VOID_TYPE,
      memberTypeContext
    );
    currentContext = restoreAdapterContext(returnTypeContext, currentContext);
    const [parameterAsts, parameterContext] = emitParameters(
      plan.interfaceMember.parameters,
      { ...memberTypeContext, qualifyLocalTypes: true }
    );
    currentContext = restoreAdapterContext(parameterContext, currentContext);

    adapterMembers.push({
      kind: "method",
      name: emitCSharpName(
        plan.interfaceMember.name,
        "methods",
        currentContext
      ),
      storageName: memberStorageName(index),
      explicitInterface: explicitInterfaceAst,
      delegateType: delegateTypeAst,
      returnType: returnTypeAst,
      parameters: parameterAsts.map((parameter) => ({
        name: parameter.name,
        type: parameter.type,
        ...(parameter.modifiers ? { modifiers: parameter.modifiers } : {}),
      })),
    });
  }

  const key = buildAdapterKey(
    safeInterfaceTypeAst,
    adapterTypeParameterNames,
    adapterMembers
  );
  const className = adapterClassNameForKey(key);
  const namespaceName = context.options.rootNamespace;
  const registry = context.options.interfaceObjectAdapterRegistry;
  if (registry && !registry.definitions.has(key)) {
    registry.definitions.set(key, {
      key,
      namespaceName,
      className,
      typeParameters: adapterTypeParameterNames,
      interfaceType: safeInterfaceTypeAst,
      members: adapterMembers,
    });
  }

  return [
    {
      kind: "objectCreationExpression",
      type: adapterTypeAst(namespaceName, className, adapterTypeArguments),
      arguments: argumentsAst,
    },
    currentContext,
  ];
};
