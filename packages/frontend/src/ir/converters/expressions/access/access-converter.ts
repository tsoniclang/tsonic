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
} from "./member-resolution.js";
import {
  resolveHierarchicalBinding,
  resolveHierarchicalBindingFromMemberId,
  resolveExtensionMethodsBinding,
} from "./binding-resolution.js";
import { createDiagnostic } from "../../../../types/diagnostic.js";
import {
  SUPPORTED_IMPORT_META_FIELDS,
  tryConvertImportMetaProperty,
} from "../import-meta.js";
import {
  tryGetObjectLiteralMethodArgumentCapture,
  tryGetObjectLiteralMethodArgumentsLength,
} from "../../../../object-literal-method-runtime.js";

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
    const importMetaExpr = tryConvertImportMetaProperty(node, ctx);
    if (importMetaExpr) return importMetaExpr;
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
    if (
      ts.isMetaProperty(node.expression) &&
      node.expression.keywordToken === ts.SyntaxKind.ImportKeyword &&
      node.expression.name.text === "meta" &&
      !SUPPORTED_IMPORT_META_FIELDS.has(node.name.text)
    ) {
      ctx.diagnostics.push(
        createDiagnostic(
          "TSN2001",
          "error",
          `import.meta.${node.name.text} is not supported in strict AOT mode`,
          getSourceSpan(node),
          "Supported fields: import.meta.url, import.meta.filename, import.meta.dirname"
        )
      );
      return {
        kind: "literal",
        value: undefined,
        raw: "undefined",
        inferredType: { kind: "primitiveType", name: "undefined" },
        sourceSpan,
      };
    }

    const object = convertExpression(node.expression, ctx, undefined);
    const propertyName = node.name.text;

    // Try to resolve hierarchical binding
    const memberBinding =
      resolveExtensionMethodsBinding(node, propertyName, ctx) ??
      resolveHierarchicalBindingFromMemberId(node, propertyName, ctx) ??
      resolveHierarchicalBinding(object, propertyName, ctx);

    // DETERMINISTIC TYPING: Property type comes from NominalEnv + TypeRegistry for
    // user-defined types (including inherited members), with fallback to Binding layer
    // for built-ins and CLR types.
    //
    // The receiver's inferredType enables NominalEnv to walk inheritance chains
    // and substitute type parameters correctly for inherited generic members.
    //
    // Built-ins like string.length work because globals declare them with proper types.
    // If getDeclaredPropertyType returns undefined, it means the property declaration
    // is missing - use unknownType as poison so validation can emit TSN5203.
    //
    // EXCEPTION: If memberBinding exists AND declaredType is undefined, return undefined.
    // This handles pure CLR-bound methods like Console.WriteLine that have no TS declaration.
    const declaredType = getDeclaredPropertyType(
      node,
      object.inferredType,
      ctx
    );

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
    // The emitter uses memberBinding separately for C# casing (e.g., length -> Length).
    //
    // Priority order for inferredType:
    // 1. If declaredType exists, use it (covers built-ins like string.length -> int)
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
      : isNamespaceTypeReference
        ? undefined
        : memberBinding
          ? undefined
          : { kind: "unknownType" as const };
    const allowUnknownInferredType = declaredType?.kind === "unknownType";

    return {
      kind: "memberAccess",
      object,
      property: propertyName,
      isComputed: false,
      isOptional,
      inferredType: propertyInferredType,
      allowUnknownInferredType,
      sourceSpan,
      memberBinding,
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

    const stringLiteralProperty = (() => {
      const arg = node.argumentExpression;
      if (!arg) return undefined;
      if (
        ts.isStringLiteral(arg) ||
        ts.isNoSubstitutionTemplateLiteral(arg)
      ) {
        return /^[$A-Z_a-z][$\w]*$/u.test(arg.text)
          ? arg.text
          : undefined;
      }
      return undefined;
    })();

    if (
      stringLiteralProperty !== undefined &&
      object.inferredType !== undefined &&
      object.inferredType.kind !== "dictionaryType"
    ) {
      const declaredType = ctx.typeSystem.typeOfMember(object.inferredType, {
        kind: "byName",
        name: stringLiteralProperty,
      });
      if (declaredType.kind !== "unknownType") {
        const memberBinding = resolveHierarchicalBinding(
          object,
          stringLiteralProperty,
          ctx
        );
        return {
          kind: "memberAccess",
          object,
          property: stringLiteralProperty,
          isComputed: false,
          isOptional,
          inferredType: declaredType,
          sourceSpan,
          memberBinding,
        };
      }
    }

    // DETERMINISTIC TYPING: Use object's inferredType (not getInferredType)
    const objectType = object.inferredType;

    // Classify the access kind for proof pass
    // This determines whether Int32 proof is required for the index
    const accessKind = classifyComputedAccess(objectType, ctx);

    // Derive element type from object type
    const elementType = deriveElementType(objectType, ctx);
    const allowUnknownInferredType =
      elementType?.kind === "unknownType" &&
      accessKind !== "unknown" &&
      objectType !== undefined &&
      objectType.kind !== "unknownType";

    return {
      kind: "memberAccess",
      object,
      property: convertExpression(node.argumentExpression, ctx, undefined),
      isComputed: true,
      isOptional,
      inferredType: elementType,
      allowUnknownInferredType,
      sourceSpan,
      accessKind,
    };
  }
};
