/**
 * Native array wrapper interop for call expressions.
 * Handles JSArray wrapping for mutation calls and result normalization.
 */

import { IrExpression, IrType } from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import { emitExpressionAst } from "../../expression-emitter.js";
import { emitTypeAst } from "../../type-emitter.js";
import type {
  CSharpExpressionAst,
  CSharpStatementAst,
  CSharpTypeAst,
} from "../../core/format/backend-ast/types.js";
import { identifierType } from "../../core/format/backend-ast/builders.js";
import { getIdentifierTypeLeafName } from "../../core/format/backend-ast/utils.js";
import { resolveEffectiveExpressionType } from "../../core/semantic/narrowed-expression-types.js";
import { resolveArrayLikeReceiverType } from "../../core/semantic/type-resolution.js";
import { allocateLocalName } from "../../core/format/local-names.js";
import { isLValue, needsIntCast } from "./call-analysis.js";
import {
  emitCallArguments,
  wrapIntCast,
  emitArrayWrapperElementTypeAst,
} from "./call-arguments.js";
import { buildDelegateType } from "./call-promise.js";

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
  !!resolveArrayLikeReceiverType(receiverType, context)?.elementType;

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
  const receiverElementType = resolveArrayLikeReceiverType(
    receiverType,
    context
  )?.elementType;
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
  const receiverElementType = resolveArrayLikeReceiverType(
    receiverType,
    context
  )?.elementType;
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
    simpleName === "ArrayLike" ||
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

export {
  emitArrayMutationInteropCall,
  emitArrayWrapperInteropCall,
  shouldPreferNativeArrayWrapperInterop,
  shouldNormalizeArrayLikeInteropResult,
  shouldNormalizeUnboundJsArrayWrapperResult,
  hasDirectNativeArrayLikeInteropShape,
  nativeArrayReturningInteropMembers,
};
