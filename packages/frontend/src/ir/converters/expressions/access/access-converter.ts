/**
 * Member access expression converter orchestrator
 *
 * Combines member-resolution and binding-resolution to convert
 * property access and element access expressions.
 */

import * as ts from "typescript";
import { IrExpression } from "../../../types.js";
import { getSourceSpan } from "../helpers.js";
import { convertExpression } from "../../../expression-converter.js";
import type { ProgramContext } from "../../../program-context.js";
import {
  getDeclaredPropertyType,
  classifyComputedAccess,
  deriveElementType,
  hasDeclaredMemberByName,
  resolveComputedAccessProtocol,
} from "./member-resolution.js";
import {
  getCurrentTypeForAccessExpression,
  hasAccessPathNarrowing,
} from "../../access-paths.js";
import { shouldWrapExpressionWithAssertion } from "../../assertion-wrapping.js";
import {
  resolveHierarchicalBinding,
  resolveHierarchicalBindingFromMemberId,
  resolveExtensionMethodsBinding,
} from "./binding-resolution.js";
import {
  isWellKnownSymbolPropertyName,
  tryResolveDeterministicPropertyNameFromExpression,
} from "../../../syntax/property-names.js";
import {
  tryGetObjectLiteralMethodArgumentCapture,
  tryGetObjectLiteralMethodArgumentsLength,
} from "../../../../object-literal-method-runtime.js";

const typeHasClrIdentity = (
  type: IrExpression["inferredType"] | undefined
): boolean => {
  if (!type) return false;
  switch (type.kind) {
    case "referenceType":
      return !!type.resolvedClrType || !!type.typeId?.clrName;
    case "unionType":
    case "intersectionType":
      return type.types.some(typeHasClrIdentity);
    case "arrayType":
      return typeHasClrTypeIdentity(type.elementType);
    case "tupleType":
      return type.elementTypes.some(typeHasClrTypeIdentity);
    default:
      return false;
  }
};

const typeHasClrTypeIdentity = (
  type: NonNullable<IrExpression["inferredType"]>
): boolean => typeHasClrIdentity(type);

const expressionHasClrIdentity = (expr: IrExpression): boolean =>
  ("resolvedClrType" in expr && typeof expr.resolvedClrType === "string") ||
  typeHasClrIdentity(expr.inferredType);

/**
 * Convert property access or element access expression
 */
export const convertMemberExpression = (
  node: ts.PropertyAccessExpression | ts.ElementAccessExpression,
  ctx: ProgramContext
): IrExpression => {
  const isOptional = node.questionDotToken !== undefined;
  const sourceSpan = getSourceSpan(node);

  if (ts.isPropertyAccessExpression(node)) {
    const objectMethodArgumentsLength =
      tryGetObjectLiteralMethodArgumentsLength(node);
    if (objectMethodArgumentsLength !== undefined) {
      return {
        kind: "literal",
        value: objectMethodArgumentsLength,
        raw: String(objectMethodArgumentsLength),
        inferredType: { kind: "primitiveType", name: "int" },
        sourceSpan,
      };
    }

    const object = convertExpression(node.expression, ctx, undefined);
    const propertyName = node.name.text;
    const currentReceiverType = getCurrentTypeForAccessExpression(
      node.expression,
      ctx
    );
    const bindingResolutionObject =
      currentReceiverType !== undefined
        ? { ...object, inferredType: currentReceiverType }
        : object;
    const exactMemberId = ctx.binding.resolvePropertyAccess(node);
    const exactDeclaringTypeName =
      exactMemberId !== undefined
        ? ctx.binding.getDeclaringTypeNameOfMember(exactMemberId)
        : undefined;
    const exactMemberBinding =
      exactMemberId !== undefined &&
      !exactDeclaringTypeName?.startsWith("__Ext_") &&
      !exactDeclaringTypeName?.startsWith("__TsonicExtMethods_")
        ? resolveHierarchicalBindingFromMemberId(
            node,
            propertyName,
            bindingResolutionObject,
            ctx
          )
        : undefined;

    // Try to resolve hierarchical binding
    const hierarchicalMemberBinding =
      exactMemberId === undefined ||
      (exactMemberBinding === undefined &&
        expressionHasClrIdentity(bindingResolutionObject))
        ? resolveHierarchicalBinding(bindingResolutionObject, propertyName, ctx)
        : undefined;
    const memberBinding =
      resolveExtensionMethodsBinding(
        node,
        propertyName,
        bindingResolutionObject,
        ctx
      ) ??
      exactMemberBinding ??
      hierarchicalMemberBinding;

    // DETERMINISTIC TYPING: Property type comes from explicit TypeSystem queries only.
    //
    // The receiver's inferredType enables NominalEnv to walk inheritance chains
    // and substitute type parameters correctly for inherited generic members.
    //
    // Surface members work only when the active surface declares them with proper types.
    // If getDeclaredPropertyType returns undefined, it means the property declaration
    // is missing - use unknownType as poison so validation can emit TSN5203.
    //
    // EXCEPTION: If memberBinding exists AND declaredType is undefined, return undefined.
    // This handles pure CLR-bound methods like Console.WriteLine that have no TS declaration.
    const narrowedAccessType =
      hasAccessPathNarrowing(node, ctx) || currentReceiverType !== undefined
        ? getCurrentTypeForAccessExpression(node, ctx)
        : undefined;
    const declaredType = getDeclaredPropertyType(
      node,
      currentReceiverType ?? object.inferredType,
      ctx
    );
    const propertyAccessKind = classifyComputedAccess(
      currentReceiverType ?? object.inferredType,
      ctx
    );
    const dictionaryPropertyType =
      declaredType === undefined &&
      propertyAccessKind === "dictionary" &&
      propertyName !== "Count" &&
      propertyName !== "Keys" &&
      propertyName !== "Values"
        ? deriveElementType(currentReceiverType ?? object.inferredType, ctx)
        : undefined;
    // Hierarchical bindings: namespace.type is a static type reference, not a runtime
    // value. When this pattern is present in the binding manifest, avoid poisoning the
    // receiver with unknownType; the emitter uses "no inferredType" to classify the
    // receiver as a static type, enabling global::Type.Member emission.
    const isNamespaceTypeReference =
      object.kind === "identifier" &&
      ctx.bindings
        .getNamespace(object.name)
        ?.types.some((t) => t.alias === propertyName) === true;

    // DETERMINISTIC TYPING: Set inferredType for validation passes (like numeric proof).
    // The emitter uses memberBinding separately for C# member naming.
    //
    // Priority order for inferredType:
    // 1. If declaredType exists, use it.
    // 2. If memberBinding exists but no declaredType, use undefined (pure CLR-bound)
    // 3. Otherwise, poison with unknownType for validation (TSN5203)
    //
    // Note: Both memberBinding AND inferredType can be set - they serve different purposes:
    // - memberBinding: used by emitter for C# member names
    // - inferredType: used by validation passes for type checking
    //
    // Class fields without explicit type annotations will emit TSN5203.
    // Users must add explicit types like `count: int = 0` instead of `count = 0`.
    const propertyInferredType = declaredType
      ? declaredType
      : dictionaryPropertyType
        ? dictionaryPropertyType
      : isNamespaceTypeReference
        ? undefined
        : memberBinding
          ? undefined
          : { kind: "unknownType" as const };

    const baseMemberAccess: IrExpression = {
      kind: "memberAccess",
      object,
      property: propertyName,
      isComputed: false,
      isOptional,
      inferredType: declaredType ?? propertyInferredType,
      sourceSpan,
      memberBinding,
      ...(dictionaryPropertyType
        ? {
            accessKind: "dictionary" as const,
            ...(dictionaryPropertyType.kind === "unknownType"
              ? { allowUnknownInferredType: true }
              : {}),
          }
        : {}),
    };
    if (
      narrowedAccessType &&
      shouldWrapExpressionWithAssertion(ctx, declaredType, narrowedAccessType)
    ) {
      return {
        kind: "typeAssertion",
        expression: baseMemberAccess,
        targetType: narrowedAccessType,
        inferredType: narrowedAccessType,
        sourceSpan,
      };
    }
    return {
      ...baseMemberAccess,
      inferredType: propertyInferredType,
    };
  } else {
    const objectMethodArgumentCapture =
      tryGetObjectLiteralMethodArgumentCapture(node);
    if (objectMethodArgumentCapture) {
      const inferredType = objectMethodArgumentCapture.parameter.type
        ? ctx.typeSystem.typeFromSyntax(
            ctx.binding.captureTypeSyntax(
              objectMethodArgumentCapture.parameter.type
            )
          )
        : undefined;
      return {
        kind: "identifier",
        name: objectMethodArgumentCapture.tempName,
        inferredType,
        sourceSpan,
      };
    }

    // Element access (computed): obj[expr]
    const object = convertExpression(node.expression, ctx, undefined);

    const deterministicPropertyName = (() => {
      const arg = node.argumentExpression;
      if (!arg) return undefined;
      return tryResolveDeterministicPropertyNameFromExpression(arg);
    })();

    const computedAccessKind = classifyComputedAccess(object.inferredType, ctx);

    const deterministicSymbolAccess =
      deterministicPropertyName !== undefined &&
      isWellKnownSymbolPropertyName(deterministicPropertyName);
    const hasDeterministicMember =
      deterministicPropertyName !== undefined &&
      hasDeclaredMemberByName(
        object.inferredType,
        deterministicPropertyName,
        ctx
      );

    if (
      deterministicPropertyName !== undefined &&
      computedAccessKind !== "dictionary" &&
      (deterministicSymbolAccess || object.inferredType !== undefined)
    ) {
      const currentAccessType =
        hasAccessPathNarrowing(node, ctx) || object.inferredType !== undefined
          ? getCurrentTypeForAccessExpression(node, ctx)
          : undefined;
      const declaredType =
        object.inferredType !== undefined
          ? ctx.typeSystem.typeOfMember(object.inferredType, {
              kind: "byName",
              name: deterministicPropertyName,
            })
          : { kind: "unknownType" as const };
      if (
        declaredType.kind !== "unknownType" ||
        deterministicSymbolAccess ||
        hasDeterministicMember
      ) {
        const memberBinding = resolveHierarchicalBinding(
          object,
          deterministicPropertyName,
          ctx
        );
        const baseMemberAccess: IrExpression = {
          kind: "memberAccess",
          object,
          property: deterministicPropertyName,
          isComputed: false,
          isOptional,
          inferredType: declaredType,
          sourceSpan,
          memberBinding,
        };
        if (
          currentAccessType &&
          shouldWrapExpressionWithAssertion(
            ctx,
            declaredType,
            currentAccessType
          )
        ) {
          return {
            kind: "typeAssertion",
            expression: baseMemberAccess,
            targetType: currentAccessType,
            inferredType: currentAccessType,
            sourceSpan,
          };
        }
        return baseMemberAccess;
      }
    }

    // DETERMINISTIC TYPING: Use object's inferredType (not getInferredType)
    const currentReceiverType = getCurrentTypeForAccessExpression(
      node.expression,
      ctx
    );
    const objectType = currentReceiverType ?? object.inferredType;

    // Classify the access kind for proof pass
    // This determines whether Int32 proof is required for the index
    const accessKind = classifyComputedAccess(objectType, ctx);

    const narrowedAccessType =
      hasAccessPathNarrowing(node, ctx) || objectType !== undefined
        ? getCurrentTypeForAccessExpression(node, ctx)
        : undefined;

    // Derive element type from object type
    const elementType =
      narrowedAccessType ??
      deriveElementType(objectType, ctx, node.argumentExpression);
    const accessProtocol = resolveComputedAccessProtocol(objectType, ctx);

    const baseElementAccess: IrExpression = {
      kind: "memberAccess",
      object,
      property: convertExpression(node.argumentExpression, ctx, undefined),
      isComputed: true,
      isOptional,
      inferredType: deriveElementType(objectType, ctx, node.argumentExpression),
      sourceSpan,
      accessKind,
      accessProtocol,
    };
    if (
      narrowedAccessType &&
      shouldWrapExpressionWithAssertion(
        ctx,
        deriveElementType(objectType, ctx, node.argumentExpression),
        narrowedAccessType
      )
    ) {
      return {
        kind: "typeAssertion",
        expression: baseElementAccess,
        targetType: narrowedAccessType,
        inferredType: narrowedAccessType,
        sourceSpan,
      };
    }
    return {
      ...baseElementAccess,
      inferredType: elementType,
    };
  }
};
