import type {
  LoweringDeclarationPlan,
  LoweringParameterPlan,
} from "@tsonic/frontend";
import { sanitizeIdentifier, sanitizeTypeName } from "./names.js";
import { renderCSharpType, renderFunctionReturnType } from "./types.js";

const indent = (text: string, spaces: number): string => {
  const prefix = " ".repeat(spaces);
  return text
    .split("\n")
    .map((line) => (line.length === 0 ? line : `${prefix}${line}`))
    .join("\n");
};

const renderParameter = (parameter: LoweringParameterPlan): string =>
  `${renderCSharpType(parameter.typeText)} ${sanitizeIdentifier(parameter.name)}`;

const sourcePreview = (sourceText: string): string =>
  sourceText.replace(/\s+/g, " ").split("*/").join("* /").slice(0, 240);

const unsupportedBody = (sourceKindName: string, sourceText: string): string =>
  [
    "{",
    `    throw new global::System.NotImplementedException("C# lowering for ${sourceKindName} is not complete.");`,
    `    // Source: ${sourcePreview(sourceText)}`,
    "}",
  ].join("\n");

const renderFunction = (plan: LoweringDeclarationPlan): string => {
  const name = sanitizeIdentifier(plan.name);
  const parameters = plan.parameters.map(renderParameter).join(", ");
  const asyncModifier = plan.async ? "async " : "";
  const returnType = renderFunctionReturnType(plan.returnTypeText, plan.async);
  return [
    `public static ${asyncModifier}${returnType} ${name}(${parameters})`,
    unsupportedBody(plan.sourceKindName, plan.sourceText),
  ].join("\n");
};

const renderClass = (plan: LoweringDeclarationPlan): string =>
  [
    `public sealed class ${sanitizeTypeName(plan.name)}`,
    "{",
    "}",
  ].join("\n");

const renderInterface = (plan: LoweringDeclarationPlan): string =>
  [
    `public interface ${sanitizeTypeName(plan.name)}`,
    "{",
    "}",
  ].join("\n");

const renderEnum = (plan: LoweringDeclarationPlan): string =>
  [
    `public enum ${sanitizeTypeName(plan.name)}`,
    "{",
    "}",
  ].join("\n");

const renderVariable = (plan: LoweringDeclarationPlan): string => {
  const name = sanitizeIdentifier(plan.name);
  const type = renderCSharpType(plan.returnTypeText);
  return `public static ${type} ${name};`;
};

export const renderDeclaration = (
  plan: LoweringDeclarationPlan
): string | undefined => {
  switch (plan.declarationKind) {
    case "class":
      return renderClass(plan);
    case "enum":
      return renderEnum(plan);
    case "function":
      return renderFunction(plan);
    case "interface":
      return renderInterface(plan);
    case "variable":
      return renderVariable(plan);
    case "type-alias":
    case "unknown":
      return undefined;
  }
};

export const renderStaticContainerMember = (
  plan: LoweringDeclarationPlan
): string | undefined => {
  const rendered = renderDeclaration(plan);
  return rendered ? indent(rendered, 4) : undefined;
};
