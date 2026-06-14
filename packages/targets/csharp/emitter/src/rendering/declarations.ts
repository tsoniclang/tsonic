import type {
  LoweringDeclarationPlan,
  LoweringParameterPlan,
  LoweringTypeMemberPlan,
} from "@tsonic/frontend";
import type { RenderContext } from "../types.js";
import { sanitizeIdentifier, sanitizeTypeName } from "./names.js";
import { renderExpression } from "./expressions.js";
import {
  renderFunctionBody,
  renderStaticField,
} from "./statements.js";
import {
  renderCSharpType,
  renderFunctionReturnType,
  renderNullableCSharpType,
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
    ? ` = ${renderExpression(parameter.initializer, context)}`
    : parameter.optional
      ? " = null"
    : "";
  const restModifier = parameter.rest ? "params " : "";
  const type =
    parameter.rest && parameter.type?.kind === "array"
      ? `${renderCSharpType(parameter.type.elementType, context)}[]`
      : parameter.optional
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
        return "ToStringTag";
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
  className?: string
): string | undefined => {
  const declarationName = requireDeclarationName(plan, context, "function");
  if (!declarationName) return undefined;
  const name = sanitizeIdentifier(declarationName);
  if (!plan.body) return undefined;
  const parameters = plan.parameters
    .map((parameter) => renderParameter(parameter, context))
    .join(", ");
  const asyncModifier = plan.async ? "async " : "";
  const staticModifier = insideClass
    ? plan.static
      ? "static "
      : ""
    : "static ";
  const returnType =
    className && plan.returnType?.kind === "intrinsic" && plan.returnType.name === "this"
      ? sanitizeTypeName(className)
      : renderFunctionReturnType(plan.returnType, plan.async, context);
  return [
    `public ${staticModifier}${asyncModifier}${returnType} ${name}${renderTypeParameters(plan.typeParameters)}(${parameters})`,
    renderFunctionBody(plan.body, context, plan.returnType),
  ].join("\n");
};

const renderConstructor = (
  plan: LoweringDeclarationPlan,
  context: RenderContext,
  className: string
): string | undefined => {
  if (!plan.body) return undefined;
  const parameters = plan.parameters
    .map((parameter) => renderParameter(parameter, context))
    .join(", ");
  return [`public ${sanitizeTypeName(className)}(${parameters})`, renderFunctionBody(plan.body, context)].join("\n");
};

const renderProperty = (
  plan: LoweringDeclarationPlan,
  context: RenderContext
): string | undefined => {
  const declarationName = requireDeclarationName(plan, context, "property");
  if (!declarationName) return undefined;
  const type = renderCSharpType(plan.returnType ?? plan.declaredTypePlan, context);
  const initializer = plan.initializer
    ? ` = ${renderExpression(plan.initializer, context)}`
    : "";
  const staticModifier = plan.static ? "static " : "";
  const suffix = initializer.length > 0 ? ";" : "";
  return `public ${staticModifier}${type} ${sanitizeIdentifier(declarationName)} { get; set; }${initializer}${suffix}`;
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
  className: string
): string | undefined => {
  switch (plan.declarationKind) {
    case "method":
      return renderFunction(plan, context, true, className);
    case "constructor":
      return renderConstructor(plan, context, className);
    case "property":
      return renderProperty(plan, context);
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

const renderClass = (
  plan: LoweringDeclarationPlan,
  context: RenderContext
): string | undefined => {
  const declarationName = requireDeclarationName(plan, context, "class");
  if (!declarationName) return undefined;
  return [
    `public sealed class ${sanitizeTypeName(declarationName)}${renderTypeParameters(plan.typeParameters)}`,
    "{",
    ...plan.members
      .map((member) => renderClassMember(member, context, declarationName))
      .filter((rendered): rendered is string => rendered !== undefined)
      .map((rendered) => indent(rendered, 4)),
    "}",
  ].join("\n");
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

const renderTypeAlias = (
  plan: LoweringDeclarationPlan,
  context: RenderContext
): string | undefined => {
  const declarationName = requireDeclarationName(plan, context, "type alias");
  if (!declarationName) return undefined;
  const name = sanitizeTypeName(declarationName);
  const target = plan.typeAliasTarget;
  if (target?.kind === "function") {
    const parameters = target.parameters
      .map((parameter) => renderParameter(parameter, context))
      .join(", ");
    return `public delegate ${renderCSharpType(target.returnType, context)} ${name}${renderTypeParameters(plan.typeParameters)}(${parameters});`;
  }
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
