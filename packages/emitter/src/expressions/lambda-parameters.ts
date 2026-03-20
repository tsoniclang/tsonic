/**
 * Lambda parameter emission and lowering.
 *
 * Extracted from functions.ts — contains parameter type resolution,
 * typed parameter AST emission, default-value lowering, and destructuring
 * prelude generation for lambda expressions.
 */

import { IrExpression, IrParameter, IrType } from "@tsonic/frontend";
import { EmitterContext } from "../types.js";
import { emitExpressionAst } from "../expression-emitter.js";
import { emitTypeAst } from "../type-emitter.js";
import { escapeCSharpIdentifier } from "../emitter-types/index.js";
import { lowerPatternAst } from "../patterns.js";
import {
  resolveTypeAlias,
  stripNullish,
} from "../core/semantic/type-resolution.js";
import { unwrapParameterModifierType } from "../core/semantic/parameter-modifier-types.js";
import { registerParameterTypes } from "../core/semantic/symbol-types.js";
import type {
  CSharpExpressionAst,
  CSharpLambdaParameterAst,
  CSharpStatementAst,
  CSharpTypeAst,
} from "../core/format/backend-ast/types.js";

export type EmittedLambdaParameter = {
  readonly parameter?: IrParameter;
  readonly ast: CSharpLambdaParameterAst;
  readonly emittedName: string;
  readonly bindsDirectly: boolean;
};

export const seedLocalNameMapFromParameters = (
  params: readonly EmittedLambdaParameter[],
  context: EmitterContext
): EmitterContext => {
  const map = new Map(context.localNameMap ?? []);
  let currentContext = context;
  const used = new Set(context.usedLocalNames ?? []);
  for (const p of params) {
    if (!p.bindsDirectly) continue;
    if (!p.parameter || p.parameter.pattern.kind !== "identifierPattern")
      continue;
    map.set(p.parameter.pattern.name, p.emittedName);
    used.add(p.emittedName);
    currentContext = registerParameterTypes(
      p.parameter.pattern.name,
      p.parameter.type,
      currentContext
    );
  }
  return {
    ...currentContext,
    localNameMap: map,
    usedLocalNames: used,
  };
};

export type ContextualFunctionType = Extract<IrType, { kind: "functionType" }>;

export const resolveContextualFunctionType = (
  expr: Extract<IrExpression, { kind: "functionExpression" | "arrowFunction" }>,
  expectedType: IrType | undefined,
  context: EmitterContext
): ContextualFunctionType | undefined => {
  if (expectedType) {
    const resolvedExpected = resolveTypeAlias(
      stripNullish(expectedType),
      context
    );
    if (resolvedExpected.kind === "functionType") {
      return resolvedExpected;
    }
  }

  if (expr.inferredType?.kind === "functionType") {
    return expr.inferredType;
  }

  return undefined;
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

const isConcreteLambdaParamType = (
  type: IrType,
  context: EmitterContext
): boolean => {
  if (type.kind === "unknownType" || type.kind === "anyType") return false;
  return !isTypeParameterLike(type, context);
};

const wrapOptionalLambdaParameterTypeAst = (
  typeAst: CSharpTypeAst,
  isOptional: boolean
): CSharpTypeAst =>
  isOptional && typeAst.kind !== "nullableType"
    ? { kind: "nullableType", underlyingType: typeAst }
    : typeAst;

/**
 * Emit lambda parameters as typed AST nodes.
 */
export const emitLambdaParametersAst = (
  parameters: readonly IrParameter[],
  context: EmitterContext,
  contextualFunctionType?: ContextualFunctionType
): [readonly EmittedLambdaParameter[], EmitterContext] => {
  let currentContext = context;
  const contextualParameters = contextualFunctionType?.parameters ?? [];
  const synthesizedContextualParameters =
    contextualParameters.length > parameters.length
      ? contextualParameters
          .slice(parameters.length)
          .filter((parameter) => !parameter.isRest)
      : [];

  const allHaveConcreteTypes =
    parameters.every((p) => {
      if (!p.type) return false;
      const unwrapped = unwrapParameterModifierType(p.type);
      const actualType = unwrapped ?? p.type;
      return isConcreteLambdaParamType(actualType, currentContext);
    }) &&
    synthesizedContextualParameters.every((p) => {
      if (!p.type) return false;
      const unwrapped = unwrapParameterModifierType(p.type);
      const actualType = unwrapped ?? p.type;
      return isConcreteLambdaParamType(actualType, currentContext);
    });

  const paramAsts: EmittedLambdaParameter[] = [];

  for (let index = 0; index < parameters.length; index++) {
    const param = parameters[index];
    if (!param) continue;
    const bindsDirectly =
      param.pattern.kind === "identifierPattern" &&
      param.initializer === undefined;
    const name = bindsDirectly
      ? escapeCSharpIdentifier(param.pattern.name)
      : `__param${index}`;

    const modifier = param.passing !== "value" ? param.passing : undefined;

    if (allHaveConcreteTypes && param.type) {
      const unwrapped = unwrapParameterModifierType(param.type);
      const actualType = unwrapped ?? param.type;

      const [typeAst, newContext] = emitTypeAst(actualType, currentContext);
      currentContext = newContext;
      const finalTypeAst = wrapOptionalLambdaParameterTypeAst(
        typeAst,
        param.isOptional || param.initializer !== undefined
      );

      paramAsts.push({
        parameter: param,
        emittedName: name,
        bindsDirectly,
        ast: modifier
          ? { name, type: finalTypeAst, modifier }
          : { name, type: finalTypeAst },
      });
    } else {
      paramAsts.push({
        parameter: param,
        emittedName: name,
        bindsDirectly,
        ast: modifier ? { name, modifier } : { name },
      });
    }
  }

  for (
    let index = 0;
    index < synthesizedContextualParameters.length;
    index += 1
  ) {
    const contextualParam = synthesizedContextualParameters[index];
    if (!contextualParam) continue;
    const contextualIndex = parameters.length + index;

    const name =
      contextualParam.pattern.kind === "identifierPattern"
        ? `__unused_${escapeCSharpIdentifier(contextualParam.pattern.name)}`
        : `__unused${contextualIndex}`;

    if (allHaveConcreteTypes && contextualParam.type) {
      const unwrapped = unwrapParameterModifierType(contextualParam.type);
      const actualType = unwrapped ?? contextualParam.type;
      const [typeAst, newContext] = emitTypeAst(actualType, currentContext);
      currentContext = newContext;
      const finalTypeAst = wrapOptionalLambdaParameterTypeAst(
        typeAst,
        contextualParam.isOptional || contextualParam.initializer !== undefined
      );
      paramAsts.push({
        emittedName: name,
        bindsDirectly: false,
        ast: { name, type: finalTypeAst },
      });
      continue;
    }

    paramAsts.push({
      emittedName: name,
      bindsDirectly: false,
      ast: { name },
    });
  }

  return [paramAsts, currentContext];
};

export const lowerLambdaParameterPreludeAst = (
  parameters: readonly EmittedLambdaParameter[],
  context: EmitterContext
): [readonly CSharpStatementAst[], EmitterContext] => {
  let currentContext = context;
  const statements: CSharpStatementAst[] = [];

  for (const parameter of parameters) {
    if (parameter.bindsDirectly || !parameter.parameter) continue;

    let inputExpr: CSharpExpressionAst = {
      kind: "identifierExpression",
      identifier: parameter.emittedName,
    };

    if (parameter.parameter.initializer) {
      const [defaultAst, defaultContext] = emitExpressionAst(
        parameter.parameter.initializer,
        currentContext,
        parameter.parameter.type
      );
      currentContext = defaultContext;
      inputExpr = {
        kind: "binaryExpression",
        operatorToken: "??",
        left: inputExpr,
        right: defaultAst,
      };
    }

    const lowered = lowerPatternAst(
      parameter.parameter.pattern,
      inputExpr,
      parameter.parameter.type,
      currentContext
    );
    statements.push(...lowered.statements);
    currentContext = lowered.context;
  }

  return [statements, currentContext];
};
