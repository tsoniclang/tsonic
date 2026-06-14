/**
 * Member access expression converter orchestrator
 *
 * Combines member-resolution and binding-resolution to convert
 * property access and element access expressions.
 */

import { TstsSyntax, type TstsNode } from "@tsonic/tsts";
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
  tryResolveDeterministicPropertyName,
  tryResolveDeterministicPropertyNameFromExpression,
} from "../../../syntax/property-names.js";
import {
  tryGetObjectLiteralMethodArgumentCapture,
  tryGetObjectLiteralMethodArgumentsLength,
} from "../../../../object-literal-method-runtime.js";
import { selectUnionArm } from "../../union-arm-selection.js";
import {
  chooseUseSiteType,
  getSourceUseSiteType,
} from "../../../expression-converter-helpers.js";

const typeHasTargetIdentity = (
  type: IrExpression["inferredType"] | undefined
): boolean => {
  if (!type) return false;
  switch (type.kind) {
    case "referenceType":
      return !!type.providerQualifiedName || !!type.symbolId || !!type.typeId;
    case "unionType":
    case "intersectionType":
      return type.types.some(typeHasTargetIdentity);
    case "arrayType":
      return typeHasTargetTypeIdentity(type.elementType);
    case "tupleType":
      return type.elementTypes.some(typeHasTargetTypeIdentity);
    default:
      return false;
  }
};

const typeHasTargetTypeIdentity = (
  type: NonNullable<IrExpression["inferredType"]>
): boolean => typeHasTargetIdentity(type);

const expressionHasTargetIdentity = (expr: IrExpression): boolean =>
  ("providerQualifiedName" in expr &&
    typeof expr.providerQualifiedName === "string") ||
  typeHasTargetIdentity(expr.inferredType);

/**
 * Convert property access or element access expression
 */
export const convertMemberExpression = (
  node: TstsNode,
  ctx: ProgramContext
): IrExpression => {
  const isOptional = TstsSyntax.Node_QuestionDotToken(node) !== undefined;
  const sourceSpan = getSourceSpan(node);

  if (node.Kind === TstsSyntax.KindPropertyAccessExpression) {
    const propertyAccess = TstsSyntax.AsPropertyAccessExpression(node);
    if (!propertyAccess?.Expression) {
      throw new Error("Invalid TSTS property access expression.");
    }
    const receiver = propertyAccess.Expression;
    const propertyName =
      tryResolveDeterministicPropertyName(propertyAccess.name) ?? "";
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

    const object = convertExpression(receiver, ctx, undefined);
    const sourceReceiverType = getSourceUseSiteType(receiver, ctx);
    const currentReceiverType =
      chooseUseSiteType(object.inferredType, sourceReceiverType, ctx) ??
      getCurrentTypeForAccessExpression(receiver, ctx);
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
        expressionHasTargetIdentity(bindingResolutionObject))
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
    // This handles pure external-bound methods like Console.WriteLine that have no TS declaration.
    const narrowedAccessType =
      hasAccessPathNarrowing(node, ctx) || currentReceiverType !== undefined
        ? getCurrentTypeForAccessExpression(node, ctx)
        : undefined;
    const declaredType = getDeclaredPropertyType(
      node,
      currentReceiverType ?? object.inferredType,
      ctx
    );
    const externalBoundMemberType =
      declaredType === undefined && memberBinding !== undefined
        ? ctx.typeSystem.typeOfExternalBoundMember(memberBinding)
        : undefined;
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
    // receiver as a static type and render the target-specific static member access.
    const isNamespaceTypeReference =
      object.kind === "identifier" &&
      ctx.bindings
        .getNamespace(object.name)
        ?.types.some((t) => t.alias === propertyName) === true;

    // DETERMINISTIC TYPING: Set inferredType for validation passes (like numeric proof).
    // The emitter uses memberBinding separately for target member naming.
    //
    // Priority order for inferredType:
    // 1. If declaredType exists, use it.
    // 2. If memberBinding has catalog metadata, use the unified-catalog member type.
    // 3. If memberBinding exists but no catalog type, use undefined (pure external-bound)
    // 4. Otherwise, poison with unknownType for validation (TSN5203)
    //
    // Note: Both memberBinding AND inferredType can be set - they serve different purposes:
    // - memberBinding: used by emitter for target member names
    // - inferredType: used by validation passes for type checking
    //
    // Class fields without explicit type annotations will emit TSN5203.
    // Users must add explicit types like `count: int = 0` instead of `count = 0`.
    const propertyUseSiteType = getSourceUseSiteType(node, ctx);
    const declaredPropertyType = declaredType
      ? declaredType
      : dictionaryPropertyType
        ? dictionaryPropertyType
        : externalBoundMemberType
          ? externalBoundMemberType
        : isNamespaceTypeReference
          ? undefined
          : memberBinding
            ? undefined
            : { kind: "unknownType" as const };
    const propertyInferredType =
      chooseUseSiteType(declaredPropertyType, propertyUseSiteType, ctx) ??
      declaredPropertyType;

    const baseMemberAccess: IrExpression = {
      kind: "memberAccess",
      object,
      property: propertyName,
      isComputed: false,
      isOptional,
      inferredType: propertyInferredType,
      sourceSpan,
      receiverArmSelection:
        currentReceiverType && object.inferredType?.kind === "unionType"
          ? selectUnionArm({
              kind: "semanticProjection",
              sourceType: currentReceiverType,
              targetUnion: object.inferredType,
            })
          : undefined,
      memberBinding,
      ...(dictionaryPropertyType
        ? {
            accessKind: "dictionary" as const,
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
      const parameterType = TstsSyntax.Node_Type(
        objectMethodArgumentCapture.parameter
      );
      const inferredType = parameterType
        ? ctx.typeSystem.typeFromSyntax(
            ctx.binding.captureTypeSyntax(parameterType)
          )
        : undefined;
      return {
        kind: "identifier",
        name: objectMethodArgumentCapture.tempName,
        inferredType,
        sourceSpan,
      };
    }

    const elementAccess = TstsSyntax.AsElementAccessExpression(node);
    if (!elementAccess?.Expression || !elementAccess.ArgumentExpression) {
      throw new Error("Invalid TSTS element access expression.");
    }
    const receiver = elementAccess.Expression;
    const argumentExpression = elementAccess.ArgumentExpression;
    // Element access (computed): obj[expr]
    const object = convertExpression(receiver, ctx, undefined);

    const deterministicPropertyName = (() => {
      if (!argumentExpression) return undefined;
      return tryResolveDeterministicPropertyNameFromExpression(
        argumentExpression
      );
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
          receiverArmSelection:
            currentAccessType && object.inferredType?.kind === "unionType"
              ? selectUnionArm({
                  kind: "semanticProjection",
                  sourceType: currentAccessType,
                  targetUnion: object.inferredType,
                })
              : undefined,
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
    const sourceReceiverType = getSourceUseSiteType(receiver, ctx);
    const currentReceiverType =
      chooseUseSiteType(object.inferredType, sourceReceiverType, ctx) ??
      getCurrentTypeForAccessExpression(receiver, ctx);
    const objectType = currentReceiverType ?? object.inferredType;

    // Classify the access kind for proof pass
    // This determines whether source-int proof is required for the index
    const accessKind = classifyComputedAccess(objectType, ctx);

    const narrowedAccessType =
      hasAccessPathNarrowing(node, ctx) || objectType !== undefined
        ? getCurrentTypeForAccessExpression(node, ctx)
        : undefined;

    // Derive element type from object type
    const declaredElementType = deriveElementType(
      objectType,
      ctx,
      argumentExpression
    );
    const elementUseSiteType = getSourceUseSiteType(node, ctx);
    const elementType =
      narrowedAccessType ??
      chooseUseSiteType(declaredElementType, elementUseSiteType, ctx) ??
      declaredElementType;
    const accessProtocol = resolveComputedAccessProtocol(objectType, ctx);

    const baseElementAccess: IrExpression = {
      kind: "memberAccess",
      object,
      property: convertExpression(argumentExpression, ctx, undefined),
      isComputed: true,
      isOptional,
      inferredType: declaredElementType,
      sourceSpan,
      receiverArmSelection:
        currentReceiverType && object.inferredType?.kind === "unionType"
          ? selectUnionArm({
              kind: "semanticProjection",
              sourceType: currentReceiverType,
              targetUnion: object.inferredType,
            })
          : undefined,
      accessKind,
      accessProtocol,
    };
    if (
      narrowedAccessType &&
      shouldWrapExpressionWithAssertion(
            ctx,
            declaredElementType,
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
