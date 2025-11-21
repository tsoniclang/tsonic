/**
 * Call and new expression emitters
 */

import { IrExpression } from "@tsonic/frontend";
import { EmitterContext, CSharpFragment, addUsing } from "../types.js";
import { emitExpression } from "../expression-emitter.js";
import { emitTypeArguments, generateSpecializedName } from "./identifiers.js";

/**
 * TODO: Ref/out parameter handling
 *
 * Full implementation requires:
 * 1. Type information from the TypeScript checker
 * 2. Parameter metadata from .metadata.json
 * 3. Integration with ref-parameters.ts helpers
 *
 * See packages/frontend/src/types/ref-parameters.ts for the infrastructure.
 */

/**
 * Emit a function call expression
 */
export const emitCall = (
  expr: Extract<IrExpression, { kind: "call" }>,
  context: EmitterContext
): [CSharpFragment, EmitterContext] => {
  // Type-aware method call rewriting
  // Use inferredType to determine if we need to rewrite as static helper
  if (
    expr.callee.kind === "memberAccess" &&
    typeof expr.callee.property === "string"
  ) {
    const methodName = expr.callee.property;
    const objectType = expr.callee.object.inferredType;

    // Rewrite based on type:
    // - string → Tsonic.Runtime.String.method()
    // - number → Tsonic.Runtime.Number.method()
    // - Array<T> → Tsonic.Runtime.Array.method() (now uses native List<T>)
    // - Other custom types → Keep as instance method

    const isStringType =
      objectType?.kind === "primitiveType" && objectType.name === "string";
    const isNumberType =
      objectType?.kind === "primitiveType" && objectType.name === "number";
    const isArrayType = objectType?.kind === "arrayType";

    const shouldRewriteAsStatic = isStringType || isNumberType || isArrayType;

    if (shouldRewriteAsStatic) {
      // Determine which runtime class based on type
      let runtimeClass: string;
      if (isStringType) {
        runtimeClass = "String";
      } else if (isNumberType) {
        runtimeClass = "Number";
      } else {
        runtimeClass = "Array";
      }

      // Rewrite: obj.method(args) → Tsonic.Runtime.{Class}.method(obj, args)
      const [objectFrag, objContext] = emitExpression(
        expr.callee.object,
        context
      );
      let currentContext = addUsing(objContext, "Tsonic.Runtime");

      const args: string[] = [objectFrag.text]; // Object becomes first argument
      for (const arg of expr.arguments) {
        if (arg.kind === "spread") {
          const [spreadFrag, ctx] = emitExpression(
            arg.expression,
            currentContext
          );
          args.push(`params ${spreadFrag.text}`);
          currentContext = ctx;
        } else {
          const [argFrag, ctx] = emitExpression(arg, currentContext);
          args.push(argFrag.text);
          currentContext = ctx;
        }
      }

      const text = `Tsonic.Runtime.${runtimeClass}.${methodName}(${args.join(", ")})`;
      return [{ text }, currentContext];
    }
  }

  // Regular function call
  const [calleeFrag, newContext] = emitExpression(expr.callee, context);
  let currentContext = newContext;

  // Handle generic type arguments
  let typeArgsStr = "";
  let finalCalleeName = calleeFrag.text;

  if (expr.typeArguments && expr.typeArguments.length > 0) {
    if (expr.requiresSpecialization) {
      // Monomorphisation: Generate specialized method name
      // e.g., process<string> → process__string
      const [specializedName, specContext] = generateSpecializedName(
        calleeFrag.text,
        expr.typeArguments,
        currentContext
      );
      finalCalleeName = specializedName;
      currentContext = specContext;
    } else {
      // Emit explicit type arguments for generic call
      // e.g., identity<string>(value)
      const [typeArgs, typeContext] = emitTypeArguments(
        expr.typeArguments,
        currentContext
      );
      typeArgsStr = typeArgs;
      currentContext = typeContext;
    }
  }

  const args: string[] = [];
  for (const arg of expr.arguments) {
    if (arg.kind === "spread") {
      // Spread in function call
      const [spreadFrag, ctx] = emitExpression(arg.expression, currentContext);
      args.push(`params ${spreadFrag.text}`);
      currentContext = ctx;
    } else {
      const [argFrag, ctx] = emitExpression(arg, currentContext);
      args.push(argFrag.text);
      currentContext = ctx;
    }
  }

  const callOp = expr.isOptional ? "?." : "";
  const text = `${finalCalleeName}${typeArgsStr}${callOp}(${args.join(", ")})`;
  return [{ text }, currentContext];
};

/**
 * Emit a new expression
 */
export const emitNew = (
  expr: Extract<IrExpression, { kind: "new" }>,
  context: EmitterContext
): [CSharpFragment, EmitterContext] => {
  const [calleeFrag, newContext] = emitExpression(expr.callee, context);
  let currentContext = newContext;

  // Handle generic type arguments
  let typeArgsStr = "";
  let finalClassName = calleeFrag.text;

  if (expr.typeArguments && expr.typeArguments.length > 0) {
    if (expr.requiresSpecialization) {
      // Monomorphisation: Generate specialized class name
      // e.g., new Box<string>() → new Box__string()
      const [specializedName, specContext] = generateSpecializedName(
        calleeFrag.text,
        expr.typeArguments,
        currentContext
      );
      finalClassName = specializedName;
      currentContext = specContext;
    } else {
      // Emit explicit type arguments for generic constructor
      // e.g., new Box<string>(value)
      const [typeArgs, typeContext] = emitTypeArguments(
        expr.typeArguments,
        currentContext
      );
      typeArgsStr = typeArgs;
      currentContext = typeContext;
    }
  }

  const args: string[] = [];
  for (const arg of expr.arguments) {
    if (arg.kind === "spread") {
      const [spreadFrag, ctx] = emitExpression(arg.expression, currentContext);
      args.push(`params ${spreadFrag.text}`);
      currentContext = ctx;
    } else {
      const [argFrag, ctx] = emitExpression(arg, currentContext);
      args.push(argFrag.text);
      currentContext = ctx;
    }
  }

  const text = `new ${finalClassName}${typeArgsStr}(${args.join(", ")})`;
  return [{ text }, currentContext];
};
