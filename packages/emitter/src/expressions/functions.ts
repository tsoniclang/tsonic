/**
 * Function expression emitters (function expressions and arrow functions)
 */

import { IrExpression, IrParameter, IrType } from "@tsonic/frontend";
import { EmitterContext, indent, withStatic } from "../types.js";
import { emitExpressionAst } from "../expression-emitter.js";
import { emitStatement } from "../statement-emitter.js";
import { emitType } from "../type-emitter.js";
import { escapeCSharpIdentifier } from "../emitter-types/index.js";
import { printExpression } from "../core/format/backend-ast/printer.js";
import type { CSharpExpressionAst } from "../core/format/backend-ast/types.js";

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
 * Emit lambda parameters.
 */
const emitLambdaParameters = (
  parameters: readonly IrParameter[],
  context: EmitterContext
): [string, EmitterContext] => {
  let currentContext = context;

  const allHaveConcreteTypes = parameters.every((p) => {
    if (!p.type) return false;
    const unwrapped = unwrapParameterModifierType(p.type);
    const actualType = unwrapped ?? p.type;
    return !isTypeParameterLike(actualType, currentContext);
  });

  const parts: string[] = [];

  for (const param of parameters) {
    let name = "_";
    if (param.pattern.kind === "identifierPattern") {
      name = escapeCSharpIdentifier(param.pattern.name);
    }

    const modifier = param.passing !== "value" ? `${param.passing} ` : "";

    if (allHaveConcreteTypes && param.type) {
      const unwrapped = unwrapParameterModifierType(param.type);
      const actualType = unwrapped ?? param.type;

      const [typeStr, newContext] = emitType(actualType, currentContext);
      currentContext = newContext;

      const optionalSuffix =
        param.isOptional && !typeStr.trimEnd().endsWith("?") ? "?" : "";
      parts.push(`${modifier}${typeStr}${optionalSuffix} ${name}`);
    } else {
      parts.push(name);
    }
  }

  return [parts.join(", "), currentContext];
};

/**
 * Emit a function expression as CSharpExpressionAst (C# lambda)
 */
export const emitFunctionExpression = (
  expr: Extract<IrExpression, { kind: "functionExpression" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  const [paramList, paramContext] = emitLambdaParameters(
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
  const blockContextBase = bodyContextSeeded.isStatic
    ? indent(bodyContextSeeded)
    : bodyContextSeeded;
  const [blockCode] = emitStatement(expr.body, {
    ...withStatic(blockContextBase, false),
    returnType,
  });

  // Block body: bridge via identifierExpression since emitStatement returns text
  const asyncPrefix = expr.isAsync ? "async " : "";
  const text = `${asyncPrefix}(${paramList}) =>\n${blockCode}`;
  return [{ kind: "identifierExpression", identifier: text }, paramContext];
};

/**
 * Emit an arrow function as CSharpExpressionAst (C# lambda)
 */
export const emitArrowFunction = (
  expr: Extract<IrExpression, { kind: "arrowFunction" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  const [paramList, paramContext] = emitLambdaParameters(
    expr.parameters,
    context
  );
  const bodyContextSeeded = seedLocalNameMapFromParameters(
    expr.parameters,
    paramContext
  );

  const asyncPrefix = expr.isAsync ? "async " : "";
  const returnType =
    expr.inferredType?.kind === "functionType"
      ? expr.inferredType.returnType
      : undefined;

  if (expr.body.kind === "blockStatement") {
    // Block body: bridge via identifierExpression
    const blockContextBase = bodyContextSeeded.isStatic
      ? indent(bodyContextSeeded)
      : bodyContextSeeded;
    const [blockCode] = emitStatement(expr.body, {
      ...withStatic(blockContextBase, false),
      returnType,
    });
    const text = `${asyncPrefix}(${paramList}) =>\n${blockCode}`;
    return [{ kind: "identifierExpression", identifier: text }, paramContext];
  } else {
    // Expression body: (params) => expression
    const [exprAst] = emitExpressionAst(
      expr.body,
      bodyContextSeeded,
      returnType
    );
    const exprText = printExpression(exprAst);
    const text = `${asyncPrefix}(${paramList}) => ${exprText}`;
    // Arrow/function expressions are separate CLR methods; do not leak lexical
    // remaps / local allocations to the outer scope.
    return [{ kind: "identifierExpression", identifier: text }, paramContext];
  }
};
