import { IrStatement } from "@tsonic/frontend";
import { EmitterContext, withAsync, withStatic } from "../../types.js";
import { emitTypeAst, emitTypeParametersAst } from "../../type-emitter.js";
import { emitBlockStatementAst } from "../blocks.js";
import { escapeCSharpIdentifier } from "../../emitter-types/index.js";
import {
  buildGeneratorHelperTypeArguments,
  needsBidirectionalSupport,
  hasGeneratorReturnType,
  extractGeneratorTypeArgs,
  usesExchangeBasedGeneratorLowering,
} from "../../generator-wrapper.js";
import { emitCSharpName, getCSharpName } from "../../naming-policy.js";
import { identifierType } from "../../core/format/backend-ast/builders.js";
import type {
  CSharpStatementAst,
  CSharpTypeAst,
  CSharpExpressionAst,
  CSharpParameterAst,
} from "../../core/format/backend-ast/types.js";
import {
  applyRuntimeParameterDefaultShadows,
  buildParameterAsts,
  captureFunctionScopeContext,
  generateParameterDestructuringAst,
  getAsyncBodyReturnType,
  reserveGeneratorLocals,
  restoreFunctionScopeContext,
  seedLocalNameMapFromParameters,
} from "./function-shared.js";

const isVoidReturnType = (typeAst: CSharpTypeAst): boolean =>
  (typeAst.kind === "identifierType" && typeAst.name === "void") ||
  (typeAst.kind === "predefinedType" && typeAst.keyword === "void");

const buildForwardedArguments = (
  parameters: readonly CSharpParameterAst[],
  suppressedDefaultArguments: readonly (CSharpExpressionAst | undefined)[],
  prefixLength: number
): readonly CSharpExpressionAst[] => {
  const forwarded: CSharpExpressionAst[] = [];

  for (let index = 0; index < prefixLength; index += 1) {
    const parameter = parameters[index];
    if (!parameter) continue;
    forwarded.push({
      kind: "identifierExpression",
      identifier: parameter.name,
    });
  }

  for (let index = prefixLength; index < parameters.length; index += 1) {
    const parameter = parameters[index];
    if (!parameter) continue;
    if (parameter.modifiers?.includes("params")) {
      break;
    }
    const suppressedDefault = suppressedDefaultArguments[index];
    if (!suppressedDefault) {
      throw new Error(
        `ICE: Missing suppressed default argument for wrapper parameter '${parameter.name}'.`
      );
    }
    forwarded.push(suppressedDefault);
  }

  return forwarded;
};

export const emitFunctionDeclarationAst = (
  stmt: Extract<IrStatement, { kind: "functionDeclaration" }>,
  context: EmitterContext
): [readonly CSharpStatementAst[], EmitterContext] => {
  const savedScoped = captureFunctionScopeContext(context);
  const publicName = stmt.overloadFamily?.publicName ?? stmt.name;
  const csharpBaseName = getCSharpName(publicName, "methods", context);
  const emittedName = emitCSharpName(publicName, "methods", context);

  const funcTypeParams = new Set<string>([
    ...(context.typeParameters ?? []),
    ...(stmt.typeParameters?.map((tp) => tp.name) ?? []),
  ]);
  const signatureContext: EmitterContext = {
    ...context,
    typeParameters: funcTypeParams,
  };

  const [, , typeParamContext] = emitTypeParametersAst(
    stmt.typeParameters,
    signatureContext
  );
  let currentContext = typeParamContext;

  const typeParamNames: string[] | undefined =
    stmt.typeParameters && stmt.typeParameters.length > 0
      ? stmt.typeParameters.map(
          (tp) => currentContext.typeParameterNameMap?.get(tp.name) ?? tp.name
        )
      : undefined;

  const isBidirectional = needsBidirectionalSupport(stmt);
  const usesExchangeBasedLowering = usesExchangeBasedGeneratorLowering(stmt);
  const generatorHasReturnType =
    stmt.isGenerator && usesExchangeBasedLowering && isBidirectional
      ? hasGeneratorReturnType(stmt)
      : false;
  const generatorHelperTypeArguments = stmt.isGenerator
    ? buildGeneratorHelperTypeArguments(
        stmt.typeParameters?.map((typeParameter) => typeParameter.name),
        currentContext
      )
    : [];

  const modifiers: string[] = [];
  if (stmt.isAsync && !stmt.isGenerator) {
    modifiers.push("async");
  }

  let returnTypeAst: CSharpTypeAst;
  if (stmt.isGenerator) {
    if (!usesExchangeBasedLowering) {
      if (!stmt.returnType) {
        throw new Error(
          "ICE: Local generator without declared return type cannot be emitted without exchange-based lowering."
        );
      }
      const [generatorReturnTypeAst, generatorReturnTypeContext] = emitTypeAst(
        stmt.returnType,
        currentContext
      );
      currentContext = generatorReturnTypeContext;
      if (stmt.isAsync) {
        modifiers.push("async");
      }
      returnTypeAst = generatorReturnTypeAst;
    } else {
    const exchangeType = identifierType(
      `${csharpBaseName}_exchange`,
      generatorHelperTypeArguments.length > 0
        ? generatorHelperTypeArguments
        : undefined
    );
    const wrapperType = identifierType(
      `${csharpBaseName}_Generator`,
      generatorHelperTypeArguments.length > 0
        ? generatorHelperTypeArguments
        : undefined
    );
    if (isBidirectional) {
      returnTypeAst = wrapperType;
    } else {
      if (stmt.isAsync) {
        modifiers.push("async");
        returnTypeAst = identifierType(
          "global::System.Collections.Generic.IAsyncEnumerable",
          [exchangeType]
        );
      } else {
        returnTypeAst = identifierType(
          "global::System.Collections.Generic.IEnumerable",
          [exchangeType]
        );
      }
    }
    }
  } else if (stmt.returnType) {
    const [retAst, retCtx] = emitTypeAst(stmt.returnType, currentContext);
    currentContext = retCtx;
    if (stmt.isAsync) {
      modifiers.push("async");
    }
    if (
      stmt.isAsync &&
      stmt.returnType.kind === "referenceType" &&
      stmt.returnType.name === "Promise"
    ) {
      returnTypeAst = retAst;
    } else if (stmt.isAsync) {
      returnTypeAst = identifierType("global::System.Threading.Tasks.Task", [
        retAst,
      ]);
    } else {
      returnTypeAst = retAst;
    }
  } else {
    returnTypeAst = stmt.isAsync
      ? identifierType("global::System.Threading.Tasks.Task")
      : { kind: "predefinedType", keyword: "void" };
  }

  const paramsResult = buildParameterAsts(stmt.parameters, currentContext);
  currentContext = paramsResult.context;

  const seededBodyContext = seedLocalNameMapFromParameters(
    stmt.parameters,
    withAsync(withStatic(currentContext, false), stmt.isAsync)
  );
  const [runtimeDefaultShadowStmts, runtimeDefaultShadowContext] =
    applyRuntimeParameterDefaultShadows(
      paramsResult.runtimeDefaultInitializers,
      seededBodyContext
    );
  const reservedLocals = reserveGeneratorLocals(
    runtimeDefaultShadowContext,
    stmt.isGenerator && usesExchangeBasedLowering,
    isBidirectional,
    generatorHasReturnType
  );

  const [paramDestructuringStmts, destructuringContext] =
    paramsResult.destructuringParams.length > 0
      ? generateParameterDestructuringAst(
          paramsResult.destructuringParams,
          reservedLocals.context
        )
      : [[] as readonly CSharpStatementAst[], reservedLocals.context];

  const bodyReturnType =
    stmt.isAsync && !stmt.isGenerator
      ? getAsyncBodyReturnType(stmt.isAsync, stmt.returnType)
      : stmt.returnType;

  const bodyContext: EmitterContext = {
    ...destructuringContext,
    typeParameters: funcTypeParams,
    returnType: bodyReturnType,
  };

  const [bodyBlock, bodyCtxAfter] = emitBlockStatementAst(
    stmt.body,
    bodyContext
  );

  if (stmt.isGenerator && usesExchangeBasedLowering && isBidirectional) {
    const exchangeName = `${csharpBaseName}_exchange`;
    const exchangeType = identifierType(
      exchangeName,
      generatorHelperTypeArguments.length > 0
        ? generatorHelperTypeArguments
        : undefined
    );
    const wrapperBodyStatements: CSharpStatementAst[] = [
      {
        kind: "localDeclarationStatement",
        modifiers: [],
        type: { kind: "varType" },
        declarators: [
          {
            name: reservedLocals.generatorExchangeVar,
            initializer: {
              kind: "objectCreationExpression",
              type: exchangeType,
              arguments: [],
            },
          },
        ],
      },
    ];

    if (generatorHasReturnType) {
      const {
        returnType: extractedReturnTypeAst,
        newContext: typeExtractContext,
      } = extractGeneratorTypeArgs(stmt.returnType, currentContext);
      currentContext = typeExtractContext;
      if (!extractedReturnTypeAst) {
        throw new Error(
          "ICE: Generator marked with non-void return type but no return type AST was extracted."
        );
      }

      wrapperBodyStatements.push({
        kind: "localDeclarationStatement",
        modifiers: [],
        type: extractedReturnTypeAst,
        declarators: [
          {
            name: reservedLocals.generatorReturnValueVar,
            initializer: {
              kind: "suppressNullableWarningExpression",
              expression: { kind: "defaultExpression" },
            },
          },
        ],
      });
    }

    const exchangeEnumerableType: CSharpTypeAst = stmt.isAsync
      ? identifierType("global::System.Collections.Generic.IAsyncEnumerable", [
          exchangeType,
        ])
      : identifierType("global::System.Collections.Generic.IEnumerable", [
          exchangeType,
        ]);

    wrapperBodyStatements.push({
      kind: "localFunctionStatement",
      modifiers: stmt.isAsync ? ["async"] : [],
      returnType: exchangeEnumerableType,
      name: reservedLocals.generatorIteratorFn,
      parameters: [],
      body: {
        kind: "blockStatement",
        statements: [...paramDestructuringStmts, ...bodyBlock.statements],
      },
    });

    const constructorArgs: CSharpExpressionAst[] = [
      {
        kind: "invocationExpression",
        expression: {
          kind: "identifierExpression",
          identifier: reservedLocals.generatorIteratorFn,
        },
        arguments: [],
      },
      {
        kind: "identifierExpression",
        identifier: reservedLocals.generatorExchangeVar,
      },
    ];

    if (generatorHasReturnType) {
      constructorArgs.push({
        kind: "lambdaExpression",
        isAsync: false,
        parameters: [],
        body: {
          kind: "identifierExpression",
          identifier: reservedLocals.generatorReturnValueVar,
        },
      });
    }

    const localFn: CSharpStatementAst = {
      kind: "localFunctionStatement",
      modifiers,
      returnType: returnTypeAst,
      name: emittedName,
      typeParameters: typeParamNames,
      parameters: [...paramsResult.paramAsts],
      body: {
        kind: "blockStatement",
        statements: [
          ...wrapperBodyStatements,
          {
            kind: "returnStatement",
            expression: {
              kind: "objectCreationExpression",
              type: identifierType(
                `${csharpBaseName}_Generator`,
                generatorHelperTypeArguments.length > 0
                  ? generatorHelperTypeArguments
                  : undefined
              ),
              arguments: constructorArgs,
            },
          },
        ],
      },
    };

    return [
      [localFn],
      restoreFunctionScopeContext(context, bodyCtxAfter, savedScoped),
    ];
  }

  const finalBodyStatements: CSharpStatementAst[] = [
    ...runtimeDefaultShadowStmts,
    ...paramDestructuringStmts,
  ];

  if (stmt.isGenerator && usesExchangeBasedLowering) {
    finalBodyStatements.push({
      kind: "localDeclarationStatement",
      modifiers: [],
      type: { kind: "varType" },
      declarators: [
        {
          name: reservedLocals.generatorExchangeVar,
          initializer: {
            kind: "objectCreationExpression",
            type: identifierType(
              `${csharpBaseName}_exchange`,
              generatorHelperTypeArguments.length > 0
                ? generatorHelperTypeArguments
                : undefined
            ),
            arguments: [],
          },
        },
      ],
    });
  }

  for (const param of stmt.parameters) {
    if (param.passing === "out" && param.pattern.kind === "identifierPattern") {
      finalBodyStatements.push({
        kind: "expressionStatement",
        expression: {
          kind: "assignmentExpression",
          operatorToken: "=",
          left: {
            kind: "identifierExpression",
            identifier: escapeCSharpIdentifier(param.pattern.name),
          },
          right: { kind: "defaultExpression" },
        },
      });
    }
  }

  for (const runtimeDefault of paramsResult.runtimeDefaultInitializers) {
    if (runtimeDefault.sourceName) {
      continue;
    }
    finalBodyStatements.push({
      kind: "expressionStatement",
      expression: {
        kind: "assignmentExpression",
        operatorToken: "??=",
        left: {
          kind: "identifierExpression",
          identifier: runtimeDefault.paramName,
        },
        right: runtimeDefault.initializer,
      },
    });
  }

  finalBodyStatements.push(...bodyBlock.statements);

  const wrapperFns: CSharpStatementAst[] = paramsResult.wrapperPrefixLengths.map(
    (prefixLength) => {
      const invocation: CSharpExpressionAst = {
        kind: "invocationExpression",
        expression: {
          kind: "identifierExpression",
          identifier: emittedName,
        },
        arguments: buildForwardedArguments(
          paramsResult.paramAsts,
          paramsResult.suppressedDefaultArguments,
          prefixLength
        ),
        ...(typeParamNames && typeParamNames.length > 0
          ? {
              typeArguments: typeParamNames.map((typeParameterName) =>
                identifierType(typeParameterName)
              ),
            }
          : {}),
      };

      return {
        kind: "localFunctionStatement",
        modifiers: [...modifiers.filter((modifier) => modifier !== "async")],
        returnType: returnTypeAst,
        name: emittedName,
        typeParameters: typeParamNames,
        parameters: paramsResult.paramAsts.slice(0, prefixLength).map((param) => ({
          ...param,
          defaultValue: undefined,
        })),
        body: {
          kind: "blockStatement",
          statements: isVoidReturnType(returnTypeAst)
            ? [{ kind: "expressionStatement", expression: invocation }]
            : [{ kind: "returnStatement", expression: invocation }],
        },
      };
    }
  );

  const localFn: CSharpStatementAst = {
    kind: "localFunctionStatement",
    modifiers,
    returnType: returnTypeAst,
    name: emittedName,
    typeParameters: typeParamNames,
    parameters: [...paramsResult.paramAsts],
    body: { kind: "blockStatement", statements: finalBodyStatements },
  };

  return [
    [...wrapperFns, localFn],
    restoreFunctionScopeContext(context, bodyCtxAfter, savedScoped),
  ];
};
