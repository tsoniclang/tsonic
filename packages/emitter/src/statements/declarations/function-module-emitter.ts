import { IrStatement } from "@tsonic/frontend";
import { EmitterContext, withAsync, withStatic } from "../../types.js";
import { emitTypeAst, emitTypeParametersAst } from "../../type-emitter.js";
import { emitBlockStatementAst } from "../blocks.js";
import {
  needsBidirectionalSupport,
  hasGeneratorReturnType,
  extractGeneratorTypeArgs,
} from "../../generator-wrapper.js";
import { emitAttributes } from "../../core/format/attributes.js";
import { emitCSharpName, getCSharpName } from "../../naming-policy.js";
import { escapeCSharpIdentifier } from "../../emitter-types/index.js";
import { identifierType } from "../../core/format/backend-ast/builders.js";
import type {
  CSharpStatementAst,
  CSharpTypeAst,
  CSharpExpressionAst,
  CSharpMemberAst,
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

export const emitFunctionDeclaration = (
  stmt: Extract<IrStatement, { kind: "functionDeclaration" }>,
  context: EmitterContext
): [readonly CSharpMemberAst[], EmitterContext] => {
  const savedScoped = captureFunctionScopeContext(context);
  const csharpBaseName = getCSharpName(stmt.name, "methods", context);

  const funcTypeParams = new Set<string>([
    ...(context.typeParameters ?? []),
    ...(stmt.typeParameters?.map((tp) => tp.name) ?? []),
  ]);
  const signatureContext: EmitterContext = {
    ...context,
    typeParameters: funcTypeParams,
  };

  const [typeParamAsts, constraintAsts, typeParamContext] =
    emitTypeParametersAst(stmt.typeParameters, signatureContext);
  let currentContext = typeParamContext;

  const accessibility = stmt.isExported
    ? "public"
    : context.isStatic
      ? "internal"
      : "private";

  const modifiers: string[] = [accessibility];
  if (context.isStatic) modifiers.push("static");

  const isBidirectional = needsBidirectionalSupport(stmt);
  const generatorHasReturnType =
    stmt.isGenerator && isBidirectional ? hasGeneratorReturnType(stmt) : false;

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
  } else if (stmt.isAsync) {
    modifiers.push("async");
    returnTypeAst = identifierType("global::System.Threading.Tasks.Task");
  } else {
    returnTypeAst = { kind: "predefinedType", keyword: "void" };
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

  let finalBody: { kind: "blockStatement"; statements: CSharpStatementAst[] };

  if (stmt.isGenerator && isBidirectional) {
    const exchangeName = `${csharpBaseName}_exchange`;
    const wrapperName = `${csharpBaseName}_Generator`;
    const enumerableType: CSharpTypeAst = stmt.isAsync
      ? identifierType("global::System.Collections.Generic.IAsyncEnumerable", [
          identifierType(exchangeName),
        ])
      : identifierType("global::System.Collections.Generic.IEnumerable", [
          identifierType(exchangeName),
        ]);

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

    const innerBodyStatements: CSharpStatementAst[] = [
      ...paramDestructuringStmts,
      ...bodyBlock.statements,
    ];

    wrapperBodyStatements.push({
      kind: "localFunctionStatement",
      modifiers: stmt.isAsync ? ["async"] : [],
      returnType: enumerableType,
      name: reservedLocals.generatorIteratorFn,
      parameters: [],
      body: { kind: "blockStatement", statements: innerBodyStatements },
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

    wrapperBodyStatements.push({
      kind: "returnStatement",
      expression: {
        kind: "objectCreationExpression",
        type: identifierType(wrapperName),
        arguments: constructorArgs,
      },
    });

    finalBody = {
      kind: "blockStatement",
      statements: wrapperBodyStatements,
    };
  } else {
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
      if (
        param.passing === "out" &&
        param.pattern.kind === "identifierPattern"
      ) {
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
    finalBody = {
      kind: "blockStatement",
      statements: finalBodyStatements,
    };
  }

  const [attrs, attrContext] = emitAttributes(stmt.attributes, currentContext);
  currentContext = attrContext;

  const methodAst: CSharpMemberAst = {
    kind: "methodDeclaration",
    attributes: attrs,
    modifiers,
    returnType: returnTypeAst,
    name: emitCSharpName(stmt.name, "methods", context),
    typeParameters: typeParamAsts.length > 0 ? typeParamAsts : undefined,
    constraints: constraintAsts.length > 0 ? constraintAsts : undefined,
    parameters: [...paramsResult.paramAsts],
    body: finalBody,
  };

  return [
    [methodAst],
    restoreFunctionScopeContext(context, bodyCtxAfter, savedScoped),
  ];
};
