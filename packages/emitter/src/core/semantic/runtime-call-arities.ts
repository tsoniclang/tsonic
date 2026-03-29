import type { IrExpression, IrParameter, IrType } from "@tsonic/frontend";
import { canEmitParameterDefaultInSignature } from "../../statements/parameter-defaults.js";

const isRuntimeConstantDefaultExpression = (
  expression: IrExpression | undefined
): boolean => {
  if (!expression) {
    return false;
  }

  switch (expression.kind) {
    case "literal":
      return true;
    case "numericNarrowing":
    case "typeAssertion":
    case "asinterface":
      return isRuntimeConstantDefaultExpression(expression.expression);
    case "defaultof":
      return true;
    default:
      return false;
  }
};

const stripNullishIrType = (type: IrType | undefined): IrType | undefined => {
  if (!type) {
    return undefined;
  }

  if (type.kind !== "unionType") {
    return type;
  }

  const remaining = type.types.filter(
    (member) =>
      !(
        member.kind === "primitiveType" &&
        (member.name === "null" || member.name === "undefined")
      )
  );

  if (remaining.length === 1) {
    return remaining[0];
  }

  return {
    ...type,
    types: remaining,
  };
};

const supportsRuntimeNullishDefault = (type: IrType | undefined): boolean => {
  const normalized = stripNullishIrType(type);
  if (!normalized) {
    return false;
  }

  switch (normalized.kind) {
    case "referenceType":
    case "arrayType":
    case "tupleType":
    case "functionType":
    case "objectType":
    case "dictionaryType":
    case "intersectionType":
    case "anyType":
    case "unknownType":
      return true;
    case "primitiveType":
      return (
        normalized.name === "string" ||
        normalized.name === "null" ||
        normalized.name === "undefined"
      );
    case "unionType":
      return normalized.types.length > 1
        ? true
        : supportsRuntimeNullishDefault(normalized.types[0]);
    case "literalType":
      return typeof normalized.value === "string";
    case "typeParameterType":
    case "voidType":
    case "neverType":
      return false;
  }
};

const buildRuntimeOmittableCallArities = (
  parameters: readonly IrParameter[],
  isRuntimeOmittable: (parameter: IrParameter, index: number) => boolean
): readonly number[] => {
  const arities = [parameters.length];
  let suffixIsRuntimeOmittable = true;

  for (let index = parameters.length - 1; index >= 0; index -= 1) {
    const parameter = parameters[index];
    if (!parameter) {
      continue;
    }

    suffixIsRuntimeOmittable =
      suffixIsRuntimeOmittable && isRuntimeOmittable(parameter, index);
    if (suffixIsRuntimeOmittable) {
      arities.push(index);
    }
  }

  arities.sort((left, right) => left - right);
  return arities;
};

export const computeDeclarationRuntimeOmittableCallArities = (
  parameters: readonly IrParameter[]
): readonly number[] =>
  buildRuntimeOmittableCallArities(
    parameters,
    (parameter, index) =>
      parameter.isOptional ||
      parameter.initializer !== undefined ||
      (parameter.isRest && index === parameters.length - 1)
  );

export const computeFunctionValueRuntimeOmittableCallArities = (
  parameters: readonly IrParameter[]
): readonly number[] =>
  buildRuntimeOmittableCallArities(parameters, (parameter, index) => {
    if (parameter.isRest) {
      return index === parameters.length - 1;
    }

    if (!canEmitParameterDefaultInSignature(parameters, index)) {
      return false;
    }

    if (parameter.isOptional) {
      return true;
    }

    if (!parameter.initializer) {
      return false;
    }

    return (
      isRuntimeConstantDefaultExpression(parameter.initializer) ||
      supportsRuntimeNullishDefault(parameter.type)
    );
  });
