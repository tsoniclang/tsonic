/**
 * Generator wrapper declaration emission.
 *
 * Builds wrapper classes as typed CSharp AST declarations (no text templates).
 */

import { IrFunctionDeclaration, IrType } from "@tsonic/frontend";
import { EmitterContext } from "./types.js";
import { emitTypeAst } from "./type-emitter.js";
import { emitCSharpName, getCSharpName } from "./naming-policy.js";
import type {
  CSharpExpressionAst,
  CSharpMemberAst,
  CSharpParameterAst,
  CSharpStatementAst,
  CSharpTypeAst,
  CSharpTypeDeclarationAst,
} from "./core/format/backend-ast/types.js";

type GeneratorTypeArgs = {
  readonly yieldType: CSharpTypeAst;
  readonly returnType?: CSharpTypeAst;
  readonly nextType: CSharpTypeAst;
  readonly hasNextType: boolean;
  readonly newContext: EmitterContext;
};

const objectTypeAst: CSharpTypeAst = { kind: "identifierType", name: "object" };
const boolTypeAst: CSharpTypeAst = { kind: "predefinedType", keyword: "bool" };

const literal = (text: string): CSharpExpressionAst => ({
  kind: "literalExpression",
  text,
});

const id = (identifier: string): CSharpExpressionAst => ({
  kind: "identifierExpression",
  identifier,
});

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

const suppressDefault = (): CSharpExpressionAst => ({
  kind: "suppressNullableWarningExpression",
  expression: { kind: "defaultExpression" },
});

const iteratorResultType = (yieldType: CSharpTypeAst): CSharpTypeAst => ({
  kind: "identifierType",
  name: "global::Tsonic.Runtime.IteratorResult",
  typeArguments: [yieldType],
});

const iteratorResultCtor = (
  yieldType: CSharpTypeAst,
  value: CSharpExpressionAst,
  done: boolean
): CSharpExpressionAst => ({
  kind: "objectCreationExpression",
  type: iteratorResultType(yieldType),
  arguments: [value, literal(done ? "true" : "false")],
});

const taskOf = (typeArg: CSharpTypeAst): CSharpTypeAst => ({
  kind: "identifierType",
  name: "global::System.Threading.Tasks.Task",
  typeArguments: [typeArg],
});

const funcType = (typeArg: CSharpTypeAst): CSharpTypeAst => ({
  kind: "identifierType",
  name: "global::System.Func",
  typeArguments: [typeArg],
});

/**
 * Extract generator type arguments as CSharpTypeAst.
 *
 * Generator<TYield, TReturn, TNext> -> { yieldType, returnType?, nextType }
 */
export const extractGeneratorTypeArgs = (
  returnType: IrType | undefined,
  context: EmitterContext
): GeneratorTypeArgs => {
  let yieldType: CSharpTypeAst = objectTypeAst;
  let returnTypeAst: CSharpTypeAst | undefined;
  let nextType: CSharpTypeAst = objectTypeAst;
  let hasNextType = false;
  let currentContext = context;

  if (returnType?.kind === "referenceType") {
    const typeRef = returnType;
    if (typeRef.typeArguments && typeRef.typeArguments.length > 0) {
      const yieldTypeArg = typeRef.typeArguments[0];
      if (yieldTypeArg) {
        const [ytAst, ctx1] = emitTypeAst(yieldTypeArg, currentContext);
        currentContext = ctx1;
        yieldType = ytAst;
      }

      if (typeRef.typeArguments.length > 1) {
        const returnTypeArg = typeRef.typeArguments[1];
        if (
          returnTypeArg &&
          returnTypeArg.kind !== "voidType" &&
          !(
            returnTypeArg.kind === "primitiveType" &&
            returnTypeArg.name === "undefined"
          )
        ) {
          const [rtAst, ctx2] = emitTypeAst(returnTypeArg, currentContext);
          currentContext = ctx2;
          returnTypeAst = rtAst;
        }
      }

      if (typeRef.typeArguments.length > 2) {
        const nextTypeArg = typeRef.typeArguments[2];
        if (
          nextTypeArg &&
          !(
            nextTypeArg.kind === "primitiveType" &&
            nextTypeArg.name === "undefined"
          )
        ) {
          const [ntAst, ctx3] = emitTypeAst(nextTypeArg, currentContext);
          currentContext = ctx3;
          nextType = ntAst;
          hasNextType = true;
        }
      }
    }
  }

  return {
    yieldType,
    returnType: returnTypeAst,
    nextType,
    hasNextType,
    newContext: currentContext,
  };
};

const buildConstructor = (
  wrapperName: string,
  exchangeName: string,
  isAsync: boolean,
  returnType: CSharpTypeAst | undefined
): CSharpMemberAst => {
  const enumerableType: CSharpTypeAst = {
    kind: "identifierType",
    name: isAsync
      ? "global::System.Collections.Generic.IAsyncEnumerable"
      : "global::System.Collections.Generic.IEnumerable",
    typeArguments: [{ kind: "identifierType", name: exchangeName }],
  };

  const parameters: CSharpParameterAst[] = [
    { name: "enumerable", type: enumerableType },
    { name: "exchange", type: { kind: "identifierType", name: exchangeName } },
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

const buildNextMethod = (
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
          expression: assign(id("_done"), literal("true")),
        },
        {
          kind: "returnStatement",
          expression: iteratorResultCtor(yieldType, suppressDefault(), true),
        },
      ],
    },
  };
};

const buildReturnValueProperty = (
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

const buildReturnMethod = (
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
      expression: assign(id("_done"), literal("true")),
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
        expression: assign(id("_wasExternallyTerminated"), literal("true")),
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

const buildThrowMethod = (
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
    type: { kind: "identifierType" as const, name: "global::System.Exception" },
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
          expression: assign(id("_done"), literal("true")),
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
            type: {
              kind: "identifierType",
              name: "global::System.Exception",
            },
            arguments: [
              {
                kind: "binaryExpression",
                operatorToken: "??",
                left: invoke({
                  kind: "conditionalMemberAccessExpression",
                  expression: id("e"),
                  memberName: "ToString",
                }),
                right: {
                  kind: "literalExpression",
                  text: '"Unknown error"',
                },
              },
            ],
          },
        },
      ],
    },
  };
};

/**
 * Generate wrapper class declaration for a generator function.
 */
export const generateWrapperClass = (
  func: IrFunctionDeclaration,
  context: EmitterContext
): [CSharpTypeDeclarationAst, EmitterContext] => {
  let currentContext = context;

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

  const {
    yieldType,
    returnType,
    nextType,
    hasNextType,
    newContext: typeContext,
  } = extractGeneratorTypeArgs(func.returnType, currentContext);
  currentContext = typeContext;

  const enumeratorType: CSharpTypeAst = {
    kind: "identifierType",
    name: func.isAsync
      ? "global::System.Collections.Generic.IAsyncEnumerator"
      : "global::System.Collections.Generic.IEnumerator",
    typeArguments: [{ kind: "identifierType", name: exchangeName }],
  };

  const members: CSharpMemberAst[] = [
    {
      kind: "fieldDeclaration",
      attributes: [],
      modifiers: ["private", "readonly"],
      type: enumeratorType,
      name: "_enumerator",
    },
    {
      kind: "fieldDeclaration",
      attributes: [],
      modifiers: ["private", "readonly"],
      type: { kind: "identifierType", name: exchangeName },
      name: "_exchange",
    },
  ];

  if (returnType) {
    members.push(
      {
        kind: "fieldDeclaration",
        attributes: [],
        modifiers: ["private", "readonly"],
        type: funcType(returnType),
        name: "_getReturnValue",
      },
      {
        kind: "fieldDeclaration",
        attributes: [],
        modifiers: ["private"],
        type: returnType,
        name: "_returnValue",
        initializer: suppressDefault(),
      },
      {
        kind: "fieldDeclaration",
        attributes: [],
        modifiers: ["private"],
        type: boolTypeAst,
        name: "_wasExternallyTerminated",
        initializer: literal("false"),
      }
    );
  }

  members.push({
    kind: "fieldDeclaration",
    attributes: [],
    modifiers: ["private"],
    type: boolTypeAst,
    name: "_done",
    initializer: literal("false"),
  });

  members.push(
    buildConstructor(wrapperName, exchangeName, func.isAsync, returnType)
  );
  members.push(
    buildNextMethod(
      yieldType,
      nextType,
      hasNextType,
      func.isAsync,
      nextMethodName
    )
  );

  if (returnType) {
    members.push(buildReturnValueProperty(returnType, returnValuePropertyName));
  }

  members.push(
    buildReturnMethod(yieldType, returnType, func.isAsync, returnMethodName)
  );
  members.push(buildThrowMethod(yieldType, func.isAsync, throwMethodName));

  const classAst: CSharpTypeDeclarationAst = {
    kind: "classDeclaration",
    attributes: [],
    modifiers: ["public", "sealed"],
    name: wrapperName,
    interfaces: [],
    members,
  };

  return [classAst, currentContext];
};

/**
 * Check if a generator function needs bidirectional support
 * (i.e., has TNext type parameter that isn't undefined)
 */
export const needsBidirectionalSupport = (
  func: IrFunctionDeclaration
): boolean => {
  if (!func.isGenerator) return false;

  if (func.returnType?.kind === "referenceType") {
    const typeRef = func.returnType;
    if (typeRef.typeArguments && typeRef.typeArguments.length > 2) {
      const nextTypeArg = typeRef.typeArguments[2];
      if (
        nextTypeArg &&
        !(
          nextTypeArg.kind === "primitiveType" &&
          nextTypeArg.name === "undefined"
        )
      ) {
        return true;
      }
    }
  }

  return false;
};

/**
 * Check if a generator function has a return type (TReturn is not void/undefined)
 */
export const hasGeneratorReturnType = (
  func: IrFunctionDeclaration
): boolean => {
  if (!func.isGenerator) return false;

  if (func.returnType?.kind === "referenceType") {
    const typeRef = func.returnType;
    if (typeRef.typeArguments && typeRef.typeArguments.length > 1) {
      const returnTypeArg = typeRef.typeArguments[1];
      if (
        returnTypeArg &&
        returnTypeArg.kind !== "voidType" &&
        !(
          returnTypeArg.kind === "primitiveType" &&
          returnTypeArg.name === "undefined"
        )
      ) {
        return true;
      }
    }
  }

  return false;
};
