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
 * Check if an expression represents a static type reference (not an instance)
 * Static type references are: namespace.Type or direct Type identifiers that resolve to types
 */
const isStaticTypeReference = (
  expr: Extract<IrExpression, { kind: "memberAccess" }>
): boolean => {
  // If the object is an identifier that's a type name (e.g., Console, Enumerable)
  // we need to check if the member binding's type matches what would be
  // accessed statically. For instance access, the object would be a variable.
  //
  // A simple heuristic: if the member binding exists and the object is an identifier
  // or a member access (like System.Console), AND the property name is being looked up
  // on the type itself (not on an instance), it's static.
  //
  // The key insight: for instance calls, the object will have an inferredType that's
  // the CLR type (e.g., List<T>), whereas for static calls the object IS the type.
  //
  // For now, we use the presence of inferredType on the object to detect instance access:
  // - Instance: `numbers.add()` → numbers has inferredType: List<T>
  // - Static: `Console.WriteLine()` → Console doesn't have a meaningful inferredType
  //   (or its inferredType would be "typeof Console" not "Console")
  const objectType = expr.object.inferredType;

  // If object has a reference type as inferredType, it's an instance access
  if (
    objectType?.kind === "referenceType" ||
    objectType?.kind === "arrayType"
  ) {
    return false;
  }

  // Otherwise it's likely a static access (type.member pattern)
  return true;
};

/**
 * Emit a member access expression (dot notation or bracket notation)
 */
export const emitMemberAccess = (
  expr: Extract<IrExpression, { kind: "memberAccess" }>,
  context: EmitterContext
): [CSharpFragment, EmitterContext] => {
  // Check if this is a hierarchical member binding
  if (expr.memberBinding) {
    const { type, member } = expr.memberBinding;

    // Determine if this is a static or instance member access
    if (isStaticTypeReference(expr)) {
      // Static access: emit full CLR type and member with global:: prefix
      const text = `global::${type}.${member}`;
      return [{ text }, context];
    } else {
      // Instance access: emit object.ClrMemberName
      const [objectFrag, newContext] = emitExpression(expr.object, context);
      const accessor = expr.isOptional ? "?." : ".";
      const text = `${objectFrag.text}${accessor}${member}`;
      return [{ text }, newContext];
    }
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
