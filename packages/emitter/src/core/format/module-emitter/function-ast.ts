import {
  IrStatement,
  type IrAttribute,
  type IrParameter,
  type IrType,
} from "@tsonic/frontend";
import { EmitterContext, withAsync, withStatic } from "../../../types.js";
import {
  emitParameterType,
  emitType,
  emitTypeParameters,
} from "../../../type-emitter.js";
import { emitExpression } from "../../../expression-emitter.js";
import { emitCSharpName, getCSharpName } from "../../../naming-policy.js";
import { escapeCSharpIdentifier } from "../../../emitter-types/index.js";
import {
  emitStatementAst,
  parseLoweredStatements,
} from "../backend-ast/statement-emitter.js";
import { typeAstFromText } from "../backend-ast/type-factories.js";
import { emitAttributes } from "../attributes.js";
import {
  extractGeneratorTypeArgs,
  hasGeneratorReturnType,
  needsBidirectionalSupport,
} from "../../../generator-wrapper.js";
import { allocateLocalName } from "../local-names.js";
import { lowerParameterPattern } from "../../../patterns.js";
import type {
  CSharpExpressionAst,
  CSharpMethodDeclarationAst,
  CSharpParameterAst,
  CSharpStatementAst,
} from "../backend-ast/types.js";

const getAsyncBodyReturnType = (
  isAsync: boolean,
  returnType: IrType | undefined
): IrType | undefined => {
  if (!isAsync || !returnType) return returnType;
  if (
    returnType.kind === "referenceType" &&
    (returnType.name === "Promise" ||
      returnType.name === "Task" ||
      returnType.name === "ValueTask") &&
    returnType.typeArguments?.length === 1
  ) {
    return returnType.typeArguments[0];
  }
  return returnType;
};

const seedLocalNameMapFromParameters = (
  params: readonly IrParameter[],
  context: EmitterContext
): EmitterContext => {
  const map = new Map(context.localNameMap ?? []);
  const used = new Set<string>(context.usedLocalNames ?? []);
  for (const parameter of params) {
    if (parameter.pattern.kind !== "identifierPattern") continue;
    const emitted = escapeCSharpIdentifier(parameter.pattern.name);
    map.set(parameter.pattern.name, emitted);
    used.add(emitted);
  }
  return { ...context, localNameMap: map, usedLocalNames: used };
};

const restoreScopedContext = (
  outer: EmitterContext,
  inner: EmitterContext
): EmitterContext => ({
  ...inner,
  narrowedBindings: outer.narrowedBindings,
  typeParameters: outer.typeParameters,
  typeParamConstraints: outer.typeParamConstraints,
  typeParameterNameMap: outer.typeParameterNameMap,
  returnType: outer.returnType,
  localNameMap: outer.localNameMap,
  usedLocalNames: outer.usedLocalNames,
  isAsync: outer.isAsync,
  isStatic: outer.isStatic,
});

const emitDefaultValueExpression = (
  initializer: Exclude<IrParameter["initializer"], undefined>,
  context: EmitterContext,
  expectedType: IrType | undefined
): [CSharpExpressionAst, EmitterContext] => {
  const [frag, next] = emitExpression(initializer, context, expectedType);
  return [{ kind: "rawExpression", text: frag.text }, next];
};

type ParameterDestructuringInfo = {
  readonly syntheticName: string;
  readonly pattern: IrParameter["pattern"];
  readonly type: IrType | undefined;
};

const splitAttributeLines = (text: string): readonly string[] =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

const emitAttributeList = (
  attributes: readonly IrAttribute[] | undefined,
  context: EmitterContext
): [readonly string[], EmitterContext] => {
  const [text, next] = emitAttributes(attributes, {
    ...context,
    indentLevel: 0,
  });
  return [splitAttributeLines(text), next];
};

const emitParameterAst = (
  parameter: IrParameter,
  context: EmitterContext,
  explicitName?: string
): [CSharpParameterAst | undefined, EmitterContext] => {
  const name =
    explicitName ??
    (parameter.pattern.kind === "identifierPattern"
      ? escapeCSharpIdentifier(parameter.pattern.name)
      : undefined);
  if (!name) return [undefined, context];

  const modifiersForParam = [
    ...(parameter.isExtensionReceiver ? ["this"] : []),
    ...(parameter.passing !== "value" ? [parameter.passing] : []),
  ];

  const [typeText, nextTypeContext] = emitParameterType(
    parameter.type,
    parameter.isOptional,
    context
  );
  let currentContext = nextTypeContext;

  const [parameterAttributes, nextAttrContext] = emitAttributeList(
    parameter.attributes,
    currentContext
  );
  currentContext = nextAttrContext;

  let defaultValue: CSharpExpressionAst | undefined;
  if (parameter.initializer) {
    const [initializerAst, next] = emitDefaultValueExpression(
      parameter.initializer,
      currentContext,
      parameter.type
    );
    currentContext = next;
    defaultValue = initializerAst;
  } else if (parameter.isOptional && !parameter.isRest) {
    defaultValue = { kind: "literalExpression", text: "default" };
  }

  return [
    {
      kind: "parameter",
      attributes: parameterAttributes,
      modifiers: modifiersForParam,
      type: typeAstFromText(typeText),
      name,
      defaultValue,
    },
    currentContext,
  ];
};

export const emitFunctionDeclarationAst = (
  stmt: Extract<IrStatement, { kind: "functionDeclaration" }>,
  context: EmitterContext
): [CSharpMethodDeclarationAst | undefined, EmitterContext] => {
  const isBidirectionalGenerator =
    stmt.isGenerator && needsBidirectionalSupport(stmt);

  const functionTypeParams = new Set<string>([
    ...(context.typeParameters ?? []),
    ...(stmt.typeParameters?.map((tp) => tp.name) ?? []),
  ]);

  let currentContext: EmitterContext = {
    ...context,
    typeParameters: functionTypeParams,
  };

  const [, whereClauses, typeParamContext] = emitTypeParameters(
    stmt.typeParameters,
    currentContext
  );
  currentContext = typeParamContext;

  const accessibility = stmt.isExported ? "public" : "internal";
  const modifiers = [
    accessibility,
    "static",
    ...(stmt.isAsync && !isBidirectionalGenerator ? ["async"] : []),
  ];

  const emittedTypeParameters =
    stmt.typeParameters?.map(
      (tp) => currentContext.typeParameterNameMap?.get(tp.name) ?? tp.name
    ) ?? [];

  let returnTypeText = stmt.isAsync
    ? "global::System.Threading.Tasks.Task"
    : "void";
  if (stmt.isGenerator) {
    const csharpBaseName = getCSharpName(stmt.name, "methods", context);
    if (isBidirectionalGenerator) {
      returnTypeText = `${csharpBaseName}_Generator`;
    } else {
      const exchangeName = `${csharpBaseName}_exchange`;
      returnTypeText = stmt.isAsync
        ? `global::System.Collections.Generic.IAsyncEnumerable<${exchangeName}>`
        : `global::System.Collections.Generic.IEnumerable<${exchangeName}>`;
    }
  } else if (stmt.returnType) {
    const [returnType, next] = emitType(stmt.returnType, currentContext);
    currentContext = next;
    if (
      stmt.isAsync &&
      stmt.returnType.kind === "referenceType" &&
      stmt.returnType.name === "Promise"
    ) {
      returnTypeText = returnType;
    } else {
      returnTypeText = stmt.isAsync
        ? `global::System.Threading.Tasks.Task<${returnType}>`
        : returnType;
    }
  }

  const [methodAttributes, methodAttrContext] = emitAttributeList(
    stmt.attributes,
    currentContext
  );
  currentContext = methodAttrContext;

  const parameters: CSharpParameterAst[] = [];
  const destructuringParams: ParameterDestructuringInfo[] = [];
  let syntheticIndex = 0;
  for (const parameter of stmt.parameters) {
    const isComplexPattern =
      parameter.pattern.kind === "arrayPattern" ||
      parameter.pattern.kind === "objectPattern";
    const explicitName = isComplexPattern
      ? `__param${syntheticIndex++}`
      : undefined;
    const [parameterAst, next] = emitParameterAst(
      parameter,
      currentContext,
      explicitName
    );
    if (!parameterAst) return [undefined, next];
    parameters.push(parameterAst);
    currentContext = next;

    if (isComplexPattern) {
      if (!explicitName) {
        throw new Error(
          "ICE: missing synthetic parameter name for complex function pattern"
        );
      }
      destructuringParams.push({
        syntheticName: explicitName,
        pattern: parameter.pattern,
        type: parameter.type,
      });
    }
  }

  let bodyContext = withAsync(withStatic(currentContext, false), stmt.isAsync);
  bodyContext = seedLocalNameMapFromParameters(stmt.parameters, bodyContext);
  bodyContext = {
    ...bodyContext,
    typeParameters: functionTypeParams,
    returnType:
      stmt.isAsync && !stmt.isGenerator
        ? getAsyncBodyReturnType(stmt.isAsync, stmt.returnType)
        : stmt.returnType,
  };

  let generatorExchangeVar: string | undefined;
  let generatorExchangeType: string | undefined;
  let generatorIteratorFunction: string | undefined;
  let generatorReturnValueVar: string | undefined;
  let generatorReturnType: string | undefined;
  let generatorHasReturnType = false;
  let generatorEnumerableType: string | undefined;
  if (stmt.isGenerator) {
    const csharpBaseName = getCSharpName(stmt.name, "methods", context);
    generatorExchangeType = `${csharpBaseName}_exchange`;
    generatorEnumerableType = stmt.isAsync
      ? `global::System.Collections.Generic.IAsyncEnumerable<${generatorExchangeType}>`
      : `global::System.Collections.Generic.IEnumerable<${generatorExchangeType}>`;
    const exchangeAlloc = allocateLocalName("exchange", bodyContext);
    generatorExchangeVar = exchangeAlloc.emittedName;
    bodyContext = {
      ...exchangeAlloc.context,
      generatorExchangeVar,
    };

    if (isBidirectionalGenerator) {
      const iteratorAlloc = allocateLocalName("__iterator", bodyContext);
      generatorIteratorFunction = iteratorAlloc.emittedName;
      bodyContext = iteratorAlloc.context;

      generatorHasReturnType = hasGeneratorReturnType(stmt);
      if (generatorHasReturnType) {
        const extracted = extractGeneratorTypeArgs(
          stmt.returnType,
          bodyContext
        );
        generatorReturnType = extracted.returnType;
        bodyContext = extracted.newContext;
        const returnAlloc = allocateLocalName("__returnValue", bodyContext);
        generatorReturnValueVar = returnAlloc.emittedName;
        bodyContext = {
          ...returnAlloc.context,
          generatorReturnValueVar,
        };
      }
    }
  }

  const destructuringInitializers: CSharpStatementAst[] = [];
  if (destructuringParams.length > 0) {
    let destructuringContext = bodyContext;
    for (const info of destructuringParams) {
      const lowered = lowerParameterPattern(
        info.pattern,
        info.syntheticName,
        info.type,
        "",
        destructuringContext
      );
      destructuringInitializers.push(
        ...parseLoweredStatements(lowered.statements)
      );
      destructuringContext = lowered.context;
    }
    bodyContext = destructuringContext;
  }

  const [bodyAst, nextBodyContext] = emitStatementAst(stmt.body, bodyContext);
  const blockBody =
    bodyAst.kind === "blockStatement"
      ? bodyAst
      : ({ kind: "blockStatement", statements: [bodyAst] } as const);

  // C# requires out parameters to be definitely assigned before return.
  const outInitializers: CSharpStatementAst[] = [];
  for (const parameter of stmt.parameters) {
    if (parameter.pattern.kind !== "identifierPattern") continue;
    if (parameter.passing !== "out") continue;
    outInitializers.push({
      kind: "expressionStatement",
      expression: {
        kind: "assignmentExpression",
        operatorToken: "=",
        left: {
          kind: "identifierExpression",
          identifier: escapeCSharpIdentifier(parameter.pattern.name),
        },
        right: { kind: "literalExpression", text: "default" },
      },
    });
  }

  const generatorInitializers: CSharpStatementAst[] = [];
  if (
    stmt.isGenerator &&
    !isBidirectionalGenerator &&
    generatorExchangeVar &&
    generatorExchangeType
  ) {
    generatorInitializers.push({
      kind: "localDeclarationStatement",
      modifiers: [],
      type: { kind: "identifierType", name: "var" },
      declarators: [
        {
          kind: "variableDeclarator",
          name: generatorExchangeVar,
          initializer: {
            kind: "objectCreationExpression",
            type: typeAstFromText(generatorExchangeType),
            arguments: [],
          },
        },
      ],
    });
  }

  const bidirectionalGeneratorInitializers: CSharpStatementAst[] = [];
  if (
    stmt.isGenerator &&
    isBidirectionalGenerator &&
    generatorExchangeVar &&
    generatorExchangeType
  ) {
    bidirectionalGeneratorInitializers.push({
      kind: "localDeclarationStatement",
      modifiers: [],
      type: { kind: "identifierType", name: "var" },
      declarators: [
        {
          kind: "variableDeclarator",
          name: generatorExchangeVar,
          initializer: {
            kind: "objectCreationExpression",
            type: typeAstFromText(generatorExchangeType),
            arguments: [],
          },
        },
      ],
    });

    if (
      generatorHasReturnType &&
      generatorReturnType &&
      generatorReturnValueVar
    ) {
      bidirectionalGeneratorInitializers.push({
        kind: "localDeclarationStatement",
        modifiers: [],
        type: typeAstFromText(generatorReturnType),
        declarators: [
          {
            kind: "variableDeclarator",
            name: generatorReturnValueVar,
            initializer: {
              kind: "unaryExpression",
              operatorToken: "!",
              operand: { kind: "literalExpression", text: "default" },
              prefix: false,
            },
          },
        ],
      });
    }
  }

  if (
    stmt.isGenerator &&
    isBidirectionalGenerator &&
    generatorIteratorFunction &&
    generatorEnumerableType &&
    generatorExchangeVar
  ) {
    const iteratorBodyStatements = [
      ...destructuringInitializers,
      ...outInitializers,
      ...blockBody.statements,
    ];
    const iteratorFunctionStatement: CSharpStatementAst = {
      kind: "localFunctionStatement",
      modifiers: stmt.isAsync ? ["async"] : [],
      returnType: typeAstFromText(generatorEnumerableType),
      name: generatorIteratorFunction,
      parameters: [],
      body: {
        kind: "blockStatement",
        statements: iteratorBodyStatements,
      },
    };

    const wrapperName = `${getCSharpName(stmt.name, "methods", context)}_Generator`;
    const wrapperArguments: CSharpExpressionAst[] = [
      {
        kind: "invocationExpression",
        expression: {
          kind: "identifierExpression",
          identifier: generatorIteratorFunction,
        },
        arguments: [],
      },
      {
        kind: "identifierExpression",
        identifier: generatorExchangeVar,
      },
    ];
    if (
      generatorHasReturnType &&
      generatorReturnValueVar &&
      generatorReturnType
    ) {
      wrapperArguments.push({
        kind: "rawExpression",
        text: `() => ${generatorReturnValueVar}`,
      });
    }

    const method: CSharpMethodDeclarationAst = {
      kind: "methodDeclaration",
      attributes: methodAttributes,
      modifiers,
      returnType: typeAstFromText(returnTypeText),
      name: emitCSharpName(stmt.name, "methods", context),
      typeParameters: emittedTypeParameters,
      parameters,
      whereClauses,
      body: {
        kind: "blockStatement",
        statements: [
          ...bidirectionalGeneratorInitializers,
          iteratorFunctionStatement,
          {
            kind: "returnStatement",
            expression: {
              kind: "objectCreationExpression",
              type: typeAstFromText(wrapperName),
              arguments: wrapperArguments,
            },
          },
        ],
      },
    };
    return [method, restoreScopedContext(context, nextBodyContext)];
  }

  const method: CSharpMethodDeclarationAst = {
    kind: "methodDeclaration",
    attributes: methodAttributes,
    modifiers,
    returnType: typeAstFromText(returnTypeText),
    name: emitCSharpName(stmt.name, "methods", context),
    typeParameters: emittedTypeParameters,
    parameters,
    whereClauses,
    body: {
      kind: "blockStatement",
      statements: [
        ...generatorInitializers,
        ...destructuringInitializers,
        ...outInitializers,
        ...blockBody.statements,
      ],
    },
  };

  return [method, restoreScopedContext(context, nextBodyContext)];
};
