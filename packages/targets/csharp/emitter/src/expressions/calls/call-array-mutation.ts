/**
 * Native array mutation interop for call expressions.
 *
 * Handles source-owned array wrapping for mutation calls (push, pop, shift, unshift,
 * splice, sort, reverse, fill, copyWithin) that modify arrays in place
 * and need to write back the mutated array.
 */

import { IrExpression, IrType } from "@tsonic/frontend";
import { contextSurfaceIncludesJs, EmitterContext } from "../../types.js";
import { emitExpressionAst } from "../../expression-emitter.js";
import { emitTypeAst } from "../../type-emitter.js";
import type {
  CSharpExpressionAst,
  CSharpStatementAst,
} from "../../core/format/backend-ast/types.js";
import { resolveEffectiveExpressionType } from "../../core/semantic/narrowed-expression-types.js";
import { resolveArrayLikeReceiverType } from "../../core/semantic/type-resolution.js";
import { allocateLocalName } from "../../core/format/local-names.js";
import { needsIntCast } from "./call-analysis.js";
import { emitCallArguments, wrapIntCast } from "./call-arguments.js";
import { wrapArgModifier } from "./call-arguments-helpers.js";
import { buildNativeArrayInteropWrapAst } from "../array-interop.js";
import { buildInvokedLambdaExpressionAst } from "../invoked-lambda.js";
import { adaptValueToExpectedTypeAst } from "../expected-type-adaptation.js";
import { tryBuildRuntimeMaterializationAst } from "../../core/semantic/runtime-reification.js";
import { resolveDirectValueSurfaceType } from "../../core/semantic/direct-value-surfaces.js";
import {
  buildRuntimeUnionLayout,
  buildRuntimeUnionTypeAst,
} from "../../core/semantic/runtime-unions.js";
import { buildRuntimeUnionFactoryCallAst } from "../../core/semantic/runtime-union-projection.js";
import { runtimeUnionAliasReferencesMatch } from "../../core/semantic/runtime-union-alias-identity.js";
import { matchesExpectedEmissionType } from "../../core/semantic/expected-type-matching.js";
import { identifierExpression } from "../../core/format/backend-ast/builders.js";
import {
  getBorrowedMutationWriteBackSemantics,
  surfaceMemberMutatesReceiver,
  surfaceMemberReturnsArray,
  surfaceMemberReturnsReceiver,
} from "../../core/semantic/surface-member-semantics.js";
import { emitCSharpName } from "../../naming-policy.js";

const stripClrGenericArity = (typeName: string): string =>
  typeName.replace(/`\d+$/, "");

export const isArrayWrapperBindingType = (bindingType: string): boolean => {
  const leaf = stripClrGenericArity(bindingType).split(".").pop();
  return leaf === "Array" || leaf === "ReadonlyArray";
};

export const shouldPreferNativeArrayWrapperInterop = (
  binding:
    | NonNullable<
        Extract<IrExpression, { kind: "memberAccess" }>["memberBinding"]
      >
    | undefined,
  receiverType: IrType | undefined,
  context: EmitterContext
): boolean =>
  !!binding &&
  contextSurfaceIncludesJs(context) &&
  isArrayWrapperBindingType(binding.type) &&
  !!resolveArrayLikeReceiverType(receiverType, context)?.elementType;

export const hasDirectNativeArrayLikeInteropShape = (
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

const createVarLocal = (
  name: string,
  initializer: CSharpExpressionAst
): CSharpStatementAst => ({
  kind: "localDeclarationStatement",
  modifiers: [],
  type: { kind: "varType" },
  declarators: [{ name, initializer }],
});

const withArrayMutationArgumentSurface = (
  expr: Extract<IrExpression, { kind: "call" }>,
  memberName: string,
  receiverType: IrType | undefined,
  receiverElementType: IrType
): Extract<IrExpression, { kind: "call" }> => {
  switch (memberName) {
    case "push":
    case "unshift":
      return {
        ...expr,
        parameterTypes: [receiverElementType],
        restParameter: {
          index: 0,
          arrayType: receiverType,
          elementType: receiverElementType,
        },
        sourceBackedSurfaceParameterTypes: [receiverElementType],
        sourceBackedRestParameter: {
          index: 0,
          arrayType: receiverType,
          elementType: receiverElementType,
        },
        surfaceParameterTypes: [receiverElementType],
        surfaceRestParameter: {
          index: 0,
          arrayType: receiverType,
          elementType: receiverElementType,
        },
      };
    case "fill":
      return {
        ...expr,
        parameterTypes: [
          receiverElementType,
          expr.parameterTypes?.[1],
          expr.parameterTypes?.[2],
        ],
        sourceBackedSurfaceParameterTypes: [
          receiverElementType,
          expr.sourceBackedSurfaceParameterTypes?.[1] ??
            expr.surfaceParameterTypes?.[1] ??
            expr.parameterTypes?.[1],
          expr.sourceBackedSurfaceParameterTypes?.[2] ??
            expr.surfaceParameterTypes?.[2] ??
            expr.parameterTypes?.[2],
        ],
        surfaceParameterTypes: [
          receiverElementType,
          expr.surfaceParameterTypes?.[1] ?? expr.parameterTypes?.[1],
          expr.surfaceParameterTypes?.[2] ?? expr.parameterTypes?.[2],
        ],
      };
    case "splice":
      return {
        ...expr,
        parameterTypes: [
          expr.parameterTypes?.[0],
          expr.parameterTypes?.[1],
          receiverElementType,
        ],
        restParameter: {
          index: 2,
          arrayType: receiverType,
          elementType: receiverElementType,
        },
        sourceBackedSurfaceParameterTypes: [
          expr.sourceBackedSurfaceParameterTypes?.[0] ??
            expr.surfaceParameterTypes?.[0] ??
            expr.parameterTypes?.[0],
          expr.sourceBackedSurfaceParameterTypes?.[1] ??
            expr.surfaceParameterTypes?.[1] ??
            expr.parameterTypes?.[1],
          receiverElementType,
        ],
        sourceBackedRestParameter: {
          index: 2,
          arrayType: receiverType,
          elementType: receiverElementType,
        },
        surfaceParameterTypes: [
          expr.surfaceParameterTypes?.[0] ?? expr.parameterTypes?.[0],
          expr.surfaceParameterTypes?.[1] ?? expr.parameterTypes?.[1],
          receiverElementType,
        ],
        surfaceRestParameter: {
          index: 2,
          arrayType: receiverType,
          elementType: receiverElementType,
        },
      };
    default:
      return expr;
  }
};

type CapturedAssignableArrayTarget = {
  readonly readExpression: CSharpExpressionAst;
  readonly writeExpression: CSharpExpressionAst;
  readonly setupStatements: readonly CSharpStatementAst[];
  readonly postMutationStatements: readonly CSharpStatementAst[];
  readonly context: EmitterContext;
};

const isStableBorrowedAliasExpression = (expr: IrExpression): boolean => {
  switch (expr.kind) {
    case "identifier":
    case "this":
      return true;
    case "literal":
      return (
        expr.value === null ||
        expr.value === undefined ||
        typeof expr.value === "string" ||
        typeof expr.value === "number" ||
        typeof expr.value === "boolean"
      );
    case "memberAccess":
      return (
        !expr.isComputed &&
        typeof expr.property === "string" &&
        isStableBorrowedAliasExpression(expr.object)
      );
    default:
      return false;
  }
};

const tryBuildBorrowedMutationWriteBack = (
  receiver: Extract<IrExpression, { kind: "identifier" }>,
  mutatedValueAst: CSharpExpressionAst,
  context: EmitterContext
):
  | {
      readonly statement: CSharpStatementAst;
      readonly context: EmitterContext;
    }
  | undefined => {
  const alias = context.conditionAliases?.get(receiver.name);
  if (
    !alias ||
    alias.kind !== "call" ||
    alias.callee.kind !== "memberAccess" ||
    alias.callee.isComputed ||
    !alias.callee.memberBinding
  ) {
    return undefined;
  }

  const semantics = getBorrowedMutationWriteBackSemantics(
    alias.callee.memberBinding,
    context
  );
  if (!semantics) {
    return undefined;
  }

  const keyArgument = alias.arguments[semantics.keyArgumentIndex];
  if (
    !keyArgument ||
    keyArgument.kind === "spread" ||
    !isStableBorrowedAliasExpression(alias.callee.object) ||
    !isStableBorrowedAliasExpression(keyArgument)
  ) {
    return undefined;
  }

  const [ownerAst, ownerContext] = emitExpressionAst(
    alias.callee.object,
    context
  );
  const [keyAst, keyContext] = emitExpressionAst(keyArgument, ownerContext);
  const methodName = emitCSharpName(
    semantics.methodName,
    "methods",
    keyContext
  );

  return {
    statement: {
      kind: "expressionStatement",
      expression: {
        kind: "invocationExpression",
        expression: {
          kind: "memberAccessExpression",
          expression: ownerAst,
          memberName: methodName,
        },
        arguments: [keyAst, mutatedValueAst],
      },
    },
    context: keyContext,
  };
};

const captureAssignableArrayTarget = (
  expr: IrExpression,
  context: EmitterContext
): CapturedAssignableArrayTarget | undefined => {
  const [receiverAst, receiverContext] = emitExpressionAst(expr, context);

  if (receiverAst.kind === "identifierExpression") {
    const borrowedWriteBack =
      expr.kind === "identifier"
        ? tryBuildBorrowedMutationWriteBack(expr, receiverAst, receiverContext)
        : undefined;
    return {
      readExpression: receiverAst,
      writeExpression: receiverAst,
      setupStatements: [],
      postMutationStatements: borrowedWriteBack
        ? [borrowedWriteBack.statement]
        : [],
      context: borrowedWriteBack?.context ?? receiverContext,
    };
  }

  if (receiverAst.kind === "qualifiedIdentifierExpression") {
    return {
      readExpression: receiverAst,
      writeExpression: receiverAst,
      setupStatements: [],
      postMutationStatements: [],
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
      postMutationStatements: [],
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
      postMutationStatements: [],
      context: indexTemp.context,
    };
  }

  return undefined;
};

export const emitArrayMutationInteropCall = (
  expr: Extract<IrExpression, { kind: "call" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] | undefined => {
  if (!contextSurfaceIncludesJs(context)) return undefined;
  if (expr.isOptional) return undefined;
  if (expr.callee.kind !== "memberAccess") return undefined;
  if (expr.callee.isComputed) return undefined;
  if (typeof expr.callee.property !== "string") return undefined;

  const binding = expr.callee.memberBinding;
  if (
    !binding ||
    (binding.isExtensionMethod && !isArrayWrapperBindingType(binding.type)) ||
    !surfaceMemberMutatesReceiver(binding, context)
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

  const argumentSurfaceExpr = withArrayMutationArgumentSurface(
    expr,
    binding.member,
    receiverType,
    receiverElementType
  );
  const [emittedArgAsts, argContext] = emitCallArguments(
    expr.arguments,
    argumentSurfaceExpr,
    currentContext
  );
  const argAsts = emittedArgAsts.map((argAst, index) => {
    const sourceArg = expr.arguments[index];
    const actualType =
      resolveDirectValueSurfaceType(argAst, argContext) ??
      (sourceArg
        ? (resolveEffectiveExpressionType(sourceArg, argContext) ??
          sourceArg.inferredType)
        : undefined);
    if (!actualType) {
      return argAst;
    }
    const [receiverElementLayout, receiverElementLayoutContext] =
      buildRuntimeUnionLayout(receiverElementType, argContext, emitTypeAst);
    const [actualRuntimeLayout] = buildRuntimeUnionLayout(
      actualType,
      receiverElementLayoutContext,
      emitTypeAst
    );
    const directRuntimeUnionMemberIndex =
      receiverElementLayout?.members.findIndex(
        (member) =>
          runtimeUnionAliasReferencesMatch(
            member,
            actualType,
            receiverElementLayoutContext
          ) ||
          (!actualRuntimeLayout &&
            matchesExpectedEmissionType(
              actualType,
              member,
              receiverElementLayoutContext
            ))
      ) ?? -1;
    const directRuntimeUnionMemberWrappedArg =
      receiverElementLayout && directRuntimeUnionMemberIndex >= 0
        ? buildRuntimeUnionFactoryCallAst(
            buildRuntimeUnionTypeAst(receiverElementLayout),
            directRuntimeUnionMemberIndex + 1,
            argAst
          )
        : undefined;
    const normalizedArg =
      directRuntimeUnionMemberWrappedArg ??
      adaptValueToExpectedTypeAst({
        valueAst: argAst,
        actualType,
        context: argContext,
        expectedType: receiverElementType,
      })?.[0] ??
      tryBuildRuntimeMaterializationAst(
        argAst,
        actualType,
        receiverElementType,
        argContext,
        emitTypeAst
      )?.[0] ??
      argAst;
    return normalizedArg;
  });
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

  if (
    binding.member === "push" &&
    expr.callee.object.kind === "identifier" &&
    context.byRefLocalNames?.has(expr.callee.object.name) === true &&
    captured.readExpression.kind === "identifierExpression" &&
    captured.writeExpression.kind === "identifierExpression" &&
    captured.readExpression.identifier === captured.writeExpression.identifier
  ) {
    return [
      wrapIntCast(needsIntCast(expr, expr.callee.property), {
        kind: "invocationExpression",
        expression: {
          kind: "memberAccessExpression",
          expression: identifierExpression("global::Tsonic.Internal.ArrayInterop"),
          memberName: "Push",
        },
        arguments: [
          wrapArgModifier("ref", captured.writeExpression),
          ...argAsts,
        ],
      }),
      currentContext,
    ];
  }

  let returnExpression: CSharpExpressionAst = resultIdentifier;
  if (surfaceMemberReturnsArray(binding, context)) {
    returnExpression = {
      kind: "invocationExpression",
      expression: {
        kind: "memberAccessExpression",
        expression: resultIdentifier,
        memberName: "toArray",
      },
      arguments: [],
    };
  } else if (surfaceMemberReturnsReceiver(binding, context)) {
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

  return [
    wrapIntCast(
      needsIntCast(expr, expr.callee.property),
      buildInvokedLambdaExpressionAst({
        parameters: [],
        parameterTypes: [],
        body: {
          kind: "blockStatement",
          statements: [
            ...captured.setupStatements,
            createVarLocal(wrapperTemp.emittedName, {
              ...buildNativeArrayInteropWrapAst(captured.readExpression),
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
            ...captured.postMutationStatements,
            {
              kind: "returnStatement",
              expression: returnExpression,
            },
          ],
        },
        arguments: [],
        returnType: returnTypeAst,
        context: currentContext,
      })
    ),
    currentContext,
  ];
};
