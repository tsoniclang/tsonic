/**
 * Member access expression emitters
 */

import { IrExpression } from "@tsonic/frontend";
import { EmitterContext, CSharpFragment, addUsing } from "../types.js";
import { emitExpression } from "../expression-emitter.js";
import {
  isExplicitViewProperty,
  extractInterfaceNameFromView,
} from "@tsonic/frontend/types/explicit-views.js";

/**
 * Emit a member access expression (dot notation or bracket notation)
 */
export const emitMemberAccess = (
  expr: Extract<IrExpression, { kind: "memberAccess" }>,
  context: EmitterContext
): [CSharpFragment, EmitterContext] => {
  // Check if this is a hierarchical member binding
  if (expr.memberBinding) {
    // Emit the full CLR type and member from the binding
    const { assembly, type, member } = expr.memberBinding;
    const updatedContext = addUsing(context, assembly);
    const text = `${type}.${member}`;
    return [{ text }, updatedContext];
  }

  const [objectFrag, newContext] = emitExpression(expr.object, context);

  if (expr.isComputed) {
    // Check if this is array index access - rewrite to static helper
    const objectType = expr.object.inferredType;
    const isArrayType = objectType?.kind === "arrayType";

    if (isArrayType && context.options.runtime !== "dotnet") {
      // In JS runtime mode, rewrite: arr[index] → Tsonic.Runtime.Array.get(arr, index)
      const indexContext = { ...newContext, isArrayIndex: true };
      const [propFrag, contextWithIndex] = emitExpression(
        expr.property as IrExpression,
        indexContext
      );
      const finalContext = addUsing(
        { ...contextWithIndex, isArrayIndex: false },
        "Tsonic.Runtime"
      );
      const text = `Tsonic.Runtime.Array.get(${objectFrag.text}, ${propFrag.text})`;
      return [{ text }, finalContext];
    }

    // Regular computed access
    const indexContext = { ...newContext, isArrayIndex: true };
    const [propFrag, contextWithIndex] = emitExpression(
      expr.property as IrExpression,
      indexContext
    );
    const finalContext = { ...contextWithIndex, isArrayIndex: false };
    const accessor = expr.isOptional ? "?[" : "[";

    // In dotnet mode with arrays, check if we need to cast index to int
    if (isArrayType && context.options.runtime === "dotnet") {
      const indexExpr = expr.property as IrExpression;
      // Check if the index is a numeric literal (which gets emitted as double)
      const needsCast =
        indexExpr.kind === "literal" && typeof indexExpr.value === "number";

      if (needsCast) {
        const text = `${objectFrag.text}${accessor}(int)${propFrag.text}]`;
        return [{ text }, finalContext];
      }
    }

    const text = `${objectFrag.text}${accessor}${propFrag.text}]`;
    return [{ text }, finalContext];
  }

  // Property access
  const prop = expr.property as string;
  const objectType = expr.object.inferredType;
  const isArrayType = objectType?.kind === "arrayType";

  // In JS runtime mode, rewrite array.length → Tsonic.Runtime.Array.length(array)
  if (
    isArrayType &&
    prop === "length" &&
    context.options.runtime !== "dotnet"
  ) {
    const updatedContext = addUsing(newContext, "Tsonic.Runtime");
    const text = `Tsonic.Runtime.Array.length(${objectFrag.text})`;
    return [{ text }, updatedContext];
  }

  // In dotnet mode, List<> uses Count property instead of length
  if (
    isArrayType &&
    prop === "length" &&
    context.options.runtime === "dotnet"
  ) {
    const text = `${objectFrag.text}.Count`;
    return [{ text }, newContext];
  }

  // Handle explicit interface view properties (As_IInterface)
  if (isExplicitViewProperty(prop)) {
    const interfaceName = extractInterfaceNameFromView(prop);
    if (interfaceName) {
      // Emit as C# interface cast: ((IInterface)obj)
      // TODO: Need to look up full interface name from metadata
      // For now, use the extracted short name
      const text = `((${interfaceName})${objectFrag.text})`;
      return [{ text }, newContext];
    }
  }

  // Regular property access
  const accessor = expr.isOptional ? "?." : ".";
  const text = `${objectFrag.text}${accessor}${prop}`;
  return [{ text }, newContext];
};
