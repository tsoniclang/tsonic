/**
 * Lambda Type Inference — inferLambdaType
 *
 * Infers the IrFunctionType of an arrow function or function expression
 * using parameter types from the expected type context.
 *
 * DAG position: depends on inference-utilities, inference-expressions-infer
 */

import type { IrType, IrFunctionType } from "../types/index.js";
import * as ts from "typescript";
import type { TypeSystemState } from "./type-system-state.js";
import { typesEqual, containsTypeParameter } from "./type-system-relations.js";
import {
  convertTypeNode,
  delegateToFunctionType,
} from "./type-system-call-resolution.js";
import { unwrapParens } from "./inference-utilities.js";
import { inferExpressionType } from "./inference-expressions-infer.js";

export const inferLambdaType = (
  state: TypeSystemState,
  expr: ts.Expression,
  expectedType: IrType | undefined
): IrFunctionType | undefined => {
  const unwrapped = unwrapParens(expr);
  if (!ts.isArrowFunction(unwrapped) && !ts.isFunctionExpression(unwrapped)) {
    return undefined;
  }

  const expectedFnType =
    expectedType?.kind === "functionType"
      ? expectedType
      : expectedType
        ? delegateToFunctionType(state, expectedType)
        : undefined;

  const parameters = unwrapped.parameters.map((p, index) => {
    const name = ts.isIdentifier(p.name) ? p.name.text : `arg${index}`;
    const paramType = p.type
      ? convertTypeNode(state, p.type)
      : expectedFnType?.parameters[index]?.type;

    return {
      kind: "parameter" as const,
      pattern: {
        kind: "identifierPattern" as const,
        name,
      },
      type: paramType,
      initializer: undefined,
      isOptional: !!p.questionToken,
      isRest: !!p.dotDotDotToken,
      passing: "value" as const,
    };
  });

  const env = new Map<string, IrType>();
  for (const p of parameters) {
    if (p.pattern.kind === "identifierPattern" && p.pattern.name && p.type) {
      env.set(p.pattern.name, p.type);
    }
  }

  const explicitReturnType =
    "type" in unwrapped && unwrapped.type
      ? convertTypeNode(state, unwrapped.type)
      : undefined;
  const expectedReturnType = expectedFnType?.returnType;

  const inferredReturnType =
    explicitReturnType ??
    (expectedReturnType && !containsTypeParameter(expectedReturnType)
      ? expectedReturnType
      : undefined) ??
    (() => {
      if (ts.isBlock(unwrapped.body)) {
        const returns: ts.Expression[] = [];
        const visit = (n: ts.Node): void => {
          if (ts.isFunctionLike(n) && n !== unwrapped) return;
          if (ts.isReturnStatement(n) && n.expression) {
            returns.push(n.expression);
          }
          n.forEachChild(visit);
        };
        unwrapped.body.forEachChild(visit);

        if (returns.length === 0) return { kind: "voidType" as const };

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const first = inferExpressionType(state, returns[0]!, env);
        if (!first) return undefined;
        for (let i = 1; i < returns.length; i++) {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const t = inferExpressionType(state, returns[i]!, env);
          if (!t || !typesEqual(t, first)) return undefined;
        }
        return first;
      }

      return inferExpressionType(state, unwrapped.body, env);
    })();

  if (!inferredReturnType) return undefined;

  return {
    kind: "functionType",
    parameters,
    returnType: inferredReturnType,
  };
};
