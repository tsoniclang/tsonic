/**
 * Property member conversion
 *
 * DETERMINISTIC TYPING: Property types are derived from initializers when
 * no explicit annotation is present, not from TypeScript inference.
 */

import {
  getTstsBodyNode,
  getTstsContainingSourceFile,
  getTstsDeclaredTypeNode,
  getTstsInitializerNode,
  getTstsNodeLocation,
  getTstsParameters,
  getTstsTypeArguments,
  TstsSyntax,
  type TstsNode,
} from "@tsonic/tsts";
import {
  IrBlockStatement,
  IrClassMember,
  IrExpression,
  IrType,
} from "../../../../types.js";
import { convertExpression } from "../../../../expression-converter.js";
import { convertBlockStatement } from "../../control.js";
import {
  definedTstsNodes,
  hasStaticModifier,
  getAccessibility,
  hasReadonlyModifier,
  makeOptionalType,
} from "../../helpers.js";
import { detectOverride } from "./override-detection.js";
import {
  getClassMemberName,
  isPrivateClassMemberName,
} from "./member-names.js";
import type { ProgramContext } from "../../../../program-context.js";
import { createDiagnostic } from "../../../../../types/diagnostic.js";
import {
  fieldSemanticsFactKey,
  isFieldStorageFact,
} from "../../../../../source-frontend/index.js";

/**
 * Derive type from a converted IR expression (deterministic).
 * NO TYPESCRIPT FALLBACK - types must be derivable from IR or undefined.
 */
const deriveTypeFromExpression = (expr: IrExpression): IrType | undefined => {
  // For literals, the inferredType is already set deterministically
  if (expr.kind === "literal") {
    return expr.inferredType;
  }

  // For arrays, derive from first element's type or array's inferredType
  if (expr.kind === "array") {
    if (expr.inferredType) {
      return expr.inferredType;
    }
    // Try to derive from first element
    if (expr.elements.length > 0) {
      const firstElement = expr.elements[0];
      if (firstElement) {
        const elementType = deriveTypeFromExpression(firstElement);
        if (elementType) {
          return { kind: "arrayType", elementType };
        }
      }
    }
    return undefined;
  }

  // For all other expressions, use their inferredType if available
  if ("inferredType" in expr && expr.inferredType) {
    return expr.inferredType;
  }

  // Cannot determine type - return undefined.
  return undefined;
};

const deriveTypeFromGetterBody = (
  body: IrBlockStatement
): IrType | undefined => {
  for (const stmt of body.statements) {
    if (stmt.kind === "returnStatement" && stmt.expression) {
      return deriveTypeFromExpression(stmt.expression);
    }
  }
  return undefined;
};

/**
 * Convert property declaration to IR
 *
 * DETERMINISTIC TYPING: For properties without explicit annotations,
 * the type is derived from the converted initializer expression.
 */
export const convertProperty = (
  node: TstsNode,
  ctx: ProgramContext,
  superClass: TstsNode | undefined
): IrClassMember => {
  const memberName = getClassMemberName(TstsSyntax.Node_Name(node));
  const isEcmaPrivate = isPrivateClassMemberName(TstsSyntax.Node_Name(node));

  const overrideInfo = detectOverride(memberName, "property", superClass, ctx);

  const declaredAccessibility = getAccessibility(node);
  const accessibility = (() => {
    if (!overrideInfo.isOverride || !overrideInfo.requiredAccessibility) {
      return isEcmaPrivate ? "private" : declaredAccessibility;
    }
    // Airplane-grade: always emit native target-required accessibility for overrides.
    // TS may not represent native target access cleanly, but target compilation enforces the truth.
    return overrideInfo.requiredAccessibility;
  })();

  // Detect wrapper types:
  // - field<T> marks a TS class property that should emit as a target field (no accessors).
  //
  // Wrappers may be nested; unwrap repeatedly.
  let emitAsField = false;
  let actualTypeNode: TstsNode | undefined = getTstsDeclaredTypeNode(node);
  while (actualTypeNode) {
    if (actualTypeNode.Kind === TstsSyntax.KindParenthesizedType) {
      actualTypeNode = TstsSyntax.Node_Type(actualTypeNode);
      continue;
    }

    if (!TstsSyntax.IsTypeReferenceNode(actualTypeNode)) break;
    const typeArguments = definedTstsNodes(getTstsTypeArguments(actualTypeNode));
    if (typeArguments.length !== 1) break;
    const inner: TstsNode | undefined = typeArguments[0];
    if (!inner) break;

    if (
      isFieldStorageFact(
        ctx.sourceSemantics.getFact(actualTypeNode, fieldSemanticsFactKey)
      )
    ) {
      emitAsField = true;
      actualTypeNode = inner;
      continue;
    }

    break;
  }

  if (isEcmaPrivate) {
    emitAsField = true;
  }

  if (emitAsField && overrideInfo.isOverride) {
    const sourceFile = getTstsContainingSourceFile(node);
    ctx.diagnostics.push(
      createDiagnostic(
        "TSN6204",
        "error",
        "`field<T>` cannot be used on an overriding property. target fields cannot override base members.",
        getTstsNodeLocation(sourceFile, node),
        "Remove the `field<T>` marker or override as a property instead."
      )
    );
  }

  // Get explicit type annotation (if present) for contextual typing
  // Convert property declaration syntax through the TypeSystem.
  const explicitType = actualTypeNode
    ? ctx.typeSystem.typeFromSyntax(
        ctx.binding.captureTypeSyntax(actualTypeNode)
      )
    : undefined;

  // Convert initializer FIRST (with explicit type as expectedType if present)
  const initializerNode = getTstsInitializerNode(node);
  const convertedInitializer = initializerNode
    ? convertExpression(initializerNode, ctx, explicitType)
    : undefined;

  // Derive property type:
  // 1. Use explicit annotation if present
  // 2. Otherwise derive from converted initializer metadata
  // 3. If no initializer and no annotation, undefined (error at emit time)
  const rawPropertyType = explicitType
    ? explicitType
    : convertedInitializer
      ? deriveTypeFromExpression(convertedInitializer)
      : undefined;

  const propertyType =
    rawPropertyType && TstsSyntax.Node_QuestionToken(node)
      ? makeOptionalType(rawPropertyType)
      : rawPropertyType;

  return {
    kind: "propertyDeclaration",
    name: memberName,
    type: propertyType,
    initializer: convertedInitializer,
    emitAsField: emitAsField || undefined,
    isStatic: hasStaticModifier(node),
    isReadonly: hasReadonlyModifier(node),
    accessibility,
    isOverride: overrideInfo.isOverride ? true : undefined,
    isShadow: overrideInfo.isShadow ? true : undefined,
  };
};

export const convertAccessorProperty = (
  memberName: string,
  getter: TstsNode | undefined,
  setter: TstsNode | undefined,
  ctx: ProgramContext,
  superClass: TstsNode | undefined
): IrClassMember => {
  const overrideInfo = detectOverride(memberName, "property", superClass, ctx);

  const getterTypeNode = getter ? getTstsDeclaredTypeNode(getter) : undefined;
  const getterType = getterTypeNode
    ? ctx.typeSystem.typeFromSyntax(ctx.binding.captureTypeSyntax(getterTypeNode))
    : undefined;

  const setterValueParam = setter
    ? definedTstsNodes(getTstsParameters(setter))[0]
    : undefined;
  const setterValueParamType = setterValueParam
    ? getTstsDeclaredTypeNode(setterValueParam)
    : undefined;
  const setterType =
    setterValueParamType !== undefined
      ? ctx.typeSystem.typeFromSyntax(
          ctx.binding.captureTypeSyntax(setterValueParamType)
        )
      : undefined;

  const explicitType = getterType ?? setterType;

  const getterBodyNode = getter ? getTstsBodyNode(getter) : undefined;
  const getterBody = getterBodyNode
    ? convertBlockStatement(getterBodyNode, ctx, explicitType)
    : undefined;

  const setterBodyNode = setter ? getTstsBodyNode(setter) : undefined;
  const setterBody = setterBodyNode
    ? convertBlockStatement(setterBodyNode, ctx, undefined)
    : undefined;

  const inferredFromGetter = getterBody
    ? deriveTypeFromGetterBody(getterBody)
    : undefined;

  const propertyType = explicitType ?? inferredFromGetter;

  const isStatic = getter
    ? hasStaticModifier(getter)
    : setter
      ? hasStaticModifier(setter)
      : false;

  const accessibility = getter
    ? getAccessibility(getter)
    : setter
      ? getAccessibility(setter)
      : "public";

  const isEcmaPrivate =
    isPrivateClassMemberName(getter ? TstsSyntax.Node_Name(getter) : undefined) ||
    isPrivateClassMemberName(setter ? TstsSyntax.Node_Name(setter) : undefined);

  const finalAccessibility = (() => {
    if (!overrideInfo.isOverride || !overrideInfo.requiredAccessibility) {
      return isEcmaPrivate ? "private" : accessibility;
    }

    return overrideInfo.requiredAccessibility;
  })();

  const setterParamName = (() => {
    if (!setterBody) return undefined;
    const param = setter ? definedTstsNodes(getTstsParameters(setter))[0] : undefined;
    if (!param) return undefined;
    const name = TstsSyntax.Node_Name(param);
    return name && TstsSyntax.IsIdentifier(name)
      ? TstsSyntax.Node_Text(name)
      : undefined;
  })();

  return {
    kind: "propertyDeclaration",
    name: memberName,
    type: propertyType,
    getterBody,
    setterBody,
    setterParamName,
    initializer: undefined,
    isStatic,
    isReadonly: false,
    accessibility: finalAccessibility,
    isOverride: overrideInfo.isOverride ? true : undefined,
    isShadow: overrideInfo.isShadow ? true : undefined,
  };
};
