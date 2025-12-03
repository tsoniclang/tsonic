/**
 * Collection expression emitters (arrays and objects)
 */

import { IrExpression, IrType } from "@tsonic/frontend";
import { EmitterContext, CSharpFragment } from "../types.js";
import { emitType } from "../type-emitter.js";
import { emitExpression } from "../expression-emitter.js";
import { getPropertyType } from "../core/type-resolution.js";

/**
 * Escape a string for use in a C# string literal.
 * Handles backslashes, quotes, newlines, carriage returns, and tabs.
 */
const escapeCSharpString = (str: string): string =>
  str
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");

/**
 * Emit an array literal
 */
export const emitArray = (
  expr: Extract<IrExpression, { kind: "array" }>,
  context: EmitterContext,
  expectedType?: IrType
): [CSharpFragment, EmitterContext] => {
  let currentContext = context;
  const elements: string[] = [];

  // Determine element type from expected type or inferred type
  let elementType = "object";

  // Check if all elements are literals to infer element type
  const definedElements = expr.elements.filter(
    (el): el is IrExpression => el !== undefined
  );

  if (definedElements.length > 0) {
    const allLiterals = definedElements.every((el) => el.kind === "literal");

    if (allLiterals) {
      const literals = definedElements as Extract<
        IrExpression,
        { kind: "literal" }
      >[];

      // Check if all are numbers
      const allNumbers = literals.every((lit) => typeof lit.value === "number");

      if (allNumbers) {
        // TypeScript `number` is always `double` in C#
        // Even if all literals are integers, use double for TS semantics
        elementType = "double";
      }
      // Check if all are strings
      else if (literals.every((lit) => typeof lit.value === "string")) {
        elementType = "string";
      }
      // Check if all are booleans
      else if (literals.every((lit) => typeof lit.value === "boolean")) {
        elementType = "bool";
      }
    }
  }

  // Use expected/inferred type if available (takes precedence over literal inference)
  if (expectedType) {
    if (expectedType.kind === "arrayType") {
      const [elemTypeStr, newContext] = emitType(
        expectedType.elementType,
        currentContext
      );
      elementType = elemTypeStr;
      currentContext = newContext;
    } else if (
      expectedType.kind === "referenceType" &&
      expectedType.name === "Array" &&
      expectedType.typeArguments &&
      expectedType.typeArguments.length > 0
    ) {
      const firstArg = expectedType.typeArguments[0];
      if (firstArg) {
        const [elemTypeStr, newContext] = emitType(firstArg, currentContext);
        elementType = elemTypeStr;
        currentContext = newContext;
      }
    }
  }
  // If no expectedType, try to use the inferredType from the expression
  else if (expr.inferredType && expr.inferredType.kind === "arrayType") {
    // Only use inferredType if we didn't already determine the type from literals
    if (elementType === "object") {
      const [elemTypeStr, newContext] = emitType(
        expr.inferredType.elementType,
        currentContext
      );
      elementType = elemTypeStr;
      currentContext = newContext;
    }
  }

  // Check if array contains only spread elements (e.g., [...arr1, ...arr2])
  const allSpreads = expr.elements.every(
    (el) => el !== undefined && el.kind === "spread"
  );

  if (allSpreads && expr.elements.length > 0) {
    // Emit as chained Enumerable.Concat calls using explicit static invocation
    // Note: Concat returns IEnumerable<T>, so wrap in Enumerable.ToList() at the end
    const spreadElements = expr.elements.filter(
      (el): el is Extract<IrExpression, { kind: "spread" }> =>
        el !== undefined && el.kind === "spread"
    );

    const firstSpread = spreadElements[0];
    if (!firstSpread) {
      // Should never happen due to allSpreads check, but satisfy TypeScript
      return [
        { text: "new global::System.Collections.Generic.List<object>()" },
        currentContext,
      ];
    }

    const [firstFrag, firstContext] = emitExpression(
      firstSpread.expression,
      currentContext
    );
    currentContext = firstContext;

    let result = firstFrag.text;
    for (let i = 1; i < spreadElements.length; i++) {
      const spread = spreadElements[i];
      if (spread) {
        const [spreadFrag, newContext] = emitExpression(
          spread.expression,
          currentContext
        );
        // Use explicit static call for extension method
        result = `global::System.Linq.Enumerable.Concat(${result}, ${spreadFrag.text})`;
        currentContext = newContext;
      }
    }

    // Wrap in Enumerable.ToList() using explicit static call
    return [
      { text: `global::System.Linq.Enumerable.ToList(${result})` },
      currentContext,
    ];
  }

  // Regular array or mixed spreads/elements
  for (const element of expr.elements) {
    if (element === undefined) {
      // Sparse array hole - fill with default value
      elements.push("default");
    } else if (element.kind === "spread") {
      // Spread mixed with other elements - not yet supported
      elements.push("/* ...spread */");
    } else {
      const [elemFrag, newContext] = emitExpression(element, currentContext);
      elements.push(elemFrag.text);
      currentContext = newContext;
    }
  }

  // Use constructor syntax for empty arrays, initializer syntax for non-empty
  const text =
    elements.length === 0
      ? `new global::System.Collections.Generic.List<${elementType}>()`
      : `new global::System.Collections.Generic.List<${elementType}> { ${elements.join(", ")} }`;

  return [{ text }, currentContext];
};

/**
 * Emit an object literal
 *
 * Handles two cases based on contextual type:
 * 1. Dictionary type (Record<K,V> or index signature) → Dictionary<string, T> initializer
 * 2. Nominal type (interface, class) → new TypeName { prop = value, ... }
 *
 * Anonymous object types should be caught by validation (TSN7403) before reaching here.
 *
 * @param expr - The object expression
 * @param context - Emitter context
 * @param expectedType - Optional expected type (for property type resolution in generic contexts)
 */
export const emitObject = (
  expr: Extract<IrExpression, { kind: "object" }>,
  context: EmitterContext,
  expectedType?: IrType
): [CSharpFragment, EmitterContext] => {
  let currentContext = context;

  // Use expectedType if provided, fall back to contextualType
  const effectiveType = expectedType ?? expr.contextualType;

  // Check if contextual type is a dictionary type
  if (effectiveType?.kind === "dictionaryType") {
    return emitDictionaryLiteral(expr, currentContext, effectiveType);
  }

  // Regular object literal with nominal type
  const properties: string[] = [];

  for (const prop of expr.properties) {
    if (prop.kind === "spread") {
      // Spread in object literal - needs special handling
      properties.push("/* ...spread */");
    } else {
      const key = typeof prop.key === "string" ? prop.key : "/* computed */";
      // Resolve property type from contextual type for generic null→default handling
      const propertyExpectedType =
        typeof prop.key === "string"
          ? getPropertyType(effectiveType, prop.key, currentContext)
          : undefined;
      const [valueFrag, newContext] = emitExpression(
        prop.value,
        currentContext,
        propertyExpectedType
      );
      properties.push(`${key} = ${valueFrag.text}`);
      currentContext = newContext;
    }
  }

  // Check for contextual type (from return type, variable annotation, etc.)
  // If present, emit `new TypeName { ... }` instead of anonymous `new { ... }`
  const [typeName, finalContext] = resolveContextualType(
    effectiveType,
    currentContext
  );

  if (!typeName) {
    // ICE: Validation (TSN7403) should have caught anonymous object literals
    throw new Error(
      "ICE: Object literal without contextual type reached emitter - validation missed TSN7403"
    );
  }

  const text = `new ${typeName} { ${properties.join(", ")} }`;
  return [{ text }, finalContext];
};

/**
 * Emit a dictionary literal using C# collection initializer syntax.
 *
 * Input:  const d: Record<string, number> = { a: 1, b: 2 };
 * Output: new Dictionary<string, double> { ["a"] = 1.0, ["b"] = 2.0 }
 */
const emitDictionaryLiteral = (
  expr: Extract<IrExpression, { kind: "object" }>,
  context: EmitterContext,
  dictType: Extract<IrType, { kind: "dictionaryType" }>
): [CSharpFragment, EmitterContext] => {
  let currentContext = context;

  // Get key and value type strings
  const [keyTypeStr, ctx1] = emitDictKeyType(dictType.keyType, currentContext);
  const [valueTypeStr, ctx2] = emitType(dictType.valueType, ctx1);
  currentContext = ctx2;

  // Emit dictionary entries
  const entries: string[] = [];

  for (const prop of expr.properties) {
    if (prop.kind === "spread") {
      // Spread in dictionary literal - not supported
      throw new Error("ICE: Spread in dictionary literal not supported");
    } else {
      // Key must be a string literal for dictionary initialization
      if (typeof prop.key !== "string") {
        throw new Error(
          "ICE: Computed property key in dictionary literal - validation gap"
        );
      }

      // Pass dictionary value type as expectedType for generic null→default handling
      const [valueFrag, newContext] = emitExpression(
        prop.value,
        currentContext,
        dictType.valueType
      );
      entries.push(`["${escapeCSharpString(prop.key)}"] = ${valueFrag.text}`);
      currentContext = newContext;
    }
  }

  const text =
    entries.length === 0
      ? `new global::System.Collections.Generic.Dictionary<${keyTypeStr}, ${valueTypeStr}>()`
      : `new global::System.Collections.Generic.Dictionary<${keyTypeStr}, ${valueTypeStr}> { ${entries.join(", ")} }`;

  return [{ text }, currentContext];
};

/**
 * Emit dictionary key type.
 * TS dictionaries only support string keys (enforced by TSN7413).
 */
const emitDictKeyType = (
  keyType: IrType,
  context: EmitterContext
): [string, EmitterContext] => {
  if (keyType.kind === "primitiveType" && keyType.name === "string") {
    return ["string", context];
  }

  // ICE: Only string keys allowed (enforced by TSN7413)
  throw new Error(
    `ICE: Non-string dictionary key type reached emitter - validation missed TSN7413. Got: ${keyType.kind}`
  );
};

/**
 * Resolve contextual type to C# type string.
 * Uses emitType to properly handle generic type arguments.
 * For imported types, qualifies using importBindings.
 */
const resolveContextualType = (
  contextualType: IrType | undefined,
  context: EmitterContext
): [string | undefined, EmitterContext] => {
  if (!contextualType) {
    return [undefined, context];
  }

  // For reference types, check if imported and qualify if needed
  if (contextualType.kind === "referenceType") {
    const typeName = contextualType.name;
    const importBinding = context.importBindings?.get(typeName);

    if (importBinding && importBinding.kind === "type") {
      // Imported type - use qualified name from binding
      // Emit type arguments if present
      if (
        contextualType.typeArguments &&
        contextualType.typeArguments.length > 0
      ) {
        let currentContext = context;
        const typeArgStrs: string[] = [];
        for (const typeArg of contextualType.typeArguments) {
          const [typeArgStr, newContext] = emitType(typeArg, currentContext);
          typeArgStrs.push(typeArgStr);
          currentContext = newContext;
        }
        return [
          `${importBinding.clrName}<${typeArgStrs.join(", ")}>`,
          currentContext,
        ];
      }
      return [importBinding.clrName, context];
    }

    // Local type - use emitType to handle type arguments
    const [typeStr, newContext] = emitType(contextualType, context);
    return [typeStr, newContext];
  }

  // For other types, use standard emitType
  const [typeStr, newContext] = emitType(contextualType, context);
  return [typeStr, newContext];
};
