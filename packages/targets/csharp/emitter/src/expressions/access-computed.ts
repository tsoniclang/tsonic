/**
 * Computed member access expression emitters.
 *
 * Handles element access via computed indexing (dict[key], arr[i], str[i]):
 * - Dictionary element access
 * - CLR indexer with Int32 proof
 * - String character access with ToString conversion
 * - Array element access with storage reification
 */

import {
  IrExpression,
  normalizedUnionType,
  type IrType,
} from "@tsonic/frontend";
import { EmitterContext } from "../types.js";
import { emitExpressionAst } from "../expression-emitter.js";
import { emitTypeAst } from "../type-emitter.js";
import {
  isDefinitelyValueType,
  resolveTypeAlias,
  resolveArrayLikeReceiverType,
  splitRuntimeNullishUnionMembers,
  stripNullish,
} from "../core/semantic/type-resolution.js";
import {
  targetTypeNameToTypeAst,
  extractCalleeNameFromAst,
  sameConcreteTypeAstSurface,
  stripNullableTypeAst,
} from "../core/format/backend-ast/utils.js";
import type { CSharpExpressionAst } from "../core/format/backend-ast/types.js";
import {
  identifierExpression,
  identifierType,
  nullLiteral,
  parseNumericLiteral,
} from "../core/format/backend-ast/builders.js";
import {
  hasInt32Proof,
  maybeReifyErasedArrayElement,
  type MemberAccessUsage,
  resolveEmittedReceiverTypeAst,
  tryEmitBroadArrayAssertionReceiverStorageAst,
} from "./access-resolution.js";
import { buildJsSafeDictionaryReadAst } from "./dictionary-safe-access.js";
import {
  resolveErasedNullableGenericStorageType,
  resolveRuntimeStorageArrayLikeElementType,
} from "../core/semantic/storage-types.js";
import { adaptStorageErasedValueAst } from "../core/semantic/storage-erased-adaptation.js";
import { getAcceptedSurfaceType } from "../core/semantic/defaults.js";
import {
  resolveDirectStorageCompatibleExpressionAst,
  resolveDirectStorageCompatibleExpressionType,
} from "./expected-type-adaptation.js";
import { contextSurfaceIncludesJs } from "../types.js";
import { unwrapTransparentExpression } from "../core/semantic/transparent-expressions.js";

const isRuntimeUnionMemberProjectionAst = (
  exprAst: CSharpExpressionAst
): boolean => {
  let target = exprAst;
  while (
    target.kind === "parenthesizedExpression" ||
    target.kind === "castExpression"
  ) {
    target = target.expression;
  }

  return (
    target.kind === "invocationExpression" &&
    target.arguments.length === 0 &&
    target.expression.kind === "memberAccessExpression" &&
    /^As\d+$/.test(target.expression.memberName)
  );
};

const SYSTEM_ARRAY_TYPE_AST = targetTypeNameToTypeAst("System.Array");

const buildSafeJsStringIndexAst = (
  objectAst: CSharpExpressionAst,
  indexAst: CSharpExpressionAst
): CSharpExpressionAst => {
  const stringName = "__tsonic_string";
  const indexName = "__tsonic_index";
  const stringIdentifier = identifierExpression(stringName);
  const indexIdentifier = identifierExpression(indexName);
  const castIndexToInt: CSharpExpressionAst = {
    kind: "castExpression",
    type: { kind: "predefinedType", keyword: "int" },
    expression: indexIdentifier,
  };
  const safeElementAccess: CSharpExpressionAst = {
    kind: "elementAccessExpression",
    expression: stringIdentifier,
    arguments: [castIndexToInt],
  };
  const indexIsInRange: CSharpExpressionAst = {
    kind: "binaryExpression",
    operatorToken: "&&",
    left: {
      kind: "binaryExpression",
      operatorToken: "&&",
      left: {
        kind: "binaryExpression",
        operatorToken: ">=",
        left: indexIdentifier,
        right: parseNumericLiteral("0"),
      },
      right: {
        kind: "binaryExpression",
        operatorToken: "<",
        left: indexIdentifier,
        right: {
          kind: "memberAccessExpression",
          expression: stringIdentifier,
          memberName: "Length",
        },
      },
    },
    right: {
      kind: "binaryExpression",
      operatorToken: "==",
      left: indexIdentifier,
      right: {
        kind: "invocationExpression",
        expression: identifierExpression("global::System.Math.Truncate"),
        arguments: [indexIdentifier],
      },
    },
  };

  return {
    kind: "invocationExpression",
    expression: {
      kind: "parenthesizedExpression",
      expression: {
        kind: "castExpression",
        type: {
          kind: "qualifiedIdentifierType",
          name: {
            aliasQualifier: "global",
            segments: ["System", "Func"],
          },
          typeArguments: [
            { kind: "predefinedType", keyword: "string" },
            { kind: "predefinedType", keyword: "double" },
            { kind: "predefinedType", keyword: "string" },
          ],
        },
        expression: {
          kind: "parenthesizedExpression",
          expression: {
            kind: "lambdaExpression",
            isAsync: false,
            parameters: [
              {
                name: stringName,
                type: { kind: "predefinedType", keyword: "string" },
              },
              {
                name: indexName,
                type: { kind: "predefinedType", keyword: "double" },
              },
            ],
            body: {
              kind: "conditionalExpression",
              condition: {
                kind: "binaryExpression",
                operatorToken: "==",
                left: stringIdentifier,
                right: nullLiteral(),
              },
              whenTrue: nullLiteral(),
              whenFalse: {
                kind: "conditionalExpression",
                condition: indexIsInRange,
                whenTrue: {
                  kind: "invocationExpression",
                  expression: {
                    kind: "memberAccessExpression",
                    expression: safeElementAccess,
                    memberName: "ToString",
                  },
                  arguments: [],
                },
                whenFalse: nullLiteral(),
              },
            },
          },
        },
      },
    },
    arguments: [objectAst, indexAst],
  };
};

const typeIncludesRuntimeAbsence = (
  type: IrType | undefined,
  context: EmitterContext
): type is IrType => {
  if (!type) {
    return false;
  }

  const resolved = resolveTypeAlias(type, context);
  if (
    resolved.kind === "primitiveType" &&
    (resolved.name === "null" || resolved.name === "undefined")
  ) {
    return true;
  }

  return splitRuntimeNullishUnionMembers(resolved)?.hasRuntimeNullish ?? false;
};

const buildSafeJsArrayReadAst = (
  objectAst: CSharpExpressionAst,
  indexAst: CSharpExpressionAst,
  elementType: IrType,
  desiredType: IrType,
  context: EmitterContext
): [CSharpExpressionAst, IrType, EmitterContext] => {
  const resolvedElementType = resolveTypeAlias(
    stripNullish(elementType),
    context
  );
  const typeParameterConstraint =
    resolvedElementType.kind === "typeParameterType"
      ? (context.typeParamConstraints?.get(resolvedElementType.name) ??
        "unconstrained")
      : undefined;
  const elementValueType =
    isDefinitelyValueType(resolvedElementType, context) ||
    typeParameterConstraint === "struct" ||
    typeParameterConstraint === "numeric";
  const elementReferenceType =
    !elementValueType &&
    (typeParameterConstraint === "class" ||
      resolvedElementType.kind === "referenceType" ||
      resolvedElementType.kind === "arrayType" ||
      resolvedElementType.kind === "tupleType" ||
      resolvedElementType.kind === "functionType" ||
      resolvedElementType.kind === "dictionaryType" ||
      resolvedElementType.kind === "objectType" ||
      (resolvedElementType.kind === "primitiveType" &&
        resolvedElementType.name === "string"));
  const [elementTypeAst, typeContext] = emitTypeAst(
    stripNullish(elementType),
    context
  );
  const helperStorageType = elementValueType
    ? desiredType
    : (resolveErasedNullableGenericStorageType(desiredType, typeContext) ??
      desiredType);

  return [
    {
      kind: "invocationExpression",
      expression: {
        kind: "memberAccessExpression",
        expression: identifierExpression(
          "global::Tsonic.Internal.ArrayInterop"
        ),
        memberName: elementValueType
          ? "ReadOptionalValue"
          : elementReferenceType
            ? "ReadOptionalReference"
            : "ReadOptionalObject",
      },
      typeArguments: [elementTypeAst],
      arguments: [objectAst, indexAst],
    },
    helperStorageType,
    typeContext,
  ];
};

/**
 * Emit a computed member access expression as CSharpExpressionAst.
 *
 * Called by the main emitMemberAccess when expr.isComputed is true.
 */
export const emitComputedAccess = (
  expr: Extract<IrExpression, { kind: "memberAccess" }>,
  objectAst: CSharpExpressionAst,
  objectType: IrType | undefined,
  receiverSourceContext: EmitterContext,
  context: EmitterContext,
  usage: MemberAccessUsage = "value",
  expectedType?: IrType
): [CSharpExpressionAst, EmitterContext] => {
  const accessKind = expr.accessKind;
  if (accessKind === undefined || accessKind === "unknown") {
    const sourceInfo = expr.sourceSpan
      ? ` at ${expr.sourceSpan.file}:${String(expr.sourceSpan.line)}:${String(expr.sourceSpan.column)}`
      : "";
    throw new Error(
      `Internal Compiler Error: Computed accessKind was not classified during IR build ` +
        `(accessKind=${accessKind ?? "undefined"})${sourceInfo}.`
    );
  }

  const indexContext = { ...context, isArrayIndex: true };
  const [propAst, contextWithIndex] = emitExpressionAst(
    expr.property as IrExpression,
    indexContext
  );
  const finalContext = { ...contextWithIndex, isArrayIndex: false };
  const indexExpr = expr.property as IrExpression;
  const resolvedObjectType = objectType
    ? resolveTypeAlias(stripNullish(objectType), context)
    : undefined;

  if (accessKind === "dictionary") {
    if (contextSurfaceIncludesJs(context) && usage !== "write") {
      const directStorageSourceExpr =
        expr.object.kind === "typeAssertion" ||
        expr.object.kind === "asinterface" ||
        expr.object.kind === "trycast"
          ? unwrapTransparentExpression(expr.object.expression)
          : expr.object;
      const directStorageObjectAst =
        resolveDirectStorageCompatibleExpressionAst({
          expr: directStorageSourceExpr,
          context: receiverSourceContext,
        });
      const directStorageObjectType = directStorageObjectAst
        ? resolveDirectStorageCompatibleExpressionType({
            expr: directStorageSourceExpr,
            valueAst: directStorageObjectAst,
            context: finalContext,
          })
        : undefined;
      const resolvedDirectStorageObjectType = directStorageObjectType
        ? resolveTypeAlias(stripNullish(directStorageObjectType), context)
        : undefined;
      const shouldUseDirectStorageObjectAst =
        resolvedDirectStorageObjectType?.kind === "dictionaryType";
      const storageObjectAst =
        shouldUseDirectStorageObjectAst && directStorageObjectAst
          ? directStorageObjectAst
          : objectAst;
      const storageObjectType =
        (shouldUseDirectStorageObjectAst
          ? directStorageObjectType
          : resolveDirectStorageCompatibleExpressionType({
              expr: expr.object,
              valueAst: objectAst,
              context: finalContext,
            })) ?? objectType;
      const resolvedStorageObjectType = storageObjectType
        ? resolveTypeAlias(stripNullish(storageObjectType), context)
        : undefined;
      const storageValueType =
        resolvedStorageObjectType?.kind === "dictionaryType"
          ? (getAcceptedSurfaceType(
              resolvedStorageObjectType.valueType,
              true
            ) ?? resolvedStorageObjectType.valueType)
          : undefined;
      const acceptedReceiverValueType =
        resolvedObjectType?.kind === "dictionaryType"
          ? (getAcceptedSurfaceType(resolvedObjectType.valueType, true) ??
            resolvedObjectType.valueType)
          : undefined;
      const fallbackType =
        expectedType ??
        storageValueType ??
        expr.inferredType ??
        acceptedReceiverValueType;
      const [resultTypeAst, typeContext] = fallbackType
        ? emitTypeAst(fallbackType, finalContext)
        : [identifierType("object"), finalContext];
      return [
        buildJsSafeDictionaryReadAst(
          storageObjectAst,
          propAst,
          expr.isOptional,
          resultTypeAst,
          typeContext
        ),
        typeContext,
      ];
    }

    return [
      {
        kind: "elementAccessExpression",
        expression: objectAst,
        arguments: [propAst],
      },
      finalContext,
    ];
  }

  if (accessKind === "stringChar") {
    const elementAccess: CSharpExpressionAst = {
      kind: "elementAccessExpression",
      expression: objectAst,
      arguments: [propAst],
    };
    const charElementAccess: CSharpExpressionAst = expr.isOptional
      ? {
          kind: "conditionalElementAccessExpression",
          expression: objectAst,
          arguments: [propAst],
        }
      : elementAccess;

    const narrowedExpectedType = expectedType
      ? stripNullish(expectedType)
      : undefined;
    const resolvedExpectedType = narrowedExpectedType
      ? resolveTypeAlias(narrowedExpectedType, context)
      : undefined;
    const expectsChar =
      (resolvedExpectedType?.kind === "primitiveType" &&
        resolvedExpectedType.name === "char") ||
      (resolvedExpectedType?.kind === "referenceType" &&
        resolvedExpectedType.name === "char");

    if (expectsChar || !contextSurfaceIncludesJs(context)) {
      if (!hasInt32Proof(indexExpr)) {
        const propText = extractCalleeNameFromAst(propAst);
        throw new Error(
          `Internal Compiler Error: CLR string indexer requires Int32 index. ` +
            `Expression '${propText}' has no Int32 proof. ` +
            `This should have been caught by the numeric proof pass (TSN5107).`
        );
      }
      return [charElementAccess, finalContext];
    }

    return [buildSafeJsStringIndexAst(objectAst, propAst), finalContext];
  }

  if (resolvedObjectType?.kind === "tupleType") {
    const literalIndex =
      indexExpr.kind === "literal" && typeof indexExpr.value === "number"
        ? indexExpr.value
        : undefined;
    if (
      literalIndex === undefined ||
      !Number.isInteger(literalIndex) ||
      literalIndex < 0 ||
      literalIndex >= resolvedObjectType.elementTypes.length
    ) {
      const propText = extractCalleeNameFromAst(propAst);
      throw new Error(
        `Internal Compiler Error: Tuple index '${propText}' must be a deterministic in-range numeric literal.`
      );
    }

    return [
      {
        kind: expr.isOptional
          ? "conditionalMemberAccessExpression"
          : "memberAccessExpression",
        expression: objectAst,
        memberName: `Item${literalIndex + 1}`,
      },
      finalContext,
    ];
  }

  if (!hasInt32Proof(indexExpr)) {
    const propText = extractCalleeNameFromAst(propAst);
    throw new Error(
      `Internal Compiler Error: CLR indexer requires Int32 index (accessKind=${accessKind}). ` +
        `Expression '${propText}' has no Int32 proof. ` +
        `This should have been caught by the numeric proof pass (TSN5107).`
    );
  }

  if (expr.accessProtocol?.getterMember) {
    const adaptProtocolGetterRead = (
      valueAst: CSharpExpressionAst,
      nextContext: EmitterContext
    ): [CSharpExpressionAst, EmitterContext] => {
      if (usage !== "value" || expr.isOptional) {
        return [valueAst, nextContext];
      }

      const desiredType = expectedType ?? expr.inferredType;
      const arrayLikeReceiver = resolveArrayLikeReceiverType(
        objectType,
        context
      );
      const protocolElementType =
        arrayLikeReceiver?.elementType ??
        (expr.inferredType ? stripNullish(expr.inferredType) : undefined);
      if (!protocolElementType || !desiredType) {
        return [valueAst, nextContext];
      }

      const storageType = typeIncludesRuntimeAbsence(expr.inferredType, context)
        ? expr.inferredType
        : normalizedUnionType([
            protocolElementType,
            { kind: "primitiveType", name: "undefined" },
          ]);
      const adapted = adaptStorageErasedValueAst({
        valueAst,
        semanticType: expr.inferredType,
        storageType,
        expectedType: desiredType,
        context: nextContext,
        emitTypeAst,
      });
      return adapted ?? [valueAst, nextContext];
    };

    if (expr.isOptional) {
      return adaptProtocolGetterRead(
        {
          kind: "invocationExpression",
          expression: {
            kind: "conditionalMemberAccessExpression",
            expression: objectAst,
            memberName: expr.accessProtocol.getterMember,
          },
          arguments: [propAst],
        },
        finalContext
      );
    }

    return adaptProtocolGetterRead(
      {
        kind: "invocationExpression",
        expression: {
          kind: "memberAccessExpression",
          expression: objectAst,
          memberName: expr.accessProtocol.getterMember,
        },
        arguments: [propAst],
      },
      finalContext
    );
  }

  if (expr.isOptional) {
    return [
      {
        kind: "conditionalElementAccessExpression",
        expression: objectAst,
        arguments: [propAst],
      },
      finalContext,
    ];
  }

  const receiverResolutionContext =
    expr.object.kind === "typeAssertion" ||
    expr.object.kind === "asinterface" ||
    expr.object.kind === "trycast"
      ? receiverSourceContext
      : finalContext;
  const preservedReceiver = tryEmitBroadArrayAssertionReceiverStorageAst(
    expr.object,
    receiverResolutionContext
  );
  const desiredType = expectedType ?? expr.inferredType;
  const adaptBroadArrayElementRead = (
    valueAst: CSharpExpressionAst,
    nextContext: EmitterContext
  ): [CSharpExpressionAst, EmitterContext] => {
    if (usage !== "value") {
      return [valueAst, nextContext];
    }

    const storageElementType = resolveRuntimeStorageArrayLikeElementType(
      objectType,
      context
    );
    const adapted = adaptStorageErasedValueAst({
      valueAst,
      semanticType: expr.inferredType,
      storageType: storageElementType,
      expectedType: desiredType,
      context: nextContext,
      emitTypeAst,
    });
    return adapted ?? [valueAst, nextContext];
  };
  const effectiveObjectAst = preservedReceiver?.[0] ?? objectAst;
  const effectiveObjectContext =
    preservedReceiver?.[1] ?? receiverResolutionContext;
  const [receiverTypeAst, receiverTypeContext] = resolveEmittedReceiverTypeAst(
    expr.object,
    effectiveObjectContext
  );
  const concreteReceiverTypeAst = receiverTypeAst
    ? stripNullableTypeAst(receiverTypeAst)
    : undefined;
  if (preservedReceiver && concreteReceiverTypeAst?.kind === "arrayType") {
    return adaptBroadArrayElementRead(
      {
        kind: "invocationExpression",
        expression: {
          kind: "memberAccessExpression",
          expression: effectiveObjectAst,
          memberName: "GetValue",
        },
        arguments: [propAst],
      },
      receiverTypeContext
    );
  }
  if (
    concreteReceiverTypeAst &&
    sameConcreteTypeAstSurface(concreteReceiverTypeAst, SYSTEM_ARRAY_TYPE_AST)
  ) {
    return adaptBroadArrayElementRead(
      {
        kind: "invocationExpression",
        expression: {
          kind: "memberAccessExpression",
          expression: effectiveObjectAst,
          memberName: "GetValue",
        },
        arguments: [propAst],
      },
      receiverTypeContext
    );
  }

  const storageObjectTypeForArrayRead =
    resolveDirectStorageCompatibleExpressionType({
      expr: expr.object,
      valueAst: objectAst,
      context: finalContext,
    }) ?? objectType;
  const arrayLikeReceiver = resolveArrayLikeReceiverType(
    storageObjectTypeForArrayRead,
    context
  );
  const optionalArrayReadType = typeIncludesRuntimeAbsence(
    expr.inferredType,
    finalContext
  )
    ? expr.inferredType
    : typeIncludesRuntimeAbsence(desiredType, finalContext)
      ? desiredType
      : undefined;
  if (
    usage === "value" &&
    arrayLikeReceiver &&
    optionalArrayReadType &&
    contextSurfaceIncludesJs(context)
  ) {
    const [safeReadAst, safeReadStorageType, safeReadContext] =
      buildSafeJsArrayReadAst(
        objectAst,
        propAst,
        arrayLikeReceiver.elementType,
        optionalArrayReadType,
        finalContext
      );
    if (!typeIncludesRuntimeAbsence(desiredType, safeReadContext)) {
      return [safeReadAst, safeReadContext];
    }

    const adapted = adaptStorageErasedValueAst({
      valueAst: safeReadAst,
      semanticType: expr.inferredType,
      storageType: safeReadStorageType,
      expectedType: desiredType,
      context: safeReadContext,
      emitTypeAst,
    });
    return adapted ?? [safeReadAst, safeReadContext];
  }

  const accessAst: CSharpExpressionAst = {
    kind: "elementAccessExpression",
    expression: objectAst,
    arguments: [propAst],
  };

  if (
    usage === "value" &&
    arrayLikeReceiver &&
    isRuntimeUnionMemberProjectionAst(objectAst)
  ) {
    const storageElementType = resolveRuntimeStorageArrayLikeElementType(
      storageObjectTypeForArrayRead,
      context
    );
    const adapted = adaptStorageErasedValueAst({
      valueAst: accessAst,
      semanticType: expr.inferredType,
      storageType: storageElementType,
      expectedType: desiredType,
      context: finalContext,
      emitTypeAst,
    });
    return adapted ?? [accessAst, finalContext];
  }

  return usage === "value"
    ? maybeReifyErasedArrayElement(
        accessAst,
        expr.object,
        desiredType,
        finalContext
      )
    : [accessAst, finalContext];
};
