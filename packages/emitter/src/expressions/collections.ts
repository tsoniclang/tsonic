/**
 * Collection expression emitters (arrays and objects)
 */

import { IrExpression, IrType } from "@tsonic/frontend";
import { EmitterContext, CSharpFragment, addUsing } from "../types.js";
import { emitType } from "../type-emitter.js";
import { emitExpression } from "../expression-emitter.js";

/**
 * Emit an array literal
 */
export const emitArray = (
  expr: Extract<IrExpression, { kind: "array" }>,
  context: EmitterContext,
  expectedType?: IrType
): [CSharpFragment, EmitterContext] => {
  let currentContext = addUsing(context, "System.Collections.Generic");
  const elements: string[] = [];

  // Determine element type from expected type if available
  let elementType = "object";
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

  // Check if array contains only spread elements (e.g., [...arr1, ...arr2])
  const allSpreads = expr.elements.every(
    (el) => el !== undefined && el.kind === "spread"
  );

  if (allSpreads && expr.elements.length > 0) {
    // Emit as chained Concat calls: arr1.Concat(arr2).Concat(arr3)
    // Note: Concat returns IEnumerable<T>, so wrap in ToList() at the end
    const spreadElements = expr.elements.filter(
      (el): el is Extract<IrExpression, { kind: "spread" }> =>
        el !== undefined && el.kind === "spread"
    );

    const firstSpread = spreadElements[0];
    if (!firstSpread) {
      // Should never happen due to allSpreads check, but satisfy TypeScript
      return [{ text: "new List<object>()" }, currentContext];
    }

    const [firstFrag, firstContext] = emitExpression(
      firstSpread.expression,
      currentContext
    );
    currentContext = addUsing(firstContext, "System.Linq");

    let result = firstFrag.text;
    for (let i = 1; i < spreadElements.length; i++) {
      const spread = spreadElements[i];
      if (spread) {
        const [spreadFrag, newContext] = emitExpression(
          spread.expression,
          currentContext
        );
        result = `${result}.Concat(${spreadFrag.text})`;
        currentContext = newContext;
      }
    }

    // Wrap in ToList() to return List<T>
    return [{ text: `${result}.ToList()` }, currentContext];
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
      ? `new List<${elementType}>()`
      : `new List<${elementType}> { ${elements.join(", ")} }`;

  return [{ text }, currentContext];
};

/**
 * Emit an object literal
 */
export const emitObject = (
  expr: Extract<IrExpression, { kind: "object" }>,
  context: EmitterContext
): [CSharpFragment, EmitterContext] => {
  let currentContext = context;
  const properties: string[] = [];

  for (const prop of expr.properties) {
    if (prop.kind === "spread") {
      // Spread in object literal - needs special handling
      properties.push("/* ...spread */");
    } else {
      const key = typeof prop.key === "string" ? prop.key : "/* computed */";
      const [valueFrag, newContext] = emitExpression(
        prop.value,
        currentContext
      );
      properties.push(`${key} = ${valueFrag.text}`);
      currentContext = newContext;
    }
  }

  const text = `new { ${properties.join(", ")} }`;
  return [{ text }, currentContext];
};
