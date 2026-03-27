import { IrStatement } from "@tsonic/frontend";
import { EmitterContext, withAsync, withStatic } from "../../types.js";
import { emitTypeAst, emitTypeParametersAst } from "../../type-emitter.js";
import { emitBlockStatementAst } from "../blocks.js";
import {
  buildGeneratorHelperTypeArguments,
  needsBidirectionalSupport,
  hasGeneratorReturnType,
  extractGeneratorTypeArgs,
  usesExchangeBasedGeneratorLowering,
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

  let returnTypeAst: CSharpTypeAst;
  if (stmt.isGenerator) {
    if (!usesExchangeBasedLowering) {
      if (!stmt.returnType) {
        throw new Error(
          "ICE: Generator function without declared return type cannot be emitted without exchange-based lowering."
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
  } else if (stmt.isAsync) {
    modifiers.push("async");
    returnTypeAst = identifierType("global::System.Threading.Tasks.Task");
  } else {
    returnTypeAst = { kind: "predefinedType", keyword: "void" };
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

  let finalBody: { kind: "blockStatement"; statements: CSharpStatementAst[] };

  if (stmt.isGenerator && usesExchangeBasedLowering && isBidirectional) {
    const exchangeName = `${csharpBaseName}_exchange`;
    const wrapperName = `${csharpBaseName}_Generator`;
    const exchangeType = identifierType(
      exchangeName,
      generatorHelperTypeArguments.length > 0
        ? generatorHelperTypeArguments
        : undefined
    );
    const wrapperType = identifierType(
      wrapperName,
      generatorHelperTypeArguments.length > 0
        ? generatorHelperTypeArguments
        : undefined
    );
    const enumerableType: CSharpTypeAst = stmt.isAsync
      ? identifierType("global::System.Collections.Generic.IAsyncEnumerable", [
          exchangeType,
        ])
      : identifierType("global::System.Collections.Generic.IEnumerable", [
          exchangeType,
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

    const innerBodyStatements: CSharpStatementAst[] = [
      ...runtimeDefaultShadowStmts,
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
        type: wrapperType,
        arguments: constructorArgs,
      },
    });

    finalBody = {
      kind: "blockStatement",
      statements: wrapperBodyStatements,
    };
  } else {
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
    finalBody = {
      kind: "blockStatement",
      statements: finalBodyStatements,
    };
  }

  const [attrs, attrContext] = emitAttributes(stmt.attributes, currentContext);
  currentContext = attrContext;
  const emittedName = emitCSharpName(stmt.name, "methods", context);
  const wrapperTypeArguments =
    typeParamAsts.length > 0
      ? typeParamAsts.map((typeParameter) => identifierType(typeParameter.name))
      : undefined;

  const wrapperMembers: CSharpMemberAst[] = paramsResult.wrapperPrefixLengths.map(
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
        ...(wrapperTypeArguments && wrapperTypeArguments.length > 0
          ? { typeArguments: wrapperTypeArguments }
          : {}),
      };

      return {
        kind: "methodDeclaration",
        attributes: [],
        modifiers: [...modifiers.filter((modifier) => modifier !== "async")],
        returnType: returnTypeAst,
        name: emittedName,
        typeParameters: typeParamAsts.length > 0 ? typeParamAsts : undefined,
        constraints: constraintAsts.length > 0 ? constraintAsts : undefined,
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

  const methodAst: CSharpMemberAst = {
    kind: "methodDeclaration",
    attributes: attrs,
    modifiers,
    returnType: returnTypeAst,
    name: emittedName,
    typeParameters: typeParamAsts.length > 0 ? typeParamAsts : undefined,
    constraints: constraintAsts.length > 0 ? constraintAsts : undefined,
    parameters: [...paramsResult.paramAsts],
    body: finalBody,
  };

  return [
    [...wrapperMembers, methodAst],
    restoreFunctionScopeContext(context, bodyCtxAfter, savedScoped),
  ];
};
