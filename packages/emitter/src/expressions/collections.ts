/**
 * Collection expression emitters (arrays and objects)
 */

import { IrExpression, IrType } from "@tsonic/frontend";
import { EmitterContext, CSharpFragment } from "../types.js";
import { emitType } from "../type-emitter.js";
import { emitExpression } from "../expression-emitter.js";
import {
  getPropertyType,
  stripNullish,
  resolveTypeAlias,
  selectUnionMemberForObjectLiteral,
} from "../core/type-resolution.js";

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
  // Resolve type alias to check for tuple types
  // (e.g., type Point = [number, number] → resolve Point to the tuple type)
  const resolvedExpectedType = expectedType
    ? resolveTypeAlias(expectedType, context)
    : undefined;

  // Check if expected type is a tuple - emit as ValueTuple
  if (resolvedExpectedType?.kind === "tupleType") {
    return emitTupleLiteral(expr, context, resolvedExpectedType);
  }

  // Check if inferred type is a tuple (already resolved in frontend)
  if (expr.inferredType?.kind === "tupleType") {
    return emitTupleLiteral(expr, context, expr.inferredType);
  }

  let currentContext = context;
  const elements: string[] = [];

  // Determine element type from expected type or inferred type
  // We track both the IR type (for threading to elements) and C# string (for emission)
  let elementType = "object";
  let expectedElementType: IrType | undefined = undefined;

  // Priority 1: Use explicit type annotation if provided (e.g., const arr: number[] = [1, 2, 3])
  // This ensures the array type matches the declared variable type
  // IMPORTANT: Resolve aliases and strip nullish to handle type Longs = long[] etc.
  if (expectedType) {
    const resolvedExpected = resolveTypeAlias(
      stripNullish(expectedType),
      context
    );

    if (resolvedExpected.kind === "arrayType") {
      expectedElementType = resolvedExpected.elementType;
      const [elemTypeStr, newContext] = emitType(
        resolvedExpected.elementType,
        currentContext
      );
      elementType = elemTypeStr;
      currentContext = newContext;
    } else if (
      resolvedExpected.kind === "referenceType" &&
      resolvedExpected.name === "Array" &&
      resolvedExpected.typeArguments &&
      resolvedExpected.typeArguments.length > 0
    ) {
      const firstArg = resolvedExpected.typeArguments[0];
      if (firstArg) {
        expectedElementType = firstArg;
        const [elemTypeStr, newContext] = emitType(firstArg, currentContext);
        elementType = elemTypeStr;
        currentContext = newContext;
      }
    }
  }

  // Priority 2: If no explicit type, infer from literals (e.g., const arr = [1, 2, 3])
  // All integers → int, any decimal → double, all strings → string, all bools → bool
  if (elementType === "object") {
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
        const allNumbers = literals.every(
          (lit) => typeof lit.value === "number"
        );

        if (allNumbers) {
          // Infer int vs long vs double from numericIntent (based on raw lexeme)
          // Any Double → double, any Int64 → long, otherwise → int
          const hasDouble = literals.some(
            (lit) => lit.numericIntent === "Double"
          );
          const hasLong = literals.some((lit) => lit.numericIntent === "Int64");

          if (hasDouble) {
            elementType = "double";
          } else if (hasLong) {
            elementType = "long";
          } else {
            elementType = "int";
          }
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
  }

  // Priority 3: Fall back to inferred type from expression
  // IMPORTANT: Also set expectedElementType so literals get proper suffixes
  if (elementType === "object") {
    if (expr.inferredType && expr.inferredType.kind === "arrayType") {
      expectedElementType = expr.inferredType.elementType;
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
      return [{ text: "new object[0]" }, currentContext];
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

    // Always emit native array via ToArray()
    return [
      { text: `global::System.Linq.Enumerable.ToArray(${result})` },
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
      const [elemFrag, newContext] = emitExpression(
        element,
        currentContext,
        expectedElementType
      );
      elements.push(elemFrag.text);
      currentContext = newContext;
    }
  }

  // Always emit native CLR array
  // Use new T[] { } syntax for non-empty arrays (explicit type for correct suffix handling)
  // Use Array.Empty<T>() for empty arrays (cached singleton, no allocation)
  const text =
    elements.length === 0
      ? `global::System.Array.Empty<${elementType}>()`
      : `new ${elementType}[] { ${elements.join(", ")} }`;

  return [{ text }, currentContext];
};

/**
 * Emit an object literal
 *
 * Handles three cases based on contextual type and structure:
 * 1. Dictionary type (Record<K,V> or index signature) → Dictionary<string, T> initializer
 * 2. Object with spreads → IIFE pattern: (() => { var __tmp = new T(); ... return __tmp; })()
 * 3. Nominal type (interface, class) → new TypeName { prop = value, ... }
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

  // Check for contextual type (from return type, variable annotation, etc.)
  // Strip null/undefined from type - `new T? { ... }` is invalid C#, use `new T { ... }`
  const strippedType: IrType | undefined = effectiveType
    ? stripNullish(effectiveType)
    : undefined;

  // Handle union type aliases: select the best-matching union member
  // e.g., for `type Result<T,E> = { ok: true; value: T } | { ok: false; error: E }`
  // we want to emit `new Result__0<T,E> { ... }` not `new Result<T,E> { ... }`
  const instantiationType: IrType | undefined = (() => {
    if (!strippedType) return undefined;

    const resolved = resolveTypeAlias(strippedType, currentContext);
    if (resolved.kind !== "unionType") return strippedType;

    // Extract only plain string keys from the literal
    const literalKeys = expr.properties
      .filter(
        (p): p is Extract<typeof p, { kind: "property" }> =>
          p.kind === "property" && typeof p.key === "string"
      )
      .map((p) => p.key as string);

    // If any property is not a plain string key, cannot match
    if (literalKeys.length !== expr.properties.length) return strippedType;

    const selected = selectUnionMemberForObjectLiteral(
      resolved,
      literalKeys,
      currentContext
    );
    return selected ?? strippedType;
  })();

  const [typeName, typeContext] = resolveContextualType(
    instantiationType,
    currentContext
  );
  currentContext = typeContext;

  if (!typeName) {
    // ICE: Validation (TSN7403) should have caught anonymous object literals
    throw new Error(
      "ICE: Object literal without contextual type reached emitter - validation missed TSN7403"
    );
  }

  // Safety net: strip trailing `?` from type name (e.g., `Option<T>?` → `Option<T>`)
  // `new T? { ... }` is never valid C# syntax
  const safeTypeName = typeName.endsWith("?")
    ? typeName.slice(0, -1)
    : typeName;

  // Check if object has spreads - use IIFE pattern for spread lowering
  if (expr.hasSpreads) {
    return emitObjectWithSpreads(
      expr,
      currentContext,
      effectiveType,
      safeTypeName
    );
  }

  // Regular object literal with nominal type - no spreads
  const properties: string[] = [];

  for (const prop of expr.properties) {
    if (prop.kind === "spread") {
      // Should not reach here if hasSpreads is correctly set
      throw new Error("ICE: Spread in object literal but hasSpreads is false");
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

  const text = `new ${safeTypeName} { ${properties.join(", ")} }`;
  return [{ text }, currentContext];
};

/**
 * Emit an object literal with spreads using IIFE pattern.
 *
 * Input:  { ...base, y: 2 }
 * Output: ((global::System.Func<T>)(() => { var __tmp = new T(); __tmp.x = base.x; __tmp.y = 2.0; return __tmp; }))()
 *
 * Properties are set in order: spread properties first, then explicit properties.
 * Later properties override earlier ones (JavaScript semantics).
 */
const emitObjectWithSpreads = (
  expr: Extract<IrExpression, { kind: "object" }>,
  context: EmitterContext,
  effectiveType: IrType | undefined,
  typeName: string
): [CSharpFragment, EmitterContext] => {
  let currentContext = context;
  const assignments: string[] = [];

  for (const prop of expr.properties) {
    if (prop.kind === "spread") {
      // Spread: copy all properties from spread source
      const [spreadAssignments, newContext] = emitSpreadPropertyCopies(
        prop.expression,
        currentContext
      );
      assignments.push(...spreadAssignments);
      currentContext = newContext;
    } else {
      // Explicit property assignment
      const key = typeof prop.key === "string" ? prop.key : "/* computed */";
      const propertyExpectedType =
        typeof prop.key === "string"
          ? getPropertyType(effectiveType, prop.key, currentContext)
          : undefined;
      const [valueFrag, newContext] = emitExpression(
        prop.value,
        currentContext,
        propertyExpectedType
      );
      assignments.push(`__tmp.${key} = ${valueFrag.text}`);
      currentContext = newContext;
    }
  }

  // Build IIFE: ((Func<T>)(() => { var __tmp = new T(); ...; return __tmp; }))()
  const body = [
    `var __tmp = new ${typeName}()`,
    ...assignments,
    "return __tmp",
  ].join("; ");

  const text = `((global::System.Func<${typeName}>)(() => { ${body}; }))()`;
  return [{ text }, currentContext];
};

/**
 * Emit property copy assignments from a spread source.
 *
 * For `...base` where base has type { x: number, y: string }:
 * Returns ["__tmp.x = base.x", "__tmp.y = base.y"]
 */
const emitSpreadPropertyCopies = (
  spreadExpr: IrExpression,
  context: EmitterContext
): [string[], EmitterContext] => {
  let currentContext = context;
  const assignments: string[] = [];

  // Get the spread expression's type to know which properties to copy
  const spreadType = spreadExpr.inferredType;

  if (!spreadType) {
    // No type info - emit a warning comment
    const [exprFrag, newContext] = emitExpression(spreadExpr, currentContext);
    assignments.push(`/* spread: ${exprFrag.text} (no type info) */`);
    return [assignments, newContext];
  }

  // Emit the spread source expression
  const [sourceFrag, sourceContext] = emitExpression(
    spreadExpr,
    currentContext
  );
  currentContext = sourceContext;
  const sourceExpr = sourceFrag.text;

  // Extract properties from the spread type
  const propertyNames = getObjectTypePropertyNames(spreadType, currentContext);

  for (const propName of propertyNames) {
    assignments.push(`__tmp.${propName} = ${sourceExpr}.${propName}`);
  }

  return [assignments, currentContext];
};

/**
 * Get property names from an object-like type.
 * Handles objectType, referenceType (to interfaces/classes), and resolved type aliases.
 */
const getObjectTypePropertyNames = (
  type: IrType,
  context: EmitterContext
): readonly string[] => {
  // Direct object type
  if (type.kind === "objectType") {
    return type.members
      .filter(
        (m): m is Extract<typeof m, { kind: "propertySignature" }> =>
          m.kind === "propertySignature"
      )
      .map((m) => m.name);
  }

  // Reference type - check type aliases registry
  if (type.kind === "referenceType") {
    const resolved = resolveTypeAlias(type, context);
    if (resolved.kind === "objectType") {
      return resolved.members
        .filter(
          (m): m is Extract<typeof m, { kind: "propertySignature" }> =>
            m.kind === "propertySignature"
        )
        .map((m) => m.name);
    }
    // Check localTypes for interface members
    const localType = context.localTypes?.get(type.name);
    if (localType?.kind === "interface") {
      return localType.members
        .filter(
          (m): m is Extract<typeof m, { kind: "propertySignature" }> =>
            m.kind === "propertySignature"
        )
        .map((m) => m.name);
    }
  }

  // Unknown type structure - return empty
  return [];
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
 * Allowed: string, number (→ double).
 * Enforced by TSN7413.
 */
const emitDictKeyType = (
  keyType: IrType,
  context: EmitterContext
): [string, EmitterContext] => {
  if (keyType.kind === "primitiveType") {
    switch (keyType.name) {
      case "string":
        return ["string", context];
      case "number":
        return ["double", context];
    }
  }

  // ICE: Unsupported key type (should have been caught by TSN7413)
  throw new Error(
    `ICE: Unsupported dictionary key type reached emitter - validation missed TSN7413. Got: ${JSON.stringify(keyType)}`
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

/**
 * Emit a tuple literal as ValueTuple.
 *
 * Input:  const t: [string, number] = ["hello", 42];
 * Output: ("hello", 42.0)
 *
 * C# ValueTuple has implicit tuple literal syntax with parentheses.
 */
const emitTupleLiteral = (
  expr: Extract<IrExpression, { kind: "array" }>,
  context: EmitterContext,
  tupleType: Extract<IrType, { kind: "tupleType" }>
): [CSharpFragment, EmitterContext] => {
  let currentContext = context;
  const elements: string[] = [];

  const definedElements = expr.elements.filter(
    (el): el is IrExpression => el !== undefined
  );

  // Emit each element with its expected type from the tuple type
  for (let i = 0; i < definedElements.length; i++) {
    const element = definedElements[i];
    const expectedElementType = tupleType.elementTypes[i];

    if (element) {
      const [elemFrag, newContext] = emitExpression(
        element,
        currentContext,
        expectedElementType
      );
      elements.push(elemFrag.text);
      currentContext = newContext;
    }
  }

  // Emit as tuple literal: (elem1, elem2, ...)
  const text = `(${elements.join(", ")})`;
  return [{ text }, currentContext];
};
