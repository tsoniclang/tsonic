import {
  IrExpression,
  IrParameter,
  IrSpreadExpression,
  IrType,
} from "../../../../types.js";
import { typesEqualForIsType } from "./overload-specialization.js";
import { getIdentifierPatternName } from "./overload-wrapper-family.js";

const syntheticArraySliceBinding = (): NonNullable<
  Extract<IrExpression, { kind: "memberAccess" }>["memberBinding"]
> => ({
  kind: "method",
  assembly: "__synthetic",
  type: "Array",
  member: "slice",
  emitSemantics: {
    callStyle: "receiver",
  },
});

const undefinedExpression = (): IrExpression => ({
  kind: "literal",
  value: undefined,
  inferredType: { kind: "primitiveType", name: "undefined" },
});

const defaultOfExpression = (targetType: IrType): IrExpression => ({
  kind: "defaultof",
  targetType,
  inferredType: targetType,
});

const numericIndexLiteral = (index: number): IrExpression => ({
  kind: "literal",
  value: index,
  inferredType: { kind: "primitiveType", name: "int" },
});

const buildWrapperRestIdentifier = (parameter: IrParameter): IrExpression => ({
  kind: "identifier",
  name: getIdentifierPatternName(parameter),
  inferredType: parameter.type,
});

const acceptsExplicitUndefined = (parameter: IrParameter): boolean =>
  !parameter.isRest &&
  (parameter.isOptional || parameter.initializer !== undefined);

const buildWrapperParameterIdentifier = (
  parameter: IrParameter
): IrExpression => ({
  kind: "identifier",
  name: getIdentifierPatternName(parameter),
  inferredType: parameter.type,
});

const buildForwardedOptionalDefaultExpression = (
  wrapperParameter: IrParameter,
  helperParameter: IrParameter
): IrExpression | undefined => {
  if (
    !acceptsExplicitUndefined(wrapperParameter) ||
    helperParameter.initializer === undefined
  ) {
    return undefined;
  }

  const wrapperIdentifier = buildWrapperParameterIdentifier(wrapperParameter);
  const fallbackExpression =
    helperParameter.initializer.kind === "numericNarrowing" &&
    helperParameter.initializer.proof === undefined &&
    helperParameter.initializer.expression.kind === "literal" &&
    (typeof helperParameter.initializer.expression.value === "number" ||
      typeof helperParameter.initializer.expression.value === "bigint")
      ? {
          ...helperParameter.initializer,
          proof: {
            kind: helperParameter.initializer.targetKind,
            source: {
              type: "literal" as const,
              value: helperParameter.initializer.expression.value,
            },
          },
        }
      : helperParameter.initializer;
  const inferredType =
    wrapperIdentifier.inferredType && fallbackExpression.inferredType
      ? typesEqualForIsType(
          wrapperIdentifier.inferredType,
          fallbackExpression.inferredType
        )
        ? wrapperIdentifier.inferredType
        : wrapperIdentifier.inferredType
      : (wrapperIdentifier.inferredType ?? fallbackExpression.inferredType);

  return {
    kind: "logical",
    operator: "??",
    left: wrapperIdentifier,
    right: fallbackExpression,
    inferredType,
  };
};

const buildWrapperRestLengthExpression = (
  parameter: IrParameter
): IrExpression => ({
  kind: "memberAccess",
  object: buildWrapperRestIdentifier(parameter),
  property: "length",
  isComputed: false,
  isOptional: false,
  inferredType: { kind: "primitiveType", name: "int" },
});

const buildWrapperRestElementExpression = (
  parameter: IrParameter,
  elementIndex: number
): IrExpression => {
  const arrayLikeType = parameter.type;
  const elementType =
    arrayLikeType?.kind === "arrayType"
      ? arrayLikeType.elementType
      : arrayLikeType?.kind === "tupleType"
        ? (arrayLikeType.elementTypes[elementIndex] ??
          arrayLikeType.elementTypes[arrayLikeType.elementTypes.length - 1])
        : undefined;

  return {
    kind: "memberAccess",
    object: buildWrapperRestIdentifier(parameter),
    property: numericIndexLiteral(elementIndex),
    isComputed: true,
    isOptional: false,
    inferredType: elementType,
    accessKind: "clrIndexer",
  };
};

const countRequiredFunctionParameters = (
  parameters: readonly IrParameter[]
): number => {
  let required = 0;
  for (const parameter of parameters) {
    if (!parameter) {
      continue;
    }
    if (
      parameter.isRest ||
      parameter.isOptional ||
      parameter.initializer !== undefined
    ) {
      break;
    }
    required += 1;
  }
  return required;
};

const coerceForwardedArgumentToTargetType = (
  expression: IrExpression,
  targetType: IrType | undefined
): IrExpression => {
  if (!targetType) {
    return expression;
  }

  if (
    expression.inferredType &&
    typesEqualForIsType(expression.inferredType, targetType)
  ) {
    return expression;
  }

  if (
    expression.inferredType?.kind === "functionType" &&
    targetType.kind === "functionType"
  ) {
    const sourceType = expression.inferredType;
    const sourceHasRest = sourceType.parameters.some((parameter) => parameter.isRest);
    const targetHasRest = targetType.parameters.some((parameter) => parameter.isRest);
    if (
      sourceType.parameters.length !== targetType.parameters.length &&
      (sourceHasRest || targetHasRest)
    ) {
      throw new Error(
        "ICE: overload wrapper cannot adapt function parameters with rest arity differences."
      );
    }

    if (
      countRequiredFunctionParameters(sourceType.parameters) >
      targetType.parameters.length
    ) {
      throw new Error(
        "ICE: overload wrapper cannot forward a callback that requires more parameters than the implementation supplies."
      );
    }

    const adapterParameters: IrParameter[] = targetType.parameters.map(
      (parameter, index) => ({
        ...parameter,
        pattern: {
          kind: "identifierPattern",
          name: `__tsonic_overload_arg_${index}`,
        },
        initializer: undefined,
      })
    );

    const callbackArgs = sourceType.parameters.map((sourceParameter, index) => {
      if (index >= adapterParameters.length) {
        return sourceParameter.type
          ? defaultOfExpression(sourceParameter.type)
          : undefinedExpression();
      }

      const parameter = adapterParameters[index];
      const parameterName =
        parameter?.pattern.kind === "identifierPattern"
          ? parameter.pattern.name
          : `__tsonic_overload_arg_${index}`;
      return coerceForwardedArgumentToTargetType(
        {
          kind: "identifier",
          name: parameterName,
          inferredType: parameter?.type,
        },
        sourceParameter.type
      );
    });

    const callbackInvocation: IrExpression = {
      kind: "call",
      callee: expression,
      arguments: callbackArgs,
      isOptional: false,
      inferredType: sourceType.returnType,
      allowUnknownInferredType: true,
      parameterTypes: sourceType.parameters.map((parameter) => parameter.type),
      argumentPassing: sourceType.parameters.map(
        (parameter) => parameter.passing
      ),
    };

    return {
      kind: "arrowFunction",
      parameters: adapterParameters,
      returnType: targetType.returnType,
      body: coerceForwardedArgumentToTargetType(
        callbackInvocation,
        targetType.returnType
      ),
      isAsync: false,
      inferredType: targetType,
    };
  }

  return {
    kind: "typeAssertion",
    expression,
    targetType,
    inferredType: targetType,
  };
};

const buildWrapperRestElementOrUndefinedExpression = (
  parameter: IrParameter,
  elementIndex: number,
  targetType: IrType | undefined
): IrExpression => {
  const elementExpression = buildWrapperRestElementExpression(
    parameter,
    elementIndex
  );
  const fallbackExpression = targetType
    ? defaultOfExpression(targetType)
    : undefinedExpression();
  const whenTrueExpression = coerceForwardedArgumentToTargetType(
    elementExpression,
    targetType
  );
  const whenTrueType = whenTrueExpression.inferredType;
  const fallbackType = fallbackExpression.inferredType;
  const inferredType =
    targetType ??
    (whenTrueType && fallbackType
      ? ({
          kind: "unionType",
          types: [whenTrueType, fallbackType],
        } satisfies IrType)
      : (whenTrueType ?? fallbackType));

  const conditionalExpr: IrExpression = {
    kind: "conditional",
    condition: {
      kind: "binary",
      operator: ">",
      left: buildWrapperRestLengthExpression(parameter),
      right: numericIndexLiteral(elementIndex),
      inferredType: { kind: "primitiveType", name: "boolean" },
    },
    whenTrue: whenTrueExpression,
    whenFalse: fallbackExpression,
    inferredType,
  };

  return conditionalExpr;
};

const buildWrapperRestSliceSpread = (
  parameter: IrParameter,
  startIndex: number,
  targetType: IrType | undefined
): IrSpreadExpression => ({
  kind: "spread",
  expression: {
    kind: "call",
    callee: {
      kind: "memberAccess",
      object: buildWrapperRestIdentifier(parameter),
      property: "slice",
      isComputed: false,
      isOptional: false,
      memberBinding: syntheticArraySliceBinding(),
    },
    arguments: [numericIndexLiteral(startIndex)],
    isOptional: false,
    inferredType: targetType ?? parameter.type,
  },
});

export const buildForwardedCallArguments = (
  wrapperParameters: readonly IrParameter[],
  helperParameters: readonly IrParameter[]
): readonly (IrExpression | IrSpreadExpression)[] => {
  const wrapperRestIndex = wrapperParameters.findIndex(
    (parameter) => parameter.isRest
  );
  const wrapperRestParameter =
    wrapperRestIndex >= 0 ? wrapperParameters[wrapperRestIndex] : undefined;
  const forwardedArgs: (IrExpression | IrSpreadExpression)[] = [];

  for (
    let helperIndex = 0;
    helperIndex < helperParameters.length;
    helperIndex += 1
  ) {
    const helperParameter = helperParameters[helperIndex];
    if (!helperParameter) continue;

    if (helperParameter.isRest) {
      if (wrapperRestParameter) {
        const restStartIndex =
          helperIndex >= wrapperRestIndex ? helperIndex - wrapperRestIndex : 0;
        forwardedArgs.push(
          buildWrapperRestSliceSpread(
            wrapperRestParameter,
            restStartIndex,
            helperParameter.type
          )
        );
      } else if (helperIndex < wrapperParameters.length) {
        const wrapperParameter = wrapperParameters[helperIndex];
        if (!wrapperParameter) continue;
        const directArgument =
          buildForwardedOptionalDefaultExpression(
            wrapperParameter,
            helperParameter
          ) ?? buildWrapperParameterIdentifier(wrapperParameter);
        forwardedArgs.push(
          coerceForwardedArgumentToTargetType(
            directArgument,
            helperParameter.type
          )
        );
      }
      break;
    }

    if (helperIndex < wrapperParameters.length) {
      const wrapperParameter = wrapperParameters[helperIndex];
      if (wrapperParameter && !wrapperParameter.isRest) {
        const directArgument =
          buildForwardedOptionalDefaultExpression(
            wrapperParameter,
            helperParameter
          ) ?? buildWrapperParameterIdentifier(wrapperParameter);
        forwardedArgs.push(
          coerceForwardedArgumentToTargetType(
            directArgument,
            helperParameter.type
          )
        );
        continue;
      }
    }

    if (wrapperRestParameter && helperIndex >= wrapperRestIndex) {
      forwardedArgs.push(
        buildWrapperRestElementOrUndefinedExpression(
          wrapperRestParameter,
          helperIndex - wrapperRestIndex,
          helperParameter.type
        )
      );
      continue;
    }

    forwardedArgs.push(undefinedExpression());
  }

  return forwardedArgs;
};
