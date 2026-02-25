/**
 * Generator Exchange Object Generator
 * Per spec/13-generators.md - Generate exchange objects for bidirectional communication
 */

import { IrModule, IrFunctionDeclaration } from "@tsonic/frontend";
import { EmitterContext, getIndent, indent } from "./types.js";
import { emitType } from "./type-emitter.js";
import { typeAstFromText } from "./core/format/backend-ast/type-factories.js";
import {
  needsBidirectionalSupport,
  generateWrapperClass,
  extractGeneratorTypeArgs,
  hasGeneratorReturnType,
} from "./generator-wrapper.js";
import { emitCSharpName, getCSharpName } from "./naming-policy.js";
import type {
  CSharpAccessorDeclarationAst,
  CSharpClassMemberAst,
  CSharpExpressionAst,
  CSharpNamespaceMemberAst,
  CSharpParameterAst,
  CSharpStatementAst,
  CSharpTypeAst,
} from "./core/format/backend-ast/types.js";

/**
 * Collect all generator functions from a module
 */
const collectGenerators = (module: IrModule): IrFunctionDeclaration[] => {
  const generators: IrFunctionDeclaration[] = [];

  for (const stmt of module.body) {
    if (stmt.kind === "functionDeclaration" && stmt.isGenerator) {
      generators.push(stmt);
    }
    // Note: Generator methods in classes are not handled here; generator support is currently
    // implemented for module-level generator functions.
  }

  return generators;
};

/**
 * Generate exchange object class for a generator function
 *
 * Example:
 * function* accumulator(start = 0): Generator<number, void, number> { }
 *
 * Generates:
 * public sealed class accumulator_exchange
 * {
 *     public double? Input { get; set; }
 *     public double Output { get; set; }
 * }
 */
const generateExchangeClass = (
  func: IrFunctionDeclaration,
  context: EmitterContext
): [string, EmitterContext] => {
  const ind = getIndent(context);
  const bodyInd = getIndent(indent(context));
  const parts: string[] = [];
  let currentContext = context;

  const csharpBaseName = getCSharpName(func.name, "methods", context);
  const exchangeName = `${csharpBaseName}_exchange`;

  parts.push(`${ind}public sealed class ${exchangeName}`);
  parts.push(`${ind}{`);

  // Determine output type from return type or yield expressions
  // For now, use 'object' as default, will refine based on type inference
  let outputType = "object";
  let inputType = "object";

  if (func.returnType && func.returnType.kind === "referenceType") {
    // Generator<Yield, Return, Next>
    // typeArguments[0] is the Yield type (Output)
    // typeArguments[2] is the Next type (Input)
    const typeRef = func.returnType;
    if (typeRef.typeArguments && typeRef.typeArguments.length > 0) {
      const yieldTypeArg = typeRef.typeArguments[0];
      if (yieldTypeArg) {
        const [yieldType, newContext1] = emitType(yieldTypeArg, currentContext);
        currentContext = newContext1;
        outputType = yieldType;
      }

      if (typeRef.typeArguments.length > 2) {
        const nextTypeArg = typeRef.typeArguments[2];
        if (nextTypeArg) {
          const [nextType, newContext2] = emitType(nextTypeArg, currentContext);
          currentContext = newContext2;
          inputType = nextType;
        }
      }
    }
  }

  // Input property (always nullable since generator might not receive value)
  parts.push(`${bodyInd}public ${inputType}? Input { get; set; }`);

  // Output property
  parts.push(`${bodyInd}public ${outputType} Output { get; set; }`);

  parts.push(`${ind}}`);

  return [parts.join("\n"), currentContext];
};

/**
 * Generate all exchange objects, wrapper classes, and IteratorResult struct for generators in a module
 */
export const generateGeneratorExchanges = (
  module: IrModule,
  context: EmitterContext
): [string, EmitterContext] => {
  const generators = collectGenerators(module);

  if (generators.length === 0) {
    return ["", context];
  }

  const parts: string[] = [];
  let currentContext = context;

  // Generate exchange classes and wrapper classes for each generator
  // Note: IteratorResult<T> is now in Tsonic.Runtime, not emitted per-module
  for (const generator of generators) {
    // Exchange class (for all generators)
    const [exchangeCode, exchangeContext] = generateExchangeClass(
      generator,
      currentContext
    );
    currentContext = exchangeContext;
    parts.push(exchangeCode);
    parts.push("");

    // Wrapper class (only for bidirectional generators)
    if (needsBidirectionalSupport(generator)) {
      const [wrapperCode, wrapperContext] = generateWrapperClass(
        generator,
        currentContext
      );
      currentContext = wrapperContext;
      parts.push(wrapperCode);
      parts.push("");
    }
  }

  return [parts.join("\n"), currentContext];
};

const getterSetterAccessorList: readonly CSharpAccessorDeclarationAst[] = [
  {
    kind: "accessorDeclaration",
    accessorKind: "get",
  },
  {
    kind: "accessorDeclaration",
    accessorKind: "set",
  },
];

const asTypeAst = (typeText: string): CSharpTypeAst =>
  typeAstFromText(typeText);

const rawExpression = (text: string): CSharpExpressionAst => ({
  kind: "rawExpression",
  text,
});

const statementExpression = (text: string): CSharpStatementAst => ({
  kind: "expressionStatement",
  expression: rawExpression(text),
});

const iteratorResultExpr = (
  resultType: string,
  valueExpr: string,
  done: boolean
): CSharpExpressionAst =>
  rawExpression(
    `new global::Tsonic.Runtime.IteratorResult<${resultType}>(${valueExpr}, ${done ? "true" : "false"})`
  );

const parameter = (
  name: string,
  typeText: string,
  defaultValue?: CSharpExpressionAst
): CSharpParameterAst => ({
  kind: "parameter",
  attributes: [],
  modifiers: [],
  type: asTypeAst(typeText),
  name,
  defaultValue,
});

const generateExchangeClassAst = (
  func: IrFunctionDeclaration,
  context: EmitterContext
): [
  Extract<CSharpNamespaceMemberAst, { kind: "classDeclaration" }>,
  EmitterContext,
] => {
  let currentContext = context;

  const csharpBaseName = getCSharpName(func.name, "methods", context);
  const exchangeName = `${csharpBaseName}_exchange`;

  let outputType = "object";
  let inputType = "object";

  if (func.returnType && func.returnType.kind === "referenceType") {
    const typeRef = func.returnType;
    if (typeRef.typeArguments && typeRef.typeArguments.length > 0) {
      const yieldTypeArg = typeRef.typeArguments[0];
      if (yieldTypeArg) {
        const [yieldType, nextContext] = emitType(yieldTypeArg, currentContext);
        currentContext = nextContext;
        outputType = yieldType;
      }

      if (typeRef.typeArguments.length > 2) {
        const nextTypeArg = typeRef.typeArguments[2];
        if (nextTypeArg) {
          const [nextType, nextContext] = emitType(nextTypeArg, currentContext);
          currentContext = nextContext;
          inputType = nextType;
        }
      }
    }
  }

  const members: CSharpClassMemberAst[] = [
    {
      kind: "propertyDeclaration",
      attributes: [],
      modifiers: ["public"],
      type: asTypeAst(`${inputType}?`),
      name: "Input",
      accessorList: getterSetterAccessorList,
    },
    {
      kind: "propertyDeclaration",
      attributes: [],
      modifiers: ["public"],
      type: asTypeAst(outputType),
      name: "Output",
      accessorList: getterSetterAccessorList,
    },
  ];

  return [
    {
      kind: "classDeclaration",
      indentLevel: 1,
      attributes: [],
      modifiers: ["public", "sealed"],
      name: exchangeName,
      members,
    },
    currentContext,
  ];
};

const generateWrapperClassAst = (
  func: IrFunctionDeclaration,
  context: EmitterContext
): [
  Extract<CSharpNamespaceMemberAst, { kind: "classDeclaration" }>,
  EmitterContext,
] => {
  const csharpBaseName = getCSharpName(func.name, "methods", context);
  const wrapperName = `${csharpBaseName}_Generator`;
  const exchangeName = `${csharpBaseName}_exchange`;

  const nextMethodName = emitCSharpName("next", "methods", context);
  const returnMethodName = emitCSharpName("return", "methods", context);
  const throwMethodName = emitCSharpName("throw", "methods", context);
  const returnValuePropertyName = emitCSharpName(
    "returnValue",
    "properties",
    context
  );

  const { yieldType, returnType, nextType, hasNextType, newContext } =
    extractGeneratorTypeArgs(func.returnType, context);
  let currentContext = newContext;
  const hasReturnType = hasGeneratorReturnType(func);

  const enumeratorType = func.isAsync
    ? `global::System.Collections.Generic.IAsyncEnumerator<${exchangeName}>`
    : `global::System.Collections.Generic.IEnumerator<${exchangeName}>`;
  const enumerableType = func.isAsync
    ? `global::System.Collections.Generic.IAsyncEnumerable<${exchangeName}>`
    : `global::System.Collections.Generic.IEnumerable<${exchangeName}>`;

  const nextReturnType = func.isAsync
    ? `global::System.Threading.Tasks.Task<global::Tsonic.Runtime.IteratorResult<${yieldType}>>`
    : `global::Tsonic.Runtime.IteratorResult<${yieldType}>`;
  const returnReturnType = nextReturnType;
  const returnParamType = returnType !== "void" ? returnType : "object?";
  const nextParamType = hasNextType ? `${nextType}?` : "object?";

  const constructorParams: CSharpParameterAst[] = [
    parameter("enumerable", enumerableType),
    parameter("exchange", exchangeName),
    ...(hasReturnType
      ? [parameter("getReturnValue", `global::System.Func<${returnType}>`)]
      : []),
  ];

  const constructorStatements: CSharpStatementAst[] = [
    statementExpression(
      `_enumerator = enumerable.${func.isAsync ? "GetAsyncEnumerator()" : "GetEnumerator()"}`
    ),
    statementExpression("_exchange = exchange"),
    ...(hasReturnType
      ? [statementExpression("_getReturnValue = getReturnValue")]
      : []),
  ];

  const moveNextExpr = func.isAsync
    ? "await _enumerator.MoveNextAsync()"
    : "_enumerator.MoveNext()";
  const disposeExpr = func.isAsync
    ? "await _enumerator.DisposeAsync()"
    : "_enumerator.Dispose()";
  const disposeInThrowExpr = func.isAsync
    ? "_enumerator.DisposeAsync().AsTask().Wait()"
    : "_enumerator.Dispose()";

  const nextMethodStatements: CSharpStatementAst[] = [
    {
      kind: "ifStatement",
      condition: { kind: "identifierExpression", identifier: "_done" },
      thenStatement: {
        kind: "blockStatement",
        statements: [
          {
            kind: "returnStatement",
            expression: iteratorResultExpr(yieldType, "default!", true),
          },
        ],
      },
    },
    statementExpression("_exchange.Input = value"),
    {
      kind: "ifStatement",
      condition: rawExpression(moveNextExpr),
      thenStatement: {
        kind: "blockStatement",
        statements: [
          {
            kind: "returnStatement",
            expression: iteratorResultExpr(
              yieldType,
              "_exchange.Output",
              false
            ),
          },
        ],
      },
    },
    statementExpression("_done = true"),
    {
      kind: "returnStatement",
      expression: iteratorResultExpr(yieldType, "default!", true),
    },
  ];

  const returnMethodStatements: CSharpStatementAst[] = [
    statementExpression("_done = true"),
    ...(hasReturnType
      ? [
          statementExpression("_returnValue = value"),
          statementExpression("_wasExternallyTerminated = true"),
        ]
      : []),
    statementExpression(disposeExpr),
    {
      kind: "returnStatement",
      expression: iteratorResultExpr(yieldType, "default!", true),
    },
  ];

  const throwMethodStatements: CSharpStatementAst[] = [
    statementExpression("_done = true"),
    statementExpression(disposeInThrowExpr),
    {
      kind: "ifStatement",
      condition: rawExpression("e is global::System.Exception ex"),
      thenStatement: {
        kind: "blockStatement",
        statements: [
          {
            kind: "throwStatement",
            expression: rawExpression("ex"),
          },
        ],
      },
    },
    {
      kind: "throwStatement",
      expression: rawExpression(
        `new global::System.Exception(e?.ToString() ?? "Unknown error")`
      ),
    },
  ];

  const members: CSharpClassMemberAst[] = [];
  members.push({
    kind: "fieldDeclaration",
    attributes: [],
    modifiers: ["private", "readonly"],
    type: asTypeAst(enumeratorType),
    name: "_enumerator",
  });
  members.push({
    kind: "fieldDeclaration",
    attributes: [],
    modifiers: ["private", "readonly"],
    type: asTypeAst(exchangeName),
    name: "_exchange",
  });
  if (hasReturnType) {
    members.push({
      kind: "fieldDeclaration",
      attributes: [],
      modifiers: ["private", "readonly"],
      type: asTypeAst(`global::System.Func<${returnType}>`),
      name: "_getReturnValue",
    });
    members.push({
      kind: "fieldDeclaration",
      attributes: [],
      modifiers: ["private"],
      type: asTypeAst(returnType),
      name: "_returnValue",
      initializer: {
        kind: "unaryExpression",
        operatorToken: "!",
        operand: { kind: "literalExpression", text: "default" },
        prefix: false,
      },
    });
    members.push({
      kind: "fieldDeclaration",
      attributes: [],
      modifiers: ["private"],
      type: asTypeAst("bool"),
      name: "_wasExternallyTerminated",
      initializer: { kind: "literalExpression", text: "false" },
    });
  }
  members.push({
    kind: "fieldDeclaration",
    attributes: [],
    modifiers: ["private"],
    type: asTypeAst("bool"),
    name: "_done",
    initializer: { kind: "literalExpression", text: "false" },
  });
  members.push({
    kind: "constructorDeclaration",
    attributes: [],
    modifiers: ["public"],
    name: wrapperName,
    parameters: constructorParams,
    body: {
      kind: "blockStatement",
      statements: constructorStatements,
    },
  });
  members.push({
    kind: "methodDeclaration",
    attributes: [],
    modifiers: ["public", ...(func.isAsync ? ["async"] : [])],
    returnType: asTypeAst(nextReturnType),
    name: nextMethodName,
    parameters: [
      parameter("value", nextParamType, {
        kind: "literalExpression",
        text: "default",
      }),
    ],
    body: {
      kind: "blockStatement",
      statements: nextMethodStatements,
    },
  });
  if (hasReturnType) {
    members.push({
      kind: "propertyDeclaration",
      attributes: [],
      modifiers: ["public"],
      type: asTypeAst(returnType),
      name: returnValuePropertyName,
      accessorList: [
        {
          kind: "accessorDeclaration",
          accessorKind: "get",
          body: {
            kind: "blockStatement",
            statements: [
              {
                kind: "returnStatement",
                expression: rawExpression(
                  "_wasExternallyTerminated ? _returnValue : _getReturnValue()"
                ),
              },
            ],
          },
        },
      ],
    });
  }
  members.push({
    kind: "methodDeclaration",
    attributes: [],
    modifiers: ["public", ...(func.isAsync ? ["async"] : [])],
    returnType: asTypeAst(returnReturnType),
    name: returnMethodName,
    parameters: [
      parameter("value", returnParamType, {
        kind: "unaryExpression",
        operatorToken: "!",
        operand: { kind: "literalExpression", text: "default" },
        prefix: false,
      }),
    ],
    body: {
      kind: "blockStatement",
      statements: returnMethodStatements,
    },
  });
  members.push({
    kind: "methodDeclaration",
    attributes: [],
    modifiers: ["public"],
    returnType: asTypeAst(returnReturnType),
    name: throwMethodName,
    parameters: [parameter("e", "object")],
    body: {
      kind: "blockStatement",
      statements: throwMethodStatements,
    },
  });

  return [
    {
      kind: "classDeclaration",
      indentLevel: 1,
      attributes: [],
      modifiers: ["public", "sealed"],
      name: wrapperName,
      members,
    },
    currentContext,
  ];
};

/**
 * AST-native variant of generator exchange emission.
 */
export const generateGeneratorExchangesAst = (
  module: IrModule,
  context: EmitterContext
): [readonly CSharpNamespaceMemberAst[], EmitterContext] => {
  const generators = collectGenerators(module);
  if (generators.length === 0) {
    return [[], context];
  }

  const members: CSharpNamespaceMemberAst[] = [];
  let currentContext = context;

  for (const generator of generators) {
    const [exchangeDecl, exchangeContext] = generateExchangeClassAst(
      generator,
      currentContext
    );
    currentContext = exchangeContext;

    if (members.length > 0) members.push({ kind: "blankLine" });
    members.push(exchangeDecl);

    if (needsBidirectionalSupport(generator)) {
      const [wrapperDecl, wrapperContext] = generateWrapperClassAst(
        generator,
        currentContext
      );
      currentContext = wrapperContext;
      members.push({ kind: "blankLine" });
      members.push(wrapperDecl);
    }
  }

  return [members, currentContext];
};
