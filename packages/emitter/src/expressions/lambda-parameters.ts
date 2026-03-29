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
import { decimalIntegerLiteral } from "../core/format/backend-ast/builders.js";
import {
  resolveTypeAlias,
  stripNullish,
  getArrayLikeElementType,
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
  readonly ast?: CSharpLambdaParameterAst;
  readonly emittedName: string;
  readonly bindsDirectly: boolean;
  readonly bindingSourceExpression?: CSharpExpressionAst;
  readonly bindingSourceType?: IrType;
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
      (p.parameter.isOptional || p.parameter.initializer !== undefined) &&
        !p.parameter.isRest,
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

type PlannedLambdaParameter = {
  readonly parameter?: IrParameter;
  readonly type?: IrType;
  readonly isOptional: boolean;
  readonly modifier?: "ref" | "out" | "in";
  readonly emittedName: string;
  readonly bindsDirectly: boolean;
  readonly bindingSourceExpression?: CSharpExpressionAst;
  readonly emitInParameterList: boolean;
};

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
  const contextualRestIndex = contextualParameters.findIndex(
    (parameter) => parameter?.isRest
  );
  const contextualRestParameter =
    contextualRestIndex >= 0
      ? (contextualParameters[contextualRestIndex] ?? undefined)
      : undefined;
  const plannedParameters: PlannedLambdaParameter[] = [];
  let restCarrierName: string | undefined;

  const ensureRestCarrierName = (): string => {
    if (restCarrierName !== undefined) return restCarrierName;
    const baseName =
      contextualRestParameter?.pattern.kind === "identifierPattern"
        ? `__unused_${escapeCSharpIdentifier(
            contextualRestParameter.pattern.name
          )}`
        : "__unused_rest";
    restCarrierName = baseName;
    return restCarrierName;
  };

  const buildRestCarrierExpression = (
    index: number
  ): CSharpExpressionAst | undefined => {
    const carrierName = restCarrierName ?? ensureRestCarrierName();
    if (contextualRestIndex < 0 || index < contextualRestIndex) {
      return undefined;
    }

    if (parameters[index]?.isRest) {
      return {
        kind: "identifierExpression",
        identifier: carrierName,
      };
    }

    return {
      kind: "elementAccessExpression",
      expression: {
        kind: "identifierExpression",
        identifier: carrierName,
      },
      arguments: [decimalIntegerLiteral(index - contextualRestIndex)],
    };
  };

  const pushPlannedParameter = (planned: PlannedLambdaParameter): void => {
    plannedParameters.push(planned);
  };

  const synthesizeRestCarrierParameter = (): void => {
    if (!contextualRestParameter) return;
    const carrierName = ensureRestCarrierName();
    if (
      plannedParameters.some(
        (planned) =>
          planned.emitInParameterList && planned.emittedName === carrierName
      )
    ) {
      return;
    }
    pushPlannedParameter({
      emittedName: carrierName,
      bindsDirectly: false,
      emitInParameterList: true,
      type: contextualRestParameter.type,
      isOptional:
        contextualRestParameter.isOptional ||
        contextualRestParameter.initializer !== undefined,
    });
  };

  const shouldLowerFromContextualRest = (
    parameter: IrParameter,
    index: number
  ): boolean => {
    if (contextualRestParameter === undefined || index < contextualRestIndex) {
      return false;
    }

    return !(
      parameter.isRest &&
      index === contextualRestIndex &&
      parameters.length === contextualRestIndex + 1
    );
  };

  for (let index = 0; index < parameters.length; index++) {
    const param = parameters[index];
    if (!param) continue;
    const contextualParam = contextualParameters[index];
    const effectiveParameterType =
      param.type?.kind === "functionType" &&
      contextualParam?.type?.kind === "functionType"
        ? contextualParam.type
        : param.type;

    if (shouldLowerFromContextualRest(param, index)) {
      synthesizeRestCarrierParameter();
      pushPlannedParameter({
        parameter: param,
        emittedName: `__rest_binding_${index}`,
        bindsDirectly: false,
        emitInParameterList: false,
        isOptional: param.isOptional || param.initializer !== undefined,
        bindingSourceExpression: buildRestCarrierExpression(index),
        type:
          param.isRest && index === contextualRestIndex
            ? (contextualRestParameter?.type ?? param.type)
            : (getArrayLikeElementType(
                contextualRestParameter?.type,
                currentContext
              ) ?? undefined),
      });
      continue;
    }

    const bindsDirectly =
      param.pattern.kind === "identifierPattern" &&
      param.initializer === undefined;
    const name = bindsDirectly
      ? escapeCSharpIdentifier(param.pattern.name)
      : `__param${index}`;

    const modifier = param.passing !== "value" ? param.passing : undefined;

    pushPlannedParameter({
      parameter: param,
      emittedName: name,
      bindsDirectly,
      emitInParameterList: true,
      type: effectiveParameterType,
      isOptional: param.isOptional || param.initializer !== undefined,
      modifier,
    });
  }

  for (
    let index = parameters.length;
    index < contextualParameters.length;
    index += 1
  ) {
    const contextualParam = contextualParameters[index];
    if (!contextualParam) continue;

    if (contextualParam.isRest) {
      synthesizeRestCarrierParameter();
      continue;
    }

    const contextualIndex = index;

    const name =
      contextualParam.pattern.kind === "identifierPattern"
        ? `__unused_${escapeCSharpIdentifier(contextualParam.pattern.name)}`
        : `__unused${contextualIndex}`;

    pushPlannedParameter({
      emittedName: name,
      bindsDirectly: false,
      emitInParameterList: true,
      type: contextualParam.type,
      isOptional:
        contextualParam.isOptional || contextualParam.initializer !== undefined,
    });
  }

  const allHaveConcreteTypes = plannedParameters
    .filter((planned) => planned.emitInParameterList)
    .every((planned) => {
      if (!planned.type) return false;
      const unwrapped = unwrapParameterModifierType(planned.type);
      const actualType = unwrapped ?? planned.type;
      return isConcreteLambdaParamType(actualType, currentContext);
    });

  const emittedParameters: EmittedLambdaParameter[] = [];
  for (const planned of plannedParameters) {
    if (!planned.emitInParameterList) {
      emittedParameters.push({
        parameter: planned.parameter,
        emittedName: planned.emittedName,
        bindsDirectly: planned.bindsDirectly,
        bindingSourceExpression: planned.bindingSourceExpression,
        bindingSourceType: planned.type,
      });
      continue;
    }

    let ast: CSharpLambdaParameterAst;
    if (allHaveConcreteTypes && planned.type) {
      const unwrapped = unwrapParameterModifierType(planned.type);
      const actualType = unwrapped ?? planned.type;
      const [typeAst, newContext] = emitTypeAst(actualType, currentContext);
      currentContext = newContext;
      const finalTypeAst = wrapOptionalLambdaParameterTypeAst(
        typeAst,
        planned.isOptional
      );
      ast = planned.modifier
        ? {
            name: planned.emittedName,
            type: finalTypeAst,
            modifier: planned.modifier,
          }
        : { name: planned.emittedName, type: finalTypeAst };
    } else {
      ast = planned.modifier
        ? { name: planned.emittedName, modifier: planned.modifier }
        : { name: planned.emittedName };
    }

    emittedParameters.push({
      parameter: planned.parameter,
      ast,
      emittedName: planned.emittedName,
      bindsDirectly: planned.bindsDirectly,
      bindingSourceExpression: planned.bindingSourceExpression,
      bindingSourceType: planned.bindingSourceExpression
        ? planned.type
        : undefined,
    });
  }

  return [emittedParameters, currentContext];
};

export const lowerLambdaParameterPreludeAst = (
  parameters: readonly EmittedLambdaParameter[],
  context: EmitterContext
): [readonly CSharpStatementAst[], EmitterContext] => {
  let currentContext = context;
  const statements: CSharpStatementAst[] = [];

  for (const parameter of parameters) {
    if (parameter.bindsDirectly || !parameter.parameter) continue;

    let inputExpr: CSharpExpressionAst = parameter.bindingSourceExpression ?? {
      kind: "identifierExpression",
      identifier: parameter.emittedName,
    };
    const inputType = parameter.bindingSourceType ?? parameter.parameter.type;

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
      inputType,
      currentContext
    );
    statements.push(...lowered.statements);
    currentContext = lowered.context;
  }

  return [statements, currentContext];
};
