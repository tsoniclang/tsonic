/**
 * Object literal synthesis helpers — accessor property type resolution,
 * return type inference from blocks, method expression finalization,
 * and synthesized object member collection.
 */

import * as ts from "typescript";
import {
  IrBlockStatement,
  IrFunctionExpression,
  IrFunctionType,
  IrInterfaceMember,
  IrObjectProperty,
  IrType,
  IrExpression,
  IrStatement,
} from "../../types.js";
import {
  typesEqual,
} from "../../types/ir-substitution.js";
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
  const inferredReturnType =
    expr.returnType ?? functionInferredType?.returnType;
  const needsInference =
    inferredReturnType === undefined ||
    inferredReturnType.kind === "unknownType" ||
    inferredReturnType.kind === "anyType";

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
