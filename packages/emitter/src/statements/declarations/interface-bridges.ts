import type {
  CSharpBlockStatementAst,
  CSharpExpressionAst,
  CSharpMemberAst,
  CSharpStatementAst,
  CSharpTypeAst,
} from "../../core/format/backend-ast/types.js";
import {
  identifierExpression,
  identifierType,
} from "../../core/format/backend-ast/builders.js";
import {
  getIdentifierTypeLeafName,
  stableTypeKeyFromAst,
  stripNullableTypeAst,
} from "../../core/format/backend-ast/utils.js";
import { emitCSharpName } from "../../naming-policy.js";
import { emitTypeAst, emitTypeParametersAst } from "../../type-emitter.js";
import { emitParameters } from "../classes/parameters.js";
import type { EmitterContext } from "../../types.js";
import type {
  CompatibleInterfaceMatch,
  CompatibleInterfaceMethodMatch,
} from "../../core/semantic/implicit-interfaces.js";

type AsyncBridgeKind = "task" | "taskOf" | "valueTask" | "valueTaskOf";

type AsyncBridgeInfo = {
  readonly kind: AsyncBridgeKind;
  readonly payload?: CSharpTypeAst;
};

const VOID_TYPE_AST: CSharpTypeAst = {
  kind: "predefinedType",
  keyword: "void",
};

const memberAccess = (
  expression: CSharpExpressionAst,
  memberName: string
): CSharpExpressionAst => ({
  kind: "memberAccessExpression",
  expression,
  memberName,
});

const invocation = (
  expression: CSharpExpressionAst,
  args: readonly CSharpExpressionAst[],
  typeArguments?: readonly CSharpTypeAst[]
): CSharpExpressionAst => ({
  kind: "invocationExpression",
  expression,
  arguments: args,
  ...(typeArguments && typeArguments.length > 0 ? { typeArguments } : {}),
});

const expressionStatement = (
  expression: CSharpExpressionAst
): CSharpStatementAst => ({
  kind: "expressionStatement",
  expression,
});

const returnStatement = (
  expression?: CSharpExpressionAst
): CSharpStatementAst => ({
  kind: "returnStatement",
  ...(expression ? { expression } : {}),
});

const taskLikeInfoFromTypeAst = (
  type: CSharpTypeAst
): AsyncBridgeInfo | undefined => {
  const stripped = stripNullableTypeAst(type);
  const leaf = getIdentifierTypeLeafName(stripped);
  if (!leaf) return undefined;

  switch (leaf) {
    case "Task":
      if (
        stripped.kind === "identifierType" ||
        stripped.kind === "qualifiedIdentifierType"
      ) {
        const args = stripped.typeArguments ?? [];
        if (args.length === 0) return { kind: "task" };
        if (args.length === 1 && args[0])
          return { kind: "taskOf", payload: args[0] };
      }
      return undefined;
    case "ValueTask":
      if (
        stripped.kind === "identifierType" ||
        stripped.kind === "qualifiedIdentifierType"
      ) {
        const args = stripped.typeArguments ?? [];
        if (args.length === 0) return { kind: "valueTask" };
        if (args.length === 1 && args[0]) {
          return { kind: "valueTaskOf", payload: args[0] };
        }
      }
      return undefined;
    default:
      return undefined;
  }
};

const buildCompletedAsyncExpression = (
  asyncInfo: AsyncBridgeInfo,
  expression?: CSharpExpressionAst
): CSharpExpressionAst => {
  switch (asyncInfo.kind) {
    case "task":
      return memberAccess(
        identifierExpression("global::System.Threading.Tasks.Task"),
        "CompletedTask"
      );
    case "taskOf":
      if (!expression) {
        throw new Error("ICE: Task<T> bridge requires a value expression.");
      }
      return invocation(
        memberAccess(
          identifierExpression("global::System.Threading.Tasks.Task"),
          "FromResult"
        ),
        [expression],
        asyncInfo.payload ? [asyncInfo.payload] : undefined
      );
    case "valueTask":
      return memberAccess(
        identifierExpression("global::System.Threading.Tasks.ValueTask"),
        "CompletedTask"
      );
    case "valueTaskOf":
      if (!expression || !asyncInfo.payload) {
        throw new Error(
          "ICE: ValueTask<T> bridge requires a value expression."
        );
      }
      return {
        kind: "objectCreationExpression",
        type: identifierType("global::System.Threading.Tasks.ValueTask", [
          asyncInfo.payload,
        ]),
        arguments: [expression],
      };
  }
};

const buildMethodBridgeBody = (
  interfaceReturnType: CSharpTypeAst,
  classReturnType: CSharpTypeAst,
  targetCall: CSharpExpressionAst
): CSharpBlockStatementAst => {
  const interfaceKey = stableTypeKeyFromAst(interfaceReturnType);
  const classKey = stableTypeKeyFromAst(classReturnType);
  const interfaceAsync = taskLikeInfoFromTypeAst(interfaceReturnType);
  const classAsync = taskLikeInfoFromTypeAst(classReturnType);
  const classIsVoid = classKey === stableTypeKeyFromAst(VOID_TYPE_AST);
  const interfaceIsVoid = interfaceKey === stableTypeKeyFromAst(VOID_TYPE_AST);

  if (interfaceKey === classKey) {
    return {
      kind: "blockStatement",
      statements: interfaceIsVoid
        ? [expressionStatement(targetCall)]
        : [returnStatement(targetCall)],
    };
  }

  if (interfaceIsVoid) {
    return {
      kind: "blockStatement",
      statements: [expressionStatement(targetCall)],
    };
  }

  if (interfaceAsync) {
    if (classAsync) {
      return {
        kind: "blockStatement",
        statements: [returnStatement(targetCall)],
      };
    }

    if (classIsVoid) {
      return {
        kind: "blockStatement",
        statements: [
          expressionStatement(targetCall),
          returnStatement(buildCompletedAsyncExpression(interfaceAsync)),
        ],
      };
    }

    if (interfaceAsync.kind === "task" || interfaceAsync.kind === "valueTask") {
      return {
        kind: "blockStatement",
        statements: [
          expressionStatement(targetCall),
          returnStatement(buildCompletedAsyncExpression(interfaceAsync)),
        ],
      };
    }

    return {
      kind: "blockStatement",
      statements: [
        returnStatement(
          buildCompletedAsyncExpression(interfaceAsync, targetCall)
        ),
      ],
    };
  }

  return {
    kind: "blockStatement",
    statements: [returnStatement(targetCall)],
  };
};

const buildMethodBridgeMember = (
  match: CompatibleInterfaceMethodMatch,
  interfaceTypeAst: CSharpTypeAst,
  context: EmitterContext
): [CSharpMemberAst, EmitterContext] => {
  const interfaceMethodName = emitCSharpName(
    match.interfaceMember.name,
    "methods",
    context
  );
  const classMethodName = emitCSharpName(
    match.classMember.name,
    "methods",
    context
  );

  let currentContext = context;
  const [typeParameters, constraints, typeParamContext] = emitTypeParametersAst(
    match.interfaceMember.typeParameters,
    currentContext
  );
  currentContext = typeParamContext;

  const [parameters, paramsContext] = emitParameters(
    match.interfaceMember.parameters,
    currentContext
  );
  currentContext = paramsContext;

  const [interfaceReturnType, interfaceContext] = emitTypeAst(
    match.interfaceMember.returnType ?? { kind: "voidType" },
    currentContext
  );
  currentContext = interfaceContext;

  const [classReturnType, classContext] = emitTypeAst(
    match.classMember.returnType ?? { kind: "voidType" },
    currentContext
  );
  currentContext = classContext;

  const callArguments = parameters.map((parameter) =>
    identifierExpression(parameter.name)
  );
  const typeArguments =
    typeParameters.length > 0
      ? typeParameters.map((typeParameter) =>
          identifierType(typeParameter.name)
        )
      : undefined;
  const targetCall = invocation(
    memberAccess(identifierExpression("this"), classMethodName),
    callArguments,
    typeArguments
  );

  return [
    {
      kind: "methodDeclaration",
      attributes: [],
      modifiers: [],
      returnType: interfaceReturnType,
      name: interfaceMethodName,
      explicitInterface: interfaceTypeAst,
      ...(typeParameters.length > 0 ? { typeParameters } : {}),
      parameters,
      body: buildMethodBridgeBody(
        interfaceReturnType,
        classReturnType,
        targetCall
      ),
      ...(constraints.length > 0 ? { constraints } : {}),
    },
    currentContext,
  ];
};

const buildPropertyBridgeMember = (
  match: CompatibleInterfaceMatch["propertyMatches"][number],
  interfaceTypeAst: CSharpTypeAst,
  context: EmitterContext
): [CSharpMemberAst | undefined, EmitterContext] => {
  let currentContext = context;
  const [interfacePropertyType, interfaceContext] = emitTypeAst(
    match.interfaceMember.type,
    currentContext
  );
  currentContext = interfaceContext;

  const [classPropertyType, classContext] = emitTypeAst(
    match.classMember.type ?? { kind: "voidType" },
    currentContext
  );
  currentContext = classContext;

  if (
    stableTypeKeyFromAst(interfacePropertyType) !==
    stableTypeKeyFromAst(classPropertyType)
  ) {
    return [undefined, currentContext];
  }

  const propertyName = emitCSharpName(
    match.interfaceMember.name,
    "properties",
    context
  );
  const classPropertyName = emitCSharpName(
    match.classMember.name,
    "properties",
    context
  );

  const getterBody: CSharpBlockStatementAst = {
    kind: "blockStatement",
    statements: [
      returnStatement(
        memberAccess(identifierExpression("this"), classPropertyName)
      ),
    ],
  };

  const setterBody: CSharpBlockStatementAst | undefined =
    match.interfaceMember.isReadonly || match.classMember.isReadonly
      ? undefined
      : {
          kind: "blockStatement",
          statements: [
            expressionStatement({
              kind: "assignmentExpression",
              operatorToken: "=",
              left: memberAccess(
                identifierExpression("this"),
                classPropertyName
              ),
              right: identifierExpression("value"),
            }),
          ],
        };

  return [
    {
      kind: "propertyDeclaration",
      attributes: [],
      modifiers: [],
      type: interfacePropertyType,
      name: propertyName,
      explicitInterface: interfaceTypeAst,
      hasGetter: true,
      hasSetter: !!setterBody,
      isAutoProperty: false,
      getterBody,
      ...(setterBody ? { setterBody } : {}),
    },
    currentContext,
  ];
};

export const generateExplicitInterfaceBridgeMembers = (
  matches: readonly CompatibleInterfaceMatch[],
  context: EmitterContext
): [readonly CSharpMemberAst[], EmitterContext] => {
  let currentContext = context;
  const members: CSharpMemberAst[] = [];

  for (const match of matches) {
    const [interfaceTypeAst, interfaceContext] = emitTypeAst(
      match.ref,
      currentContext
    );
    currentContext = interfaceContext;

    for (const propertyMatch of match.propertyMatches) {
      const [propertyBridge, propertyContext] = buildPropertyBridgeMember(
        propertyMatch,
        interfaceTypeAst,
        currentContext
      );
      currentContext = propertyContext;
      if (propertyBridge) {
        members.push(propertyBridge);
      }
    }

    for (const methodMatch of match.methodMatches) {
      const [methodBridge, methodContext] = buildMethodBridgeMember(
        methodMatch,
        interfaceTypeAst,
        currentContext
      );
      currentContext = methodContext;
      members.push(methodBridge);
    }
  }

  return [members, currentContext];
};
