import type {
  LoweringDeclarationPlan,
  LoweringParameterPlan,
  LoweringStatementPlan,
  LoweringTypeMemberPlan,
} from "@tsonic/frontend";
import type { RenderContext } from "../types.js";
import { sanitizeIdentifier, sanitizeTypeName } from "./names.js";
import { renderExpression, renderExpressionWithUseSiteCast } from "./expressions.js";
import {
  renderFunctionBody,
  renderStaticField,
} from "./statements.js";
import {
  isRecursiveRuntimeArrayArm,
  renderCSharpType,
  renderFunctionReturnType,
  renderNullableCSharpType,
  runtimeUnionCarrierArms,
} from "./types.js";

const indent = (text: string, spaces: number): string => {
  const prefix = " ".repeat(spaces);
  return text
    .split("\n")
    .map((line) => (line.length === 0 ? line : `${prefix}${line}`))
    .join("\n");
};

const renderParameter = (
  parameter: LoweringParameterPlan,
  context: RenderContext
): string => {
  const initializer = parameter.initializer
    ? " = default"
    : parameter.optional
      ? " = null"
      : "";
  const restModifier = parameter.rest ? "params " : "";
  const type =
    parameter.rest && parameter.type?.kind === "array"
      ? `${renderCSharpType(parameter.type.elementType, context)}[]`
      : parameter.optional || parameter.initializer
        ? renderNullableCSharpType(parameter.type, context)
        : renderCSharpType(parameter.type, context);
  return `${restModifier}${type} ${sanitizeIdentifier(parameter.name)}${initializer}`;
};

const renderTypeParameters = (
  typeParameters: readonly string[] | undefined
): string =>
  typeParameters && typeParameters.length > 0
    ? `<${typeParameters.map((name) => sanitizeTypeName(name)).join(", ")}>`
    : "";

const withTypeParameterScope = <T>(
  context: RenderContext,
  typeParameters: readonly string[] | undefined,
  render: () => T
): T => {
  if (!typeParameters || typeParameters.length === 0) {
    return render();
  }
  const previous = context.currentTypeParameters;
  const next = new Set(previous ?? []);
  for (const typeParameter of typeParameters) {
    next.add(typeParameter);
  }
  context.currentTypeParameters = next;
  try {
    return render();
  } finally {
    context.currentTypeParameters = previous;
  }
};

const isBroadSourceType = (type: LoweringParameterPlan["type"]): boolean =>
  type?.kind === "intrinsic" &&
  (type.name === "any" || type.name === "unknown" || type.name === "object");

const requireDeclarationName = (
  plan: LoweringDeclarationPlan,
  context: RenderContext,
  feature: string
): string | undefined => {
  if (plan.nameIsComputed || !plan.name) {
    switch (plan.computedName) {
      case "symbol-async-iterator":
        return "GetAsyncEnumerator";
      case "symbol-iterator":
        return "GetEnumerator";
      case "symbol-to-string-tag":
        return "__tsonic_symbol_toStringTag";
      case undefined:
        break;
    }
    context.reportUnsupported(
      `${feature} name`,
      plan.nameSourceKindName ?? plan.sourceKindName,
      plan.sourceText
    );
    return undefined;
  }
  return plan.name;
};

const renderFunction = (
  plan: LoweringDeclarationPlan,
  context: RenderContext,
  insideClass: boolean,
  className?: string,
  heritageTypes: readonly LoweringDeclarationPlan["heritageTypes"][number][] = []
): string | undefined => {
  return withTypeParameterScope(context, plan.typeParameters, () => {
  const declarationName = requireDeclarationName(plan, context, "function");
  if (!declarationName) return undefined;
  const name = sanitizeIdentifier(declarationName);
  if (!plan.body) return undefined;
  const parameters = plan.parameters
    .map((parameter) => renderParameter(parameter, context))
    .join(", ");
  const asyncModifier = plan.async ? "async " : "";
  const accessibility = insideClass
    ? (context.overrideMemberAccessibility(heritageTypes, plan) ??
      plan.accessibility)
    : "public";
  const staticModifier = insideClass ? (plan.static ? "static " : "") : "static ";
  const canRenderOverride =
    insideClass &&
    plan.override &&
    !plan.parameters.some((parameter) => isBroadSourceType(parameter.type));
  const overrideModifier = canRenderOverride ? "override " : "";
  const virtualModifier =
    insideClass && !plan.static && !canRenderOverride ? "virtual " : "";
  const effectiveReturnType =
    className &&
    plan.returnType?.kind === "intrinsic" &&
    plan.returnType.name === "this"
      ? ({ kind: "named", name: className, typeArguments: [] } as const)
      : plan.returnType;
  const returnType = renderFunctionReturnType(
    effectiveReturnType,
    plan.async,
    context
  );
  const bodyReturnType =
    plan.async &&
    effectiveReturnType?.kind === "named" &&
    effectiveReturnType.name === "Promise"
      ? effectiveReturnType.typeArguments[0]
      : effectiveReturnType;
  return [
    `${accessibility} ${staticModifier}${overrideModifier}${virtualModifier}${asyncModifier}${returnType} ${name}${renderTypeParameters(plan.typeParameters)}(${parameters})`,
    renderFunctionBody(plan.body, context, bodyReturnType, plan.parameters),
  ].join("\n");
  });
};

const renderConstructor = (
  plan: LoweringDeclarationPlan,
  context: RenderContext,
  className: string,
  prologueStatements: readonly string[] = []
): string | undefined => {
  if (!plan.body) return undefined;
  const parameters = plan.parameters
    .map((parameter) => renderParameter(parameter, context))
    .join(", ");
  const superCall = leadingSuperConstructorCall(plan.body);
  const body = superCall ? removeLeadingSuperConstructorCall(plan.body) : plan.body;
  const baseInitializer =
    superCall && superCall.arguments.length > 0
      ? ` : base(${superCall.arguments.map((argument) => renderExpression(argument, context)).join(", ")})`
      : "";
  const renderedBody = renderFunctionBody(body, context, undefined, plan.parameters);
  const bodyLines = renderedBody.split("\n");
  const bodyWithPrologue =
    prologueStatements.length === 0
      ? renderedBody
      : [
          "{",
          ...prologueStatements.map((statement) => indent(statement, 4)),
          ...bodyLines.slice(1, -1),
          "}",
        ].join("\n");
  return [
    `${plan.accessibility} ${sanitizeTypeName(className)}(${parameters})${baseInitializer}`,
    bodyWithPrologue,
  ].join("\n");
};

const renderSynthesizedConstructor = (
  className: string,
  parameters: readonly LoweringParameterPlan[],
  prologueStatements: readonly string[],
  context: RenderContext
): string | undefined => {
  if (parameters.length === 0 && prologueStatements.length === 0) {
    return undefined;
  }
  const renderedParameters = parameters
    .map((parameter) => renderParameter(parameter, context))
    .join(", ");
  const baseInitializer =
    parameters.length > 0
      ? ` : base(${parameters.map((parameter) => sanitizeIdentifier(parameter.name)).join(", ")})`
      : "";
  return [
    `public ${sanitizeTypeName(className)}(${renderedParameters})${baseInitializer}`,
    "{",
    ...prologueStatements.map((statement) => indent(statement, 4)),
    "}",
  ].join("\n");
};

const leadingSuperConstructorCall = (
  body: LoweringStatementPlan | undefined
) => {
  const first =
    body?.statementKind === "block" ? body.statements[0] : body;
  return first?.statementKind === "expression" &&
    first.expression?.expressionKind === "call" &&
    first.expression.expression?.expressionKind === "super"
    ? first.expression
    : undefined;
};

const removeLeadingSuperConstructorCall = (
  body: LoweringStatementPlan
): LoweringStatementPlan => {
  if (body.statementKind !== "block") {
    return { ...body, statementKind: "empty" };
  }
  return { ...body, statements: body.statements.slice(1) };
};

const renderProperty = (
  plan: LoweringDeclarationPlan,
  context: RenderContext,
  heritageTypes: readonly LoweringDeclarationPlan["heritageTypes"][number][] = []
): string | undefined => {
  const declarationName = requireDeclarationName(plan, context, "property");
  if (!declarationName) return undefined;
  const type = renderCSharpType(plan.returnType ?? plan.declaredTypePlan, context);
  const initializer = plan.static && plan.initializer
    ? ` = ${renderExpressionWithUseSiteCast(
        plan.initializer,
        context,
        plan.returnType ?? plan.declaredTypePlan
      )}`
    : "";
  const staticModifier = plan.static ? "static " : "";
  const overrideModifier = plan.override ? "override " : "";
  const suffix = initializer.length > 0 ? ";" : "";
  const accessibility =
    context.overrideMemberAccessibility(heritageTypes, plan) ??
    plan.accessibility;
  return `${accessibility} ${staticModifier}${overrideModifier}${type} ${sanitizeIdentifier(declarationName)} { get; set; }${initializer}${suffix}`;
};

const renderIndexSignature = (
  parameters: readonly LoweringParameterPlan[],
  valueType: LoweringDeclarationPlan["returnType"],
  context: RenderContext,
  includePublic: boolean
): string => {
  const [parameter] = parameters;
  const keyType = renderCSharpType(parameter?.type, context);
  const keyName = sanitizeIdentifier(parameter?.name ?? "key");
  const type = renderCSharpType(valueType, context);
  return `${includePublic ? "public " : ""}${type} this[${keyType} ${keyName}] { get; set; }`;
};

const renderClassMember = (
  plan: LoweringDeclarationPlan,
  context: RenderContext,
  className: string,
  constructorPrologueStatements: readonly string[],
  heritageTypes: readonly LoweringDeclarationPlan["heritageTypes"][number][]
): string | undefined => {
  switch (plan.declarationKind) {
    case "method":
      return renderFunction(plan, context, true, className, heritageTypes);
    case "constructor":
      return renderConstructor(plan, context, className, constructorPrologueStatements);
    case "property":
      return renderProperty(plan, context, heritageTypes);
    case "index-signature":
      return renderIndexSignature(plan.parameters, plan.returnType, context, true);
    default:
      context.reportUnsupported(
        "class member",
        plan.sourceKindName,
        plan.sourceText
      );
      return undefined;
  }
};

const isAccessorProperty = (member: LoweringDeclarationPlan): boolean =>
  member.declarationKind === "property" &&
  (member.sourceKindName === "KindGetAccessor" ||
    member.sourceKindName === "KindSetAccessor");

const coalesceAccessorMembers = (
  members: readonly LoweringDeclarationPlan[]
): readonly LoweringDeclarationPlan[] => {
  const result: LoweringDeclarationPlan[] = [];
  const accessorIndexes = new Map<string, number>();
  for (const member of members) {
    if (!isAccessorProperty(member) || !member.name) {
      result.push(member);
      continue;
    }
    const key = `${member.static ? "static" : "instance"}\0${member.name}`;
    const existingIndex = accessorIndexes.get(key);
    if (existingIndex === undefined) {
      accessorIndexes.set(key, result.length);
      result.push(member);
      continue;
    }
    const existing = result[existingIndex];
    if (!existing) {
      result.push(member);
      continue;
    }
    result[existingIndex] = {
      ...existing,
      declaredTypePlan: existing.declaredTypePlan ?? member.declaredTypePlan,
      returnType: existing.returnType ?? member.returnType,
      initializer: existing.initializer ?? member.initializer,
      override: existing.override || member.override,
      accessibility:
        existing.accessibility === "public" ? member.accessibility : existing.accessibility,
      accessibilityExplicit:
        existing.accessibilityExplicit || member.accessibilityExplicit,
    };
  }
  return result;
};

const renderClass = (
  plan: LoweringDeclarationPlan,
  context: RenderContext
): string | undefined => {
  return withTypeParameterScope(context, plan.typeParameters, () => {
  const declarationName = requireDeclarationName(plan, context, "class");
  if (!declarationName) return undefined;
  const members = coalesceAccessorMembers(plan.members);
  const heritage = plan.heritageTypes
    .filter(
      (heritageType) =>
        !(heritageType.kind === "named" && heritageType.name === "struct")
    )
    .map((heritageType) => renderCSharpType(heritageType, context));
  const heritageClause =
    heritage.length > 0 ? ` : ${heritage.join(", ")}` : "";
  const constructorPrologueStatements = members
    .filter(
      (member) =>
        member.declarationKind === "property" &&
        !member.static &&
        member.initializer !== undefined &&
        requireDeclarationName(member, context, "property") !== undefined
    )
    .map(
      (member) =>
        `this.${sanitizeIdentifier(member.name ?? "")} = ${renderExpressionWithUseSiteCast(
          member.initializer,
          context,
          member.returnType ?? member.declaredTypePlan
        )};`
    );
  const hasConstructor = members.some(
    (member) => member.declarationKind === "constructor"
  );
  const synthesizedConstructor =
    !hasConstructor
      ? renderSynthesizedConstructor(
          declarationName,
          plan.baseConstructorParameters,
          constructorPrologueStatements,
          context
        )
      : undefined;
  return [
    `public class ${sanitizeTypeName(declarationName)}${renderTypeParameters(plan.typeParameters)}${heritageClause}`,
    "{",
    ...members
      .map((member) =>
        renderClassMember(
          member,
          context,
          declarationName,
          constructorPrologueStatements,
          plan.heritageTypes
        )
      )
      .filter((rendered): rendered is string => rendered !== undefined)
      .map((rendered) => indent(rendered, 4)),
    ...(synthesizedConstructor ? [indent(synthesizedConstructor, 4)] : []),
    "}",
  ].join("\n");
  });
};

const renderInterfaceMember = (
  plan: LoweringDeclarationPlan,
  context: RenderContext
): string | undefined => {
  switch (plan.declarationKind) {
    case "method": {
      const name =
        plan.sourceKindName === "KindCallSignature"
          ? "Invoke"
          : requireDeclarationName(plan, context, "interface member");
      if (!name) return undefined;
      const parameters = plan.parameters
        .map((parameter) => renderParameter(parameter, context))
        .join(", ");
      return `${renderCSharpType(plan.returnType, context)} ${sanitizeIdentifier(name)}${renderTypeParameters(plan.typeParameters)}(${parameters});`;
    }
    case "property": {
      const name = requireDeclarationName(plan, context, "interface member");
      if (!name) return undefined;
      return `${renderCSharpType(plan.returnType ?? plan.declaredTypePlan, context)} ${sanitizeIdentifier(name)} { get; set; }`;
    }
    case "index-signature":
      return renderIndexSignature(plan.parameters, plan.returnType, context, false);
    default:
      context.reportUnsupported(
        "interface member",
        plan.sourceKindName,
        plan.sourceText
      );
      return undefined;
  }
};

const renderInterface = (
  plan: LoweringDeclarationPlan,
  context: RenderContext
): string | undefined => {
  const declarationName = requireDeclarationName(plan, context, "interface");
  if (!declarationName) return undefined;
  const callSignature =
    plan.members.length === 1 &&
    plan.members[0]?.declarationKind === "method" &&
    plan.members[0].sourceKindName === "KindCallSignature"
      ? plan.members[0]
      : undefined;
  if (callSignature) {
    const parameters = callSignature.parameters
      .map((parameter) => renderParameter(parameter, context))
      .join(", ");
    return `public delegate ${renderCSharpType(callSignature.returnType, context)} ${sanitizeTypeName(declarationName)}${renderTypeParameters(plan.typeParameters)}(${parameters});`;
  }
  if (plan.members.every((member) => member.declarationKind === "property")) {
    return [
      `public sealed class ${sanitizeTypeName(declarationName)}${renderTypeParameters(plan.typeParameters)}`,
      "{",
      ...plan.members
        .map((member) => renderProperty(member, context))
        .filter((rendered): rendered is string => rendered !== undefined)
        .map((rendered) => indent(rendered, 4)),
      "}",
    ].join("\n");
  }
  return [
    `public interface ${sanitizeTypeName(declarationName)}${renderTypeParameters(plan.typeParameters)}`,
    "{",
    ...plan.members
      .map((member) => renderInterfaceMember(member, context))
      .filter((rendered): rendered is string => rendered !== undefined)
      .map((rendered) => indent(rendered, 4)),
    "}",
  ].join("\n");
};

const renderEnum = (
  plan: LoweringDeclarationPlan,
  context: RenderContext
): string | undefined => {
  const declarationName = requireDeclarationName(plan, context, "enum");
  if (!declarationName) return undefined;
  return [
    `public enum ${sanitizeTypeName(declarationName)}`,
    "{",
    ...plan.enumMembers.map((member, index) => {
      const suffix = index === plan.enumMembers.length - 1 ? "" : ",";
      const initializer = member.initializer
        ? ` = ${renderExpression(member.initializer, context)}`
        : "";
      return `    ${sanitizeIdentifier(member.name)}${initializer}${suffix}`;
    }),
    "}",
  ].join("\n");
};

const renderTypeMemberAlias = (
  member: LoweringTypeMemberPlan,
  context: RenderContext,
  includePublic: boolean
): string => {
  switch (member.kind) {
    case "property":
      return `${includePublic ? "public " : ""}${renderCSharpType(member.type, context)} ${sanitizeIdentifier(member.name)} { get; set; }`;
    case "method":
      return `${renderCSharpType(member.returnType, context)} ${sanitizeIdentifier(member.name)}${renderTypeParameters(member.typeParameters)}(${member.parameters
        .map((parameter) => renderParameter(parameter, context))
        .join(", ")});`;
    case "index-signature": {
      const keyType = renderCSharpType(member.keyType, context);
      const valueType = renderCSharpType(member.valueType, context);
      return `${includePublic ? "public " : ""}${valueType} this[${keyType} key] { get; set; }`;
    }
  }
};

const renderRuntimeUnionCarrier = (
  name: string,
  typeParameters: readonly string[] | undefined,
  target: LoweringDeclarationPlan["typeAliasTarget"],
  context: RenderContext
): string | undefined => {
  if (!target) return undefined;
  const carrierType = {
    kind: "named",
    name,
    typeArguments: [],
    aliasTarget: target,
    declarationKind: "type-alias",
  } as const;
  const arms = runtimeUnionCarrierArms(carrierType, context);
  if (arms.length === 0) return undefined;
  const typeParameterList = renderTypeParameters(typeParameters);
  const typeName = `${name}${typeParameterList}`;
  return [
    `public sealed class ${typeName}`,
    "{",
    "    private readonly object? value;",
    `    private ${name}(object? value)`,
    "    {",
    "        this.value = value;",
    "    }",
    "",
    "    public object? Value => this.value;",
    "",
    ...arms.flatMap((arm, index) => {
      const armNumber = index + 1;
      const armType = renderCSharpType(arm, context);
      const nullableArmType = renderNullableCSharpType(arm, context);
      const recursiveArrayArm = isRecursiveRuntimeArrayArm(arm, carrierType);
      return [
        `    public static ${typeName} From${armNumber}(${armType} value) => new ${name}(value);`,
        ...(recursiveArrayArm
          ? [
              `    public static ${typeName} From${armNumber}(object?[] value) => From${armNumber}(global::System.Linq.Enumerable.ToArray(global::System.Linq.Enumerable.Select(value, FromValue)));`,
              `    public static ${typeName} From${armNumber}(global::System.Collections.Generic.List<object?> value) => From${armNumber}(global::System.Linq.Enumerable.ToArray(global::System.Linq.Enumerable.Select(value, FromValue)));`,
            ]
          : []),
        `    public ${nullableArmType} As${armNumber}() => this.value is ${armType} value ? value : default;`,
        "",
      ];
    }),
    `    public static ${typeName} FromNull() => new ${name}(null);`,
    "    public static " + typeName + " FromValue(object? value)",
    "    {",
    "        if (value == null) return FromNull();",
    ...arms.flatMap((arm, index) => {
      const armNumber = index + 1;
      const armType = renderCSharpType(arm, context);
      const recursiveArrayArm = isRecursiveRuntimeArrayArm(arm, carrierType);
      return [
        ...(recursiveArrayArm
          ? [
              `        if (value is object?[] array${armNumber}) return From${armNumber}(array${armNumber});`,
              `        if (value is global::System.Collections.Generic.List<object?> list${armNumber}) return From${armNumber}(list${armNumber});`,
            ]
          : []),
        `        if (value is ${armType} value${armNumber}) return From${armNumber}(value${armNumber});`,
      ];
    }),
    `        throw new global::System.InvalidCastException("Value cannot be converted to ${name}.");`,
    "    }",
    "    public bool IsNull => this.value == null;",
    "}",
  ].join("\n");
};

const renderTypeAlias = (
  plan: LoweringDeclarationPlan,
  context: RenderContext
): string | undefined => {
  const declarationName = requireDeclarationName(plan, context, "type alias");
  if (!declarationName) return undefined;
  const name = sanitizeTypeName(declarationName);
  const target = plan.typeAliasTarget;
  const functionTarget =
    target?.kind === "function"
      ? target
      : target?.kind === "named" && target.aliasTarget?.kind === "function"
        ? target.aliasTarget
        : undefined;
  if (functionTarget) {
    const parameters = functionTarget.parameters
      .map((parameter) => renderParameter(parameter, context))
      .join(", ");
    return `public delegate ${renderFunctionReturnType(functionTarget.returnType, false, context)} ${name}${renderTypeParameters(plan.typeParameters)}(${parameters});`;
  }
  const unionTarget =
    target?.kind === "union"
      ? target
      : target?.kind === "named" && target.aliasTarget?.kind === "union"
        ? target.aliasTarget
        : undefined;
  const unionCarrier = renderRuntimeUnionCarrier(
    name,
    plan.typeParameters,
    unionTarget,
    context
  );
  if (unionCarrier) return unionCarrier;
  if (target?.kind === "object") {
    const hasMethods = target.members.some((member) => member.kind === "method");
    if (hasMethods) {
      return [
        `public interface ${name}${renderTypeParameters(plan.typeParameters)}`,
        "{",
        ...target.members
          .map((member) => `    ${renderTypeMemberAlias(member, context, false)}`),
        "}",
      ].join("\n");
    }
    return [
      `public sealed class ${name}${renderTypeParameters(plan.typeParameters)}`,
      "{",
      ...target.members.map(
        (member) => `    ${renderTypeMemberAlias(member, context, true)}`
      ),
      "}",
    ].join("\n");
  }
  return undefined;
};

const renderVariable = (
  plan: LoweringDeclarationPlan,
  context: RenderContext
): string | undefined => {
  const declarationName = requireDeclarationName(plan, context, "variable");
  if (!declarationName) return undefined;
  const initializer = plan.initializer;
  if (
    initializer &&
    (initializer.expressionKind === "arrow-function" ||
      initializer.expressionKind === "function-expression") &&
    initializer.parameters.some(
      (parameter) => parameter.initializer !== undefined || parameter.optional
    )
  ) {
    const delegateName = `${sanitizeTypeName(declarationName)}__Delegate`;
    const parameters = initializer.parameters
      .map((parameter) => renderParameter(parameter, context))
      .join(", ");
    const returnType = renderFunctionReturnType(
      initializer.returnType,
      initializer.async ?? false,
      context
    );
    return [
      `public delegate ${returnType} ${delegateName}(${parameters});`,
      `public static ${delegateName} ${sanitizeIdentifier(declarationName)} = ${renderExpressionWithUseSiteCast(
        initializer,
        context,
        plan.returnType ?? plan.declaredTypePlan
      )};`,
    ].join("\n");
  }
  return renderStaticField(
    {
      sourceNode: plan.sourceNode,
      name: declarationName,
      type: plan.returnType ?? plan.declaredTypePlan,
      initializer: plan.initializer,
      bindingElements: [],
    },
    context
  );
};

export const renderDeclaration = (
  plan: LoweringDeclarationPlan,
  context: RenderContext
): string | undefined => {
  switch (plan.declarationKind) {
    case "class":
      return renderClass(plan, context);
    case "enum":
      return renderEnum(plan, context);
    case "function":
      return renderFunction(plan, context, false);
    case "interface":
      return renderInterface(plan, context);
    case "variable":
      return renderVariable(plan, context);
    case "type-alias":
      return renderTypeAlias(plan, context);
    case "method":
    case "constructor":
    case "index-signature":
    case "property":
    case "unknown":
      context.reportUnsupported("declaration", plan.sourceKindName, plan.sourceText);
      return undefined;
  }
};

export const renderStaticContainerMember = (
  plan: LoweringDeclarationPlan,
  context: RenderContext
): string | undefined => {
  const rendered = renderDeclaration(plan, context);
  return rendered ? indent(rendered, 4) : undefined;
};
