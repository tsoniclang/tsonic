/**
 * Method member emission — returns CSharpMemberAst (method declaration)
 */

import { IrClassMember } from "@tsonic/frontend";
import {
  EmitterContext,
  indent,
  dedent,
  withAsync,
  withScoped,
} from "../../../types.js";
import { emitTypeAst, emitTypeParametersAst } from "../../../type-emitter.js";
import { emitBlockStatementAst } from "../../../statement-emitter.js";
import {
  emitParametersWithDestructuring,
  generateParameterDestructuringAst,
} from "../parameters.js";
import { escapeCSharpIdentifier } from "../../../emitter-types/index.js";
import { identifierType } from "../../../core/format/backend-ast/builders.js";
import { emitAttributes } from "../../../core/format/attributes.js";
import { emitCSharpName } from "../../../naming-policy.js";
import {
  captureFunctionScopeContext,
  getAsyncBodyReturnType,
  reserveGeneratorLocals,
  restoreFunctionScopeContext,
  seedLocalNameMapFromParameters,
} from "../../declarations/function-shared.js";
import {
  extractGeneratorTypeArgs,
  getGeneratorHelperBaseName,
  hasGeneratorReturnType,
  needsBidirectionalSupport,
} from "../../../generator-wrapper.js";
import type {
  CSharpMemberAst,
  CSharpBlockStatementAst,
  CSharpExpressionAst,
  CSharpTypeAst,
  CSharpStatementAst,
} from "../../../core/format/backend-ast/types.js";

/**
 * Emit a method declaration as CSharpMemberAst
 */
export const emitMethodMember = (
  member: IrClassMember & { kind: "methodDeclaration" },
  context: EmitterContext
): [CSharpMemberAst, EmitterContext] => {
  const savedScoped = captureFunctionScopeContext(context);
  let currentContext = context;

  const methodTypeParams = new Set<string>([
    ...(context.typeParameters ?? []),
    ...(member.typeParameters?.map((tp) => tp.name) ?? []),
  ]);

  const signatureContext: EmitterContext = {
    ...context,
    typeParameters: methodTypeParams,
  };

  const [typeParamAsts, constraintAsts, typeParamContext] =
    emitTypeParametersAst(member.typeParameters, signatureContext);
  currentContext = typeParamContext;

  const modifiers: string[] = [];
  const accessibility = member.accessibility ?? "public";
  modifiers.push(accessibility);

  if (member.isStatic) {
    modifiers.push("static");
  }
  if (!member.isStatic && !member.isOverride && member.isShadow) {
    modifiers.push("new");
  }
  if (member.isOverride) {
    modifiers.push("override");
  }
  if (!member.isStatic && !member.isOverride && member.isVirtual) {
    modifiers.push("virtual");
  }

  const generatorHelperBaseName = member.isGenerator
    ? getGeneratorHelperBaseName(
        member,
        context,
        context.className !== "Program" ? context.className : undefined
      )
    : undefined;
  const isBidirectional = member.isGenerator
    ? needsBidirectionalSupport(member)
    : false;
  const generatorHasReturnType =
    member.isGenerator && isBidirectional
      ? hasGeneratorReturnType(member)
      : false;

  let returnTypeAst: CSharpTypeAst;
  if (member.isGenerator) {
    if (!generatorHelperBaseName) {
      throw new Error(
        "ICE: Generator method helper base name was not resolved."
      );
    }
    if (isBidirectional) {
      returnTypeAst = identifierType(`${generatorHelperBaseName}_Generator`);
    } else {
      if (member.isAsync) {
        modifiers.push("async");
        returnTypeAst = identifierType(
          "global::System.Collections.Generic.IAsyncEnumerable",
          [identifierType(`${generatorHelperBaseName}_exchange`)]
        );
      } else {
        returnTypeAst = identifierType(
          "global::System.Collections.Generic.IEnumerable",
          [identifierType(`${generatorHelperBaseName}_exchange`)]
        );
      }
    }
  } else if (member.returnType) {
    const [rAst, newContext] = emitTypeAst(member.returnType, currentContext);
    currentContext = newContext;
    if (member.isAsync) {
      modifiers.push("async");
    }
    if (
      member.isAsync &&
      member.returnType.kind === "referenceType" &&
      member.returnType.name === "Promise"
    ) {
      returnTypeAst = rAst;
    } else if (member.isAsync) {
      returnTypeAst = identifierType("global::System.Threading.Tasks.Task", [
        rAst,
      ]);
    } else {
      returnTypeAst = rAst;
    }
  } else if (member.isAsync) {
    modifiers.push("async");
    returnTypeAst = identifierType("global::System.Threading.Tasks.Task");
  } else {
    returnTypeAst = { kind: "predefinedType", keyword: "void" };
  }

  const name = emitCSharpName(member.name, "methods", context);

  const paramsResult = emitParametersWithDestructuring(
    member.parameters,
    currentContext
  );
  currentContext = paramsResult.context;

  const [attrs, attrContext] = emitAttributes(
    member.attributes,
    currentContext
  );
  currentContext = attrContext;

  if (!member.body) {
    const methodAst: CSharpMemberAst = {
      kind: "methodDeclaration",
      attributes: attrs,
      modifiers,
      returnType: returnTypeAst,
      name,
      typeParameters: typeParamAsts.length > 0 ? typeParamAsts : undefined,
      parameters: paramsResult.parameters,
      constraints: constraintAsts.length > 0 ? constraintAsts : undefined,
    };
    return [
      methodAst,
      restoreFunctionScopeContext(context, currentContext, savedScoped),
    ];
  }

  const body = member.body;

  const baseBodyContext = seedLocalNameMapFromParameters(
    member.parameters,
    withAsync(indent(currentContext), member.isAsync)
  );
  const reservedLocals = reserveGeneratorLocals(
    baseBodyContext,
    member.isGenerator,
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
    member.isAsync && !member.isGenerator
      ? getAsyncBodyReturnType(member.isAsync, member.returnType)
      : member.returnType;

  const [bodyBlockAst, finalContext] = withScoped(
    destructuringContext,
    {
      typeParameters: methodTypeParams,
      returnType: bodyReturnType,
    },
    (scopedCtx) => emitBlockStatementAst(body, scopedCtx)
  );

  let mergedBody: CSharpBlockStatementAst;

  if (member.isGenerator && isBidirectional) {
    if (!generatorHelperBaseName) {
      throw new Error(
        "ICE: Bidirectional generator method helper base name missing."
      );
    }
    const exchangeName = `${generatorHelperBaseName}_exchange`;
    const wrapperName = `${generatorHelperBaseName}_Generator`;
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
      } = extractGeneratorTypeArgs(member.returnType, currentContext);
      currentContext = typeExtractContext;
      if (!extractedReturnTypeAst) {
        throw new Error(
          "ICE: Generator method marked with non-void return type but no return type AST was extracted."
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

    const enumerableType: CSharpTypeAst = member.isAsync
      ? identifierType("global::System.Collections.Generic.IAsyncEnumerable", [
          identifierType(exchangeName),
        ])
      : identifierType("global::System.Collections.Generic.IEnumerable", [
          identifierType(exchangeName),
        ]);

    wrapperBodyStatements.push({
      kind: "localFunctionStatement",
      modifiers: member.isAsync ? ["async"] : [],
      returnType: enumerableType,
      name: reservedLocals.generatorIteratorFn,
      parameters: [],
      body: {
        kind: "blockStatement",
        statements: [...paramDestructuringStmts, ...bodyBlockAst.statements],
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

    wrapperBodyStatements.push({
      kind: "returnStatement",
      expression: {
        kind: "objectCreationExpression",
        type: identifierType(wrapperName),
        arguments: constructorArgs,
      },
    });

    mergedBody = {
      kind: "blockStatement",
      statements: wrapperBodyStatements,
    };
  } else {
    const preamble: CSharpStatementAst[] = [...paramDestructuringStmts];

    if (member.isGenerator) {
      if (!generatorHelperBaseName) {
        throw new Error("ICE: Generator method helper base name missing.");
      }
      preamble.push({
        kind: "localDeclarationStatement",
        modifiers: [],
        type: { kind: "varType" },
        declarators: [
          {
            name: reservedLocals.generatorExchangeVar,
            initializer: {
              kind: "objectCreationExpression",
              type: identifierType(`${generatorHelperBaseName}_exchange`),
              arguments: [],
            },
          },
        ],
      });
    }

    for (const param of member.parameters) {
      if (
        param.passing === "out" &&
        param.pattern.kind === "identifierPattern"
      ) {
        let defaultExpr: CSharpExpressionAst = { kind: "defaultExpression" };
        if (param.type) {
          const [typeAst] = emitTypeAst(param.type, currentContext);
          defaultExpr = { kind: "defaultExpression", type: typeAst };
        }
        preamble.push({
          kind: "expressionStatement",
          expression: {
            kind: "assignmentExpression",
            operatorToken: "=",
            left: {
              kind: "identifierExpression",
              identifier: escapeCSharpIdentifier(param.pattern.name),
            },
            right: defaultExpr,
          },
        });
      }
    }

    mergedBody = {
      kind: "blockStatement",
      statements:
        preamble.length > 0
          ? [...preamble, ...bodyBlockAst.statements]
          : [...bodyBlockAst.statements],
    };
  }

  const methodAst: CSharpMemberAst = {
    kind: "methodDeclaration",
    attributes: attrs,
    modifiers,
    returnType: returnTypeAst,
    name,
    typeParameters: typeParamAsts.length > 0 ? typeParamAsts : undefined,
    parameters: paramsResult.parameters,
    body: mergedBody,
    constraints: constraintAsts.length > 0 ? constraintAsts : undefined,
  };

  return [
    methodAst,
    restoreFunctionScopeContext(context, dedent(finalContext), savedScoped),
  ];
};
