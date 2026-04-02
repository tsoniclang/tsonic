/**
 * Object literal synthesis helpers — accessor property type resolution,
 * return type inference from blocks, method expression finalization,
 * and synthesized object member collection.
 */

import * as ts from "typescript";
import {
  IrBlockStatement,
  IrClassMember,
  IrFunctionExpression,
  IrFunctionType,
  IrInterfaceMember,
  IrObjectProperty,
  IrType,
  IrExpression,
  IrStatement,
} from "../../types.js";
import { typesEqual } from "../../types/ir-substitution.js";
import type { ProgramContext } from "../../program-context.js";
import { convertAccessorProperty } from "../statements/declarations/classes/properties.js";

export const getSynthesizedPropertyType = (
  expr: IrExpression,
  widenNumericLiterals: boolean
): IrType | undefined => {
  if (
    widenNumericLiterals &&
    expr.kind === "literal" &&
    typeof expr.value === "number"
  ) {
    return { kind: "primitiveType", name: "number" };
  }
  return expr.inferredType;
};

export const getProvisionalAccessorPropertyType = (
  memberName: string,
  getter: ts.GetAccessorDeclaration | undefined,
  setter: ts.SetAccessorDeclaration | undefined,
  expectedType: IrType | undefined,
  ctx: ProgramContext,
  objectLiteralThisType: IrType | undefined
): IrType | undefined => {
  const getterType = getter?.type
    ? ctx.typeSystem.typeFromSyntax(ctx.binding.captureTypeSyntax(getter.type))
    : undefined;
  const setterValueParam = setter?.parameters[0];
  const setterType =
    setterValueParam?.type !== undefined
      ? ctx.typeSystem.typeFromSyntax(
          ctx.binding.captureTypeSyntax(setterValueParam.type)
        )
      : undefined;
  if (getterType) return getterType;
  if (setterType) return setterType;
  if (expectedType) return expectedType;

  if (!getter) return undefined;

  const accessorMember = convertAccessorProperty(
    memberName,
    getter,
    setter,
    objectLiteralThisType ? { ...ctx, objectLiteralThisType } : ctx,
    undefined
  );

  return accessorMember.kind === "propertyDeclaration"
    ? accessorMember.type
    : undefined;
};

export const collectReturnExpressionTypes = (
  stmt: IrStatement,
  acc: IrType[]
): void => {
  switch (stmt.kind) {
    case "returnStatement":
      if (stmt.expression?.inferredType) {
        acc.push(stmt.expression.inferredType);
      }
      return;
    case "blockStatement":
      for (const inner of stmt.statements) {
        collectReturnExpressionTypes(inner, acc);
      }
      return;
    case "ifStatement":
      collectReturnExpressionTypes(stmt.thenStatement, acc);
      if (stmt.elseStatement) {
        collectReturnExpressionTypes(stmt.elseStatement, acc);
      }
      return;
    case "whileStatement":
    case "forStatement":
    case "forOfStatement":
    case "forInStatement":
      collectReturnExpressionTypes(stmt.body, acc);
      return;
    case "switchStatement":
      for (const clause of stmt.cases) {
        for (const inner of clause.statements) {
          collectReturnExpressionTypes(inner, acc);
        }
      }
      return;
    case "tryStatement":
      collectReturnExpressionTypes(stmt.tryBlock, acc);
      if (stmt.catchClause) {
        collectReturnExpressionTypes(stmt.catchClause.body, acc);
      }
      if (stmt.finallyBlock) {
        collectReturnExpressionTypes(stmt.finallyBlock, acc);
      }
      return;
    default:
      return;
  }
};

export const inferDeterministicReturnTypeFromBlock = (
  body: IrBlockStatement
): IrType | undefined => {
  const returns: IrType[] = [];
  collectReturnExpressionTypes(body, returns);

  if (returns.length === 0) {
    return { kind: "voidType" };
  }

  const [first] = returns;
  if (!first) return undefined;
  if (first.kind === "unknownType" || first.kind === "anyType") {
    return undefined;
  }

  for (let index = 1; index < returns.length; index += 1) {
    const current = returns[index];
    if (!current || !typesEqual(current, first)) {
      return undefined;
    }
  }

  return first;
};

export const finalizeObjectLiteralMethodExpression = (
  expr: IrExpression
): IrExpression => {
  if (expr.kind !== "functionExpression") return expr;

  const functionInferredType =
    expr.inferredType?.kind === "functionType" ? expr.inferredType : undefined;
  const hasDeclaredReturnType = expr.returnType !== undefined;
  const inferredReturnType =
    expr.returnType ?? functionInferredType?.returnType;
  const needsInference =
    !hasDeclaredReturnType &&
    (inferredReturnType === undefined ||
      inferredReturnType.kind === "unknownType" ||
      inferredReturnType.kind === "anyType" ||
      inferredReturnType.kind === "voidType");

  if (!needsInference) return expr;

  const recoveredReturnType = inferDeterministicReturnTypeFromBlock(expr.body);
  if (!recoveredReturnType) return expr;

  return {
    ...expr,
    returnType: expr.returnType ?? recoveredReturnType,
    inferredType: {
      ...(functionInferredType ?? {
        kind: "functionType" as const,
        parameters: expr.parameters,
      }),
      returnType: recoveredReturnType,
    },
  } satisfies IrFunctionExpression;
};

const rebindObjectLiteralThisInBlock = (
  block: IrBlockStatement,
  objectLiteralThisType: IrType
): IrBlockStatement => ({
  ...block,
  statements: block.statements.map((statement) =>
    rebindObjectLiteralThisInStatement(statement, objectLiteralThisType)
  ),
});

const rebindObjectLiteralThisInStatement = (
  stmt: IrStatement,
  objectLiteralThisType: IrType
): IrStatement => {
  switch (stmt.kind) {
    case "expressionStatement":
      return {
        ...stmt,
        expression: rebindObjectLiteralThisInExpression(
          stmt.expression,
          objectLiteralThisType
        ),
      };

    case "returnStatement":
      return {
        ...stmt,
        expression: stmt.expression
          ? rebindObjectLiteralThisInExpression(
              stmt.expression,
              objectLiteralThisType
            )
          : undefined,
      };

    case "variableDeclaration":
      return {
        ...stmt,
        declarations: stmt.declarations.map((declaration) => ({
          ...declaration,
          initializer: declaration.initializer
            ? rebindObjectLiteralThisInExpression(
                declaration.initializer,
                objectLiteralThisType
              )
            : undefined,
        })),
      };

    case "ifStatement":
      return {
        ...stmt,
        condition: rebindObjectLiteralThisInExpression(
          stmt.condition,
          objectLiteralThisType
        ),
        thenStatement: rebindObjectLiteralThisInStatement(
          stmt.thenStatement,
          objectLiteralThisType
        ),
        elseStatement: stmt.elseStatement
          ? rebindObjectLiteralThisInStatement(
              stmt.elseStatement,
              objectLiteralThisType
            )
          : undefined,
      };

    case "blockStatement":
      return rebindObjectLiteralThisInBlock(stmt, objectLiteralThisType);

    case "forStatement":
      return {
        ...stmt,
        initializer:
          stmt.initializer?.kind === "variableDeclaration"
            ? (rebindObjectLiteralThisInStatement(
                stmt.initializer,
                objectLiteralThisType
              ) as typeof stmt.initializer)
            : stmt.initializer
              ? rebindObjectLiteralThisInExpression(
                  stmt.initializer,
                  objectLiteralThisType
                )
              : undefined,
        condition: stmt.condition
          ? rebindObjectLiteralThisInExpression(
              stmt.condition,
              objectLiteralThisType
            )
          : undefined,
        update: stmt.update
          ? rebindObjectLiteralThisInExpression(
              stmt.update,
              objectLiteralThisType
            )
          : undefined,
        body: rebindObjectLiteralThisInStatement(stmt.body, objectLiteralThisType),
      };

    case "forOfStatement":
    case "forInStatement":
      return {
        ...stmt,
        expression: rebindObjectLiteralThisInExpression(
          stmt.expression,
          objectLiteralThisType
        ),
        body: rebindObjectLiteralThisInStatement(stmt.body, objectLiteralThisType),
      };

    case "whileStatement":
      return {
        ...stmt,
        condition: rebindObjectLiteralThisInExpression(
          stmt.condition,
          objectLiteralThisType
        ),
        body: rebindObjectLiteralThisInStatement(stmt.body, objectLiteralThisType),
      };

    case "switchStatement":
      return {
        ...stmt,
        expression: rebindObjectLiteralThisInExpression(
          stmt.expression,
          objectLiteralThisType
        ),
        cases: stmt.cases.map((switchCase) => ({
          ...switchCase,
          test: switchCase.test
            ? rebindObjectLiteralThisInExpression(
                switchCase.test,
                objectLiteralThisType
              )
            : undefined,
          statements: switchCase.statements.map((statement) =>
            rebindObjectLiteralThisInStatement(statement, objectLiteralThisType)
          ),
        })),
      };

    case "throwStatement":
      return {
        ...stmt,
        expression: rebindObjectLiteralThisInExpression(
          stmt.expression,
          objectLiteralThisType
        ),
      };

    case "tryStatement":
      return {
        ...stmt,
        tryBlock: rebindObjectLiteralThisInBlock(
          stmt.tryBlock,
          objectLiteralThisType
        ),
        catchClause: stmt.catchClause
          ? {
              ...stmt.catchClause,
              body: rebindObjectLiteralThisInBlock(
                stmt.catchClause.body,
                objectLiteralThisType
              ),
            }
          : undefined,
        finallyBlock: stmt.finallyBlock
          ? rebindObjectLiteralThisInBlock(
              stmt.finallyBlock,
              objectLiteralThisType
            )
          : undefined,
      };

    default:
      return stmt;
  }
};

export const rebindObjectLiteralThisInExpression = (
  expr: IrExpression,
  objectLiteralThisType: IrType
): IrExpression => {
  switch (expr.kind) {
    case "this":
      return {
        ...expr,
        inferredType: objectLiteralThisType,
      };

    case "call":
      return {
        ...expr,
        callee: rebindObjectLiteralThisInExpression(
          expr.callee,
          objectLiteralThisType
        ),
        arguments: expr.arguments.map((argument) =>
          argument.kind === "spread"
            ? {
                ...argument,
                expression: rebindObjectLiteralThisInExpression(
                  argument.expression,
                  objectLiteralThisType
                ),
              }
            : rebindObjectLiteralThisInExpression(
                argument,
                objectLiteralThisType
              )
        ),
        dynamicImportNamespace: expr.dynamicImportNamespace
          ? (rebindObjectLiteralThisInExpression(
              expr.dynamicImportNamespace,
              objectLiteralThisType
            ) as typeof expr.dynamicImportNamespace)
          : undefined,
      };

    case "new":
      return {
        ...expr,
        callee: rebindObjectLiteralThisInExpression(
          expr.callee,
          objectLiteralThisType
        ),
        arguments: expr.arguments.map((argument) =>
          argument.kind === "spread"
            ? {
                ...argument,
                expression: rebindObjectLiteralThisInExpression(
                  argument.expression,
                  objectLiteralThisType
                ),
              }
            : rebindObjectLiteralThisInExpression(
                argument,
                objectLiteralThisType
              )
        ),
      };

    case "memberAccess":
      return {
        ...expr,
        object: rebindObjectLiteralThisInExpression(
          expr.object,
          objectLiteralThisType
        ),
        property:
          typeof expr.property === "string"
            ? expr.property
            : rebindObjectLiteralThisInExpression(
                expr.property,
                objectLiteralThisType
              ),
      };

    case "binary":
    case "logical":
      return {
        ...expr,
        left: rebindObjectLiteralThisInExpression(
          expr.left,
          objectLiteralThisType
        ),
        right: rebindObjectLiteralThisInExpression(
          expr.right,
          objectLiteralThisType
        ),
      };

    case "conditional":
      return {
        ...expr,
        condition: rebindObjectLiteralThisInExpression(
          expr.condition,
          objectLiteralThisType
        ),
        whenTrue: rebindObjectLiteralThisInExpression(
          expr.whenTrue,
          objectLiteralThisType
        ),
        whenFalse: rebindObjectLiteralThisInExpression(
          expr.whenFalse,
          objectLiteralThisType
        ),
      };

    case "assignment":
      return {
        ...expr,
        left:
          expr.left.kind === "identifierPattern" ||
          expr.left.kind === "arrayPattern" ||
          expr.left.kind === "objectPattern"
            ? expr.left
            : rebindObjectLiteralThisInExpression(
                expr.left,
                objectLiteralThisType
              ),
        right: rebindObjectLiteralThisInExpression(
          expr.right,
          objectLiteralThisType
        ),
      };

    case "array":
      return {
        ...expr,
        elements: expr.elements.map((element) =>
          element?.kind === "spread"
            ? {
                ...element,
                expression: rebindObjectLiteralThisInExpression(
                  element.expression,
                  objectLiteralThisType
                ),
              }
            : element
              ? rebindObjectLiteralThisInExpression(
                  element,
                  objectLiteralThisType
                )
              : undefined
        ),
      };

    case "object":
      return {
        ...expr,
        properties: expr.properties.map((property) =>
          property.kind === "spread"
            ? {
                ...property,
                expression: rebindObjectLiteralThisInExpression(
                  property.expression,
                  objectLiteralThisType
                ),
              }
            : {
                ...property,
                key:
                  typeof property.key === "string"
                    ? property.key
                    : rebindObjectLiteralThisInExpression(
                        property.key,
                        objectLiteralThisType
                      ),
                value: rebindObjectLiteralThisInExpression(
                  property.value,
                  objectLiteralThisType
                ),
              }
        ),
        behaviorMembers: expr.behaviorMembers?.map((member) =>
          rebindObjectLiteralThisInClassMember(member, objectLiteralThisType)
        ),
      };

    case "functionExpression":
      return {
        ...expr,
        body: rebindObjectLiteralThisInBlock(expr.body, objectLiteralThisType),
      };

    case "arrowFunction":
      return {
        ...expr,
        body:
          expr.body.kind === "blockStatement"
            ? rebindObjectLiteralThisInBlock(expr.body, objectLiteralThisType)
            : rebindObjectLiteralThisInExpression(
                expr.body,
                objectLiteralThisType
              ),
      };

    case "await":
    case "unary":
    case "update":
    case "typeAssertion":
    case "numericNarrowing":
    case "asinterface":
    case "trycast":
      return {
        ...expr,
        expression: rebindObjectLiteralThisInExpression(
          expr.expression,
          objectLiteralThisType
        ),
      };

    case "yield":
      return {
        ...expr,
        expression: expr.expression
          ? rebindObjectLiteralThisInExpression(
              expr.expression,
              objectLiteralThisType
            )
          : undefined,
      };

    case "templateLiteral":
      return {
        ...expr,
        expressions: expr.expressions.map((expression) =>
          rebindObjectLiteralThisInExpression(expression, objectLiteralThisType)
        ),
      };

    default:
      return expr;
  }
};

export const rebindObjectLiteralThisInClassMember = (
  member: IrClassMember,
  objectLiteralThisType: IrType
): IrClassMember => {
  if (member.kind === "methodDeclaration" && member.body) {
    return {
      ...member,
      body: rebindObjectLiteralThisInBlock(member.body, objectLiteralThisType),
    };
  }

  if (member.kind === "propertyDeclaration") {
    return {
      ...member,
      initializer: member.initializer
        ? rebindObjectLiteralThisInExpression(
            member.initializer,
            objectLiteralThisType
          )
        : undefined,
      getterBody: member.getterBody
        ? rebindObjectLiteralThisInBlock(member.getterBody, objectLiteralThisType)
        : undefined,
      setterBody: member.setterBody
        ? rebindObjectLiteralThisInBlock(member.setterBody, objectLiteralThisType)
        : undefined,
    };
  }

  return member;
};

export const collectSynthesizedObjectMembers = (
  properties: readonly IrObjectProperty[],
  pendingMethods: readonly {
    readonly keyName: string;
    readonly functionType: IrFunctionType;
  }[],
  pendingAccessors: readonly {
    readonly memberName: string;
    readonly propertyType: IrType | undefined;
  }[],
  widenNumericLiterals: boolean
): {
  readonly ok: boolean;
  readonly members?: readonly IrInterfaceMember[];
  readonly failureReason?: string;
} => {
  const synthesizedMembers: IrInterfaceMember[] = [];

  for (const prop of properties) {
    if (prop.kind === "property") {
      const keyName =
        typeof prop.key === "string"
          ? prop.key
          : prop.key.kind === "literal" && typeof prop.key.value === "string"
            ? prop.key.value
            : undefined;

      if (!keyName) {
        return {
          ok: false,
          failureReason:
            "Only identifier and computed string-literal keys are supported",
        };
      }

      const propType = getSynthesizedPropertyType(
        prop.value,
        widenNumericLiterals
      );
      if (
        !propType ||
        propType.kind === "unknownType" ||
        propType.kind === "anyType"
      ) {
        return {
          ok: false,
          failureReason: `Property '${keyName}' type cannot be recovered deterministically`,
        };
      }

      synthesizedMembers.push({
        kind: "propertySignature",
        name: keyName,
        type: propType,
        isOptional: false,
        isReadonly: false,
      });
      continue;
    }

    const spreadType = prop.expression.inferredType;
    if (spreadType?.kind !== "objectType") {
      return {
        ok: false,
        failureReason:
          "Spread sources must have a deterministically known object literal shape",
      };
    }

    for (const member of spreadType.members) {
      if (member.kind === "propertySignature") {
        synthesizedMembers.push(member);
      }
    }
  }

  for (const method of pendingMethods) {
    synthesizedMembers.push({
      kind: "propertySignature",
      name: method.keyName,
      type: method.functionType,
      isOptional: false,
      isReadonly: false,
    });
  }

  for (const accessor of pendingAccessors) {
    if (!accessor.propertyType) {
      return {
        ok: false,
        failureReason: `Accessor '${accessor.memberName}' type cannot be recovered deterministically`,
      };
    }

    synthesizedMembers.push({
      kind: "propertySignature",
      name: accessor.memberName,
      type: accessor.propertyType,
      isOptional: false,
      isReadonly: false,
    });
  }

  return { ok: true, members: synthesizedMembers };
};
