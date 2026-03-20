import { IrStatement } from "@tsonic/frontend";
import { EmitterContext, withAsync, withStatic } from "../../types.js";
import { emitTypeAst, emitTypeParametersAst } from "../../type-emitter.js";
import { emitBlockStatementAst } from "../blocks.js";
import { escapeCSharpIdentifier } from "../../emitter-types/index.js";
import {
  needsBidirectionalSupport,
  hasGeneratorReturnType,
  extractGeneratorTypeArgs,
} from "../../generator-wrapper.js";
import { emitCSharpName, getCSharpName } from "../../naming-policy.js";
import { identifierType } from "../../core/format/backend-ast/builders.js";
import type {
  CSharpStatementAst,
  CSharpTypeAst,
  CSharpExpressionAst,
} from "../../core/format/backend-ast/types.js";
import {
  buildParameterAsts,
  captureFunctionScopeContext,
  generateParameterDestructuringAst,
  getAsyncBodyReturnType,
  reserveGeneratorLocals,
  restoreFunctionScopeContext,
  seedLocalNameMapFromParameters,
} from "./function-shared.js";

export const emitFunctionDeclarationAst = (
  stmt: Extract<IrStatement, { kind: "functionDeclaration" }>,
  context: EmitterContext
): [readonly CSharpStatementAst[], EmitterContext] => {
  const savedScoped = captureFunctionScopeContext(context);
  const csharpBaseName = getCSharpName(stmt.name, "methods", context);
  const emittedName = emitCSharpName(stmt.name, "methods", context);

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
  const generatorHasReturnType =
    stmt.isGenerator && isBidirectional ? hasGeneratorReturnType(stmt) : false;

  const modifiers: string[] = [];
  if (stmt.isAsync && !stmt.isGenerator) {
    modifiers.push("async");
  }

  let returnTypeAst: CSharpTypeAst;
  if (stmt.isGenerator) {
    if (isBidirectional) {
      returnTypeAst = identifierType(`${csharpBaseName}_Generator`);
    } else {
      const exchangeName = `${csharpBaseName}_exchange`;
      if (stmt.isAsync) {
        modifiers.push("async");
        returnTypeAst = identifierType(
          "global::System.Collections.Generic.IAsyncEnumerable",
          [identifierType(exchangeName)]
        );
      } else {
        returnTypeAst = identifierType(
          "global::System.Collections.Generic.IEnumerable",
          [identifierType(exchangeName)]
        );
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

  const baseBodyContext = seedLocalNameMapFromParameters(
    stmt.parameters,
    withAsync(withStatic(currentContext, false), stmt.isAsync)
  );
  const reservedLocals = reserveGeneratorLocals(
    baseBodyContext,
    stmt.isGenerator,
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

  if (stmt.isGenerator && isBidirectional) {
    const exchangeName = `${csharpBaseName}_exchange`;
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
              type: identifierType(exchangeName),
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
          identifierType(exchangeName),
        ])
      : identifierType("global::System.Collections.Generic.IEnumerable", [
          identifierType(exchangeName),
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
              type: identifierType(`${csharpBaseName}_Generator`),
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
    ...paramDestructuringStmts,
  ];

  if (stmt.isGenerator) {
    finalBodyStatements.push({
      kind: "localDeclarationStatement",
      modifiers: [],
      type: { kind: "varType" },
      declarators: [
        {
          name: reservedLocals.generatorExchangeVar,
          initializer: {
            kind: "objectCreationExpression",
            type: identifierType(`${csharpBaseName}_exchange`),
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

  finalBodyStatements.push(...bodyBlock.statements);

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
    [localFn],
    restoreFunctionScopeContext(context, bodyCtxAfter, savedScoped),
  ];
};
