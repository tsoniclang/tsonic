import type { IrParameter, IrType } from "@tsonic/frontend";
import type {
  CSharpExpressionAst,
  CSharpTypeAst,
} from "../core/format/backend-ast/types.js";

export type RuntimeParameterDefaultInfo = {
  readonly paramName: string;
  readonly typeAst: CSharpTypeAst;
  readonly initializer: CSharpExpressionAst;
  readonly sourceName?: string;
  readonly semanticType?: IrType;
};

export const isCSharpOptionalParameterDefaultAst = (
  expr: CSharpExpressionAst
): boolean => {
  switch (expr.kind) {
    case "nullLiteralExpression":
    case "booleanLiteralExpression":
    case "stringLiteralExpression":
    case "charLiteralExpression":
    case "numericLiteralExpression":
    case "defaultExpression":
      return true;
    case "parenthesizedExpression":
      return isCSharpOptionalParameterDefaultAst(expr.expression);
    case "prefixUnaryExpression":
      return isCSharpOptionalParameterDefaultAst(expr.operand);
    case "castExpression":
      return isCSharpOptionalParameterDefaultAst(expr.expression);
    default:
      return false;
  }
};

export const supportsNullCoalescingParameterDefault = (
  typeAst: CSharpTypeAst
): boolean => {
  switch (typeAst.kind) {
    case "arrayType":
    case "nullableType":
    case "identifierType":
    case "qualifiedIdentifierType":
      return true;
    case "predefinedType":
      return typeAst.keyword === "string" || typeAst.keyword === "object";
    default:
      return false;
  }
};

export const preservesNullableShadowType = (
  initializer: CSharpExpressionAst
): boolean => {
  switch (initializer.kind) {
    case "nullLiteralExpression":
      return true;
    case "defaultExpression":
      return (
        initializer.type === undefined || initializer.type.kind === "nullableType"
      );
    case "parenthesizedExpression":
    case "castExpression":
    case "asExpression":
    case "suppressNullableWarningExpression":
      return preservesNullableShadowType(initializer.expression);
    default:
      return false;
  }
};

export const signatureDefaultForInitializedParameter = (
  parameters: readonly IrParameter[],
  parameterIndex: number,
  typeAst: CSharpTypeAst,
  initializer: CSharpExpressionAst
): CSharpExpressionAst | undefined => {
  if (!canEmitParameterDefaultInSignature(parameters, parameterIndex)) {
    return undefined;
  }

  if (supportsNullCoalescingParameterDefault(typeAst)) {
    return { kind: "defaultExpression" };
  }

  if (isCSharpOptionalParameterDefaultAst(initializer)) {
    return initializer;
  }

  return undefined;
};

export const canEmitParameterDefaultInSignature = (
  parameters: readonly IrParameter[],
  parameterIndex: number
): boolean => {
  const parameter = parameters[parameterIndex];
  if (!parameter) return false;
  if (parameter.isRest) return false;
  if (!parameter.isOptional && !parameter.initializer) {
    return false;
  }

  for (let index = parameterIndex + 1; index < parameters.length; index += 1) {
    const later = parameters[index];
    if (!later) continue;
    if (!later.isOptional && !later.initializer) {
      if (later.isRest && index === parameters.length - 1) {
        continue;
      }
      return false;
    }
  }

  return true;
};

export const computeWrapperPrefixLengths = (
  parameters: readonly IrParameter[],
  suppressedDefaultIndexes: ReadonlySet<number>
): readonly number[] => {
  const prefixLengths: number[] = [];
  let suffixIsOmittable = true;

  for (let index = parameters.length - 1; index >= 0; index -= 1) {
    const parameter = parameters[index];
    if (!parameter) continue;

    const isTailOmittable =
      parameter.isOptional ||
      parameter.initializer !== undefined ||
      (parameter.isRest && index === parameters.length - 1);
    suffixIsOmittable = suffixIsOmittable && isTailOmittable;

    if (suffixIsOmittable && suppressedDefaultIndexes.has(index)) {
      prefixLengths.push(index);
    }
  }

  prefixLengths.reverse();
  return prefixLengths;
};

export const canLowerParameterDefaultViaWrapper = (
  parameters: readonly IrParameter[],
  parameterIndex: number
): boolean => {
  const parameter = parameters[parameterIndex];
  if (!parameter) return false;
  if (parameter.isRest) return false;
  if (!parameter.isOptional && !parameter.initializer) {
    return false;
  }

  let suffixIsOmittable = true;

  for (let index = parameters.length - 1; index >= parameterIndex; index -= 1) {
    const current = parameters[index];
    if (!current) continue;

    const isTailOmittable =
      current.isOptional ||
      current.initializer !== undefined ||
      (current.isRest && index === parameters.length - 1);
    suffixIsOmittable = suffixIsOmittable && isTailOmittable;
  }

  return suffixIsOmittable;
};
