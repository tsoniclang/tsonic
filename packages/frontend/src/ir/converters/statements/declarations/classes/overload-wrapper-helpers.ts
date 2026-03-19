/**
 * IR building helpers for overload wrappers.
 *
 * Contains helpers for constructing forwarded call arguments,
 * wrapper bodies, return statement adaptation, and rest-parameter
 * element/slice IR nodes.
 */

import {
  IrBlockStatement,
  IrExpression,
  IrMethodDeclaration,
  IrParameter,
  IrSpreadExpression,
  IrStatement,
  IrType,
} from "../../../../types.js";
import { typesEqualForIsType } from "./overload-specialization.js";

export const OVERLOAD_IMPL_PREFIX = "__tsonic_overload_impl_";

export const getOverloadImplementationName = (memberName: string): string =>
  `${OVERLOAD_IMPL_PREFIX}${memberName}`;

export const buildPublicOverloadFamilyMember = (
  memberName: string,
  signatureIndex: number,
  publicSignatureCount: number,
  implementationName?: string
): NonNullable<IrMethodDeclaration["overloadFamily"]> => ({
  ownerKind: "method",
  publicName: memberName,
  role: "publicOverload",
  publicSignatureIndex: signatureIndex,
  publicSignatureCount,
  implementationName,
});

export const buildImplementationOverloadFamilyMember = (
  memberName: string,
  publicSignatureCount: number,
  implementationName: string
): NonNullable<IrMethodDeclaration["overloadFamily"]> => ({
  ownerKind: "method",
  publicName: memberName,
  role: "implementation",
  publicSignatureCount,
  implementationName,
});

export const getIdentifierPatternName = (parameter: IrParameter): string => {
  if (parameter.pattern.kind !== "identifierPattern") {
    throw new Error(
      `ICE: overload wrappers currently require identifier parameters (got '${parameter.pattern.kind}')`
    );
  }

  return parameter.pattern.name;
};

const isSuperMemberCall = (expression: IrExpression): boolean =>
  expression.kind === "call" &&
  expression.callee.kind === "memberAccess" &&
  expression.callee.object.kind === "identifier" &&
  expression.callee.object.name === "super";

export const substitutePolymorphicReturn = (
  expression: IrExpression,
  implReturnType: IrType | undefined,
  wrapperReturnType: IrType | undefined
): IrExpression => {
  if (!wrapperReturnType) {
    return expression;
  }

  if (isSuperMemberCall(expression)) {
    return {
      kind: "typeAssertion",
      expression,
      targetType: wrapperReturnType,
      inferredType: wrapperReturnType,
      sourceSpan: expression.sourceSpan,
    };
  }

  if (
    implReturnType &&
    typesEqualForIsType(implReturnType, wrapperReturnType)
  ) {
    return {
      ...expression,
      inferredType: wrapperReturnType,
    };
  }

  return {
    kind: "typeAssertion",
    expression,
    targetType: wrapperReturnType,
    inferredType: wrapperReturnType,
    sourceSpan: expression.sourceSpan,
  };
};

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

export const adaptReturnStatements = (
  stmt: IrStatement,
  targetReturnType: IrType | undefined
): IrStatement => {
  if (!targetReturnType || targetReturnType.kind === "voidType") {
    return stmt;
  }

  switch (stmt.kind) {
    case "blockStatement":
      return {
        ...stmt,
        statements: stmt.statements.map((inner) =>
          adaptReturnStatements(inner, targetReturnType)
        ),
      };
    case "ifStatement":
      return {
        ...stmt,
        thenStatement: adaptReturnStatements(
          stmt.thenStatement,
          targetReturnType
        ),
        elseStatement: stmt.elseStatement
          ? adaptReturnStatements(stmt.elseStatement, targetReturnType)
          : undefined,
      };
    case "whileStatement":
      return {
        ...stmt,
        body: adaptReturnStatements(stmt.body, targetReturnType),
      };
    case "forStatement":
      return {
        ...stmt,
        body: adaptReturnStatements(stmt.body, targetReturnType),
      };
    case "forOfStatement":
    case "forInStatement":
      return {
        ...stmt,
        body: adaptReturnStatements(stmt.body, targetReturnType),
      };
    case "switchStatement":
      return {
        ...stmt,
        cases: stmt.cases.map((switchCase) => ({
          ...switchCase,
          statements: switchCase.statements.map((inner) =>
            adaptReturnStatements(inner, targetReturnType)
          ),
        })),
      };
    case "tryStatement":
      return {
        ...stmt,
        tryBlock: adaptReturnStatements(
          stmt.tryBlock,
          targetReturnType
        ) as IrBlockStatement,
        catchClause: stmt.catchClause
          ? {
              ...stmt.catchClause,
              body: adaptReturnStatements(
                stmt.catchClause.body,
                targetReturnType
              ) as IrBlockStatement,
            }
          : undefined,
        finallyBlock: stmt.finallyBlock
          ? (adaptReturnStatements(
              stmt.finallyBlock,
              targetReturnType
            ) as IrBlockStatement)
          : undefined,
      };
    case "returnStatement":
      return stmt.expression
        ? {
            ...stmt,
            expression: substitutePolymorphicReturn(
              stmt.expression,
              stmt.expression.inferredType,
              targetReturnType
            ),
          }
        : stmt;
    case "functionDeclaration":
    case "classDeclaration":
    case "interfaceDeclaration":
    case "enumDeclaration":
    case "typeAliasDeclaration":
      return stmt;
    default:
      return stmt;
  }
};

export const createWrapperBody = (
  helperName: string,
  parameters: readonly IrParameter[],
  helperParameters: readonly IrParameter[],
  isStatic: boolean,
  implReturnType: IrType | undefined,
  wrapperReturnType: IrType | undefined,
  typeParameterNames: readonly string[]
): IrBlockStatement => {
  const forwardedArgs = buildForwardedCallArguments(
    parameters,
    helperParameters
  );

  const callee: IrExpression = isStatic
    ? {
        kind: "identifier",
        name: helperName,
      }
    : {
        kind: "memberAccess",
        object: {
          kind: "this",
        },
        property: helperName,
        isComputed: false,
        isOptional: false,
      };

  const callExpr: IrExpression = {
    kind: "call",
    callee,
    arguments: forwardedArgs,
    isOptional: false,
    inferredType: implReturnType ?? wrapperReturnType,
    ...(typeParameterNames.length > 0
      ? {
          typeArguments: typeParameterNames.map(
            (name) =>
              ({
                kind: "typeParameterType",
                name,
              }) satisfies IrType
          ),
        }
      : {}),
    parameterTypes: helperParameters.map((parameter) => parameter.type),
    argumentPassing: helperParameters.map((parameter) => parameter.passing),
  };

  const hasReturnValue =
    wrapperReturnType !== undefined && wrapperReturnType.kind !== "voidType";

  return {
    kind: "blockStatement",
    statements: hasReturnValue
      ? [
          {
            kind: "returnStatement",
            expression: substitutePolymorphicReturn(
              callExpr,
              implReturnType,
              wrapperReturnType
            ),
          },
        ]
      : [
          {
            kind: "expressionStatement",
            expression: callExpr,
          },
        ],
  };
};
