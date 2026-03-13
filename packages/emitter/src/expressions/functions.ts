/**
 * Function expression emitters (function expressions and arrow functions)
 */

import { IrExpression, IrParameter, IrType } from "@tsonic/frontend";
import { EmitterContext, withStatic } from "../types.js";
import { emitExpressionAst } from "../expression-emitter.js";
import { emitBlockStatementAst } from "../statement-emitter.js";
import { emitTypeAst } from "../type-emitter.js";
import { escapeCSharpIdentifier } from "../emitter-types/index.js";
import { lowerPatternAst } from "../patterns.js";
import type {
  CSharpBlockStatementAst,
  CSharpExpressionAst,
  CSharpLambdaParameterAst,
  CSharpStatementAst,
  CSharpTypeAst,
} from "../core/format/backend-ast/types.js";

type EmittedLambdaParameter = {
  readonly parameter: IrParameter;
  readonly ast: CSharpLambdaParameterAst;
  readonly emittedName: string;
  readonly bindsDirectly: boolean;
};

const seedLocalNameMapFromParameters = (
  params: readonly EmittedLambdaParameter[],
  context: EmitterContext
): EmitterContext => {
  const map = new Map(context.localNameMap ?? []);
  const used = new Set(context.usedLocalNames ?? []);
  for (const p of params) {
    if (!p.bindsDirectly) continue;
    if (p.parameter.pattern.kind !== "identifierPattern") continue;
    map.set(p.parameter.pattern.name, p.emittedName);
    used.add(p.emittedName);
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

const isConcreteLambdaParamType = (
  type: IrType,
  context: EmitterContext
): boolean => {
  if (type.kind === "unknownType" || type.kind === "anyType") return false;
  return !isTypeParameterLike(type, context);
};

/**
 * Emit lambda parameters as typed AST nodes.
 */
const emitLambdaParametersAst = (
  parameters: readonly IrParameter[],
  context: EmitterContext
): [readonly EmittedLambdaParameter[], EmitterContext] => {
  let currentContext = context;

  const allHaveConcreteTypes = parameters.every((p) => {
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

      // Wrap in nullable if optional and not already nullable
      const finalTypeAst: CSharpTypeAst =
        (param.isOptional || param.initializer !== undefined) &&
        typeAst.kind !== "nullableType"
          ? { kind: "nullableType", underlyingType: typeAst }
          : typeAst;

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

  return [paramAsts, currentContext];
};

const lowerLambdaParameterPreludeAst = (
  parameters: readonly EmittedLambdaParameter[],
  context: EmitterContext
): [readonly CSharpStatementAst[], EmitterContext] => {
  let currentContext = context;
  const statements: CSharpStatementAst[] = [];

  for (const parameter of parameters) {
    if (parameter.bindsDirectly) continue;

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

const emitLambdaBodyAst = (
  parameters: readonly EmittedLambdaParameter[],
  body: Extract<
    IrExpression,
    { kind: "functionExpression" | "arrowFunction" }
  >["body"],
  context: EmitterContext,
  returnType: IrType | undefined,
  capturesObjectLiteralThis: boolean | undefined
): [CSharpExpressionAst | CSharpBlockStatementAst, EmitterContext] => {
  const blockContext = withStatic(
    {
      ...context,
      objectLiteralThisIdentifier: capturesObjectLiteralThis
        ? context.objectLiteralThisIdentifier
        : undefined,
    },
    false
  );

  const [preludeStatements, preludeContext] = lowerLambdaParameterPreludeAst(
    parameters,
    blockContext
  );

  if (body.kind === "blockStatement") {
    const [blockAst] = emitBlockStatementAst(body, {
      ...preludeContext,
      returnType,
    });
    return [
      {
        kind: "blockStatement",
        statements: [...preludeStatements, ...blockAst.statements],
      },
      preludeContext,
    ];
  }

  const [exprAst] = emitExpressionAst(body, preludeContext, returnType);
  return [
    {
      kind: "blockStatement",
      statements: [
        ...preludeStatements,
        {
          kind: "returnStatement",
          expression: exprAst,
        },
      ],
    },
    preludeContext,
  ];
};

/**
 * Emit a function expression as CSharpExpressionAst (C# lambda)
 */
export const emitFunctionExpression = (
  expr: Extract<IrExpression, { kind: "functionExpression" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  const [paramInfos, paramContext] = emitLambdaParametersAst(
    expr.parameters,
    context
  );
  const bodyContextSeeded = seedLocalNameMapFromParameters(
    paramInfos,
    paramContext
  );

  const returnType =
    expr.inferredType?.kind === "functionType"
      ? expr.inferredType.returnType
      : undefined;
  const [bodyAst] = emitLambdaBodyAst(
    paramInfos,
    expr.body,
    bodyContextSeeded,
    returnType,
    expr.capturesObjectLiteralThis
  );

  const result: CSharpExpressionAst = {
    kind: "lambdaExpression",
    isAsync: expr.isAsync ?? false,
    parameters: paramInfos.map((p) => p.ast),
    body: bodyAst,
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
  const [paramInfos, paramContext] = emitLambdaParametersAst(
    expr.parameters,
    context
  );
  const bodyContextSeeded = seedLocalNameMapFromParameters(
    paramInfos,
    paramContext
  );

  const returnType =
    expr.inferredType?.kind === "functionType"
      ? expr.inferredType.returnType
      : undefined;

  const requiresLoweredBody = paramInfos.some((p) => !p.bindsDirectly);

  if (expr.body.kind === "blockStatement" || requiresLoweredBody) {
    const [bodyAst] = emitLambdaBodyAst(
      paramInfos,
      expr.body,
      bodyContextSeeded,
      returnType,
      undefined
    );
    const result: CSharpExpressionAst = {
      kind: "lambdaExpression",
      isAsync: expr.isAsync ?? false,
      parameters: paramInfos.map((p) => p.ast),
      body: bodyAst,
    };
    return [result, paramContext];
  }

  // Expression body: (params) => expression
  const [exprAst] = emitExpressionAst(expr.body, bodyContextSeeded, returnType);
  const result: CSharpExpressionAst = {
    kind: "lambdaExpression",
    isAsync: expr.isAsync ?? false,
    parameters: paramInfos.map((p) => p.ast),
    body: exprAst,
  };
  return [result, paramContext];
};
