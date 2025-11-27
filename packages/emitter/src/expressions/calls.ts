/**
 * Call and new expression emitters
 */

import { IrExpression } from "@tsonic/frontend";
import { EmitterContext, CSharpFragment, addUsing } from "../types.js";
import { emitExpression } from "../expression-emitter.js";
import { emitTypeArguments, generateSpecializedName } from "./identifiers.js";

/**
 * Ref/out/in parameter handling:
 * The frontend extracts parameter passing modes from resolved signatures
 * and attaches them to IrCallExpression.argumentPassing array.
 * The emitter reads this array and prefixes arguments with ref/out/in keywords.
 */

/**
 * Check if an expression is an lvalue (can be passed by reference)
 * Only identifiers and member accesses are lvalues in C#
 */
const isLValue = (expr: IrExpression): boolean => {
  return expr.kind === "identifier" || expr.kind === "memberAccess";
};

/**
 * Check if a call expression needs an explicit cast because the inferred type
 * differs from the C# return type. This handles cases like Math.floor() which
 * returns double in C# but is cast to int in TypeScript via `as int`.
 */
const needsIntCast = (
  expr: Extract<IrExpression, { kind: "call" }>,
  calleeName: string
): boolean => {
  // Check if the inferred type is int (a reference type from @tsonic/types)
  const inferredType = expr.inferredType;
  if (
    !inferredType ||
    inferredType.kind !== "referenceType" ||
    inferredType.name !== "int"
  ) {
    return false;
  }

  // Check if this is a Math method that returns double
  const mathMethodsReturningDouble = [
    "Math.floor",
    "Math.ceil",
    "Math.round",
    "Math.abs",
    "Math.pow",
    "Math.sqrt",
    "Math.min",
    "Math.max",
    "Tsonic.JSRuntime.Math.floor",
    "Tsonic.JSRuntime.Math.ceil",
    "Tsonic.JSRuntime.Math.round",
  ];

  return mathMethodsReturningDouble.some(
    (m) => calleeName === m || calleeName.endsWith(`.${m.split(".").pop()}`)
  );
};

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
    // - string → Tsonic.JSRuntime.String.method()
    // - number → Tsonic.JSRuntime.Number.method()
    // - Array<T> → Tsonic.JSRuntime.Array.method() (extension methods on List<T>)
    // - Other custom types → Keep as instance method

    const isStringType =
      objectType?.kind === "primitiveType" && objectType.name === "string";
    const isNumberType =
      objectType?.kind === "primitiveType" && objectType.name === "number";
    const isArrayType = objectType?.kind === "arrayType";

    const shouldRewriteAsStatic = isStringType || isNumberType || isArrayType;

    // Only rewrite to JSRuntime in "js" mode
    // In "dotnet" mode, there is no JS emulation - use .NET APIs directly
    const runtime = context.options.runtime ?? "js";
    if (shouldRewriteAsStatic && runtime === "js") {
      // Runtime mode "js": Use Tsonic.JSRuntime
      // Determine which runtime class based on type
      let runtimeClass: string;
      if (isStringType) {
        runtimeClass = "String";
      } else if (isNumberType) {
        runtimeClass = "Number";
      } else {
        runtimeClass = "Array";
      }

      // Rewrite: obj.method(args) → Tsonic.JSRuntime.{Class}.method(obj, args)
      const [objectFrag, objContext] = emitExpression(
        expr.callee.object,
        context
      );
      let currentContext = addUsing(objContext, "Tsonic.JSRuntime");

      const args: string[] = [objectFrag.text]; // Object becomes first argument
      for (let i = 0; i < expr.arguments.length; i++) {
        const arg = expr.arguments[i];
        if (!arg) continue; // Skip undefined (shouldn't happen in valid IR)
        if (arg.kind === "spread") {
          const [spreadFrag, ctx] = emitExpression(
            arg.expression,
            currentContext
          );
          args.push(`params ${spreadFrag.text}`);
          currentContext = ctx;
        } else {
          const [argFrag, ctx] = emitExpression(arg, currentContext);
          // Check if this argument needs ref/out/in prefix
          // Note: argumentPassing[i] corresponds to method parameter i+1 (first param is the object)
          // Only add prefix if argument is an lvalue (identifier or member access)
          const passingMode = expr.argumentPassing?.[i + 1];
          const prefix =
            passingMode && passingMode !== "value" && isLValue(arg)
              ? `${passingMode} `
              : "";
          args.push(`${prefix}${argFrag.text}`);
          currentContext = ctx;
        }
      }

      const text = `Tsonic.JSRuntime.${runtimeClass}.${methodName}(${args.join(", ")})`;
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
  for (let i = 0; i < expr.arguments.length; i++) {
    const arg = expr.arguments[i];
    if (!arg) continue; // Skip undefined (shouldn't happen in valid IR)
    if (arg.kind === "spread") {
      // Spread in function call
      const [spreadFrag, ctx] = emitExpression(arg.expression, currentContext);
      args.push(`params ${spreadFrag.text}`);
      currentContext = ctx;
    } else {
      const [argFrag, ctx] = emitExpression(arg, currentContext);
      // Check if this argument needs ref/out/in prefix
      // Only add prefix if argument is an lvalue (identifier or member access)
      const passingMode = expr.argumentPassing?.[i];
      const prefix =
        passingMode && passingMode !== "value" && isLValue(arg)
          ? `${passingMode} `
          : "";
      args.push(`${prefix}${argFrag.text}`);
      currentContext = ctx;
    }
  }

  const callOp = expr.isOptional ? "?." : "";
  const callText = `${finalCalleeName}${typeArgsStr}${callOp}(${args.join(", ")})`;

  // Add cast if needed (e.g., Math.floor returning double but asserted as int)
  const text = needsIntCast(expr, finalCalleeName)
    ? `(int)${callText}`
    : callText;

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
