import {
  IrBlockStatement,
  IrExpression,
  IrParameter,
  IrStatement,
  IrType,
} from "../../../../types.js";
import { buildForwardedCallArguments } from "./overload-wrapper-forwarding.js";
import { substitutePolymorphicReturn } from "./overload-wrapper-family.js";

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
