import {
  IrExpression,
  IrParameter,
  IrSpreadExpression,
  IrType,
} from "../../../../types.js";
import { typesEqualForIsType } from "./overload-specialization.js";
import { getIdentifierPatternName } from "./overload-wrapper-family.js";

const undefinedExpression = (): IrExpression => ({
  kind: "literal",
  value: undefined,
  inferredType: { kind: "primitiveType", name: "undefined" },
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

const coerceForwardedArgumentToTargetType = (
  expression: IrExpression,
  targetType: IrType | undefined
): IrExpression => {
  if (
    !targetType ||
    !expression.inferredType ||
    typesEqualForIsType(expression.inferredType, targetType)
  ) {
    return expression;
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
  const fallbackExpression = undefinedExpression();
  const whenTrueExpression =
    targetType &&
    elementExpression.inferredType &&
    !typesEqualForIsType(elementExpression.inferredType, targetType)
      ? ({
          kind: "typeAssertion",
          expression: elementExpression,
          targetType,
          inferredType: targetType,
        } satisfies IrExpression)
      : elementExpression;
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

  if (
    targetType &&
    conditionalExpr.inferredType &&
    !typesEqualForIsType(conditionalExpr.inferredType, targetType)
  ) {
    return {
      kind: "typeAssertion",
      expression: conditionalExpr,
      targetType,
      inferredType: targetType,
    };
  }

  return conditionalExpr;
};

const buildWrapperRestSliceSpread = (
  parameter: IrParameter,
  startIndex: number
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
    },
    arguments: [numericIndexLiteral(startIndex)],
    isOptional: false,
    inferredType: parameter.type,
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
          buildWrapperRestSliceSpread(wrapperRestParameter, restStartIndex)
        );
      } else if (helperIndex < wrapperParameters.length) {
        const wrapperParameter = wrapperParameters[helperIndex];
        if (!wrapperParameter) continue;
        const directArgument: IrExpression = {
          kind: "identifier",
          name: getIdentifierPatternName(wrapperParameter),
          inferredType: wrapperParameter.type,
        };
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
        const directArgument: IrExpression = {
          kind: "identifier",
          name: getIdentifierPatternName(wrapperParameter),
          inferredType: wrapperParameter.type,
        };
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
