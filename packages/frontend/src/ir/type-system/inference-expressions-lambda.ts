/**
 * Lambda Type Inference — inferLambdaType
 *
 * Infers the IrFunctionType of an arrow function or function expression
 * using parameter types from the expected type context.
 *
 * DAG position: depends on inference-utilities, inference-expressions-infer
 */

import type { IrType, IrFunctionType } from "../types/index.js";
import type { TstsNode } from "@tsonic/tsts";
import {
  getTstsDeclaredTypeNode,
  forEachTstsChild,
  getTstsIdentifierText,
  getTstsParameters,
  isTstsFunctionLikeDeclaration,
  isTstsOptionalParameter,
  isTstsRestParameter,
  TstsSyntax,
} from "@tsonic/tsts";
import type { TypeSystemState } from "./type-system-state.js";
import {
  typesEqual,
  containsTypeParameter,
  isAssignableTo,
} from "./type-system-relations.js";
import {
  convertTypeNode,
  delegateToFunctionType,
} from "./type-system-call-resolution.js";
import { unwrapParens } from "./inference-utilities.js";
import { inferExpressionType } from "./inference-expressions-infer.js";

export const inferLambdaType = (
  state: TypeSystemState,
  expr: TstsNode,
  expectedType: IrType | undefined
): IrFunctionType | undefined => {
  const unwrapped = unwrapParens(expr);
  if (
    !TstsSyntax.IsArrowFunction(unwrapped) &&
    !TstsSyntax.IsFunctionExpression(unwrapped)
  ) {
    return undefined;
  }

  const expectedFnType =
    expectedType?.kind === "functionType"
      ? expectedType
      : expectedType
        ? delegateToFunctionType(state, expectedType)
        : undefined;

  const parameters = getTstsParameters(unwrapped).map((p, index) => {
    const name =
      getTstsIdentifierText(TstsSyntax.Node_Name(p)) ?? `arg${index}`;
    const paramType = getTstsDeclaredTypeNode(p)
      ? convertTypeNode(state, getTstsDeclaredTypeNode(p))
      : expectedFnType?.parameters[index]?.type;

    return {
      kind: "parameter" as const,
      pattern: {
        kind: "identifierPattern" as const,
        name,
      },
      type: paramType,
      initializer: undefined,
      isOptional: isTstsOptionalParameter(p),
      isRest: isTstsRestParameter(p),
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
    getTstsDeclaredTypeNode(unwrapped)
      ? convertTypeNode(state, getTstsDeclaredTypeNode(unwrapped))
      : undefined;
  const expectedReturnType = expectedFnType?.returnType;

  const bodyInferredReturnType =
    explicitReturnType !== undefined
      ? undefined
      : (() => {
          const body = TstsSyntax.Node_Body(unwrapped);
          if (body && TstsSyntax.IsBlock(body)) {
            const returns: TstsNode[] = [];
            const visitReturns = (n: TstsNode): void => {
              if (!n) return;
              if (n !== body && isTstsFunctionLikeDeclaration(n)) return;
              if (TstsSyntax.IsReturnStatement(n)) {
                const expression = TstsSyntax.Node_Expression(n);
                if (expression) returns.push(expression);
                return;
              }
              forEachTstsChild(n, (child) => {
                if (child) visitReturns(child);
              });
            };
            visitReturns(body);

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

          return body ? inferExpressionType(state, body, env) : undefined;
        })();

  const inferredReturnType =
    explicitReturnType ??
    (bodyInferredReturnType &&
    expectedReturnType &&
    !containsTypeParameter(expectedReturnType) &&
    isAssignableTo(state, bodyInferredReturnType, expectedReturnType)
      ? bodyInferredReturnType
      : undefined) ??
    (expectedReturnType && !containsTypeParameter(expectedReturnType)
      ? expectedReturnType
      : undefined) ??
    bodyInferredReturnType;

  if (!inferredReturnType) return undefined;

  return {
    kind: "functionType",
    parameters,
    returnType: inferredReturnType,
  };
};
