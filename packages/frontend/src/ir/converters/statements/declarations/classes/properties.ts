/**
 * Property member conversion
 *
 * DETERMINISTIC TYPING: Property types are derived from initializers when
 * no explicit annotation is present, not from TypeScript inference.
 */

import * as ts from "typescript";
import {
  IrBlockStatement,
  IrClassMember,
  IrExpression,
  IrType,
} from "../../../../types.js";
import { convertExpression } from "../../../../expression-converter.js";
import { convertBlockStatement } from "../../control.js";
import {
  hasStaticModifier,
  hasReadonlyModifier,
  getAccessibility,
  makeOptionalType,
} from "../../helpers.js";
import { detectOverride } from "./override-detection.js";
import type { ProgramContext } from "../../../../program-context.js";
import { createDiagnostic } from "../../../../../types/diagnostic.js";
import { getSourceLocation } from "../../../../../program/diagnostics.js";

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

  // Cannot determine type - return undefined (no TypeScript fallback)
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
  node: ts.PropertyDeclaration,
  ctx: ProgramContext,
  superClass: ts.ExpressionWithTypeArguments | undefined
): IrClassMember => {
  const memberName = ts.isIdentifier(node.name) ? node.name.text : "[computed]";

  const overrideInfo = detectOverride(memberName, "property", superClass, ctx);

  const declaredAccessibility = getAccessibility(node);
  const accessibility = (() => {
    if (!overrideInfo.isOverride || !overrideInfo.requiredAccessibility) {
      return declaredAccessibility;
    }
    // Airplane-grade: always emit CLR-required accessibility for overrides.
    // TS may not represent CLR access cleanly, but C# compilation enforces the truth.
    return overrideInfo.requiredAccessibility;
  })();

  // Detect wrapper types:
  // - field<T> marks a TS class property that should emit as a C# field (no accessors).
  //
  // Wrappers may be nested; unwrap repeatedly.
  let emitAsField = false;
  let actualTypeNode: ts.TypeNode | undefined = node.type;
  while (actualTypeNode) {
    if (ts.isParenthesizedTypeNode(actualTypeNode)) {
      actualTypeNode = actualTypeNode.type;
      continue;
    }

    if (!ts.isTypeReferenceNode(actualTypeNode)) break;
    if (!ts.isIdentifier(actualTypeNode.typeName)) break;
    if (
      !actualTypeNode.typeArguments ||
      actualTypeNode.typeArguments.length !== 1
    )
      break;
    const inner: ts.TypeNode | undefined = actualTypeNode.typeArguments[0];
    if (!inner) break;

    const wrapperName = actualTypeNode.typeName.text;
    if (wrapperName === "field") {
      emitAsField = true;
      actualTypeNode = inner;
      continue;
    }

    break;
  }

  if (emitAsField && overrideInfo.isOverride) {
    const sf = node.getSourceFile();
    ctx.diagnostics.push(
      createDiagnostic(
        "TSN6204",
        "error",
        "`field<T>` cannot be used on an overriding property. C# fields cannot override base members.",
        getSourceLocation(sf, node.getStart(sf), node.getWidth(sf)),
        "Remove the `field<T>` marker or override as a property instead."
      )
    );
  }

  // Get explicit type annotation (if present) for contextual typing
  // PHASE 4 (Alice's spec): Use captureTypeSyntax + typeFromSyntax
  const explicitType = actualTypeNode
    ? ctx.typeSystem.typeFromSyntax(
        ctx.binding.captureTypeSyntax(actualTypeNode)
      )
    : undefined;

  // Convert initializer FIRST (with explicit type as expectedType if present)
  const convertedInitializer = node.initializer
    ? convertExpression(node.initializer, ctx, explicitType)
    : undefined;

  // Derive property type:
  // 1. Use explicit annotation if present
  // 2. Otherwise derive from converted initializer (NO TypeScript fallback)
  // 3. If no initializer and no annotation, undefined (error at emit time)
  const rawPropertyType = explicitType
    ? explicitType
    : convertedInitializer
      ? deriveTypeFromExpression(convertedInitializer)
      : undefined;

  const propertyType =
    rawPropertyType && node.questionToken
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
  getter: ts.GetAccessorDeclaration | undefined,
  setter: ts.SetAccessorDeclaration | undefined,
  ctx: ProgramContext,
  superClass: ts.ExpressionWithTypeArguments | undefined
): IrClassMember => {
  const overrideInfo = detectOverride(memberName, "property", superClass, ctx);

  const getterType = getter?.type
    ? ctx.typeSystem.typeFromSyntax(ctx.binding.captureTypeSyntax(getter.type))
    : undefined;

  const setterValueParam = setter?.parameters[0];
  const setterType =
    setterValueParam?.type !== undefined
      ? ctx.typeSystem.typeFromSyntax(
          ctx.binding.captureTypeSyntax(setterValueParam.type)
        )
      : undefined;

  const explicitType = getterType ?? setterType;

  const getterBody = getter?.body
    ? convertBlockStatement(getter.body, ctx, explicitType)
    : undefined;

  const setterBody = setter?.body
    ? convertBlockStatement(setter.body, ctx, undefined)
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

  const finalAccessibility = (() => {
    if (!overrideInfo.isOverride || !overrideInfo.requiredAccessibility) {
      return accessibility;
    }

    return overrideInfo.requiredAccessibility;
  })();

  const setterParamName = (() => {
    if (!setterBody) return undefined;
    const param = setter?.parameters[0];
    if (!param) return undefined;
    return ts.isIdentifier(param.name) ? param.name.text : undefined;
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
