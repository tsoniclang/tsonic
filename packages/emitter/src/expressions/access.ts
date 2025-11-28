/**
 * Member access expression emitters
 */

import { IrExpression } from "@tsonic/frontend";
import { EmitterContext, CSharpFragment } from "../types.js";
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
    // Emit the full CLR type and member with global:: prefix
    const { assembly, type, member } = expr.memberBinding;
    const text = `global::${assembly}.${type}.${member}`;
    return [{ text }, context];
  }

  const [objectFrag, newContext] = emitExpression(expr.object, context);

  // Default runtime to "js" when not specified
  const runtime = context.options.runtime ?? "js";

  if (expr.isComputed) {
    // Check if this is array index access - rewrite to static helper
    const objectType = expr.object.inferredType;
    const isArrayType = objectType?.kind === "arrayType";

    // For TS arrays, use Tsonic.Runtime.Array.get() in BOTH modes
    // This provides TS array semantics (auto-grow, sparse arrays, etc.)
    // Note: Tsonic.Runtime is compiler support for lowered TS constructs (both modes)
    //       Tsonic.JSRuntime is JS built-ins like .map/.filter (js mode only)
    if (isArrayType) {
      const indexContext = { ...newContext, isArrayIndex: true };
      const [propFrag, contextWithIndex] = emitExpression(
        expr.property as IrExpression,
        indexContext
      );
      const finalContext = { ...contextWithIndex, isArrayIndex: false };
      const text = `global::Tsonic.Runtime.Array.get(${objectFrag.text}, ${propFrag.text})`;
      return [{ text }, finalContext];
    }

    // CLR indexer access (non-TS-array types like List<T>, string, etc.)
    // CLR indexers require integral indices.
    // This applies in BOTH js and dotnet modes - CLR type requirements are mode-independent.
    const indexContext = { ...newContext, isArrayIndex: true };
    const [propFrag, contextWithIndex] = emitExpression(
      expr.property as IrExpression,
      indexContext
    );
    const finalContext = { ...contextWithIndex, isArrayIndex: false };
    const accessor = expr.isOptional ? "?[" : "[";

    // Check if the index is already known to be int (e.g., canonical loop counter)
    const indexExpr = expr.property as IrExpression;
    const isKnownInt =
      indexExpr.kind === "identifier" &&
      context.intLoopVars?.has(indexExpr.name);

    // Skip cast if index is known int, otherwise cast for safety
    const indexText = isKnownInt ? propFrag.text : `(int)(${propFrag.text})`;
    const text = `${objectFrag.text}${accessor}${indexText}]`;
    return [{ text }, finalContext];
  }

  // Property access
  const prop = expr.property as string;
  const objectType = expr.object.inferredType;
  const isArrayType = objectType?.kind === "arrayType";

  // In JS runtime mode, rewrite array.length → global::Tsonic.Runtime.Array.length(array)
  // In dotnet mode, there is no JS emulation - users access .Count directly on List<T>
  if (isArrayType && prop === "length" && runtime === "js") {
    const text = `global::Tsonic.Runtime.Array.length(${objectFrag.text})`;
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
