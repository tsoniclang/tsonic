import { createHash } from "node:crypto";
import type {
  IrExpression,
  IrInterfaceMember,
  IrType,
} from "@tsonic/frontend";
import { EmitterContext } from "../types.js";
import { emitTypeAst } from "../type-emitter.js";
import { emitExpressionAst } from "../expression-emitter.js";
import { emitParameters } from "../statements/classes/parameters.js";
import { emitCSharpName } from "../naming-policy.js";
import {
  identifierType,
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
import { getDeterministicObjectKeyName } from "./object-helpers.js";

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
  readonly property: ObjectProperty;
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
  className: string
): CSharpTypeAst =>
  identifierType(
    namespaceName.length > 0
      ? `global::${namespaceName}.${className}`
      : className
  );

const memberStorageName = (index: number): string =>
  `__tsonic_member_${index}`;

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

const buildAdapterKey = (
  interfaceTypeAst: CSharpTypeAst,
  members: readonly InterfaceObjectAdapterMember[]
): string =>
  [
    printType(interfaceTypeAst),
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
      return undefined;
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

export const tryEmitInterfaceObjectAdapter = (
  expr: Extract<IrExpression, { kind: "object" }>,
  context: EmitterContext,
  targetType: IrType | undefined
): [CSharpExpressionAst, EmitterContext] | undefined => {
  if (!targetType || !referenceTypeEmitsAsNativeInterface(targetType, context)) {
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
  const [interfaceTypeAst, interfaceContext] = emitTypeAst(
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

    const [valueAst, valueContext] = emitExpressionAst(
      plan.property.value,
      currentContext,
      plan.expectedValueType
    );
    currentContext = valueContext;
    argumentsAst.push(valueAst);

    if (plan.interfaceMember.kind === "propertySignature") {
      const [explicitInterfaceAst, explicitInterfaceContext] = emitTypeAst(
        plan.declaringType ?? strippedTarget,
        currentContext
      );
      currentContext = explicitInterfaceContext;
      const [valueTypeAst, valueTypeContext] = emitTypeAst(
        plan.interfaceMember.type,
        currentContext
      );
      currentContext = valueTypeContext;
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
        isWritable: !plan.interfaceMember.isReadonly,
      });
      continue;
    }

    const [explicitInterfaceAst, explicitInterfaceContext] = emitTypeAst(
      plan.declaringType ?? strippedTarget,
      currentContext
    );
    currentContext = explicitInterfaceContext;
    const methodType = functionTypeForMethod(plan.interfaceMember);
    const [delegateTypeAst, delegateTypeContext] = emitTypeAst(
      methodType,
      currentContext
    );
    currentContext = delegateTypeContext;
    const [returnTypeAst, returnTypeContext] = emitTypeAst(
      plan.interfaceMember.returnType ?? VOID_TYPE,
      currentContext
    );
    currentContext = returnTypeContext;
    const [parameterAsts, parameterContext] = emitParameters(
      plan.interfaceMember.parameters,
      currentContext
    );
    currentContext = parameterContext;

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

  const key = buildAdapterKey(safeInterfaceTypeAst, adapterMembers);
  const className = adapterClassNameForKey(key);
  const namespaceName = context.options.rootNamespace;
  const registry = context.options.interfaceObjectAdapterRegistry;
  if (registry && !registry.definitions.has(key)) {
    registry.definitions.set(key, {
      key,
      namespaceName,
      className,
      interfaceType: safeInterfaceTypeAst,
      members: adapterMembers,
    });
  }

  return [
    {
      kind: "objectCreationExpression",
      type: adapterTypeAst(namespaceName, className),
      arguments: argumentsAst,
    },
    currentContext,
  ];
};
