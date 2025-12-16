/**
 * Call and new expression emitters
 */

import { IrExpression, IrType } from "@tsonic/frontend";
import { EmitterContext, CSharpFragment } from "../types.js";
import { emitExpression } from "../expression-emitter.js";
import { emitTypeArguments, generateSpecializedName } from "./identifiers.js";
import { emitType } from "../type-emitter.js";

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
 * Check if a member access expression targets System.Text.Json.JsonSerializer
 */
const isJsonSerializerCall = (
  callee: IrExpression
): { method: "Serialize" | "Deserialize" } | null => {
  if (callee.kind !== "memberAccess") return null;
  if (!callee.memberBinding) return null;

  const { type, member } = callee.memberBinding;

  // Check if this is System.Text.Json.JsonSerializer
  if (type !== "System.Text.Json.JsonSerializer") return null;

  // Check if the member is Serialize or Deserialize
  if (member === "Serialize") return { method: "Serialize" };
  if (member === "Deserialize") return { method: "Deserialize" };

  return null;
};

/**
 * Ensure a C# type string has global:: prefix for unambiguous resolution
 */
const ensureGlobalPrefix = (typeStr: string): string => {
  // Skip primitives and already-prefixed types
  if (
    typeStr.startsWith("global::") ||
    typeStr === "string" ||
    typeStr === "int" ||
    typeStr === "long" ||
    typeStr === "short" ||
    typeStr === "byte" ||
    typeStr === "sbyte" ||
    typeStr === "uint" ||
    typeStr === "ulong" ||
    typeStr === "ushort" ||
    typeStr === "float" ||
    typeStr === "double" ||
    typeStr === "decimal" ||
    typeStr === "bool" ||
    typeStr === "char" ||
    typeStr === "object" ||
    typeStr === "void"
  ) {
    return typeStr;
  }

  // Handle generic types: List<Foo> -> global::List<global::Foo>
  // For now, just add prefix to the outer type
  // The inner types should already be handled by emitType
  return `global::${typeStr}`;
};

/**
 * Register a type with the JSON AOT registry
 */
const registerJsonAotType = (
  type: IrType | undefined,
  context: EmitterContext
): void => {
  if (!type) return;
  if (!context.options.jsonAotRegistry) return;

  const registry = context.options.jsonAotRegistry;
  const [typeStr] = emitType(type, context);
  const globalType = ensureGlobalPrefix(typeStr);

  registry.rootTypes.add(globalType);
  registry.needsJsonAot = true;
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
  // Check if the inferred type is int (a reference type from @tsonic/core)
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
 * Emit a JsonSerializer call with NativeAOT-compatible options.
 * Rewrites:
 *   JsonSerializer.Serialize(value) → JsonSerializer.Serialize(value, TsonicJson.Options)
 *   JsonSerializer.Deserialize<T>(json) → JsonSerializer.Deserialize<T>(json, TsonicJson.Options)
 */
const emitJsonSerializerCall = (
  expr: Extract<IrExpression, { kind: "call" }>,
  context: EmitterContext,
  method: "Serialize" | "Deserialize"
): [CSharpFragment, EmitterContext] => {
  let currentContext = context;

  // Register the type with the JSON AOT registry
  if (method === "Serialize") {
    // For Serialize, get type from first argument's inferredType
    const firstArg = expr.arguments[0];
    if (firstArg && firstArg.kind !== "spread") {
      registerJsonAotType(firstArg.inferredType, context);
    }
  } else {
    // For Deserialize, get type from type arguments
    const typeArg = expr.typeArguments?.[0];
    if (typeArg) {
      registerJsonAotType(typeArg, context);
    }
  }

  // Emit type arguments for Deserialize<T>
  let typeArgsStr = "";
  if (expr.typeArguments && expr.typeArguments.length > 0) {
    const [typeArgs, typeContext] = emitTypeArguments(
      expr.typeArguments,
      currentContext
    );
    typeArgsStr = typeArgs;
    currentContext = typeContext;
  }

  // Emit arguments
  const args: string[] = [];
  for (const arg of expr.arguments) {
    if (arg.kind === "spread") {
      const [spreadFrag, ctx] = emitExpression(arg.expression, currentContext);
      args.push(spreadFrag.text);
      currentContext = ctx;
    } else {
      const [argFrag, ctx] = emitExpression(arg, currentContext);
      args.push(argFrag.text);
      currentContext = ctx;
    }
  }

  // Add TsonicJson.Options as the last argument for NativeAOT compatibility
  args.push("TsonicJson.Options");

  const text = `global::System.Text.Json.JsonSerializer.${method}${typeArgsStr}(${args.join(", ")})`;
  return [{ text }, currentContext];
};

/**
 * Emit a function call expression
 */
export const emitCall = (
  expr: Extract<IrExpression, { kind: "call" }>,
  context: EmitterContext
): [CSharpFragment, EmitterContext] => {
  // Check for JsonSerializer calls (NativeAOT support)
  const jsonCall = isJsonSerializerCall(expr.callee);
  if (jsonCall) {
    return emitJsonSerializerCall(expr, context, jsonCall.method);
  }

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

      // Rewrite: obj.method(args) → global::Tsonic.JSRuntime.{Class}.method(obj, args)
      const [objectFrag, objContext] = emitExpression(
        expr.callee.object,
        context
      );
      let currentContext = objContext;

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

      const text = `global::Tsonic.JSRuntime.${runtimeClass}.${methodName}(${args.join(", ")})`;
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

  // Get parameter types from IR (extracted from resolved signature in frontend)
  const parameterTypes = expr.parameterTypes ?? [];

  const args: string[] = [];
  for (let i = 0; i < expr.arguments.length; i++) {
    const arg = expr.arguments[i];
    if (!arg) continue; // Skip undefined (shouldn't happen in valid IR)

    // Get expected type for this argument from parameter types
    const expectedType = parameterTypes[i];

    if (arg.kind === "spread") {
      // Spread in function call
      const [spreadFrag, ctx] = emitExpression(arg.expression, currentContext);
      args.push(`params ${spreadFrag.text}`);
      currentContext = ctx;
    } else {
      const [argFrag, ctx] = emitExpression(arg, currentContext, expectedType);
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
