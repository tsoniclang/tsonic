/**
 * Call expression emitter
 */

import {
  getAwaitedIrType,
  getSpreadTupleShape,
  isAwaitableIrType,
  IrBlockStatement,
  IrExpression,
  IrStatement,
  IrType,
  normalizedUnionType,
  stableIrTypeKey,
} from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import { emitExpressionAst } from "../../expression-emitter.js";
import {
  emitTypeArgumentsAst,
  generateSpecializedName,
} from "../identifiers.js";
import { emitTypeAst } from "../../type-emitter.js";
import { emitMemberAccess } from "../access.js";
import {
  isLValue,
  getPassingModifierFromCast,
  isJsonSerializerCall,
  isGlobalJsonCall,
  isInstanceMemberAccess,
  shouldEmitFluentExtensionCall,
  getTypeNamespace,
  registerJsonAotExpressionTypes,
  registerJsonAotType,
  needsIntCast,
  isPromiseChainMethod,
  isAsyncWrapperType,
} from "./call-analysis.js";
import type { ModuleIdentity } from "../../emitter-types/core.js";
import {
  extractCalleeNameFromAst,
  getIdentifierTypeName,
  getIdentifierTypeLeafName,
  stableTypeKeyFromAst,
} from "../../core/format/backend-ast/utils.js";
import type {
  CSharpBlockStatementAst,
  CSharpCatchClauseAst,
  CSharpExpressionAst,
  CSharpStatementAst,
  CSharpTypeAst,
} from "../../core/format/backend-ast/types.js";
import { resolveImportPath } from "../../core/semantic/index.js";
import { resolveEffectiveExpressionType } from "../../core/semantic/narrowed-expression-types.js";
import { normalizeRuntimeStorageType } from "../../core/semantic/storage-types.js";
import {
  containsTypeParameter,
  getArrayLikeElementType,
  normalizeStructuralEmissionType,
  resolveTypeAlias,
  stripNullish,
} from "../../core/semantic/type-resolution.js";
import { buildRuntimeUnionLayout } from "../../core/semantic/runtime-unions.js";
import { allocateLocalName } from "../../core/format/local-names.js";
import {
  identifierExpression,
  identifierType,
  nullLiteral,
  stringLiteral,
} from "../../core/format/backend-ast/builders.js";
import { getAcceptedParameterType } from "../../core/semantic/defaults.js";

const preserveReceiverTypeAssertionAst = (
  receiverExpr: IrExpression,
  receiverAst: CSharpExpressionAst,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  if (receiverExpr.kind !== "typeAssertion") {
    return [receiverAst, context];
  }

  const [targetTypeAst, nextContext] = emitTypeAst(
    receiverExpr.targetType,
    context
  );

  if (
    receiverAst.kind === "castExpression" &&
    stableTypeKeyFromAst(receiverAst.type) ===
      stableTypeKeyFromAst(targetTypeAst)
  ) {
    return [receiverAst, nextContext];
  }

  return [
    {
      kind: "parenthesizedExpression",
      expression: {
        kind: "castExpression",
        type: targetTypeAst,
        expression: receiverAst,
      },
    },
    nextContext,
  ];
};

const emitArrayWrapperElementTypeAst = (
  receiverType: IrType,
  context: EmitterContext
): [CSharpTypeAst, EmitterContext] => {
  const storageReceiverType =
    normalizeRuntimeStorageType(receiverType, context) ?? receiverType;
  const resolvedReceiverType = resolveTypeAlias(
    stripNullish(storageReceiverType),
    context
  );
  if (resolvedReceiverType.kind === "arrayType") {
    const elementType = normalizeStructuralEmissionType(
      resolvedReceiverType.elementType,
      context
    );
    return emitTypeAst(elementType, context);
  }

  if (
    resolvedReceiverType.kind === "referenceType" &&
    (resolvedReceiverType.name === "Array" ||
      resolvedReceiverType.name === "ReadonlyArray") &&
    resolvedReceiverType.typeArguments?.length === 1
  ) {
    const elementType = resolvedReceiverType.typeArguments[0];
    if (elementType) {
      const emittedElementType = normalizeStructuralEmissionType(
        elementType,
        context
      );
      return emitTypeAst(emittedElementType, context);
    }
  }

  const nativeElementType = resolveNativeArrayLikeElementType(
    storageReceiverType,
    context
  );
  if (nativeElementType) {
    const emittedElementType = normalizeStructuralEmissionType(
      nativeElementType,
      context
    );
    return emitTypeAst(emittedElementType, context);
  }
  return [identifierType("object"), context];
};

const buildTupleSpreadElementAccess = (
  spreadExpr: IrExpression,
  index: number,
  inferredType: IrType
): IrExpression => ({
  kind: "memberAccess",
  object: spreadExpr,
  property: {
    kind: "literal",
    value: index,
    inferredType: { kind: "primitiveType", name: "int" },
  },
  isComputed: true,
  isOptional: false,
  inferredType,
  accessKind: "clrIndexer",
});

const buildTupleSpreadSlice = (
  spreadExpr: IrExpression,
  startIndex: number,
  inferredType: IrType
): IrExpression => ({
  kind: "call",
  callee: {
    kind: "memberAccess",
    object: spreadExpr,
    property: "slice",
    isComputed: false,
    isOptional: false,
  },
  arguments: [
    {
      kind: "literal",
      value: startIndex,
      inferredType: { kind: "primitiveType", name: "int" },
    },
  ],
  isOptional: false,
  inferredType,
});

const expandTupleLikeSpreadArguments = (
  args: readonly IrExpression[]
): readonly IrExpression[] => {
  const expanded: IrExpression[] = [];

  for (const arg of args) {
    if (arg.kind !== "spread") {
      expanded.push(arg);
      continue;
    }

    const spreadShape = arg.inferredType
      ? getSpreadTupleShape(arg.inferredType)
      : undefined;
    if (!spreadShape) {
      expanded.push(arg);
      continue;
    }

    for (
      let index = 0;
      index < spreadShape.prefixElementTypes.length;
      index += 1
    ) {
      const elementType = spreadShape.prefixElementTypes[index];
      if (!elementType) continue;
      expanded.push(
        buildTupleSpreadElementAccess(arg.expression, index, elementType)
      );
    }

    if (spreadShape.restElementType) {
      expanded.push({
        kind: "spread",
        expression: buildTupleSpreadSlice(
          arg.expression,
          spreadShape.prefixElementTypes.length,
          {
            kind: "arrayType",
            elementType: spreadShape.restElementType,
            origin: "explicit",
          }
        ),
        inferredType: {
          kind: "arrayType",
          elementType: spreadShape.restElementType,
          origin: "explicit",
        },
      });
      continue;
    }

    if (spreadShape.prefixElementTypes.length === 0) {
      expanded.push(arg);
    }
  }

  if (expanded.length === args.length) {
    return args;
  }

  return expanded;
};

/**
 * Wrap an expression AST with an optional argument modifier (ref/out/in).
 */
const wrapArgModifier = (
  modifier: string | undefined,
  expr: CSharpExpressionAst
): CSharpExpressionAst =>
  modifier
    ? { kind: "argumentModifierExpression", modifier, expression: expr }
    : expr;

/**
 * Wrap an invocation AST with an optional (int) cast.
 */
const wrapIntCast = (
  needsCast: boolean,
  expr: CSharpExpressionAst
): CSharpExpressionAst =>
  needsCast
    ? {
        kind: "castExpression",
        type: { kind: "predefinedType", keyword: "int" },
        expression: expr,
      }
    : expr;

const stripClrGenericArity = (typeName: string): string =>
  typeName.replace(/`\d+$/, "");

const nativeArrayMutationMembers = new Set([
  "push",
  "pop",
  "shift",
  "unshift",
  "splice",
  "sort",
  "reverse",
  "fill",
  "copyWithin",
]);

const isJsArrayWrapperBindingType = (bindingType: string): boolean =>
  stripClrGenericArity(bindingType).split(".").pop() === "JSArray";

const resolveNativeArrayLikeElementType = (
  receiverType: IrType | undefined,
  context: EmitterContext
): IrType | undefined => {
  if (!receiverType) return undefined;

  const resolved = resolveTypeAlias(stripNullish(receiverType), context);
  if (resolved.kind === "arrayType") {
    return resolved.elementType;
  }

  if (
    resolved.kind === "referenceType" &&
    (resolved.name === "Array" || resolved.name === "ReadonlyArray") &&
    resolved.typeArguments?.length === 1
  ) {
    return resolved.typeArguments[0];
  }

  return undefined;
};

const shouldPreferNativeArrayWrapperInterop = (
  binding:
    | NonNullable<
        Extract<IrExpression, { kind: "memberAccess" }>["memberBinding"]
      >
    | undefined,
  receiverType: IrType | undefined,
  context: EmitterContext
): boolean =>
  !!binding &&
  isJsArrayWrapperBindingType(binding.type) &&
  !!resolveNativeArrayLikeElementType(receiverType, context);

const hasDirectNativeArrayLikeInteropShape = (
  receiverType: IrType | undefined
): boolean => {
  if (!receiverType) return false;
  return (
    receiverType.kind === "arrayType" ||
    (receiverType.kind === "referenceType" &&
      (receiverType.name === "Array" ||
        receiverType.name === "ReadonlyArray") &&
      receiverType.typeArguments?.length === 1)
  );
};

const returnsMutatedArrayMember = (memberName: string): boolean =>
  memberName === "sort" ||
  memberName === "reverse" ||
  memberName === "fill" ||
  memberName === "copyWithin";

const nativeArrayReturningInteropMembers = new Set([
  "concat",
  "copyWithin",
  "filter",
  "flat",
  "flatMap",
  "map",
  "reverse",
  "slice",
  "sort",
  "splice",
  "toReversed",
  "toSorted",
  "toSpliced",
  "with",
]);

const createVarLocal = (
  name: string,
  initializer: CSharpExpressionAst
): CSharpStatementAst => ({
  kind: "localDeclarationStatement",
  modifiers: [],
  type: { kind: "varType" },
  declarators: [{ name, initializer }],
});

type CapturedAssignableArrayTarget = {
  readonly readExpression: CSharpExpressionAst;
  readonly writeExpression: CSharpExpressionAst;
  readonly setupStatements: readonly CSharpStatementAst[];
  readonly context: EmitterContext;
};

const captureAssignableArrayTarget = (
  expr: IrExpression,
  context: EmitterContext
): CapturedAssignableArrayTarget | undefined => {
  const [receiverAst, receiverContext] = emitExpressionAst(expr, context);

  if (receiverAst.kind === "identifierExpression") {
    return {
      readExpression: receiverAst,
      writeExpression: receiverAst,
      setupStatements: [],
      context: receiverContext,
    };
  }

  if (receiverAst.kind === "memberAccessExpression") {
    const objectTemp = allocateLocalName(
      "__tsonic_arrayTarget",
      receiverContext
    );
    const objectIdentifier: CSharpExpressionAst = {
      kind: "identifierExpression",
      identifier: objectTemp.emittedName,
    };

    return {
      readExpression: {
        kind: "memberAccessExpression",
        expression: objectIdentifier,
        memberName: receiverAst.memberName,
      },
      writeExpression: {
        kind: "memberAccessExpression",
        expression: objectIdentifier,
        memberName: receiverAst.memberName,
      },
      setupStatements: [
        createVarLocal(objectTemp.emittedName, receiverAst.expression),
      ],
      context: objectTemp.context,
    };
  }

  if (
    receiverAst.kind === "elementAccessExpression" &&
    receiverAst.arguments.length === 1
  ) {
    const objectTemp = allocateLocalName(
      "__tsonic_arrayTarget",
      receiverContext
    );
    const indexTemp = allocateLocalName(
      "__tsonic_arrayIndex",
      objectTemp.context
    );
    const objectIdentifier: CSharpExpressionAst = {
      kind: "identifierExpression",
      identifier: objectTemp.emittedName,
    };
    const indexIdentifier: CSharpExpressionAst = {
      kind: "identifierExpression",
      identifier: indexTemp.emittedName,
    };
    const indexArgument = receiverAst.arguments[0];
    if (!indexArgument) return undefined;

    return {
      readExpression: {
        kind: "elementAccessExpression",
        expression: objectIdentifier,
        arguments: [indexIdentifier],
      },
      writeExpression: {
        kind: "elementAccessExpression",
        expression: objectIdentifier,
        arguments: [indexIdentifier],
      },
      setupStatements: [
        createVarLocal(objectTemp.emittedName, receiverAst.expression),
        createVarLocal(indexTemp.emittedName, indexArgument),
      ],
      context: indexTemp.context,
    };
  }

  return undefined;
};

const emitArrayMutationInteropCall = (
  expr: Extract<IrExpression, { kind: "call" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] | undefined => {
  if (expr.isOptional) return undefined;
  if (expr.callee.kind !== "memberAccess") return undefined;
  if (expr.callee.isComputed) return undefined;
  if (typeof expr.callee.property !== "string") return undefined;
  if (!nativeArrayMutationMembers.has(expr.callee.property)) return undefined;
  if (!isLValue(expr.callee.object)) return undefined;

  const binding = expr.callee.memberBinding;
  if (
    !binding ||
    (binding.isExtensionMethod && !isJsArrayWrapperBindingType(binding.type))
  ) {
    return undefined;
  }

  const receiverType =
    resolveEffectiveExpressionType(expr.callee.object, context) ??
    expr.callee.object.inferredType;
  const receiverElementType = resolveNativeArrayLikeElementType(
    receiverType,
    context
  );
  if (!receiverElementType) return undefined;

  const captured = captureAssignableArrayTarget(expr.callee.object, context);
  if (!captured) return undefined;

  let currentContext = captured.context;

  const [elementTypeAst, elementTypeContext] = emitArrayWrapperElementTypeAst(
    receiverType ?? {
      kind: "arrayType",
      elementType: receiverElementType,
      origin: "explicit",
    },
    currentContext
  );
  currentContext = elementTypeContext;

  const wrapperTemp = allocateLocalName(
    "__tsonic_arrayWrapper",
    currentContext
  );
  currentContext = wrapperTemp.context;

  const resultTemp = allocateLocalName("__tsonic_arrayResult", currentContext);
  currentContext = resultTemp.context;

  const wrapperIdentifier: CSharpExpressionAst = {
    kind: "identifierExpression",
    identifier: wrapperTemp.emittedName,
  };
  const resultIdentifier: CSharpExpressionAst = {
    kind: "identifierExpression",
    identifier: resultTemp.emittedName,
  };

  const [argAsts, argContext] = emitCallArguments(
    expr.arguments,
    expr,
    currentContext
  );
  currentContext = argContext;

  const mutationCall: CSharpExpressionAst = {
    kind: "invocationExpression",
    expression: {
      kind: "memberAccessExpression",
      expression: wrapperIdentifier,
      memberName: binding.member,
    },
    arguments: argAsts,
  };

  const mutatedArrayAst: CSharpExpressionAst = {
    kind: "invocationExpression",
    expression: {
      kind: "memberAccessExpression",
      expression: wrapperIdentifier,
      memberName: "toArray",
    },
    arguments: [],
  };

  let returnExpression: CSharpExpressionAst = resultIdentifier;
  if (expr.callee.property === "splice") {
    returnExpression = {
      kind: "invocationExpression",
      expression: {
        kind: "memberAccessExpression",
        expression: resultIdentifier,
        memberName: "toArray",
      },
      arguments: [],
    };
  } else if (returnsMutatedArrayMember(expr.callee.property)) {
    returnExpression = mutatedArrayAst;
  }

  const returnType = expr.inferredType ?? {
    kind: "arrayType",
    elementType: receiverElementType,
    origin: "explicit" as const,
  };
  const [returnTypeAst, returnTypeContext] = emitTypeAst(
    returnType,
    currentContext
  );
  currentContext = returnTypeContext;

  const lambdaAst: CSharpExpressionAst = {
    kind: "lambdaExpression",
    isAsync: false,
    parameters: [],
    body: {
      kind: "blockStatement",
      statements: [
        ...captured.setupStatements,
        createVarLocal(wrapperTemp.emittedName, {
          kind: "objectCreationExpression",
          type: identifierType("global::Tsonic.JSRuntime.JSArray", [
            elementTypeAst,
          ]),
          arguments: [captured.readExpression],
        }),
        createVarLocal(resultTemp.emittedName, mutationCall),
        {
          kind: "expressionStatement",
          expression: {
            kind: "assignmentExpression",
            operatorToken: "=",
            left: captured.writeExpression,
            right: mutatedArrayAst,
          },
        },
        {
          kind: "returnStatement",
          expression: returnExpression,
        },
      ],
    },
  };

  const delegateCastAst: CSharpExpressionAst = {
    kind: "castExpression",
    type: buildDelegateType([], returnTypeAst),
    expression: {
      kind: "parenthesizedExpression",
      expression: lambdaAst,
    },
  };

  return [
    wrapIntCast(needsIntCast(expr, expr.callee.property), {
      kind: "invocationExpression",
      expression: {
        kind: "parenthesizedExpression",
        expression: delegateCastAst,
      },
      arguments: [],
    }),
    currentContext,
  ];
};

const emitArrayWrapperInteropCall = (
  expr: Extract<IrExpression, { kind: "call" }>,
  context: EmitterContext,
  expectedType: IrType | undefined
): [CSharpExpressionAst, EmitterContext] | undefined => {
  if (expr.isOptional) return undefined;
  if (expr.callee.kind !== "memberAccess") return undefined;
  if (expr.callee.isComputed) return undefined;
  if (typeof expr.callee.property !== "string") return undefined;

  const binding = expr.callee.memberBinding;
  if (
    !binding ||
    (binding.isExtensionMethod && !isJsArrayWrapperBindingType(binding.type))
  ) {
    return undefined;
  }

  const receiverType =
    resolveEffectiveExpressionType(expr.callee.object, context) ??
    expr.callee.object.inferredType;
  const receiverElementType = resolveNativeArrayLikeElementType(
    receiverType,
    context
  );
  if (!receiverElementType) {
    return undefined;
  }

  const bindingType = binding.type;
  if (
    bindingType === "System.Array" ||
    bindingType === "global::System.Array" ||
    bindingType.startsWith("System.Array`") ||
    bindingType.startsWith("global::System.Array`")
  ) {
    return undefined;
  }

  const arityText = bindingType.match(/`(\d+)$/)?.[1];
  const genericArity = arityText ? Number.parseInt(arityText, 10) : 0;
  if (genericArity > 1) return undefined;

  let currentContext = context;
  const [receiverAst, receiverContext] = emitExpressionAst(
    expr.callee.object,
    currentContext
  );
  currentContext = receiverContext;

  let typeArguments: readonly CSharpTypeAst[] | undefined;
  if (genericArity === 1) {
    const [elementTypeAst, elementTypeContext] = emitArrayWrapperElementTypeAst(
      receiverType ?? {
        kind: "arrayType",
        elementType: receiverElementType,
        origin: "explicit",
      },
      currentContext
    );
    currentContext = elementTypeContext;
    typeArguments = [elementTypeAst];
  }

  const wrapperAst: CSharpExpressionAst = {
    kind: "objectCreationExpression",
    type: identifierType(
      `global::${stripClrGenericArity(bindingType)}`,
      typeArguments
    ),
    arguments: [receiverAst],
  };

  const [argAsts, argContext] = emitCallArguments(
    expr.arguments,
    expr,
    currentContext
  );
  currentContext = argContext;

  const invocation: CSharpExpressionAst = {
    kind: "invocationExpression",
    expression: {
      kind: "memberAccessExpression",
      expression: wrapperAst,
      memberName: binding.member,
    },
    arguments: argAsts,
  };

  const resultAst: CSharpExpressionAst =
    shouldNormalizeNativeArrayWrapperResult(expr, expectedType, currentContext)
      ? {
          kind: "invocationExpression",
          expression: {
            kind: "memberAccessExpression",
            expression: invocation,
            memberName: "toArray",
          },
          arguments: [],
        }
      : invocation;

  return [
    wrapIntCast(needsIntCast(expr, expr.callee.property), resultAst),
    currentContext,
  ];
};

const isTaskTypeAst = (typeAst: CSharpTypeAst): boolean =>
  getIdentifierTypeLeafName(typeAst) === "Task";

const containsVoidTypeAst = (typeAst: CSharpTypeAst): boolean => {
  if (typeAst.kind === "predefinedType" && typeAst.keyword === "void") {
    return true;
  }
  if (typeAst.kind === "identifierType") {
    if (typeAst.name === "void") {
      return true;
    }
    return (typeAst.typeArguments ?? []).some((t) => containsVoidTypeAst(t));
  }
  if (typeAst.kind === "qualifiedIdentifierType") {
    if (getIdentifierTypeLeafName(typeAst) === "void") {
      return true;
    }
    return (typeAst.typeArguments ?? []).some((t) => containsVoidTypeAst(t));
  }
  if (typeAst.kind === "arrayType") {
    return containsVoidTypeAst(typeAst.elementType);
  }
  if (typeAst.kind === "nullableType") {
    return containsVoidTypeAst(typeAst.underlyingType);
  }
  if (typeAst.kind === "pointerType") {
    return containsVoidTypeAst(typeAst.elementType);
  }
  if (typeAst.kind === "tupleType") {
    return typeAst.elements.some((e) => containsVoidTypeAst(e.type));
  }
  return false;
};

const getTaskResultType = (
  typeAst: CSharpTypeAst
): CSharpTypeAst | undefined => {
  if (!isTaskTypeAst(typeAst)) {
    return undefined;
  }
  if (
    typeAst.kind !== "identifierType" &&
    typeAst.kind !== "qualifiedIdentifierType"
  ) {
    return undefined;
  }
  return typeAst.typeArguments?.length === 1
    ? typeAst.typeArguments[0]
    : undefined;
};

const callbackParameterCount = (callbackExpr: IrExpression): number => {
  if (
    callbackExpr.kind === "arrowFunction" ||
    callbackExpr.kind === "functionExpression"
  ) {
    return callbackExpr.parameters.length;
  }
  const callbackType = callbackExpr.inferredType;
  if (callbackType?.kind === "functionType") {
    return callbackType.parameters.length;
  }
  return 1;
};

const collectBlockReturnTypes = (
  block: IrBlockStatement
): readonly IrType[] => {
  const collectFromStatement = (statement: IrStatement): readonly IrType[] => {
    switch (statement.kind) {
      case "returnStatement":
        return statement.expression?.inferredType
          ? [statement.expression.inferredType]
          : [];
      case "blockStatement":
        return statement.statements.flatMap(collectFromStatement);
      case "ifStatement":
        return [
          ...collectFromStatement(statement.thenStatement),
          ...(statement.elseStatement
            ? collectFromStatement(statement.elseStatement)
            : []),
        ];
      case "whileStatement":
      case "forStatement":
      case "forOfStatement":
      case "forInStatement":
        return collectFromStatement(statement.body);
      case "switchStatement":
        return statement.cases.flatMap((switchCase) =>
          switchCase.statements.flatMap(collectFromStatement)
        );
      case "tryStatement":
        return [
          ...statement.tryBlock.statements.flatMap(collectFromStatement),
          ...(statement.catchClause
            ? statement.catchClause.body.statements.flatMap(
                collectFromStatement
              )
            : []),
          ...(statement.finallyBlock
            ? statement.finallyBlock.statements.flatMap(collectFromStatement)
            : []),
        ];
      case "functionDeclaration":
      case "classDeclaration":
      case "interfaceDeclaration":
      case "enumDeclaration":
      case "typeAliasDeclaration":
        return [];
      default:
        return [];
    }
  };

  return block.statements.flatMap(collectFromStatement);
};

const getCallbackDelegateReturnType = (
  callbackExpr: IrExpression
): IrType | undefined => {
  if (
    (callbackExpr.kind === "arrowFunction" ||
      callbackExpr.kind === "functionExpression") &&
    callbackExpr.body.kind === "blockStatement"
  ) {
    const returnTypes = collectBlockReturnTypes(callbackExpr.body);
    const concreteReturnTypes = returnTypes.filter(
      (type): type is IrType => !isVoidOrUnknownIrType(type)
    );

    if (concreteReturnTypes.length === 0) {
      return undefined;
    }

    const deduped = concreteReturnTypes.filter(
      (type, index, all) =>
        all.findIndex(
          (candidate) => stableIrTypeKey(candidate) === stableIrTypeKey(type)
        ) === index
    );

    if (deduped.length === 1) {
      return deduped[0];
    }

    return {
      kind: "unionType",
      types: deduped,
    };
  }

  return getCallbackReturnType(callbackExpr);
};

const callbackReturnsAsyncWrapper = (callbackExpr: IrExpression): boolean => {
  const delegateReturnType = getCallbackDelegateReturnType(callbackExpr);
  return delegateReturnType ? isAsyncWrapperType(delegateReturnType) : false;
};

const buildInvocation = (
  expression: CSharpExpressionAst,
  args: readonly CSharpExpressionAst[]
): CSharpExpressionAst => ({
  kind: "invocationExpression",
  expression,
  arguments: args,
});

const buildAwait = (expression: CSharpExpressionAst): CSharpExpressionAst => ({
  kind: "awaitExpression",
  expression,
});

const buildDelegateType = (
  parameterTypes: readonly CSharpTypeAst[],
  returnType: CSharpTypeAst | undefined
): CSharpTypeAst => {
  const isVoidReturn =
    returnType?.kind === "predefinedType" && returnType.keyword === "void";
  if (returnType === undefined) {
    return parameterTypes.length === 0
      ? identifierType("global::System.Action")
      : identifierType("global::System.Action", parameterTypes);
  }
  if (isVoidReturn || getIdentifierTypeLeafName(returnType) === "void") {
    return parameterTypes.length === 0
      ? identifierType("global::System.Action")
      : identifierType("global::System.Action", parameterTypes);
  }

  return identifierType("global::System.Func", [...parameterTypes, returnType]);
};

const isVoidOrUnknownIrType = (type: IrType | undefined): boolean =>
  type === undefined ||
  type.kind === "voidType" ||
  type.kind === "unknownType" ||
  (type.kind === "primitiveType" && type.name === "undefined");

const getCallbackReturnType = (
  callbackExpr: IrExpression
): IrType | undefined => {
  if (
    callbackExpr.kind === "arrowFunction" &&
    callbackExpr.body.kind !== "blockStatement" &&
    !isVoidOrUnknownIrType(callbackExpr.body.inferredType)
  ) {
    return callbackExpr.body.inferredType;
  }

  const declared =
    callbackExpr.inferredType?.kind === "functionType"
      ? callbackExpr.inferredType.returnType
      : undefined;
  if (!isVoidOrUnknownIrType(declared)) {
    return declared;
  }

  if (
    callbackExpr.kind === "arrowFunction" &&
    callbackExpr.body.kind !== "blockStatement"
  ) {
    return callbackExpr.body.inferredType;
  }

  return undefined;
};

const getFunctionValueSignature = (
  expr: Extract<IrExpression, { kind: "call" }>
): Extract<IrType, { kind: "functionType" }> | undefined => {
  const calleeType = expr.callee.inferredType;
  if (!calleeType || calleeType.kind !== "functionType") return undefined;

  if (expr.callee.kind === "identifier" && expr.callee.resolvedClrType) {
    return undefined;
  }

  if (expr.callee.kind === "memberAccess" && expr.callee.memberBinding) {
    return undefined;
  }

  return calleeType;
};

const emitFunctionValueCallArguments = (
  args: readonly IrExpression[],
  signature: Extract<IrType, { kind: "functionType" }>,
  expr: Extract<IrExpression, { kind: "call" }>,
  context: EmitterContext
): [readonly CSharpExpressionAst[], EmitterContext] => {
  let currentContext = context;
  const argAsts: CSharpExpressionAst[] = [];
  const parameters = signature.parameters;

  const extractTupleRestCandidates = (
    type: IrType | undefined
  ): readonly (readonly IrType[])[] | undefined => {
    if (!type) return undefined;
    if (type.kind === "tupleType") {
      return [type.elementTypes];
    }
    if (type.kind !== "unionType") {
      return undefined;
    }
    const candidates: (readonly IrType[])[] = [];
    for (const member of type.types) {
      if (!member || member.kind !== "tupleType") {
        return undefined;
      }
      candidates.push(member.elementTypes);
    }
    return candidates;
  };

  const tryEmitTupleRestArguments = (
    startIndex: number,
    parameterType: IrType | undefined
  ): [readonly CSharpExpressionAst[], EmitterContext] | undefined => {
    const remainingArgs = args.slice(startIndex);
    if (remainingArgs.some((arg) => arg?.kind === "spread")) {
      return undefined;
    }

    const tupleCandidates = extractTupleRestCandidates(parameterType);
    if (!tupleCandidates || tupleCandidates.length === 0) {
      return undefined;
    }

    const matchingCandidates = tupleCandidates.filter(
      (candidate) => candidate.length === remainingArgs.length
    );
    if (matchingCandidates.length !== 1) {
      return undefined;
    }

    const tupleElements = matchingCandidates[0] ?? [];
    const emittedArgs: CSharpExpressionAst[] = [];
    let tupleContext = currentContext;

    for (let index = 0; index < remainingArgs.length; index++) {
      const arg = remainingArgs[index];
      const expectedType = tupleElements[index];
      if (!arg) continue;
      const [argAst, argContext] = emitExpressionAst(
        arg,
        tupleContext,
        expectedType
      );
      emittedArgs.push(argAst);
      tupleContext = argContext;
    }

    return [emittedArgs, tupleContext];
  };

  for (let i = 0; i < parameters.length; i++) {
    const parameter = parameters[i];
    if (!parameter) continue;

    if (parameter.isRest) {
      const tupleRestResult = tryEmitTupleRestArguments(i, parameter.type);
      if (tupleRestResult) {
        const [tupleArgs, tupleContext] = tupleRestResult;
        argAsts.push(...tupleArgs);
        currentContext = tupleContext;
        break;
      }

      const spreadArg = args[i];
      if (args.length === i + 1 && spreadArg && spreadArg.kind === "spread") {
        const [spreadAst, spreadCtx] = emitExpressionAst(
          spreadArg.expression,
          currentContext
        );
        argAsts.push(spreadAst);
        currentContext = spreadCtx;
        break;
      }

      const restElementType =
        getArrayLikeElementType(parameter.type, currentContext) ??
        parameter.type;
      let elementTypeAst: CSharpTypeAst = {
        kind: "predefinedType",
        keyword: "object",
      };
      if (restElementType) {
        const [emittedType, typeCtx] = emitTypeAst(
          restElementType,
          currentContext
        );
        elementTypeAst = emittedType;
        currentContext = typeCtx;
      }

      const restItems: CSharpExpressionAst[] = [];
      for (let j = i; j < args.length; j++) {
        const arg = args[j];
        if (!arg) continue;
        if (arg.kind === "spread") {
          const [spreadAst, spreadCtx] = emitExpressionAst(
            arg.expression,
            currentContext
          );
          argAsts.push(spreadAst);
          currentContext = spreadCtx;
          return [argAsts, currentContext];
        }
        const [argAst, argCtx] = emitExpressionAst(
          arg,
          currentContext,
          restElementType
        );
        restItems.push(argAst);
        currentContext = argCtx;
      }

      argAsts.push({
        kind: "arrayCreationExpression",
        elementType: elementTypeAst,
        initializer: restItems,
      });
      break;
    }

    const arg = args[i];
    if (arg) {
      const [argAst, argCtx] = emitExpressionAst(
        arg,
        currentContext,
        getAcceptedParameterType(parameter?.type, !!parameter?.isOptional)
      );
      const modifier =
        expr.argumentPassing?.[i] &&
        expr.argumentPassing[i] !== "value" &&
        isLValue(arg)
          ? expr.argumentPassing[i]
          : undefined;
      argAsts.push(wrapArgModifier(modifier, argAst));
      currentContext = argCtx;
      continue;
    }

    if (parameter.isOptional || parameter.initializer) {
      let defaultType: CSharpTypeAst | undefined;
      if (parameter.type) {
        const [emittedType, typeCtx] = emitTypeAst(
          parameter.type,
          currentContext
        );
        currentContext = typeCtx;
        defaultType =
          parameter.isOptional || parameter.initializer
            ? emittedType.kind === "nullableType"
              ? emittedType
              : { kind: "nullableType", underlyingType: emittedType }
            : emittedType;
      }
      argAsts.push({ kind: "defaultExpression", type: defaultType });
    }
  }

  return [argAsts, currentContext];
};

const isArrayLikeIrType = (type: IrType | undefined): boolean => {
  if (!type) return false;

  if (type.kind === "arrayType" || type.kind === "tupleType") {
    return true;
  }

  if (type.kind === "unionType") {
    return type.types.every((member) => isArrayLikeIrType(member));
  }

  if (type.kind !== "referenceType") {
    return false;
  }

  const simpleName = type.name.split(".").pop() ?? type.name;
  return (
    simpleName === "Array" ||
    simpleName === "ReadonlyArray" ||
    simpleName === "JSArray" ||
    simpleName === "Iterable" ||
    simpleName === "IterableIterator" ||
    simpleName === "IEnumerable" ||
    simpleName === "IReadOnlyList" ||
    simpleName === "List"
  );
};

const shouldNormalizeArrayLikeInteropResult = (
  actualType: IrType | undefined,
  expectedType: IrType | undefined
): boolean => isArrayLikeIrType(expectedType) || isArrayLikeIrType(actualType);

const shouldNormalizeNativeArrayWrapperResult = (
  expr: Extract<IrExpression, { kind: "call" }>,
  expectedType: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (shouldNormalizeArrayLikeInteropResult(expr.inferredType, expectedType)) {
    return true;
  }

  if (expr.callee.kind !== "memberAccess") {
    return false;
  }
  if (typeof expr.callee.property !== "string") {
    return false;
  }
  if (!nativeArrayReturningInteropMembers.has(expr.callee.property)) {
    return false;
  }

  const receiverType =
    resolveEffectiveExpressionType(expr.callee.object, context) ??
    expr.callee.object.inferredType;
  if (!hasDirectNativeArrayLikeInteropShape(receiverType)) {
    return false;
  }

  const binding = expr.callee.memberBinding;
  if (!binding || binding.isExtensionMethod) {
    return false;
  }

  return binding.kind === "method";
};

const isJsArrayObjectCreationAst = (
  expr: CSharpExpressionAst
): expr is Extract<CSharpExpressionAst, { kind: "objectCreationExpression" }> =>
  expr.kind === "objectCreationExpression" &&
  getIdentifierTypeLeafName(expr.type) === "JSArray";

const shouldNormalizeUnboundJsArrayWrapperResult = (
  expr: Extract<IrExpression, { kind: "call" }>,
  calleeAst: CSharpExpressionAst,
  expectedType: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!shouldNormalizeArrayLikeInteropResult(expr.inferredType, expectedType)) {
    return false;
  }
  if (expr.callee.kind !== "memberAccess") {
    return false;
  }
  if (typeof expr.callee.property !== "string") {
    return false;
  }
  if (!nativeArrayReturningInteropMembers.has(expr.callee.property)) {
    return false;
  }
  if (expr.callee.memberBinding) {
    return false;
  }

  const receiverType =
    resolveEffectiveExpressionType(expr.callee.object, context) ??
    expr.callee.object.inferredType;
  if (!hasDirectNativeArrayLikeInteropShape(receiverType)) {
    return false;
  }

  return (
    (calleeAst.kind === "memberAccessExpression" &&
      isJsArrayObjectCreationAst(calleeAst.expression)) ||
    (calleeAst.kind === "conditionalMemberAccessExpression" &&
      isJsArrayObjectCreationAst(calleeAst.expression))
  );
};

const emitFlattenedRestArguments = (
  restArgs: readonly IrExpression[],
  restElementType: IrType,
  context: EmitterContext
): [readonly CSharpExpressionAst[], EmitterContext] => {
  let currentContext = context;
  const [elementTypeAst, typeContext] = emitTypeAst(
    restElementType,
    currentContext
  );
  currentContext = typeContext;

  const segments: CSharpExpressionAst[] = [];
  let inlineElements: CSharpExpressionAst[] = [];

  const flushInlineElements = (): void => {
    if (inlineElements.length === 0) return;
    segments.push({
      kind: "arrayCreationExpression",
      elementType: elementTypeAst,
      initializer: inlineElements,
    });
    inlineElements = [];
  };

  for (const arg of restArgs) {
    if (!arg) continue;

    if (arg.kind === "spread") {
      flushInlineElements();
      const [spreadAst, spreadContext] = emitExpressionAst(
        arg.expression,
        currentContext
      );
      segments.push(spreadAst);
      currentContext = spreadContext;
      continue;
    }

    const [argAst, argContext] = emitExpressionAst(
      arg,
      currentContext,
      restElementType
    );
    inlineElements.push(argAst);
    currentContext = argContext;
  }

  flushInlineElements();

  if (segments.length === 0) {
    return [
      [
        {
          kind: "invocationExpression",
          expression: {
            ...identifierExpression("global::System.Array.Empty"),
          },
          typeArguments: [elementTypeAst],
          arguments: [],
        },
      ],
      currentContext,
    ];
  }

  const firstSegment = segments[0];
  if (!firstSegment) {
    return [
      [
        {
          kind: "arrayCreationExpression",
          elementType: elementTypeAst,
          initializer: [],
        },
      ],
      currentContext,
    ];
  }

  let concatAst = firstSegment;
  for (let index = 1; index < segments.length; index++) {
    const segment = segments[index];
    if (!segment) continue;
    concatAst = {
      kind: "invocationExpression",
      expression: {
        ...identifierExpression("global::System.Linq.Enumerable.Concat"),
      },
      arguments: [concatAst, segment],
    };
  }

  return [
    [
      {
        kind: "invocationExpression",
        expression: {
          ...identifierExpression("global::System.Linq.Enumerable.ToArray"),
        },
        arguments: [concatAst],
      },
    ],
    currentContext,
  ];
};

const isAsyncWrapperIrTypeLike = (type: IrType): boolean => {
  return isAwaitableIrType(type);
};

const containsPromiseChainArtifact = (type: IrType | undefined): boolean => {
  if (!type) return false;

  if (isAsyncWrapperIrTypeLike(type)) {
    return true;
  }

  if (type.kind === "unionType" || type.kind === "intersectionType") {
    return type.types.some(
      (member) => !!member && containsPromiseChainArtifact(member)
    );
  }

  return false;
};

const normalizePromiseChainResultIrType = (
  type: IrType | undefined
): IrType | undefined => {
  if (!type) return undefined;

  const awaited = getAwaitedIrType(type);
  if (awaited) {
    return awaited.kind === "voidType"
      ? awaited
      : normalizePromiseChainResultIrType(awaited);
  }

  if (type.kind === "unionType") {
    const normalizedTypes: IrType[] = [];
    const seen = new Set<string>();

    for (const member of type.types) {
      if (!member) continue;
      const normalized = normalizePromiseChainResultIrType(member);
      if (!normalized) continue;
      const key = stableIrTypeKey(normalized);
      if (seen.has(key)) continue;
      seen.add(key);
      normalizedTypes.push(normalized);
    }

    if (normalizedTypes.length === 0) return undefined;
    if (normalizedTypes.length === 1) return normalizedTypes[0];
    return normalizedUnionType(normalizedTypes);
  }

  return type;
};

const mergePromiseChainResultIrTypes = (
  ...types: readonly (IrType | undefined)[]
): IrType | undefined => {
  const merged: IrType[] = [];
  const seen = new Set<string>();

  for (const type of types) {
    const normalized = normalizePromiseChainResultIrType(type);
    if (!normalized) continue;

    if (normalized.kind === "unionType") {
      for (const member of normalized.types) {
        if (!member) continue;
        const key = stableIrTypeKey(member);
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(member);
      }
      continue;
    }

    const key = stableIrTypeKey(normalized);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(normalized);
  }

  if (merged.length === 0) return undefined;
  if (merged.length === 1) return merged[0];
  return normalizedUnionType(merged);
};

const buildTaskTypeAst = (
  resultType: CSharpTypeAst | undefined
): CSharpTypeAst =>
  resultType
    ? identifierType("global::System.Threading.Tasks.Task", [resultType])
    : identifierType("global::System.Threading.Tasks.Task");

const buildTaskRunInvocation = (
  outputTaskType: CSharpTypeAst,
  body: CSharpBlockStatementAst,
  isAsync: boolean
): CSharpExpressionAst => {
  const resultType = getTaskResultType(outputTaskType);
  return {
    kind: "invocationExpression",
    expression: {
      kind: "memberAccessExpression",
      expression: identifierExpression("global::System.Threading.Tasks.Task"),
      memberName: "Run",
    },
    arguments: [
      {
        kind: "lambdaExpression",
        isAsync,
        parameters: [],
        body,
      },
    ],
    typeArguments: resultType ? [resultType] : undefined,
  };
};

const buildCompletedTaskAst = (): CSharpExpressionAst => ({
  kind: "memberAccessExpression",
  expression: identifierExpression("global::System.Threading.Tasks.Task"),
  memberName: "CompletedTask",
});

const buildPromiseRejectedExceptionAst = (
  reasonAst: CSharpExpressionAst | undefined
): CSharpExpressionAst => {
  const reasonExpr = reasonAst ?? (nullLiteral() satisfies CSharpExpressionAst);

  return {
    kind: "binaryExpression",
    operatorToken: "??",
    left: {
      kind: "asExpression",
      expression: reasonExpr,
      type: identifierType("global::System.Exception"),
    },
    right: {
      kind: "objectCreationExpression",
      type: identifierType("global::System.Exception"),
      arguments: [
        {
          kind: "binaryExpression",
          operatorToken: "??",
          left: {
            kind: "invocationExpression",
            expression: {
              kind: "conditionalMemberAccessExpression",
              expression: reasonExpr,
              memberName: "ToString",
            },
            arguments: [],
          },
          right: {
            ...stringLiteral("Promise rejected"),
          },
        },
      ],
    },
  };
};

const getPromiseStaticMethod = (
  expr: Extract<IrExpression, { kind: "call" }>
): "resolve" | "reject" | "all" | "race" | undefined => {
  if (expr.callee.kind !== "memberAccess") return undefined;
  if (expr.callee.isComputed) return undefined;
  if (typeof expr.callee.property !== "string") return undefined;
  if (expr.callee.object.kind !== "identifier") return undefined;

  const objectName = expr.callee.object.originalName ?? expr.callee.object.name;
  const simpleObjectName = objectName.split(".").pop() ?? objectName;
  if (simpleObjectName !== "Promise") return undefined;

  switch (expr.callee.property) {
    case "resolve":
    case "reject":
    case "all":
    case "race":
      return expr.callee.property;
    default:
      return undefined;
  }
};

const getSequenceElementIrType = (
  type: IrType | undefined
): IrType | undefined => {
  if (!type) return undefined;

  if (type.kind === "arrayType") return type.elementType;
  if (type.kind === "tupleType") {
    if (type.elementTypes.length === 0) return undefined;
    if (type.elementTypes.length === 1) return type.elementTypes[0];
    return normalizedUnionType(type.elementTypes);
  }

  if (
    type.kind === "referenceType" &&
    type.typeArguments &&
    type.typeArguments.length > 0
  ) {
    const simpleName = type.name.split(".").pop() ?? type.name;
    switch (simpleName) {
      case "Array":
      case "ReadonlyArray":
      case "Iterable":
      case "IterableIterator":
      case "IEnumerable":
      case "IReadOnlyList":
      case "List":
      case "Set":
      case "ReadonlySet":
      case "JSArray":
        return type.typeArguments[0];
      default:
        return undefined;
    }
  }

  return undefined;
};

const isValueTaskLikeIrType = (type: IrType | undefined): boolean => {
  if (!type || type.kind !== "referenceType") return false;
  const simpleName = type.name.split(".").pop() ?? type.name;
  const clrName = type.resolvedClrType ?? type.name;
  return (
    simpleName === "ValueTask" ||
    simpleName === "ValueTask_1" ||
    simpleName === "ValueTask`1" ||
    clrName === "System.Threading.Tasks.ValueTask" ||
    clrName.startsWith("System.Threading.Tasks.ValueTask`1")
  );
};

const isRuntimeUnionTypeAst = (typeAst: CSharpTypeAst): boolean => {
  const name = getIdentifierTypeName(typeAst);
  return (
    name === "global::Tsonic.Runtime.Union" ||
    name === "Tsonic.Runtime.Union" ||
    name === "Union"
  );
};

const emitPromiseNormalizedTaskAst = (
  valueAst: CSharpExpressionAst,
  valueType: IrType | undefined,
  resultTypeAst: CSharpTypeAst | undefined,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  let currentContext = context;

  if (valueType && isAwaitableIrType(valueType)) {
    if (isValueTaskLikeIrType(valueType)) {
      return [
        {
          kind: "invocationExpression",
          expression: {
            kind: "memberAccessExpression",
            expression: valueAst,
            memberName: "AsTask",
          },
          arguments: [],
        },
        currentContext,
      ];
    }
    return [valueAst, currentContext];
  }

  if (valueType?.kind === "unionType") {
    const [emittedUnionTypeAst, emittedUnionTypeContext] = emitTypeAst(
      valueType,
      currentContext
    );
    currentContext = emittedUnionTypeContext;
    const concreteUnionTypeAst =
      emittedUnionTypeAst.kind === "nullableType"
        ? emittedUnionTypeAst.underlyingType
        : emittedUnionTypeAst;
    const [runtimeLayout, runtimeLayoutContext] = isRuntimeUnionTypeAst(
      concreteUnionTypeAst
    )
      ? buildRuntimeUnionLayout(valueType, currentContext, emitTypeAst)
      : [undefined, currentContext];
    currentContext = runtimeLayoutContext;

    const members = runtimeLayout?.members ?? valueType.types;
    const memberTypeAsts: CSharpTypeAst[] = runtimeLayout
      ? [...runtimeLayout.memberTypeAsts]
      : [];
    const arms: CSharpExpressionAst[] = [];
    for (let index = 0; index < members.length; index++) {
      const memberType = members[index];
      if (!memberType) continue;

      let memberTypeAst = memberTypeAsts[index];
      if (!memberTypeAst) {
        const [emittedMemberTypeAst, memberTypeContext] = emitTypeAst(
          memberType,
          currentContext
        );
        currentContext = memberTypeContext;
        memberTypeAst = emittedMemberTypeAst;
        memberTypeAsts[index] = emittedMemberTypeAst;
      }

      const memberName = `__tsonic_promise_value_${index}`;
      const [normalizedArm, normalizedContext] = emitPromiseNormalizedTaskAst(
        {
          kind: "identifierExpression",
          identifier: memberName,
        },
        memberType,
        resultTypeAst,
        currentContext
      );
      currentContext = normalizedContext;

      arms.push({
        kind: "lambdaExpression",
        isAsync: false,
        parameters: [
          {
            name: memberName,
            type:
              memberTypeAst ??
              ({
                kind: "predefinedType",
                keyword: "object",
              } satisfies CSharpTypeAst),
          },
        ],
        body: normalizedArm,
      });
    }

    return [
      {
        kind: "invocationExpression",
        expression: {
          kind: "memberAccessExpression",
          expression: valueAst,
          memberName: "Match",
        },
        arguments: arms,
      },
      currentContext,
    ];
  }

  if (!resultTypeAst) {
    return [buildCompletedTaskAst(), currentContext];
  }

  return [
    {
      kind: "invocationExpression",
      expression: {
        kind: "memberAccessExpression",
        expression: identifierExpression("global::System.Threading.Tasks.Task"),
        memberName: "FromResult",
      },
      typeArguments: [resultTypeAst],
      arguments: [valueAst],
    },
    currentContext,
  ];
};

const emitPromiseStaticCall = (
  expr: Extract<IrExpression, { kind: "call" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] | null => {
  const method = getPromiseStaticMethod(expr);
  if (!method) return null;

  let currentContext = context;
  const [outputTaskType, outputTaskContext] = emitTypeAst(
    expr.inferredType ?? {
      kind: "referenceType",
      name: "Promise",
      typeArguments: [{ kind: "referenceType", name: "object" }],
    },
    currentContext
  );
  currentContext = outputTaskContext;
  const outputResultType = getTaskResultType(outputTaskType);

  if (method === "resolve") {
    const argument = expr.arguments[0];
    if (!argument) {
      return [buildCompletedTaskAst(), currentContext];
    }

    const [valueAst, valueContext] = emitExpressionAst(
      argument,
      currentContext,
      argument.inferredType
    );
    currentContext = valueContext;
    const normalizedResultIrType = normalizePromiseChainResultIrType(
      argument.inferredType
    );
    let preferredResultTypeAst = outputResultType;
    if (normalizedResultIrType) {
      const [normalizedResultTypeAst, normalizedResultTypeContext] =
        emitTypeAst(normalizedResultIrType, currentContext);
      preferredResultTypeAst = normalizedResultTypeAst;
      currentContext = normalizedResultTypeContext;
    }
    return emitPromiseNormalizedTaskAst(
      valueAst,
      argument.inferredType,
      preferredResultTypeAst,
      currentContext
    );
  }

  if (method === "reject") {
    const reason = expr.arguments[0];
    let reasonAst: CSharpExpressionAst | undefined;
    if (reason) {
      [reasonAst, currentContext] = emitExpressionAst(
        reason,
        currentContext,
        reason.inferredType
      );
    }

    const exceptionAst = buildPromiseRejectedExceptionAst(reasonAst);
    return [
      {
        kind: "invocationExpression",
        expression: {
          kind: "memberAccessExpression",
          expression: identifierExpression(
            "global::System.Threading.Tasks.Task"
          ),
          memberName: "FromException",
        },
        typeArguments: outputResultType ? [outputResultType] : undefined,
        arguments: [exceptionAst],
      },
      currentContext,
    ];
  }

  const valuesArg = expr.arguments[0];
  if (!valuesArg) return null;

  const [valuesAst, valuesContext] = emitExpressionAst(
    valuesArg,
    currentContext,
    valuesArg.inferredType
  );
  currentContext = valuesContext;

  const inputElementType = getSequenceElementIrType(valuesArg.inferredType);
  const resultElementTypeAst =
    outputResultType?.kind === "arrayType"
      ? outputResultType.elementType
      : outputResultType;

  let normalizedValuesAst = valuesAst;
  if (inputElementType) {
    const [inputElementTypeAst, inputElementContext] = emitTypeAst(
      inputElementType,
      currentContext
    );
    currentContext = inputElementContext;

    const [normalizedTaskAst, normalizedTaskContext] =
      emitPromiseNormalizedTaskAst(
        {
          kind: "identifierExpression",
          identifier: "__tsonic_promise_item",
        },
        inputElementType,
        resultElementTypeAst,
        currentContext
      );
    currentContext = normalizedTaskContext;

    normalizedValuesAst = {
      kind: "invocationExpression",
      expression: identifierExpression("global::System.Linq.Enumerable.Select"),
      arguments: [
        valuesAst,
        {
          kind: "lambdaExpression",
          isAsync: false,
          parameters: [
            {
              name: "__tsonic_promise_item",
              type: inputElementTypeAst,
            },
          ],
          body: normalizedTaskAst,
        },
      ],
    };
  }

  if (method === "all") {
    return [
      {
        kind: "invocationExpression",
        expression: {
          kind: "memberAccessExpression",
          expression: identifierExpression(
            "global::System.Threading.Tasks.Task"
          ),
          memberName: "WhenAll",
        },
        arguments: [normalizedValuesAst],
      },
      currentContext,
    ];
  }

  const whenAnyAst: CSharpExpressionAst = {
    kind: "invocationExpression",
    expression: {
      kind: "memberAccessExpression",
      expression: identifierExpression("global::System.Threading.Tasks.Task"),
      memberName: "WhenAny",
    },
    arguments: [normalizedValuesAst],
  };

  if (!outputResultType) {
    return [
      buildTaskRunInvocation(
        outputTaskType,
        {
          kind: "blockStatement",
          statements: [
            {
              kind: "expressionStatement",
              expression: {
                kind: "awaitExpression",
                expression: {
                  kind: "awaitExpression",
                  expression: whenAnyAst,
                },
              },
            },
          ],
        },
        true
      ),
      currentContext,
    ];
  }

  return [
    buildTaskRunInvocation(
      outputTaskType,
      {
        kind: "blockStatement",
        statements: [
          {
            kind: "returnStatement",
            expression: {
              kind: "awaitExpression",
              expression: {
                kind: "awaitExpression",
                expression: whenAnyAst,
              },
            },
          },
        ],
      },
      true
    ),
    currentContext,
  ];
};

const getDynamicImportSpecifier = (
  expr: Extract<IrExpression, { kind: "call" }>
): string | undefined => {
  const [arg] = expr.arguments;
  if (!arg || arg.kind === "spread") return undefined;
  return arg.kind === "literal" && typeof arg.value === "string"
    ? arg.value
    : undefined;
};

const resolveDynamicImportTargetModule = (
  specifier: string,
  context: EmitterContext
): ModuleIdentity | undefined => {
  const currentFilePath = context.options.currentModuleFilePath;
  const moduleMap = context.options.moduleMap;
  if (!currentFilePath || !moduleMap) {
    return undefined;
  }

  const targetPath = resolveImportPath(currentFilePath, specifier);
  const direct = moduleMap.get(targetPath);
  if (direct) {
    return direct;
  }

  const normalizedTarget = targetPath.replace(/\\/g, "/");
  for (const [key, identity] of moduleMap.entries()) {
    const normalizedKey = key.replace(/\\/g, "/");
    if (
      normalizedKey === normalizedTarget ||
      normalizedKey.endsWith(`/${normalizedTarget}`) ||
      normalizedTarget.endsWith(`/${normalizedKey}`)
    ) {
      return identity;
    }
  }

  return undefined;
};

const buildDynamicImportContainerType = (
  targetModule: NonNullable<ReturnType<typeof resolveDynamicImportTargetModule>>
): CSharpTypeAst => {
  const containerName = targetModule.hasTypeCollision
    ? `${targetModule.className}__Module`
    : targetModule.className;

  return identifierType(`global::${targetModule.namespace}.${containerName}`);
};

const buildRunClassConstructorExpression = (
  containerType: CSharpTypeAst
): CSharpExpressionAst => ({
  kind: "invocationExpression",
  expression: {
    kind: "memberAccessExpression",
    expression: {
      ...identifierExpression(
        "global::System.Runtime.CompilerServices.RuntimeHelpers"
      ),
    },
    memberName: "RunClassConstructor",
  },
  arguments: [
    {
      kind: "memberAccessExpression",
      expression: {
        kind: "typeofExpression",
        type: containerType,
      },
      memberName: "TypeHandle",
    },
  ],
});

const emitDynamicImportCall = (
  expr: Extract<IrExpression, { kind: "call" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] | null => {
  if (expr.callee.kind !== "identifier" || expr.callee.name !== "import") {
    return null;
  }

  const specifier = getDynamicImportSpecifier(expr);
  if (!specifier) return null;

  const completedTaskExpr: CSharpExpressionAst = {
    kind: "memberAccessExpression",
    expression: identifierExpression("global::System.Threading.Tasks.Task"),
    memberName: "CompletedTask",
  };

  const targetModule = resolveDynamicImportTargetModule(specifier, context);

  if (!expr.dynamicImportNamespace) {
    if (!targetModule || !targetModule.hasRuntimeContainer) {
      return [completedTaskExpr, context];
    }

    const containerType = buildDynamicImportContainerType(targetModule);
    const runClassConstructor =
      buildRunClassConstructorExpression(containerType);

    return [
      {
        kind: "invocationExpression",
        expression: {
          kind: "memberAccessExpression",
          expression: identifierExpression(
            "global::System.Threading.Tasks.Task"
          ),
          memberName: "Run",
        },
        arguments: [
          {
            kind: "lambdaExpression",
            isAsync: false,
            parameters: [],
            body: runClassConstructor,
          },
        ],
      },
      context,
    ];
  }

  if (!targetModule) {
    throw new Error(
      `ICE: Closed-world dynamic import '${specifier}' was validated as a namespace import but no module identity was available during emission.`
    );
  }

  let currentContext = context;
  const [outputTaskType, outputTaskContext] = emitTypeAst(
    expr.inferredType ?? {
      kind: "referenceType",
      name: "Promise",
      typeArguments: [{ kind: "referenceType", name: "object" }],
    },
    currentContext
  );
  currentContext = outputTaskContext;

  const [namespaceAst, namespaceContext] =
    expr.dynamicImportNamespace.properties.length === 0
      ? [
          {
            kind: "objectCreationExpression" as const,
            type: { kind: "predefinedType" as const, keyword: "object" },
            arguments: [],
          } satisfies CSharpExpressionAst,
          currentContext,
        ]
      : emitExpressionAst(
          expr.dynamicImportNamespace,
          currentContext,
          expr.dynamicImportNamespace.inferredType
        );
  currentContext = namespaceContext;

  const setupStatements: CSharpStatementAst[] = [];
  if (targetModule.hasRuntimeContainer) {
    const containerType = buildDynamicImportContainerType(targetModule);
    setupStatements.push({
      kind: "expressionStatement",
      expression: buildRunClassConstructorExpression(containerType),
    });
  }

  return [
    buildTaskRunInvocation(
      outputTaskType,
      {
        kind: "blockStatement",
        statements: [
          ...setupStatements,
          {
            kind: "returnStatement",
            expression: namespaceAst,
          },
        ],
      },
      false
    ),
    currentContext,
  ];
};

const emitPromiseThenCatchFinally = (
  expr: Extract<IrExpression, { kind: "call" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] | null => {
  if (expr.callee.kind !== "memberAccess") return null;
  if (typeof expr.callee.property !== "string") return null;
  if (!isPromiseChainMethod(expr.callee.property)) return null;
  if (expr.callee.isOptional || expr.isOptional) return null;
  if (!isAsyncWrapperType(expr.callee.object.inferredType)) return null;

  let currentContext = context;
  const [receiverAst, receiverCtx] = emitExpressionAst(
    expr.callee.object,
    currentContext
  );
  currentContext = receiverCtx;

  const outputTypeHint =
    context.returnType && isAsyncWrapperType(context.returnType)
      ? context.returnType
      : expr.inferredType;
  const [rawOutputTaskType, outputTaskCtx] = emitTypeAst(
    outputTypeHint ?? { kind: "referenceType", name: "Task" },
    currentContext
  );
  currentContext = outputTaskCtx;
  const rawOutputTaskResultType = getTaskResultType(rawOutputTaskType);
  const defaultOutputTaskType: CSharpTypeAst =
    rawOutputTaskResultType && containsVoidTypeAst(rawOutputTaskResultType)
      ? identifierType("global::System.Threading.Tasks.Task")
      : rawOutputTaskType;

  const [sourceTaskType, sourceTaskCtx] = emitTypeAst(
    expr.callee.object.inferredType ?? { kind: "referenceType", name: "Task" },
    currentContext
  );
  currentContext = sourceTaskCtx;

  const sourceResultType = getTaskResultType(sourceTaskType);
  const sourceResultIr = normalizePromiseChainResultIrType(
    expr.callee.object.inferredType
  );
  const exIdent = "__tsonic_promise_ex";
  const valueIdent = "__tsonic_promise_value";

  const fulfilledArg = expr.arguments[0];
  const rejectedArg =
    expr.callee.property === "then" ? expr.arguments[1] : expr.arguments[0];
  const finallyArg =
    expr.callee.property === "finally" ? expr.arguments[0] : undefined;

  let fulfilledAst: CSharpExpressionAst | undefined;
  let rejectedAst: CSharpExpressionAst | undefined;
  let finallyAst: CSharpExpressionAst | undefined;

  if (fulfilledArg && fulfilledArg.kind !== "spread") {
    const [fAst, fCtx] = emitExpressionAst(fulfilledArg, currentContext);
    fulfilledAst = fAst;
    currentContext = fCtx;
  }
  if (rejectedArg && rejectedArg.kind !== "spread") {
    const [rAst, rCtx] = emitExpressionAst(rejectedArg, currentContext);
    rejectedAst = rAst;
    currentContext = rCtx;
  }
  if (finallyArg && finallyArg.kind !== "spread") {
    const [fiAst, fiCtx] = emitExpressionAst(finallyArg, currentContext);
    finallyAst = fiAst;
    currentContext = fiCtx;
  }

  const fulfilledResultIr =
    fulfilledArg && fulfilledArg.kind !== "spread"
      ? normalizePromiseChainResultIrType(
          getCallbackReturnType(fulfilledArg as IrExpression)
        )
      : undefined;
  const rejectedResultIr =
    rejectedArg && rejectedArg.kind !== "spread"
      ? normalizePromiseChainResultIrType(
          getCallbackReturnType(rejectedArg as IrExpression)
        )
      : undefined;
  const normalizedPromiseChainResultIr = (() => {
    if (expr.callee.property === "then") {
      if (rejectedArg && rejectedArg.kind !== "spread") {
        return mergePromiseChainResultIrTypes(
          fulfilledResultIr ?? sourceResultIr,
          rejectedResultIr
        );
      }
      return fulfilledResultIr ?? sourceResultIr;
    }
    if (expr.callee.property === "catch") {
      return mergePromiseChainResultIrTypes(sourceResultIr, rejectedResultIr);
    }
    if (expr.callee.property === "finally") {
      return sourceResultIr;
    }
    return undefined;
  })();
  const normalizedFrontendPromiseChainResultIr =
    normalizePromiseChainResultIrType(expr.inferredType);
  const preferredPromiseChainResultIr =
    normalizedFrontendPromiseChainResultIr &&
    !containsPromiseChainArtifact(normalizedFrontendPromiseChainResultIr)
      ? normalizedFrontendPromiseChainResultIr
      : normalizedPromiseChainResultIr;

  let outputResultType = getTaskResultType(defaultOutputTaskType);
  let outputTaskType = defaultOutputTaskType;
  if (preferredPromiseChainResultIr) {
    const [normalizedResultAst, normalizedCtx] = emitTypeAst(
      preferredPromiseChainResultIr,
      currentContext
    );
    currentContext = normalizedCtx;
    outputResultType = containsVoidTypeAst(normalizedResultAst)
      ? undefined
      : normalizedResultAst;
    outputTaskType = buildTaskTypeAst(outputResultType);
  }

  const awaitReceiverStatement =
    sourceResultType === undefined
      ? ({
          kind: "expressionStatement",
          expression: buildAwait(receiverAst),
        } as const satisfies CSharpStatementAst)
      : ({
          kind: "localDeclarationStatement",
          modifiers: [],
          type: { kind: "varType" },
          declarators: [
            {
              name: valueIdent,
              initializer: buildAwait(receiverAst),
            },
          ],
        } as const satisfies CSharpStatementAst);

  const invokeFulfilled = (): readonly CSharpStatementAst[] => {
    if (!fulfilledAst) {
      if (sourceResultType === undefined) return [];
      return [
        {
          kind: "returnStatement",
          expression: {
            kind: "identifierExpression",
            identifier: valueIdent,
          },
        },
      ];
    }

    const fulfilledArgs: CSharpExpressionAst[] = [];
    if (
      sourceResultType !== undefined &&
      callbackParameterCount(fulfilledArg as IrExpression) > 0
    ) {
      fulfilledArgs.push({
        kind: "identifierExpression",
        identifier: valueIdent,
      });
    }

    const delegateParamTypes: CSharpTypeAst[] =
      sourceResultType !== undefined &&
      callbackParameterCount(fulfilledArg as IrExpression) > 0
        ? [sourceResultType]
        : [];
    const callbackReturnIr = getCallbackDelegateReturnType(
      fulfilledArg as IrExpression
    );
    let callbackReturnTypeAst: CSharpTypeAst | undefined = outputResultType;
    if (callbackReturnIr !== undefined) {
      const [cbRetAst, cbRetCtx] = emitTypeAst(
        callbackReturnIr,
        currentContext
      );
      callbackReturnTypeAst =
        (cbRetAst.kind === "predefinedType" && cbRetAst.keyword === "void") ||
        (cbRetAst.kind === "identifierType" && cbRetAst.name === "void")
          ? undefined
          : cbRetAst;
      currentContext = cbRetCtx;
    }
    if (outputResultType !== undefined && callbackReturnTypeAst === undefined) {
      callbackReturnTypeAst = outputResultType;
    }
    if (
      callbackReturnTypeAst === undefined &&
      fulfilledArg?.kind === "arrowFunction" &&
      fulfilledArg.body.kind !== "blockStatement"
    ) {
      callbackReturnTypeAst = { kind: "predefinedType", keyword: "object" };
    }
    const callbackCallee =
      fulfilledAst.kind === "lambdaExpression"
        ? ({
            kind: "castExpression",
            type: buildDelegateType(delegateParamTypes, callbackReturnTypeAst),
            expression: fulfilledAst,
          } as const satisfies CSharpExpressionAst)
        : fulfilledAst;
    const callbackCall =
      callbackCallee.kind === "castExpression"
        ? buildInvocation(
            {
              kind: "memberAccessExpression",
              expression: callbackCallee,
              memberName: "Invoke",
            },
            fulfilledArgs
          )
        : buildInvocation(callbackCallee, fulfilledArgs);
    const callbackExpr = callbackReturnsAsyncWrapper(
      fulfilledArg as IrExpression
    )
      ? buildAwait(callbackCall)
      : callbackCall;

    if (outputResultType === undefined) {
      return [{ kind: "expressionStatement", expression: callbackExpr }];
    }

    return [{ kind: "returnStatement", expression: callbackExpr }];
  };

  const invokeRejected = (): readonly CSharpStatementAst[] => {
    if (!rejectedAst) {
      return [{ kind: "throwStatement" }];
    }

    const rejectedArgs: CSharpExpressionAst[] = [];
    if (callbackParameterCount(rejectedArg as IrExpression) > 0) {
      rejectedArgs.push({
        kind: "identifierExpression",
        identifier: exIdent,
      });
    }
    const callbackReturnIr = getCallbackDelegateReturnType(
      rejectedArg as IrExpression
    );
    let callbackReturnTypeAst: CSharpTypeAst | undefined = outputResultType;
    if (callbackReturnIr !== undefined) {
      const [cbRetAst, cbRetCtx] = emitTypeAst(
        callbackReturnIr,
        currentContext
      );
      callbackReturnTypeAst =
        (cbRetAst.kind === "predefinedType" && cbRetAst.keyword === "void") ||
        (cbRetAst.kind === "identifierType" && cbRetAst.name === "void")
          ? undefined
          : cbRetAst;
      currentContext = cbRetCtx;
    }
    if (outputResultType !== undefined && callbackReturnTypeAst === undefined) {
      callbackReturnTypeAst = outputResultType;
    }
    if (
      callbackReturnTypeAst === undefined &&
      rejectedArg?.kind === "arrowFunction" &&
      rejectedArg.body.kind !== "blockStatement"
    ) {
      callbackReturnTypeAst = { kind: "predefinedType", keyword: "object" };
    }
    const callbackCallee =
      rejectedAst.kind === "lambdaExpression"
        ? ({
            kind: "castExpression",
            type: buildDelegateType(
              [identifierType("global::System.Exception")],
              callbackReturnTypeAst
            ),
            expression: rejectedAst,
          } as const satisfies CSharpExpressionAst)
        : rejectedAst;
    const callbackCall =
      callbackCallee.kind === "castExpression"
        ? buildInvocation(
            {
              kind: "memberAccessExpression",
              expression: callbackCallee,
              memberName: "Invoke",
            },
            rejectedArgs
          )
        : buildInvocation(callbackCallee, rejectedArgs);
    const callbackExpr = callbackReturnsAsyncWrapper(
      rejectedArg as IrExpression
    )
      ? buildAwait(callbackCall)
      : callbackCall;

    if (outputResultType === undefined) {
      return [{ kind: "expressionStatement", expression: callbackExpr }];
    }

    return [{ kind: "returnStatement", expression: callbackExpr }];
  };

  const invokeFinally = (): readonly CSharpStatementAst[] => {
    if (!finallyAst) return [];
    const callbackReturnIr = getCallbackDelegateReturnType(
      finallyArg as IrExpression
    );
    let callbackReturnTypeAst: CSharpTypeAst | undefined = undefined;
    if (callbackReturnIr !== undefined) {
      const [cbRetAst, cbRetCtx] = emitTypeAst(
        callbackReturnIr,
        currentContext
      );
      callbackReturnTypeAst = cbRetAst;
      currentContext = cbRetCtx;
    }
    if (
      callbackReturnTypeAst === undefined &&
      finallyArg?.kind === "arrowFunction" &&
      finallyArg.body.kind !== "blockStatement"
    ) {
      callbackReturnTypeAst = { kind: "predefinedType", keyword: "object" };
    }
    const callbackCallee =
      finallyAst.kind === "lambdaExpression"
        ? ({
            kind: "castExpression",
            type: buildDelegateType([], callbackReturnTypeAst),
            expression: finallyAst,
          } as const satisfies CSharpExpressionAst)
        : finallyAst;
    const callbackCall =
      callbackCallee.kind === "castExpression"
        ? buildInvocation(
            {
              kind: "memberAccessExpression",
              expression: callbackCallee,
              memberName: "Invoke",
            },
            []
          )
        : buildInvocation(callbackCallee, []);
    const callbackExpr = callbackReturnsAsyncWrapper(finallyArg as IrExpression)
      ? buildAwait(callbackCall)
      : callbackCall;
    return [{ kind: "expressionStatement", expression: callbackExpr }];
  };

  if (expr.callee.property === "then") {
    const thenStatements: CSharpStatementAst[] = [
      awaitReceiverStatement,
      ...invokeFulfilled(),
    ];
    const bodyStatements: CSharpStatementAst[] = rejectedAst
      ? [
          {
            kind: "tryStatement",
            body: { kind: "blockStatement", statements: thenStatements },
            catches: [
              {
                type: identifierType("global::System.Exception"),
                identifier: exIdent,
                body: {
                  kind: "blockStatement",
                  statements: invokeRejected(),
                },
              },
            ],
          },
        ]
      : thenStatements;
    return [
      buildTaskRunInvocation(
        outputTaskType,
        {
          kind: "blockStatement",
          statements: bodyStatements,
        },
        true
      ),
      currentContext,
    ];
  }

  if (expr.callee.property === "catch") {
    const successPath: readonly CSharpStatementAst[] =
      sourceResultType === undefined
        ? [{ kind: "expressionStatement", expression: buildAwait(receiverAst) }]
        : [
            {
              kind: "returnStatement",
              expression: buildAwait(receiverAst),
            },
          ];
    const catches: readonly CSharpCatchClauseAst[] = [
      {
        type: identifierType("global::System.Exception"),
        identifier: exIdent,
        body: {
          kind: "blockStatement",
          statements: invokeRejected(),
        },
      },
    ];
    return [
      buildTaskRunInvocation(
        outputTaskType,
        {
          kind: "blockStatement",
          statements: [
            {
              kind: "tryStatement",
              body: { kind: "blockStatement", statements: successPath },
              catches,
            },
          ],
        },
        true
      ),
      currentContext,
    ];
  }

  if (expr.callee.property === "finally") {
    const tryStatements: readonly CSharpStatementAst[] =
      sourceResultType === undefined
        ? [{ kind: "expressionStatement", expression: buildAwait(receiverAst) }]
        : [{ kind: "returnStatement", expression: buildAwait(receiverAst) }];
    return [
      buildTaskRunInvocation(
        outputTaskType,
        {
          kind: "blockStatement",
          statements: [
            {
              kind: "tryStatement",
              body: { kind: "blockStatement", statements: tryStatements },
              catches: [],
              finallyBody: {
                kind: "blockStatement",
                statements: invokeFinally(),
              },
            },
          ],
        },
        true
      ),
      currentContext,
    ];
  }

  return null;
};

/**
 * Emit call arguments as typed AST array.
 * Handles spread arrays, castModifier (ref/out from cast), and argumentPassing modes.
 */
const emitCallArguments = (
  args: readonly IrExpression[],
  expr: Extract<IrExpression, { kind: "call" }>,
  context: EmitterContext,
  parameterTypeOverrides?: readonly (IrType | undefined)[]
): [readonly CSharpExpressionAst[], EmitterContext] => {
  const functionValueSignature = getFunctionValueSignature(expr);
  const valueSymbolSignature =
    expr.callee.kind === "identifier"
      ? context.valueSymbols?.get(expr.callee.name)?.type
      : undefined;
  if (
    functionValueSignature &&
    functionValueSignature.parameters.some(
      (parameter) =>
        parameter?.isRest ||
        parameter?.isOptional ||
        parameter?.initializer !== undefined
    )
  ) {
    return emitFunctionValueCallArguments(
      args,
      functionValueSignature,
      expr,
      context
    );
  }

  const parameterTypes =
    parameterTypeOverrides && parameterTypeOverrides.length > 0
      ? parameterTypeOverrides
      : expr.parameterTypes && expr.parameterTypes.length > 0
        ? expr.parameterTypes
        : ((
            functionValueSignature?.parameters ??
            valueSymbolSignature?.parameters
          )?.map((parameter) => parameter?.type) ?? []);
  const normalizedArgs = expandTupleLikeSpreadArguments(args);
  const restInfo:
    | {
        readonly index: number;
        readonly arrayType: IrType;
        readonly elementType: IrType;
      }
    | undefined =
    expr.restParameter?.arrayType &&
    expr.restParameter.elementType &&
    normalizedArgs
      .slice(expr.restParameter.index)
      .some((candidate) => candidate?.kind === "spread")
      ? {
          index: expr.restParameter.index,
          arrayType: expr.restParameter.arrayType,
          elementType: expr.restParameter.elementType,
        }
      : undefined;
  let currentContext = context;
  const argAsts: CSharpExpressionAst[] = [];

  for (let i = 0; i < normalizedArgs.length; i++) {
    const arg = normalizedArgs[i];
    if (!arg) continue;

    if (
      restInfo &&
      i === restInfo.index &&
      normalizedArgs
        .slice(restInfo.index)
        .some((candidate) => candidate?.kind === "spread")
    ) {
      const [flattenedRestArgs, flattenedContext] = emitFlattenedRestArguments(
        normalizedArgs.slice(restInfo.index),
        restInfo.elementType,
        currentContext
      );
      argAsts.push(...flattenedRestArgs);
      currentContext = flattenedContext;
      break;
    }

    const expectedType =
      restInfo && i >= restInfo.index
        ? restInfo.elementType
        : parameterTypes[i];

    if (arg.kind === "spread") {
      const [spreadAst, ctx] = emitExpressionAst(
        arg.expression,
        currentContext
      );
      argAsts.push(spreadAst);
      currentContext = ctx;
    } else {
      const castModifier = getPassingModifierFromCast(arg);
      if (castModifier && isLValue(arg)) {
        const [argAst, ctx] = emitExpressionAst(arg, currentContext);
        argAsts.push(wrapArgModifier(castModifier, argAst));
        currentContext = ctx;
      } else {
        const [argAst, ctx] = emitExpressionAst(
          arg,
          currentContext,
          expectedType
        );
        const passingMode = expr.argumentPassing?.[i];
        const modifier =
          passingMode && passingMode !== "value" && isLValue(arg)
            ? passingMode
            : undefined;
        argAsts.push(wrapArgModifier(modifier, argAst));
        currentContext = ctx;
      }
    }
  }

  return [argAsts, currentContext];
};

const getRuntimeObjectHelperParameterOverrides = (
  expr: Extract<IrExpression, { kind: "call" }>,
  argCount: number
): readonly (IrType | undefined)[] | undefined => {
  if (
    expr.callee.kind !== "memberAccess" ||
    expr.callee.isComputed ||
    expr.callee.object.kind !== "identifier" ||
    expr.callee.object.name !== "Object" ||
    (expr.callee.property !== "entries" &&
      expr.callee.property !== "keys" &&
      expr.callee.property !== "values")
  ) {
    return undefined;
  }

  if (argCount === 0) {
    return undefined;
  }

  const overrides: (IrType | undefined)[] = Array.from(
    { length: argCount },
    () => undefined
  );
  overrides[0] = { kind: "unknownType" } as IrType;
  return overrides;
};

/**
 * Emit a JsonSerializer call with NativeAOT-compatible options.
 */
const isConcreteGlobalJsonParseTarget = (
  type: IrType | undefined
): type is IrType => {
  if (!type) return false;
  if (
    type.kind === "unknownType" ||
    type.kind === "anyType" ||
    type.kind === "voidType" ||
    type.kind === "neverType"
  ) {
    return false;
  }
  if (type.kind === "unionType" || type.kind === "intersectionType") {
    return false;
  }
  return !containsTypeParameter(type);
};

const emitJsRuntimeJsonParseCall = (
  expr: Extract<IrExpression, { kind: "call" }>,
  context: EmitterContext,
  typeArgument: CSharpTypeAst
): [CSharpExpressionAst, EmitterContext] => {
  let currentContext = context;
  const argAsts: CSharpExpressionAst[] = [];

  for (const arg of expr.arguments) {
    if (arg.kind === "spread") {
      const [spreadAst, ctx] = emitExpressionAst(
        arg.expression,
        currentContext
      );
      argAsts.push(spreadAst);
      currentContext = ctx;
      continue;
    }

    const [argAst, ctx] = emitExpressionAst(arg, currentContext);
    argAsts.push(argAst);
    currentContext = ctx;
  }

  return [
    {
      kind: "invocationExpression",
      expression: {
        kind: "memberAccessExpression",
        expression: identifierExpression("global::Tsonic.JSRuntime.JSON"),
        memberName: "parse",
      },
      arguments: argAsts,
      typeArguments: [typeArgument],
    },
    currentContext,
  ];
};

const emitJsonSerializerCall = (
  expr: Extract<IrExpression, { kind: "call" }>,
  context: EmitterContext,
  method: "Serialize" | "Deserialize",
  deserializeTypeOverride?: IrType
): [CSharpExpressionAst, EmitterContext] => {
  let currentContext = context;

  // Register the type with the JSON AOT registry
  if (method === "Serialize") {
    const firstArg = expr.arguments[0];
    if (firstArg && firstArg.kind !== "spread") {
      registerJsonAotExpressionTypes(firstArg, context);
    }
  } else {
    const typeArg = deserializeTypeOverride ?? expr.typeArguments?.[0];
    if (typeArg) {
      registerJsonAotType(typeArg, context);
    }
  }

  // Emit type arguments for Deserialize<T>
  let typeArgAsts: readonly CSharpTypeAst[] = [];
  const deserializeIrType =
    method === "Deserialize"
      ? (deserializeTypeOverride ?? expr.typeArguments?.[0])
      : undefined;
  if (deserializeIrType) {
    const [typeArgs, typeContext] = emitTypeArgumentsAst(
      [deserializeIrType],
      currentContext
    );
    typeArgAsts = typeArgs;
    currentContext = typeContext;
  } else if (expr.typeArguments && expr.typeArguments.length > 0) {
    const [typeArgs, typeContext] = emitTypeArgumentsAst(
      expr.typeArguments,
      currentContext
    );
    typeArgAsts = typeArgs;
    currentContext = typeContext;
  }

  // Emit arguments
  const argAsts: CSharpExpressionAst[] = [];
  for (const arg of expr.arguments) {
    if (arg.kind === "spread") {
      const [spreadAst, ctx] = emitExpressionAst(
        arg.expression,
        currentContext
      );
      argAsts.push(spreadAst);
      currentContext = ctx;
    } else {
      const [argAst, ctx] = emitExpressionAst(arg, currentContext);
      argAsts.push(argAst);
      currentContext = ctx;
    }
  }

  // Only pass TsonicJson.Options when this call site actually participates in the
  // NativeAOT JSON rewrite. Non-generic JSON.parse(...) intentionally returns
  // unknown and should emit plain JsonSerializer calls without requiring the
  // generated TsonicJson helper.
  if (context.options.jsonAotRegistry?.needsJsonAot) {
    argAsts.push(identifierExpression("TsonicJson.Options"));
  }

  const invocation: CSharpExpressionAst = {
    kind: "invocationExpression",
    expression: {
      kind: "memberAccessExpression",
      expression: identifierExpression(
        "global::System.Text.Json.JsonSerializer"
      ),
      memberName: method,
    },
    arguments: argAsts,
    typeArguments: typeArgAsts.length > 0 ? typeArgAsts : undefined,
  };
  return [invocation, currentContext];
};

const emitGlobalJsonCall = (
  expr: Extract<IrExpression, { kind: "call" }>,
  context: EmitterContext,
  method: "Serialize" | "Deserialize"
): [CSharpExpressionAst, EmitterContext] => {
  if (method === "Serialize") {
    return emitJsonSerializerCall(expr, context, method);
  }

  const deserializeTarget =
    expr.typeArguments?.[0] ??
    (isConcreteGlobalJsonParseTarget(expr.inferredType)
      ? expr.inferredType
      : undefined);

  if (deserializeTarget) {
    return emitJsonSerializerCall(
      expr,
      context,
      "Deserialize",
      deserializeTarget
    );
  }

  return emitJsRuntimeJsonParseCall(expr, context, {
    kind: "predefinedType",
    keyword: "object",
  });
};

const extractTransparentIdentifier = (
  expr: IrExpression
): Extract<IrExpression, { kind: "identifier" }> | undefined => {
  let current: IrExpression = expr;

  while (
    current.kind === "typeAssertion" ||
    current.kind === "numericNarrowing"
  ) {
    current = current.expression;
  }

  return current.kind === "identifier" ? current : undefined;
};

/**
 * Emit a function call expression as CSharpExpressionAst
 */
export const emitCall = (
  expr: Extract<IrExpression, { kind: "call" }>,
  context: EmitterContext,
  expectedType?: IrType
): [CSharpExpressionAst, EmitterContext] => {
  const dynamicImport = emitDynamicImportCall(expr, context);
  if (dynamicImport) return dynamicImport;

  const promiseStaticCall = emitPromiseStaticCall(expr, context);
  if (promiseStaticCall) return promiseStaticCall;

  const promiseChain = emitPromiseThenCatchFinally(expr, context);
  if (promiseChain) return promiseChain;

  // Void promise resolve: emit as zero-arg call when safe.
  const transparentCalleeIdentifier = extractTransparentIdentifier(expr.callee);
  if (
    transparentCalleeIdentifier &&
    context.voidResolveNames?.has(transparentCalleeIdentifier.name)
  ) {
    const isZeroArg = expr.arguments.length === 0;
    const isSingleUndefined =
      expr.arguments.length === 1 &&
      expr.arguments[0]?.kind === "identifier" &&
      expr.arguments[0].name === "undefined";

    if (isZeroArg || isSingleUndefined) {
      const [calleeAst, calleeCtx] = emitExpressionAst(
        transparentCalleeIdentifier,
        context
      );
      return [
        {
          kind: "invocationExpression",
          expression: calleeAst,
          arguments: [],
        },
        calleeCtx,
      ];
    }
  }

  // Check for JsonSerializer calls (NativeAOT support)
  const jsonCall = isJsonSerializerCall(expr.callee);
  if (jsonCall) {
    return emitJsonSerializerCall(expr, context, jsonCall.method);
  }

  // Check for global JSON.stringify/parse calls
  const globalJsonCall = isGlobalJsonCall(expr.callee);
  if (globalJsonCall) {
    return emitGlobalJsonCall(expr, context, globalJsonCall.method);
  }

  // EF Core query canonicalization: ToList().ToArray() → ToArray()
  if (
    expr.callee.kind === "memberAccess" &&
    expr.callee.property === "ToArray" &&
    expr.arguments.length === 0 &&
    expr.callee.object.kind === "call"
  ) {
    const innerCall = expr.callee.object;

    if (
      innerCall.callee.kind === "memberAccess" &&
      innerCall.callee.memberBinding?.isExtensionMethod &&
      isInstanceMemberAccess(innerCall.callee, context) &&
      innerCall.callee.memberBinding.type.startsWith(
        "System.Linq.Enumerable"
      ) &&
      innerCall.callee.memberBinding.member === "ToList" &&
      innerCall.arguments.length === 0
    ) {
      let currentContext = context;

      currentContext.usings.add("System.Linq");

      const receiverExpr = innerCall.callee.object;
      const [receiverAst, receiverCtx] = emitExpressionAst(
        receiverExpr,
        currentContext
      );
      currentContext = receiverCtx;

      return [
        {
          kind: "invocationExpression",
          expression: {
            kind: "memberAccessExpression",
            expression: receiverAst,
            memberName: "ToArray",
          },
          arguments: [],
        },
        currentContext,
      ];
    }
  }

  // Extension method lowering: emit explicit static invocation with receiver as first arg.
  if (
    expr.callee.kind === "memberAccess" &&
    expr.callee.memberBinding?.isExtensionMethod &&
    isInstanceMemberAccess(expr.callee, context) &&
    !shouldPreferNativeArrayWrapperInterop(
      expr.callee.memberBinding,
      expr.callee.object.inferredType,
      context
    )
  ) {
    let currentContext = context;

    const binding = expr.callee.memberBinding;
    const receiverExpr = expr.callee.object;

    const [rawReceiverAst, receiverContext] = emitExpressionAst(
      receiverExpr,
      currentContext
    );
    const [receiverAst, preservedReceiverContext] =
      preserveReceiverTypeAssertionAst(
        receiverExpr,
        rawReceiverAst,
        receiverContext
      );
    currentContext = preservedReceiverContext;

    // Fluent extension method path
    if (shouldEmitFluentExtensionCall(binding)) {
      const ns = getTypeNamespace(binding.type);
      if (ns) {
        currentContext.usings.add(ns);
      }

      let typeArgAsts: readonly CSharpTypeAst[] = [];
      if (expr.typeArguments && expr.typeArguments.length > 0) {
        const [typeArgs, typeContext] = emitTypeArgumentsAst(
          expr.typeArguments,
          currentContext
        );
        typeArgAsts = typeArgs;
        currentContext = typeContext;
      }

      const [argAsts, argContext] = emitCallArguments(
        expr.arguments,
        expr,
        currentContext
      );
      currentContext = argContext;

      const memberAccess: CSharpExpressionAst = expr.isOptional
        ? {
            kind: "conditionalMemberAccessExpression",
            expression: receiverAst,
            memberName: binding.member,
          }
        : {
            kind: "memberAccessExpression",
            expression: receiverAst,
            memberName: binding.member,
          };

      const invocation: CSharpExpressionAst = {
        kind: "invocationExpression",
        expression: memberAccess,
        arguments: argAsts,
        typeArguments: typeArgAsts.length > 0 ? typeArgAsts : undefined,
      };

      const callAst: CSharpExpressionAst =
        shouldNormalizeArrayLikeInteropResult(expr.inferredType, expectedType)
          ? {
              kind: "invocationExpression",
              expression: identifierExpression(
                "global::System.Linq.Enumerable.ToArray"
              ),
              arguments: [invocation],
            }
          : invocation;

      return [
        wrapIntCast(needsIntCast(expr, binding.member), callAst),
        currentContext,
      ];
    }

    let finalCalleeName = `global::${binding.type}.${binding.member}`;

    let typeArgAsts: readonly CSharpTypeAst[] = [];
    if (expr.typeArguments && expr.typeArguments.length > 0) {
      if (expr.requiresSpecialization) {
        const [specializedName, specContext] = generateSpecializedName(
          finalCalleeName,
          expr.typeArguments,
          currentContext
        );
        finalCalleeName = specializedName;
        currentContext = specContext;
      } else {
        const [typeArgs, typeContext] = emitTypeArgumentsAst(
          expr.typeArguments,
          currentContext
        );
        typeArgAsts = typeArgs;
        currentContext = typeContext;
      }
    }

    const [argAsts, argContext] = emitCallArguments(
      expr.arguments,
      expr,
      currentContext
    );
    currentContext = argContext;

    // Prepend receiver as first argument (static extension call)
    const allArgAsts: readonly CSharpExpressionAst[] = [
      receiverAst,
      ...argAsts,
    ];

    const invocation: CSharpExpressionAst = {
      kind: "invocationExpression",
      expression: identifierExpression(finalCalleeName),
      arguments: allArgAsts,
      typeArguments: typeArgAsts.length > 0 ? typeArgAsts : undefined,
    };

    // Wrap in ToArray() if result type is array
    const callAst: CSharpExpressionAst = shouldNormalizeArrayLikeInteropResult(
      expr.inferredType,
      expectedType
    )
      ? {
          kind: "invocationExpression",
          expression: identifierExpression(
            "global::System.Linq.Enumerable.ToArray"
          ),
          arguments: [invocation],
        }
      : invocation;

    return [
      wrapIntCast(needsIntCast(expr, finalCalleeName), callAst),
      currentContext,
    ];
  }

  const arrayWrapperInteropCall = emitArrayWrapperInteropCall(
    expr,
    context,
    expectedType
  );
  const arrayMutationInteropCall = emitArrayMutationInteropCall(expr, context);
  if (arrayMutationInteropCall) {
    return arrayMutationInteropCall;
  }
  if (arrayWrapperInteropCall) {
    return arrayWrapperInteropCall;
  }

  // Regular function call
  const [calleeAst, newContext] =
    expr.callee.kind === "memberAccess"
      ? emitMemberAccess(expr.callee, context, "call")
      : emitExpressionAst(expr.callee, context);
  let currentContext = newContext;

  let calleeExpr: CSharpExpressionAst = calleeAst;
  let typeArgAsts: readonly CSharpTypeAst[] = [];

  if (expr.typeArguments && expr.typeArguments.length > 0) {
    if (expr.requiresSpecialization) {
      const calleeText = extractCalleeNameFromAst(calleeAst);
      const [specializedName, specContext] = generateSpecializedName(
        calleeText,
        expr.typeArguments,
        currentContext
      );
      calleeExpr = {
        kind: "identifierExpression",
        identifier: specializedName,
      };
      currentContext = specContext;
    } else {
      const [typeArgs, typeContext] = emitTypeArgumentsAst(
        expr.typeArguments,
        currentContext
      );
      typeArgAsts = typeArgs;
      currentContext = typeContext;
    }
  }

  const parameterTypeOverrides = getRuntimeObjectHelperParameterOverrides(
    expr,
    expr.arguments.length
  );

  const [argAsts, argContext] = emitCallArguments(
    expr.arguments,
    expr,
    currentContext,
    parameterTypeOverrides
  );
  currentContext = argContext;

  // Build the invocation target (may need optional chaining wrapper)
  const invocationTarget: CSharpExpressionAst = expr.isOptional
    ? (() => {
        // Optional call: callee?.(args) — in C# this requires the callee to be
        // a delegate and the call to be ?.Invoke(). For member access callees
        // the optional chaining is already handled by the member access emitter.
        // For identifiers, emit callee?.Invoke(args).
        if (calleeExpr.kind === "identifierExpression") {
          return {
            kind: "conditionalMemberAccessExpression" as const,
            expression: calleeExpr,
            memberName: "Invoke",
          };
        }
        return calleeExpr;
      })()
    : calleeExpr;

  const invocation: CSharpExpressionAst = {
    kind: "invocationExpression",
    expression: invocationTarget,
    arguments: argAsts,
    typeArguments: typeArgAsts.length > 0 ? typeArgAsts : undefined,
  };

  const normalizedInvocation: CSharpExpressionAst =
    shouldNormalizeUnboundJsArrayWrapperResult(
      expr,
      invocationTarget,
      expectedType,
      context
    )
      ? {
          kind: "invocationExpression",
          expression: {
            kind: "memberAccessExpression",
            expression: invocation,
            memberName: "toArray",
          },
          arguments: [],
        }
      : invocation;

  const shouldCastSuperCallResult =
    expr.callee.kind === "memberAccess" &&
    expr.callee.object.kind === "identifier" &&
    expr.callee.object.name === "super" &&
    !!expectedType &&
    expectedType.kind !== "voidType" &&
    expectedType.kind !== "anyType" &&
    expectedType.kind !== "unknownType";

  let finalInvocation: CSharpExpressionAst = normalizedInvocation;
  if (shouldCastSuperCallResult && expectedType) {
    const [expectedTypeAst, expectedTypeContext] = emitTypeAst(
      expectedType,
      currentContext
    );
    finalInvocation = {
      kind: "castExpression",
      type: expectedTypeAst,
      expression: normalizedInvocation,
    };
    currentContext = expectedTypeContext;
  }

  const calleeText = extractCalleeNameFromAst(calleeAst);
  return [
    wrapIntCast(needsIntCast(expr, calleeText), finalInvocation),
    currentContext,
  ];
};
