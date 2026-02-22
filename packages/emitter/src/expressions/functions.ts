/**
 * Function expression emitters (function expressions and arrow functions)
 */

import { IrExpression, IrParameter, IrType } from "@tsonic/frontend";
import {
  EmitterContext,
  CSharpFragment,
  indent,
  withStatic,
} from "../types.js";
import { emitExpression } from "../expression-emitter.js";
import { emitStatement } from "../statement-emitter.js";
import { emitType } from "../type-emitter.js";
import { escapeCSharpIdentifier } from "../emitter-types/index.js";

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
 * Returns the inner type if it's a wrapper, null otherwise.
 */
const unwrapParameterModifierType = (type: IrType): IrType | null => {
  if (type.kind !== "referenceType") {
    return null;
  }

  const name = type.name;
  // Check for wrapper types: out<T>, ref<T>, In<T>
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
 * Rules:
 * - If ALL params have types, emit typed: (Type a, Type b) => ...
 * - If ANY param is missing type, emit untyped: (a, b) => ...
 * - Support ref/out/in modifiers
 * - Never emit = default or initializers (not valid in C# lambdas)
 */
const emitLambdaParameters = (
  parameters: readonly IrParameter[],
  context: EmitterContext
): [string, EmitterContext] => {
  let currentContext = context;

  // Check if ALL parameters have types - "all-or-nothing" rule
  // C# doesn't allow mixing typed and untyped lambda parameters
  const allHaveConcreteTypes = parameters.every((p) => {
    if (!p.type) return false;
    const unwrapped = unwrapParameterModifierType(p.type);
    const actualType = unwrapped ?? p.type;
    // If the "type" is a type parameter (or references one), omit all types and let C# infer.
    // This avoids emitting invalid C# like `(T x) => ...` in non-generic scopes.
    return !isTypeParameterLike(actualType, currentContext);
  });

  const parts: string[] = [];

  for (const param of parameters) {
    // Get parameter name
    let name = "_";
    if (param.pattern.kind === "identifierPattern") {
      name = escapeCSharpIdentifier(param.pattern.name);
    }

    // Get modifier (ref/out/in)
    const modifier = param.passing !== "value" ? `${param.passing} ` : "";

    if (allHaveConcreteTypes && param.type) {
      // Emit typed parameter
      // Unwrap ref/out/in wrapper types if present
      const unwrapped = unwrapParameterModifierType(param.type);
      const actualType = unwrapped ?? param.type;

      const [typeStr, newContext] = emitType(actualType, currentContext);
      currentContext = newContext;

      const optionalSuffix =
        param.isOptional && !typeStr.trimEnd().endsWith("?") ? "?" : "";
      parts.push(`${modifier}${typeStr}${optionalSuffix} ${name}`);
    } else {
      // Emit untyped parameter (name only)
      // Note: modifiers don't work without types in C# lambdas
      parts.push(name);
    }
  }

  return [parts.join(", "), currentContext];
};

/**
 * Emit a function expression as C# lambda
 */
export const emitFunctionExpression = (
  expr: Extract<IrExpression, { kind: "functionExpression" }>,
  context: EmitterContext
): [CSharpFragment, EmitterContext] => {
  // Emit parameters
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

  const asyncPrefix = expr.isAsync ? "async " : "";
  const text = `${asyncPrefix}(${paramList}) =>\n${blockCode}`;
  return [{ text }, paramContext];
};

/**
 * Emit an arrow function as C# lambda
 */
export const emitArrowFunction = (
  expr: Extract<IrExpression, { kind: "arrowFunction" }>,
  context: EmitterContext
): [CSharpFragment, EmitterContext] => {
  // Emit parameters
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

  // Arrow function body can be block or expression
  if (expr.body.kind === "blockStatement") {
    // Block body: (params) => { ... }
    const blockContextBase = bodyContextSeeded.isStatic
      ? indent(bodyContextSeeded)
      : bodyContextSeeded;
    const [blockCode] = emitStatement(expr.body, {
      ...withStatic(blockContextBase, false),
      returnType,
    });
    const text = `${asyncPrefix}(${paramList}) =>\n${blockCode}`;
    return [{ text }, paramContext];
  } else {
    // Expression body: (params) => expression
    const [exprCode] = emitExpression(expr.body, bodyContextSeeded, returnType);
    const text = `${asyncPrefix}(${paramList}) => ${exprCode.text}`;
    // Arrow/function expressions are separate CLR methods; do not leak lexical
    // remaps / local allocations to the outer scope.
    return [{ text }, paramContext];
  }
};
