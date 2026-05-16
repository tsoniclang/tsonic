/**
 * Lambda body emission and async union return planning.
 *
 * Extracted from functions.ts — contains the lambda body emitters,
 * async union return plan resolution, and the public emitFunctionExpression /
 * emitArrowFunction entry points.
 */

import {
  IrExpression,
  IrStatement,
  IrType,
  getAwaitedIrType,
  isAwaitableIrType,
} from "@tsonic/frontend";
import { EmitterContext, withStatic } from "../types.js";
import { emitExpressionAst } from "../expression-emitter.js";
import { emitBlockStatementAst } from "../statement-emitter.js";
import { emitTypeAst } from "../type-emitter.js";
import {
  resolveTypeAlias,
  stripNullish,
} from "../core/semantic/type-resolution.js";
import {
  emitRuntimeCarrierTypeAst,
  findRuntimeUnionMemberIndex,
} from "../core/semantic/runtime-unions.js";
import { buildRuntimeUnionFactoryCallAst } from "../core/semantic/runtime-union-projection.js";
import { identifierType } from "../core/format/backend-ast/builders.js";
import { stableTypeKeyFromAst } from "../core/format/backend-ast/utils.js";
import { allocateLocalName } from "../core/format/local-names.js";
import type {
  CSharpBlockStatementAst,
  CSharpExpressionAst,
  CSharpStatementAst,
  CSharpTypeAst,
} from "../core/format/backend-ast/types.js";
import {
  type EmittedLambdaParameter,
  seedLocalNameMapFromParameters,
  resolveContextualFunctionType,
  emitLambdaParametersAst,
  lowerLambdaParameterPreludeAst,
} from "./lambda-parameters.js";

type AsyncUnionReturnPlan = {
  readonly unionReturnType: IrType;
  readonly awaitedReturnType: IrType;
  readonly awaitableMemberType: IrType;
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

const canEmitDirectVoidLambdaStatement = (
  body: Extract<
    IrExpression,
    { kind: "functionExpression" | "arrowFunction" }
  >["body"]
): boolean =>
  body.kind === "call" ||
  body.kind === "new" ||
  body.kind === "assignment" ||
  body.kind === "update" ||
  body.kind === "await";

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
    const discardName = discardLocal?.emittedName;
    if (
      isVoidAwaitedReturn &&
      !isNoopVoidExpression &&
      discardName === undefined
    ) {
      throw new Error("Missing discard local for awaited void expression");
    }
    currentContext = discardLocal?.context ?? currentContext;
    let awaitedStatements: readonly CSharpStatementAst[];
    if (!isVoidAwaitedReturn) {
      awaitedStatements = [
        {
          kind: "returnStatement",
          expression: exprAst,
        },
      ];
    } else if (isNoopVoidExpression) {
      awaitedStatements = [];
    } else {
      const requiredDiscardName = discardName;
      if (requiredDiscardName === undefined) {
        throw new Error("Missing discard local for awaited void expression");
      }
      awaitedStatements = [
        {
          kind: "localDeclarationStatement",
          modifiers: [],
          type: identifierType("var"),
          declarators: [
            {
              name: requiredDiscardName,
              initializer: exprAst,
            },
          ],
        },
      ];
    }
    taskBody = {
      kind: "blockStatement",
      statements: awaitedStatements,
    };
  }

  const resultTypeAst =
    awaitedReturnTypeAst.kind === "predefinedType" &&
    awaitedReturnTypeAst.keyword === "void"
      ? undefined
      : awaitedReturnTypeAst;

  const taskInvocationAst = buildTaskRunInvocationAst(taskBody, resultTypeAst);
  const [unionTypeAst, runtimeLayout, unionTypeContext] =
    emitRuntimeCarrierTypeAst(
      unionPlan.unionReturnType,
      currentContext,
      emitTypeAst
    );
  const concreteUnionTypeAst =
    unionTypeAst.kind === "nullableType"
      ? unionTypeAst.underlyingType
      : unionTypeAst;

  if (!runtimeLayout) {
    return [taskInvocationAst, unionTypeContext];
  }
  const [awaitableMemberTypeAst, awaitableMemberTypeContext] = emitTypeAst(
    unionPlan.awaitableMemberType,
    unionTypeContext
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

  const wrappedTaskAst = buildRuntimeUnionFactoryCallAst(
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
  const isVoidReturn = returnType?.kind === "voidType";
  const isNoopVoidExpression =
    isVoidReturn &&
    ((body.kind === "literal" &&
      (body.value === undefined || body.value === null)) ||
      (body.kind === "identifier" &&
        (body.name === "undefined" || body.name === "null")));

  if (isVoidReturn) {
    const emitsDirectStatement = canEmitDirectVoidLambdaStatement(body);
    const discardLocal =
      isNoopVoidExpression ||
      exprAst.kind === "defaultExpression" ||
      emitsDirectStatement
        ? undefined
        : allocateLocalName("__tsonic_discard", preludeContext);
    const statements: CSharpStatementAst[] = emitsDirectStatement
      ? [{ kind: "expressionStatement", expression: exprAst }]
      : discardLocal && discardLocal.emittedName
        ? [
            {
              kind: "localDeclarationStatement",
              modifiers: [],
              type: identifierType("var"),
              declarators: [
                {
                  name: discardLocal.emittedName,
                  initializer: exprAst,
                },
              ],
            },
          ]
        : [];

    return [
      {
        kind: "blockStatement",
        statements: [...preludeStatements, ...statements],
      },
      discardLocal?.context ?? preludeContext,
    ];
  }

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

const resolveFunctionExpressionReturnType = (
  expr: Extract<IrExpression, { kind: "functionExpression" | "arrowFunction" }>,
  contextualFunctionType: Extract<IrType, { kind: "functionType" }> | undefined
): IrType | undefined => {
  if (expr.returnType) {
    return expr.returnType;
  }
  if (contextualFunctionType?.returnType) {
    return contextualFunctionType.returnType;
  }
  if (expr.inferredType?.kind === "functionType") {
    return expr.inferredType.returnType;
  }
  return undefined;
};

const emitGeneratorFunctionExpression = (
  expr: Extract<IrExpression, { kind: "functionExpression" }>,
  parameters: readonly EmittedLambdaParameter[],
  context: EmitterContext,
  returnType: IrType | undefined
): [CSharpExpressionAst, EmitterContext] => {
  const blockContext = withStatic(
    {
      ...context,
      objectLiteralThisIdentifier: expr.capturesObjectLiteralThis
        ? context.objectLiteralThisIdentifier
        : undefined,
    },
    false
  );

  const [preludeStatements, preludeContext] = lowerLambdaParameterPreludeAst(
    parameters,
    blockContext
  );
  const iteratorName = allocateLocalName(
    "__tsonic_generator_expr",
    preludeContext
  );
  const [returnTypeAst, returnTypeContext] = emitTypeAst(
    returnType ?? { kind: "unknownType" },
    iteratorName.context
  );
  const [bodyAst] = emitBlockStatementAst(expr.body, {
    ...returnTypeContext,
    returnType,
  });

  return [
    {
      kind: "lambdaExpression",
      isAsync: false,
      parameters: parameters.flatMap((parameter) =>
        parameter.ast ? [parameter.ast] : []
      ),
      body: {
        kind: "blockStatement",
        statements: [
          ...preludeStatements,
          {
            kind: "localFunctionStatement",
            modifiers: expr.isAsync ? ["async"] : [],
            returnType: returnTypeAst,
            name: iteratorName.emittedName,
            parameters: [],
            body: bodyAst,
          },
          {
            kind: "returnStatement",
            expression: {
              kind: "invocationExpression",
              expression: {
                kind: "identifierExpression",
                identifier: iteratorName.emittedName,
              },
              arguments: [],
            },
          },
        ],
      },
    },
    returnTypeContext,
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
  const returnType = resolveFunctionExpressionReturnType(
    expr,
    contextualFunctionType
  );

  if (expr.isGenerator) {
    return emitGeneratorFunctionExpression(
      expr,
      paramInfos,
      bodyContextSeeded,
      returnType
    );
  }

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
    parameters: paramInfos.flatMap((p) => (p.ast ? [p.ast] : [])),
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
  const returnType = resolveFunctionExpressionReturnType(
    expr,
    contextualFunctionType
  );
  const asyncUnionReturnPlan =
    expr.isAsync && returnType
      ? getAsyncUnionReturnPlan(returnType, bodyContextSeeded)
      : undefined;

  const requiresLoweredBody = paramInfos.some((p) => !p.bindsDirectly);
  const requiresVoidLoweredBody = returnType?.kind === "voidType";

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
      parameters: paramInfos.flatMap((p) => (p.ast ? [p.ast] : [])),
      body: bodyAst,
    };
    return [result, paramContext];
  }

  if (
    expr.body.kind === "blockStatement" ||
    requiresLoweredBody ||
    requiresVoidLoweredBody
  ) {
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
      parameters: paramInfos.flatMap((p) => (p.ast ? [p.ast] : [])),
      body: bodyAst,
    };
    return [result, paramContext];
  }

  // Expression body: (params) => expression
  const [exprAst] = emitExpressionAst(expr.body, bodyContextSeeded, returnType);
  const result: CSharpExpressionAst = {
    kind: "lambdaExpression",
    isAsync: expr.isAsync ?? false,
    parameters: paramInfos.flatMap((p) => (p.ast ? [p.ast] : [])),
    body: exprAst,
  };
  return [result, paramContext];
};
