import type {
  LoweringDeclarationPlan,
  LoweringParameterPlan,
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
  const type = parameter.optional
    ? renderNullableCSharpType(parameter.typeText)
    : renderCSharpType(parameter.typeText);
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
    const compactNameSource = (plan.nameSourceText ?? plan.sourceText).replace(
      /\s+/g,
      ""
    );
    if (
      plan.nameIsComputed &&
      compactNameSource.includes("[Symbol.asyncIterator]")
    ) {
      return "GetAsyncEnumerator";
    }
    if (
      plan.nameIsComputed &&
      compactNameSource.includes("[Symbol.iterator]")
    ) {
      return "GetEnumerator";
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
  const returnTypeText =
    className && plan.returnTypeText?.trim() === "this"
      ? sanitizeTypeName(className)
      : plan.returnTypeText;
  const returnType = renderFunctionReturnType(returnTypeText, plan.async);
  return [
    `public ${staticModifier}${asyncModifier}${returnType} ${name}${renderTypeParameters(plan.typeParameters)}(${parameters})`,
    renderFunctionBody(plan.body, context),
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
  const type = renderCSharpType(plan.returnTypeText ?? plan.declaredTypeText);
  const initializer = plan.initializer
    ? ` = ${renderExpression(plan.initializer, context)}`
    : "";
  const staticModifier = plan.static ? "static " : "";
  const suffix = initializer.length > 0 ? ";" : "";
  return `public ${staticModifier}${type} ${sanitizeIdentifier(declarationName)} { get; set; }${initializer}${suffix}`;
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
      const name = requireDeclarationName(plan, context, "interface member");
      if (!name) return undefined;
      const parameters = plan.parameters
        .map((parameter) => renderParameter(parameter, context))
        .join(", ");
      return `${renderCSharpType(plan.returnTypeText)} ${sanitizeIdentifier(name)}${renderTypeParameters(plan.typeParameters)}(${parameters});`;
    }
    case "property": {
      const name = requireDeclarationName(plan, context, "interface member");
      if (!name) return undefined;
      return `${renderCSharpType(plan.returnTypeText ?? plan.declaredTypeText)} ${sanitizeIdentifier(name)} { get; set; }`;
    }
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
        ? ` = ${member.initializer.literalText ?? "0"}`
        : "";
      return `    ${sanitizeIdentifier(member.name)}${initializer}${suffix}`;
    }),
    "}",
  ].join("\n");
};

const renderVariable = (
  plan: LoweringDeclarationPlan,
  context: RenderContext
): string | undefined => {
  const declarationName = requireDeclarationName(plan, context, "variable");
  if (!declarationName) return undefined;
  return renderStaticField(
    {
      name: declarationName,
      typeText: plan.returnTypeText ?? plan.declaredTypeText,
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
      return undefined;
    case "method":
    case "constructor":
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
