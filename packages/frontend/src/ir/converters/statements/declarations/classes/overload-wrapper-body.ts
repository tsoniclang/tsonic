import {
  IrBlockStatement,
  IrExpression,
  IrParameter,
  IrStatement,
  IrType,
} from "../../../../types.js";
import { getAwaitedIrType } from "../../../../types.js";
import { buildForwardedCallArguments } from "./overload-wrapper-forwarding.js";
import { substitutePolymorphicReturn } from "./overload-wrapper-family.js";
import { typesEqualForIsType } from "./overload-specialization.js";

const resolveEffectiveReturnType = (
  targetReturnType: IrType | undefined,
  isAsync: boolean
): IrType | undefined => {
  if (!targetReturnType) {
    return undefined;
  }

  if (!isAsync) {
    return targetReturnType;
  }

  return getAwaitedIrType(targetReturnType) ?? targetReturnType;
};

export const needsAsyncWrapperReturnAdaptation = (
  implReturnType: IrType | undefined,
  wrapperReturnType: IrType | undefined
): boolean => {
  if (!implReturnType || !wrapperReturnType) {
    return false;
  }

  const awaitedImpl = getAwaitedIrType(implReturnType);
  const awaitedWrapper = getAwaitedIrType(wrapperReturnType);
  if (!awaitedImpl || !awaitedWrapper) {
    return false;
  }

  return !typesEqualForIsType(awaitedImpl, awaitedWrapper);
};

const returnExpressionNeedsAsyncAwait = (
  expression: IrExpression,
  targetReturnType: IrType | undefined
): boolean => {
  const awaitedTarget = targetReturnType
    ? getAwaitedIrType(targetReturnType)
    : undefined;
  const awaitedActual = expression.inferredType
    ? getAwaitedIrType(expression.inferredType)
    : undefined;

  if (!awaitedTarget || !awaitedActual) {
    return false;
  }

  return !typesEqualForIsType(awaitedActual, awaitedTarget);
};

export const needsAsyncReturnStatementAdaptation = (
  stmt: IrStatement,
  targetReturnType: IrType | undefined
): boolean => {
  switch (stmt.kind) {
    case "blockStatement":
      return stmt.statements.some((inner) =>
        needsAsyncReturnStatementAdaptation(inner, targetReturnType)
      );
    case "ifStatement":
      return (
        needsAsyncReturnStatementAdaptation(
          stmt.thenStatement,
          targetReturnType
        ) ||
        (!!stmt.elseStatement &&
          needsAsyncReturnStatementAdaptation(
            stmt.elseStatement,
            targetReturnType
          ))
      );
    case "whileStatement":
    case "forStatement":
    case "forOfStatement":
    case "forInStatement":
      return needsAsyncReturnStatementAdaptation(stmt.body, targetReturnType);
    case "switchStatement":
      return stmt.cases.some((switchCase) =>
        switchCase.statements.some((inner) =>
          needsAsyncReturnStatementAdaptation(inner, targetReturnType)
        )
      );
    case "tryStatement":
      return (
        needsAsyncReturnStatementAdaptation(stmt.tryBlock, targetReturnType) ||
        (!!stmt.catchClause &&
          needsAsyncReturnStatementAdaptation(
            stmt.catchClause.body,
            targetReturnType
          )) ||
        (!!stmt.finallyBlock &&
          needsAsyncReturnStatementAdaptation(
            stmt.finallyBlock,
            targetReturnType
          ))
      );
    case "returnStatement":
      return !!stmt.expression &&
        stmt.expression.kind !== "await" &&
        returnExpressionNeedsAsyncAwait(stmt.expression, targetReturnType);
    default:
      return false;
  }
};

export const adaptReturnStatements = (
  stmt: IrStatement,
  targetReturnType: IrType | undefined,
  isAsync = false
): IrStatement => {
  const effectiveReturnType = resolveEffectiveReturnType(
    targetReturnType,
    isAsync
  );

  if (!effectiveReturnType || effectiveReturnType.kind === "voidType") {
    return stmt;
  }

  switch (stmt.kind) {
    case "blockStatement":
      return {
        ...stmt,
        statements: stmt.statements.map((inner) =>
          adaptReturnStatements(inner, targetReturnType, isAsync)
        ),
      };
    case "ifStatement":
      return {
        ...stmt,
        thenStatement: adaptReturnStatements(
          stmt.thenStatement,
          targetReturnType,
          isAsync
        ),
        elseStatement: stmt.elseStatement
          ? adaptReturnStatements(stmt.elseStatement, targetReturnType, isAsync)
          : undefined,
      };
    case "whileStatement":
      return {
        ...stmt,
        body: adaptReturnStatements(stmt.body, targetReturnType, isAsync),
      };
    case "forStatement":
      return {
        ...stmt,
        body: adaptReturnStatements(stmt.body, targetReturnType, isAsync),
      };
    case "forOfStatement":
    case "forInStatement":
      return {
        ...stmt,
        body: adaptReturnStatements(stmt.body, targetReturnType, isAsync),
      };
    case "switchStatement":
      return {
        ...stmt,
        cases: stmt.cases.map((switchCase) => ({
          ...switchCase,
          statements: switchCase.statements.map((inner) =>
            adaptReturnStatements(inner, targetReturnType, isAsync)
          ),
        })),
      };
    case "tryStatement":
      return {
        ...stmt,
        tryBlock: adaptReturnStatements(
          stmt.tryBlock,
          targetReturnType,
          isAsync
        ) as IrBlockStatement,
        catchClause: stmt.catchClause
          ? {
              ...stmt.catchClause,
              body: adaptReturnStatements(
                stmt.catchClause.body,
                targetReturnType,
                isAsync
              ) as IrBlockStatement,
            }
          : undefined,
        finallyBlock: stmt.finallyBlock
          ? (adaptReturnStatements(
              stmt.finallyBlock,
              targetReturnType,
              isAsync
            ) as IrBlockStatement)
          : undefined,
      };
    case "returnStatement":
      if (!stmt.expression) {
        return stmt;
      }

      const sourceExpression =
        isAsync && returnExpressionNeedsAsyncAwait(stmt.expression, targetReturnType)
          ? ({
              kind: "await",
              expression: stmt.expression,
              inferredType: getAwaitedIrType(stmt.expression.inferredType!),
            } satisfies IrExpression)
          : stmt.expression;

      return {
        ...stmt,
        expression: substitutePolymorphicReturn(
          sourceExpression,
          sourceExpression.inferredType,
          effectiveReturnType
        ),
      };
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
  typeParameterNames: readonly string[],
  wrapperIsAsync = false
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
    allowUnknownInferredType: true,
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

  const awaitableReturnAdaptation =
    wrapperIsAsync && wrapperReturnType
      ? getAwaitedIrType(wrapperReturnType)
      : undefined;
  const implAwaitedReturnType =
    wrapperIsAsync && implReturnType
      ? getAwaitedIrType(implReturnType)
      : undefined;
  const awaitedReturnExpression =
    wrapperIsAsync && awaitableReturnAdaptation
      ? ({
          kind: "await",
          expression: callExpr,
          inferredType: implAwaitedReturnType ?? awaitableReturnAdaptation,
        } satisfies IrExpression)
      : undefined;
  const wrappedReturnExpression =
    wrapperIsAsync && awaitableReturnAdaptation
      ? substitutePolymorphicReturn(
          awaitedReturnExpression!,
          implAwaitedReturnType,
          awaitableReturnAdaptation
        )
      : substitutePolymorphicReturn(
          callExpr,
          implReturnType,
          wrapperReturnType
        );
  const hasReturnValue =
    wrapperIsAsync && awaitableReturnAdaptation
      ? awaitableReturnAdaptation.kind !== "voidType"
      : wrapperReturnType !== undefined && wrapperReturnType.kind !== "voidType";

  return {
    kind: "blockStatement",
    statements: hasReturnValue
      ? [
          {
            kind: "returnStatement",
            expression: wrappedReturnExpression,
          },
        ]
      : [
          {
            kind: "expressionStatement",
            expression: awaitedReturnExpression ?? callExpr,
          },
        ],
  };
};
