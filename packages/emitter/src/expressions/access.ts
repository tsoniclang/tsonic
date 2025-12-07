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
import { escapeCSharpIdentifier } from "../emitter-types/index.js";
import {
  resolveTypeAlias,
  stripNullish,
  getAllPropertySignatures,
} from "../core/type-resolution.js";

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
    // Check if this is array index access
    const objectType = expr.object.inferredType;
    const isArrayType = objectType?.kind === "arrayType";

    // In JS mode, use Tsonic.JSRuntime.Array.get() for JS semantics (auto-grow, sparse arrays)
    // In dotnet mode, use native CLR indexer (no JSRuntime exists)
    if (isArrayType && runtime === "js") {
      const indexContext = { ...newContext, isArrayIndex: true };
      const [propFrag, contextWithIndex] = emitExpression(
        expr.property as IrExpression,
        indexContext
      );
      const finalContext = { ...contextWithIndex, isArrayIndex: false };
      const text = `global::Tsonic.JSRuntime.Array.get(${objectFrag.text}, ${propFrag.text})`;
      return [{ text }, finalContext];
    }

    // In dotnet mode, arrays use native List<T> indexer with int cast
    if (isArrayType && runtime === "dotnet") {
      const indexContext = { ...newContext, isArrayIndex: true };
      const [propFrag, contextWithIndex] = emitExpression(
        expr.property as IrExpression,
        indexContext
      );
      const finalContext = { ...contextWithIndex, isArrayIndex: false };
      const accessor = expr.isOptional ? "?[" : "[";
      // Check if index is known int (canonical loop counter)
      const indexExpr = expr.property as IrExpression;
      const isKnownInt =
        indexExpr.kind === "identifier" &&
        context.intLoopVars?.has(indexExpr.name);
      const indexText = isKnownInt ? propFrag.text : `(int)(${propFrag.text})`;
      const text = `${objectFrag.text}${accessor}${indexText}]`;
      return [{ text }, finalContext];
    }

    // CLR indexer access (non-TS-array types like List<T>, string, Dictionary, etc.)
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

    // Check if this is dictionary access (no cast needed - use key type directly)
    const isDictionaryType = objectType?.kind === "dictionaryType";

    // Determine index text:
    // - Dictionary: use key as-is (double for number keys, string for string keys)
    // - Known int: no cast needed
    // - Other CLR indexers (List, string): require (int) cast
    const indexText =
      isDictionaryType || isKnownInt
        ? propFrag.text
        : `(int)(${propFrag.text})`;
    const text = `${objectFrag.text}${accessor}${indexText}]`;
    return [{ text }, finalContext];
  }

  // Property access
  const prop = expr.property as string;
  const objectType = expr.object.inferredType;
  const isArrayType = objectType?.kind === "arrayType";

  // Union member projection: u.prop → u.Match(__m1 => __m1.prop, __m2 => __m2.prop, ...)
  // This handles accessing properties on union types where the property exists on all members.
  // Example: account.kind where account is Union<User, Admin> and both have .kind
  if (objectType && !expr.isOptional) {
    const resolved = resolveTypeAlias(stripNullish(objectType), context);
    if (resolved.kind === "unionType") {
      const members = resolved.types;
      const arity = members.length;

      // Only handle unions with 2-8 members (runtime supports Union<T1..T8>)
      if (arity >= 2 && arity <= 8) {
        // Check if all members are reference types with the property
        const allHaveProp = members.every((m) => {
          if (m.kind !== "referenceType") return false;
          const props = getAllPropertySignatures(m, context);
          return props?.some((p) => p.name === prop) ?? false;
        });

        if (allHaveProp) {
          // Emit: object.Match(__m1 => __m1.prop, __m2 => __m2.prop, ...)
          const escapedProp = escapeCSharpIdentifier(prop);
          const lambdas = members.map(
            (_, i) => `__m${i + 1} => __m${i + 1}.${escapedProp}`
          );
          const text = `${objectFrag.text}.Match(${lambdas.join(", ")})`;
          return [{ text }, newContext];
        }
      }
    }
  }

  // In JS runtime mode, rewrite array.length → global::Tsonic.JSRuntime.Array.length(array)
  // In dotnet mode, there is no JS emulation - users access .Count directly on List<T>
  if (isArrayType && prop === "length" && runtime === "js") {
    const text = `global::Tsonic.JSRuntime.Array.length(${objectFrag.text})`;
    return [{ text }, newContext];
  }

  // Check if this is a string type
  const isStringType =
    objectType?.kind === "primitiveType" && objectType.name === "string";

  // In JS runtime mode, rewrite string.length → global::Tsonic.JSRuntime.String.length(string)
  // In dotnet mode, use C#'s native .Length property
  if (isStringType && prop === "length" && runtime === "js") {
    const text = `global::Tsonic.JSRuntime.String.length(${objectFrag.text})`;
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
  const text = `${objectFrag.text}${accessor}${escapeCSharpIdentifier(prop)}`;
  return [{ text }, newContext];
};
