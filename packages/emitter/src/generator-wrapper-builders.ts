import {
  booleanLiteral,
  identifierExpression,
  identifierType,
  stringLiteral,
} from "./core/format/backend-ast/builders.js";
import type {
  CSharpExpressionAst,
  CSharpMemberAst,
  CSharpParameterAst,
  CSharpStatementAst,
  CSharpTypeAst,
} from "./core/format/backend-ast/types.js";

const objectTypeAst: CSharpTypeAst = {
  kind: "predefinedType",
  keyword: "object",
};

export const boolTypeAst: CSharpTypeAst = {
  kind: "predefinedType",
  keyword: "bool",
};

const id = (identifier: string): CSharpExpressionAst =>
  identifierExpression(identifier);

const member = (
  expression: CSharpExpressionAst,
  memberName: string
): CSharpExpressionAst => ({
  kind: "memberAccessExpression",
  expression,
  memberName,
});

const invoke = (
  expression: CSharpExpressionAst,
  args: readonly CSharpExpressionAst[] = []
): CSharpExpressionAst => ({
  kind: "invocationExpression",
  expression,
  arguments: args,
});

const assign = (
  left: CSharpExpressionAst,
  right: CSharpExpressionAst
): CSharpExpressionAst => ({
  kind: "assignmentExpression",
  operatorToken: "=",
  left,
  right,
});

export const suppressDefault = (): CSharpExpressionAst => ({
  kind: "suppressNullableWarningExpression",
  expression: { kind: "defaultExpression" },
});

const iteratorResultType = (yieldType: CSharpTypeAst): CSharpTypeAst =>
  identifierType("global::Tsonic.Runtime.IteratorResult", [yieldType]);

const iteratorResultCtor = (
  yieldType: CSharpTypeAst,
  value: CSharpExpressionAst,
  done: boolean
): CSharpExpressionAst => ({
  kind: "objectCreationExpression",
  type: iteratorResultType(yieldType),
  arguments: [value, booleanLiteral(done)],
});

const taskOf = (typeArg: CSharpTypeAst): CSharpTypeAst =>
  identifierType("global::System.Threading.Tasks.Task", [typeArg]);

export const funcType = (typeArg: CSharpTypeAst): CSharpTypeAst =>
  identifierType("global::System.Func", [typeArg]);

export const buildConstructor = (
  wrapperName: string,
  exchangeName: string,
  isAsync: boolean,
  returnType: CSharpTypeAst | undefined
): CSharpMemberAst => {
  const enumerableType: CSharpTypeAst = identifierType(
    isAsync
      ? "global::System.Collections.Generic.IAsyncEnumerable"
      : "global::System.Collections.Generic.IEnumerable",
    [identifierType(exchangeName)]
  );

  const parameters: CSharpParameterAst[] = [
    { name: "enumerable", type: enumerableType },
    { name: "exchange", type: identifierType(exchangeName) },
  ];

  if (returnType) {
    parameters.push({
      name: "getReturnValue",
      type: funcType(returnType),
    });
  }

  const getEnumeratorCall = invoke(
    member(id("enumerable"), isAsync ? "GetAsyncEnumerator" : "GetEnumerator")
  );

  const statements: CSharpStatementAst[] = [
    {
      kind: "expressionStatement",
      expression: assign(id("_enumerator"), getEnumeratorCall),
    },
    {
      kind: "expressionStatement",
      expression: assign(id("_exchange"), id("exchange")),
    },
  ];

  if (returnType) {
    statements.push({
      kind: "expressionStatement",
      expression: assign(id("_getReturnValue"), id("getReturnValue")),
    });
  }

  return {
    kind: "constructorDeclaration",
    attributes: [],
    modifiers: ["public"],
    name: wrapperName,
    parameters,
    body: { kind: "blockStatement", statements },
  };
};

const buildDoneGuard = (yieldType: CSharpTypeAst): CSharpStatementAst => ({
  kind: "ifStatement",
  condition: id("_done"),
  thenStatement: {
    kind: "blockStatement",
    statements: [
      {
        kind: "returnStatement",
        expression: iteratorResultCtor(yieldType, suppressDefault(), true),
      },
    ],
  },
});

export const buildNextMethod = (
  yieldType: CSharpTypeAst,
  nextType: CSharpTypeAst,
  hasNextType: boolean,
  isAsync: boolean,
  nextMethodName: string
): CSharpMemberAst => {
  const resultType = iteratorResultType(yieldType);
  const returnType = isAsync ? taskOf(resultType) : resultType;
  const paramType = hasNextType
    ? { kind: "nullableType" as const, underlyingType: nextType }
    : { kind: "nullableType" as const, underlyingType: objectTypeAst };

  const moveNextExpr = invoke(
    member(id("_enumerator"), isAsync ? "MoveNextAsync" : "MoveNext")
  );
  const moveNextCondition = isAsync
    ? ({
        kind: "awaitExpression",
        expression: moveNextExpr,
      } as CSharpExpressionAst)
    : moveNextExpr;

  return {
    kind: "methodDeclaration",
    attributes: [],
    modifiers: ["public", ...(isAsync ? ["async"] : [])],
    returnType,
    name: nextMethodName,
    parameters: [
      {
        name: "value",
        type: paramType,
        defaultValue: { kind: "defaultExpression" },
      },
    ],
    body: {
      kind: "blockStatement",
      statements: [
        buildDoneGuard(yieldType),
        {
          kind: "expressionStatement",
          expression: assign(member(id("_exchange"), "Input"), id("value")),
        },
        {
          kind: "ifStatement",
          condition: moveNextCondition,
          thenStatement: {
            kind: "blockStatement",
            statements: [
              {
                kind: "returnStatement",
                expression: iteratorResultCtor(
                  yieldType,
                  member(id("_exchange"), "Output"),
                  false
                ),
              },
            ],
          },
        },
        {
          kind: "expressionStatement",
          expression: assign(id("_done"), booleanLiteral(true)),
        },
        {
          kind: "returnStatement",
          expression: iteratorResultCtor(yieldType, suppressDefault(), true),
        },
      ],
    },
  };
};

export const buildReturnValueProperty = (
  returnType: CSharpTypeAst,
  propertyName: string
): CSharpMemberAst => ({
  kind: "propertyDeclaration",
  attributes: [],
  modifiers: ["public"],
  type: returnType,
  name: propertyName,
  hasGetter: true,
  hasSetter: false,
  isAutoProperty: false,
  getterBody: {
    kind: "blockStatement",
    statements: [
      {
        kind: "returnStatement",
        expression: {
          kind: "conditionalExpression",
          condition: id("_wasExternallyTerminated"),
          whenTrue: id("_returnValue"),
          whenFalse: invoke(id("_getReturnValue")),
        },
      },
    ],
  },
});

const buildDisposeExpression = (isAsync: boolean): CSharpExpressionAst =>
  isAsync
    ? {
        kind: "awaitExpression",
        expression: invoke(member(id("_enumerator"), "DisposeAsync")),
      }
    : invoke(member(id("_enumerator"), "Dispose"));

export const buildReturnMethod = (
  yieldType: CSharpTypeAst,
  returnType: CSharpTypeAst | undefined,
  isAsync: boolean,
  returnMethodName: string
): CSharpMemberAst => {
  const resultType = iteratorResultType(yieldType);
  const methodReturnType = isAsync ? taskOf(resultType) : resultType;
  const returnParamType = returnType ?? {
    kind: "nullableType",
    underlyingType: objectTypeAst,
  };

  const statements: CSharpStatementAst[] = [
    {
      kind: "expressionStatement",
      expression: assign(id("_done"), booleanLiteral(true)),
    },
  ];

  if (returnType) {
    statements.push(
      {
        kind: "expressionStatement",
        expression: assign(id("_returnValue"), id("value")),
      },
      {
        kind: "expressionStatement",
        expression: assign(
          id("_wasExternallyTerminated"),
          booleanLiteral(true)
        ),
      }
    );
  }

  statements.push({
    kind: "expressionStatement",
    expression: buildDisposeExpression(isAsync),
  });

  statements.push({
    kind: "returnStatement",
    expression: iteratorResultCtor(yieldType, suppressDefault(), true),
  });

  return {
    kind: "methodDeclaration",
    attributes: [],
    modifiers: ["public", ...(isAsync ? ["async"] : [])],
    returnType: methodReturnType,
    name: returnMethodName,
    parameters: [
      {
        name: "value",
        type: returnParamType,
        defaultValue: suppressDefault(),
      },
    ],
    body: { kind: "blockStatement", statements },
  };
};

export const buildThrowMethod = (
  yieldType: CSharpTypeAst,
  isAsync: boolean,
  throwMethodName: string
): CSharpMemberAst => {
  const resultType = iteratorResultType(yieldType);
  const methodReturnType = isAsync ? taskOf(resultType) : resultType;

  const disposeCall: CSharpExpressionAst = isAsync
    ? invoke(
        member(
          invoke(
            member(invoke(member(id("_enumerator"), "DisposeAsync")), "AsTask")
          ),
          "Wait"
        )
      )
    : invoke(member(id("_enumerator"), "Dispose"));

  const exPattern = {
    kind: "declarationPattern" as const,
    type: identifierType("global::System.Exception"),
    designation: "ex",
  };

  return {
    kind: "methodDeclaration",
    attributes: [],
    modifiers: ["public"],
    returnType: methodReturnType,
    name: throwMethodName,
    parameters: [{ name: "e", type: objectTypeAst }],
    body: {
      kind: "blockStatement",
      statements: [
        {
          kind: "expressionStatement",
          expression: assign(id("_done"), booleanLiteral(true)),
        },
        { kind: "expressionStatement", expression: disposeCall },
        {
          kind: "ifStatement",
          condition: {
            kind: "isExpression",
            expression: id("e"),
            pattern: exPattern,
          },
          thenStatement: {
            kind: "blockStatement",
            statements: [{ kind: "throwStatement", expression: id("ex") }],
          },
        },
        {
          kind: "throwStatement",
          expression: {
            kind: "objectCreationExpression",
            type: identifierType("global::System.Exception"),
            arguments: [
              {
                kind: "binaryExpression",
                operatorToken: "??",
                left: invoke({
                  kind: "conditionalMemberAccessExpression",
                  expression: id("e"),
                  memberName: "ToString",
                }),
                right: stringLiteral("Unknown error"),
              },
            ],
          },
        },
      ],
    },
  };
};
