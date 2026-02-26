/**
 * Function expression emitters (function expressions and arrow functions)
 */

import { IrExpression, IrParameter, IrType } from "@tsonic/frontend";
import { EmitterContext, withStatic } from "../types.js";
import { emitExpressionAst } from "../expression-emitter.js";
import { emitBlockStatementAst } from "../statement-emitter.js";
import { emitTypeAst } from "../type-emitter.js";
import { escapeCSharpIdentifier } from "../emitter-types/index.js";
import type {
  CSharpExpressionAst,
  CSharpLambdaParameterAst,
  CSharpTypeAst,
} from "../core/format/backend-ast/types.js";

const seedLocalNameMapFromParameters = (
  params: readonly IrParameter[],
  context: EmitterContext
): EmitterContext => {
  const map = new Map(context.localNameMap ?? []);
  const used = new Set(context.usedLocalNames ?? []);
  for (const p of params) {
    if (p.pattern.kind === "identifierPattern") {
      const emitted = escapeCSharpIdentifier(p.pattern.name);
      map.set(p.pattern.name, emitted);
      used.add(emitted);
    }
  }
  return { ...context, localNameMap: map, usedLocalNames: used };
};

/**
 * Unwrap ref/out/in wrapper types (e.g., ref<T> -> T)
 */
const unwrapParameterModifierType = (type: IrType): IrType | null => {
  if (type.kind !== "referenceType") {
    return null;
  }

  const name = type.name;
  if (
    (name === "out" || name === "ref" || name === "In") &&
    type.typeArguments &&
    type.typeArguments.length === 1
  ) {
    const innerType = type.typeArguments[0];
    return innerType ?? null;
  }

  return null;
};

const isTypeParameterLike = (
  type: IrType,
  context: EmitterContext
): boolean => {
  if (type.kind === "typeParameterType") return true;
  if (
    type.kind === "referenceType" &&
    (context.typeParameters?.has(type.name) ?? false) &&
    (!type.typeArguments || type.typeArguments.length === 0)
  ) {
    return true;
  }
  return false;
};

/**
 * Emit lambda parameters as typed AST nodes.
 */
const emitLambdaParametersAst = (
  parameters: readonly IrParameter[],
  context: EmitterContext
): [readonly CSharpLambdaParameterAst[], EmitterContext] => {
  let currentContext = context;

  const allHaveConcreteTypes = parameters.every((p) => {
    if (!p.type) return false;
    const unwrapped = unwrapParameterModifierType(p.type);
    const actualType = unwrapped ?? p.type;
    return !isTypeParameterLike(actualType, currentContext);
  });

  const paramAsts: CSharpLambdaParameterAst[] = [];

  for (const param of parameters) {
    const name =
      param.pattern.kind === "identifierPattern"
        ? escapeCSharpIdentifier(param.pattern.name)
        : "_";

    const modifier = param.passing !== "value" ? param.passing : undefined;

    if (allHaveConcreteTypes && param.type) {
      const unwrapped = unwrapParameterModifierType(param.type);
      const actualType = unwrapped ?? param.type;

      const [typeAst, newContext] = emitTypeAst(actualType, currentContext);
      currentContext = newContext;

      // Wrap in nullable if optional and not already nullable
      const finalTypeAst: CSharpTypeAst =
        param.isOptional && typeAst.kind !== "nullableType"
          ? { kind: "nullableType", underlyingType: typeAst }
          : typeAst;

      paramAsts.push(
        modifier
          ? { name, type: finalTypeAst, modifier }
          : { name, type: finalTypeAst }
      );
    } else {
      paramAsts.push(modifier ? { name, modifier } : { name });
    }
  }

  return [paramAsts, currentContext];
};

/**
 * Emit a function expression as CSharpExpressionAst (C# lambda)
 */
export const emitFunctionExpression = (
  expr: Extract<IrExpression, { kind: "functionExpression" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  const [paramAsts, paramContext] = emitLambdaParametersAst(
    expr.parameters,
    context
  );
  const bodyContextSeeded = seedLocalNameMapFromParameters(
    expr.parameters,
    paramContext
  );

  // Function expressions always have block bodies
  const returnType =
    expr.inferredType?.kind === "functionType"
      ? expr.inferredType.returnType
      : undefined;
  const blockContext = withStatic(bodyContextSeeded, false);
  const [blockAst] = emitBlockStatementAst(expr.body, {
    ...blockContext,
    returnType,
  });

  const result: CSharpExpressionAst = {
    kind: "lambdaExpression",
    isAsync: expr.isAsync ?? false,
    parameters: paramAsts,
    body: blockAst,
  };
  return [result, paramContext];
};

/**
 * Emit an arrow function as CSharpExpressionAst (C# lambda)
 */
export const emitArrowFunction = (
  expr: Extract<IrExpression, { kind: "arrowFunction" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  const [paramAsts, paramContext] = emitLambdaParametersAst(
    expr.parameters,
    context
  );
  const bodyContextSeeded = seedLocalNameMapFromParameters(
    expr.parameters,
    paramContext
  );

  const returnType =
    expr.inferredType?.kind === "functionType"
      ? expr.inferredType.returnType
      : undefined;

  if (expr.body.kind === "blockStatement") {
    // Block body: emit as AST directly
    const blockContext = withStatic(bodyContextSeeded, false);
    const [blockAst] = emitBlockStatementAst(expr.body, {
      ...blockContext,
      returnType,
    });
    const result: CSharpExpressionAst = {
      kind: "lambdaExpression",
      isAsync: expr.isAsync ?? false,
      parameters: paramAsts,
      body: blockAst,
    };
    return [result, paramContext];
  } else {
    // Expression body: (params) => expression
    const [exprAst] = emitExpressionAst(
      expr.body,
      bodyContextSeeded,
      returnType
    );
    // Arrow/function expressions are separate CLR methods; do not leak lexical
    // remaps / local allocations to the outer scope.
    const result: CSharpExpressionAst = {
      kind: "lambdaExpression",
      isAsync: expr.isAsync ?? false,
      parameters: paramAsts,
      body: exprAst,
    };
    return [result, paramContext];
  }
};
