/**
 * Member access expression converter orchestrator
 *
 * Combines member-resolution and binding-resolution to convert
 * property access and element access expressions.
 */

import * as ts from "typescript";
import { pathToFileURL } from "node:url";
import { dirname } from "node:path";
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

const SUPPORTED_IMPORT_META_FIELDS = new Set(["url", "filename", "dirname"]);
const DYNAMIC_ANY_TYPE_NAME = "__TSONIC_ANY";

const isDynamicAnyType = (type: IrExpression["inferredType"]): boolean => {
  if (!type) return false;
  if (type.kind === "referenceType") {
    return type.name === DYNAMIC_ANY_TYPE_NAME;
  }
  if (type.kind === "unionType" || type.kind === "intersectionType") {
    return type.types.some((member) => isDynamicAnyType(member));
  }
  return false;
};

const tryConvertImportMetaProperty = (
  node: ts.PropertyAccessExpression,
  ctx: ProgramContext
): IrExpression | undefined => {
  if (!ts.isMetaProperty(node.expression)) return undefined;
  if (
    node.expression.keywordToken !== ts.SyntaxKind.ImportKeyword ||
    node.expression.name.text !== "meta"
  ) {
    return undefined;
  }

  const filePath = node.getSourceFile().fileName.replace(/\\/g, "/");
  const field = node.name.text;
  const sourceSpan = getSourceSpan(node);

  if (!SUPPORTED_IMPORT_META_FIELDS.has(field)) {
    ctx.diagnostics.push(
      createDiagnostic(
        "TSN2001",
        "error",
        `import.meta.${field} is not supported in strict AOT mode`,
        sourceSpan,
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

  const value =
    field === "url"
      ? pathToFileURL(filePath).href
      : field === "dirname"
        ? dirname(filePath).replace(/\\/g, "/")
        : filePath;

  return {
    kind: "literal",
    value,
    raw: JSON.stringify(value),
    inferredType: { kind: "primitiveType", name: "string" },
    sourceSpan,
  };
};

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

    const object = convertExpression(node.expression, ctx, undefined);
    const propertyName = node.name.text;

    if (isDynamicAnyType(object.inferredType)) {
      return {
        kind: "memberAccess",
        object,
        property: propertyName,
        isComputed: false,
        isOptional,
        inferredType: { kind: "referenceType", name: DYNAMIC_ANY_TYPE_NAME },
        sourceSpan,
      };
    }

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

    return {
      kind: "memberAccess",
      object,
      property: propertyName,
      isComputed: false,
      isOptional,
      inferredType: propertyInferredType,
      sourceSpan,
      memberBinding,
    };
  } else {
    // Element access (computed): obj[expr]
    const object = convertExpression(node.expression, ctx, undefined);

    if (isDynamicAnyType(object.inferredType)) {
      return {
        kind: "memberAccess",
        object,
        property: convertExpression(node.argumentExpression, ctx, undefined),
        isComputed: true,
        isOptional,
        inferredType: { kind: "referenceType", name: DYNAMIC_ANY_TYPE_NAME },
        sourceSpan,
        accessKind: "dictionary",
      };
    }

    // DETERMINISTIC TYPING: Use object's inferredType (not getInferredType)
    const objectType = object.inferredType;

    // Classify the access kind for proof pass
    // This determines whether Int32 proof is required for the index
    const accessKind = classifyComputedAccess(objectType, ctx);

    // Derive element type from object type
    const elementType = deriveElementType(objectType, ctx);

    return {
      kind: "memberAccess",
      object,
      property: convertExpression(node.argumentExpression, ctx, undefined),
      isComputed: true,
      isOptional,
      inferredType: elementType,
      sourceSpan,
      accessKind,
    };
  }
};
