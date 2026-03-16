/**
 * Function expression emitters (function expressions and arrow functions)
 */

import {
  IrExpression,
  IrParameter,
  IrStatement,
  IrType,
  getAwaitedIrType,
  isAwaitableIrType,
} from "@tsonic/frontend";
import { EmitterContext, withStatic } from "../types.js";
import { emitExpressionAst } from "../expression-emitter.js";
import { emitBlockStatementAst } from "../statement-emitter.js";
import { emitTypeAst } from "../type-emitter.js";
import { escapeCSharpIdentifier } from "../emitter-types/index.js";
import { lowerPatternAst } from "../patterns.js";
import {
  resolveTypeAlias,
  stripNullish,
} from "../core/semantic/type-resolution.js";
import {
  buildRuntimeUnionLayout,
  findRuntimeUnionMemberIndex,
} from "../core/semantic/runtime-unions.js";
import { identifierType } from "../core/format/backend-ast/builders.js";
import {
  getIdentifierTypeName,
  stableTypeKeyFromAst,
} from "../core/format/backend-ast/utils.js";
import {
  allocateLocalName,
  registerLocalValueType,
} from "../core/format/local-names.js";
import type {
  CSharpBlockStatementAst,
  CSharpExpressionAst,
  CSharpLambdaParameterAst,
  CSharpStatementAst,
  CSharpTypeAst,
} from "../core/format/backend-ast/types.js";

type EmittedLambdaParameter = {
  readonly parameter?: IrParameter;
  readonly ast: CSharpLambdaParameterAst;
  readonly emittedName: string;
  readonly bindsDirectly: boolean;
};

const seedLocalNameMapFromParameters = (
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
    currentContext = registerLocalValueType(
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

type ContextualFunctionType = Extract<IrType, { kind: "functionType" }>;

type AsyncUnionReturnPlan = {
  readonly unionReturnType: IrType;
  readonly awaitedReturnType: IrType;
  readonly awaitableMemberType: IrType;
};

const resolveContextualFunctionType = (
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

const isDefinitelyTerminatingStatement = (stmt: IrStatement): boolean => {
  if (stmt.kind === "returnStatement" || stmt.kind === "throwStatement") {
    return true;
  }
  if (stmt.kind === "blockStatement") {
    const last = stmt.statements.at(-1);
    return last ? isDefinitelyTerminatingStatement(last) : false;
  }
  return false;
};

const getAsyncUnionReturnPlan = (
  returnType: IrType | undefined,
  context: EmitterContext
): AsyncUnionReturnPlan | undefined => {
  if (!returnType) return undefined;

  const resolved = resolveTypeAlias(stripNullish(returnType), context);
  if (resolved.kind !== "unionType") {
    return undefined;
  }

  let awaitableIndex = -1;
  let awaitedReturnType: IrType | undefined;
  let awaitableMemberType: IrType | undefined;

  for (let index = 0; index < resolved.types.length; index += 1) {
    const member = resolved.types[index];
    if (!member || !isAwaitableIrType(member)) {
      continue;
    }

    if (awaitableIndex !== -1) {
      return undefined;
    }

    awaitableIndex = index;
    awaitedReturnType = getAwaitedIrType(member) ?? { kind: "voidType" };
    awaitableMemberType = member;
  }

  if (awaitableIndex === -1 || !awaitedReturnType || !awaitableMemberType) {
    return undefined;
  }

  return {
    unionReturnType: returnType,
    awaitedReturnType,
    awaitableMemberType,
  };
};

const buildTaskRunInvocationAst = (
  body: CSharpBlockStatementAst,
  resultTypeAst: CSharpTypeAst | undefined
): CSharpExpressionAst => ({
  kind: "invocationExpression",
  expression: {
    kind: "memberAccessExpression",
    expression: {
      kind: "typeReferenceExpression",
      type: identifierType("global::System.Threading.Tasks.Task"),
    },
    memberName: "Run",
  },
  typeArguments: resultTypeAst ? [resultTypeAst] : undefined,
  arguments: [
    {
      kind: "lambdaExpression",
      isAsync: true,
      parameters: [],
      body,
    },
  ],
});

const wrapInUnionReturnMemberAst = (
  unionTypeAst: CSharpTypeAst,
  memberIndex: number,
  valueAst: CSharpExpressionAst
): CSharpExpressionAst => ({
  kind: "invocationExpression",
  expression: {
    kind: "memberAccessExpression",
    expression: {
      kind: "typeReferenceExpression",
      type: unionTypeAst,
    },
    memberName: `From${memberIndex}`,
  },
  arguments: [valueAst],
});

const isRuntimeUnionTypeAst = (type: CSharpTypeAst): boolean => {
  const name = getIdentifierTypeName(type);
  return (
    name === "global::Tsonic.Runtime.Union" ||
    name === "Tsonic.Runtime.Union" ||
    name === "Union"
  );
};

const emitAsyncUnionReturningLambdaBodyAst = (
  parameters: readonly EmittedLambdaParameter[],
  body: Extract<
    IrExpression,
    { kind: "functionExpression" | "arrowFunction" }
  >["body"],
  context: EmitterContext,
  unionPlan: AsyncUnionReturnPlan,
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

  const [awaitedReturnTypeAst, awaitedReturnTypeContext] = emitTypeAst(
    unionPlan.awaitedReturnType,
    preludeContext
  );

  let currentContext = awaitedReturnTypeContext;
  let taskBody: CSharpBlockStatementAst;
  const isVoidAwaitedReturn = unionPlan.awaitedReturnType.kind === "voidType";

  if (body.kind === "blockStatement") {
    const [blockAst] = emitBlockStatementAst(body, {
      ...currentContext,
      returnType: unionPlan.awaitedReturnType,
    });
    const needsImplicitUndefinedReturn = !(
      unionPlan.awaitedReturnType.kind === "voidType" ||
      isDefinitelyTerminatingStatement(body)
    );

    taskBody = {
      kind: "blockStatement",
      statements: needsImplicitUndefinedReturn
        ? isVoidAwaitedReturn
          ? blockAst.statements
          : [
              ...blockAst.statements,
              {
                kind: "returnStatement",
                expression: {
                  kind: "defaultExpression",
                  type: awaitedReturnTypeAst,
                },
              },
            ]
        : blockAst.statements,
    };
  } else {
    const [exprAst] = emitExpressionAst(
      body,
      currentContext,
      unionPlan.awaitedReturnType
    );
    const isNoopVoidExpression =
      isVoidAwaitedReturn &&
      ((body.kind === "literal" &&
        (body.value === undefined || body.value === null)) ||
        (body.kind === "identifier" &&
          (body.name === "undefined" || body.name === "null")));
    const discardLocal = isVoidAwaitedReturn
      ? allocateLocalName("__tsonic_discard", currentContext)
      : undefined;
    currentContext = discardLocal?.context ?? currentContext;
    taskBody = {
      kind: "blockStatement",
      statements: isVoidAwaitedReturn
        ? isNoopVoidExpression
          ? []
          : [
              {
                kind: "localDeclarationStatement",
                modifiers: [],
                type: identifierType("var"),
                declarators: [
                  {
                    name: discardLocal!.emittedName,
                    initializer: exprAst,
                  },
                ],
              },
            ]
        : [
            {
              kind: "returnStatement",
              expression: exprAst,
            },
          ],
    };
  }

  const resultTypeAst =
    awaitedReturnTypeAst.kind === "predefinedType" &&
    awaitedReturnTypeAst.keyword === "void"
      ? undefined
      : awaitedReturnTypeAst;

  const taskInvocationAst = buildTaskRunInvocationAst(taskBody, resultTypeAst);
  const [unionTypeAst, unionTypeContext] = emitTypeAst(
    unionPlan.unionReturnType,
    currentContext
  );
  const concreteUnionTypeAst =
    unionTypeAst.kind === "nullableType"
      ? unionTypeAst.underlyingType
      : unionTypeAst;

  if (!isRuntimeUnionTypeAst(concreteUnionTypeAst)) {
    return [taskInvocationAst, unionTypeContext];
  }

  const [runtimeLayout, runtimeLayoutContext] = buildRuntimeUnionLayout(
    unionPlan.unionReturnType,
    unionTypeContext,
    emitTypeAst
  );
  const [awaitableMemberTypeAst, awaitableMemberTypeContext] = emitTypeAst(
    unionPlan.awaitableMemberType,
    runtimeLayoutContext
  );
  const awaitableMemberTypeKey = stableTypeKeyFromAst(awaitableMemberTypeAst);
  const awaitableMemberIndex =
    runtimeLayout?.memberTypeAsts.findIndex(
      (memberTypeAst) =>
        stableTypeKeyFromAst(memberTypeAst) === awaitableMemberTypeKey
    ) ?? -1;

  const resolvedAwaitableMemberIndex =
    awaitableMemberIndex >= 0
      ? awaitableMemberIndex
      : runtimeLayout
        ? findRuntimeUnionMemberIndex(
            runtimeLayout.members,
            unionPlan.awaitableMemberType,
            awaitableMemberTypeContext
          )
        : undefined;

  if (resolvedAwaitableMemberIndex === undefined) {
    return [taskInvocationAst, awaitableMemberTypeContext];
  }

  const wrappedTaskAst = wrapInUnionReturnMemberAst(
    concreteUnionTypeAst,
    resolvedAwaitableMemberIndex + 1,
    taskInvocationAst
  );

  if (preludeStatements.length === 0) {
    return [wrappedTaskAst, awaitableMemberTypeContext];
  }

  return [
    {
      kind: "blockStatement",
      statements: [
        ...preludeStatements,
        {
          kind: "returnStatement",
          expression: wrappedTaskAst,
        },
      ],
    },
    awaitableMemberTypeContext,
  ];
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
const emitLambdaParametersAst = (
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

const lowerLambdaParameterPreludeAst = (
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
  context: EmitterContext,
  expectedType?: IrType
): [CSharpExpressionAst, EmitterContext] => {
  const contextualFunctionType = resolveContextualFunctionType(
    expr,
    expectedType,
    context
  );
  const [paramInfos, paramContext] = emitLambdaParametersAst(
    expr.parameters,
    context,
    contextualFunctionType
  );
  const bodyContextSeeded = seedLocalNameMapFromParameters(
    paramInfos,
    paramContext
  );
  const returnType = contextualFunctionType?.returnType;
  const asyncUnionReturnPlan =
    expr.isAsync && returnType
      ? getAsyncUnionReturnPlan(returnType, bodyContextSeeded)
      : undefined;
  const [bodyAst] = asyncUnionReturnPlan
    ? emitAsyncUnionReturningLambdaBodyAst(
        paramInfos,
        expr.body,
        bodyContextSeeded,
        asyncUnionReturnPlan,
        expr.capturesObjectLiteralThis
      )
    : emitLambdaBodyAst(
        paramInfos,
        expr.body,
        bodyContextSeeded,
        returnType,
        expr.capturesObjectLiteralThis
      );

  const result: CSharpExpressionAst = {
    kind: "lambdaExpression",
    isAsync: asyncUnionReturnPlan ? false : (expr.isAsync ?? false),
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
  context: EmitterContext,
  expectedType?: IrType
): [CSharpExpressionAst, EmitterContext] => {
  const contextualFunctionType = resolveContextualFunctionType(
    expr,
    expectedType,
    context
  );
  const [paramInfos, paramContext] = emitLambdaParametersAst(
    expr.parameters,
    context,
    contextualFunctionType
  );
  const bodyContextSeeded = seedLocalNameMapFromParameters(
    paramInfos,
    paramContext
  );
  const returnType = contextualFunctionType?.returnType;
  const asyncUnionReturnPlan =
    expr.isAsync && returnType
      ? getAsyncUnionReturnPlan(returnType, bodyContextSeeded)
      : undefined;

  const requiresLoweredBody = paramInfos.some((p) => !p.bindsDirectly);

  if (asyncUnionReturnPlan) {
    const [bodyAst] = emitAsyncUnionReturningLambdaBodyAst(
      paramInfos,
      expr.body,
      bodyContextSeeded,
      asyncUnionReturnPlan,
      undefined
    );
    const result: CSharpExpressionAst = {
      kind: "lambdaExpression",
      isAsync: false,
      parameters: paramInfos.map((p) => p.ast),
      body: bodyAst,
    };
    return [result, paramContext];
  }

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
