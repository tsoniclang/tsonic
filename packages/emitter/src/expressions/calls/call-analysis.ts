/**
 * Call expression analysis and detection helpers
 */

import { IrExpression, IrType } from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import { emitTypeAst } from "../../type-emitter.js";
import type { CSharpTypeAst } from "../../core/format/backend-ast/types.js";
import {
  globallyQualifyTypeAst,
  stableTypeKeyFromAst,
  stripNullableTypeAst,
} from "../../core/format/backend-ast/utils.js";
import {
  containsTypeParameter,
  getPropertyType,
  resolveTypeAlias,
  stripNullish,
} from "../../core/semantic/type-resolution.js";

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
export const isLValue = (expr: IrExpression): boolean => {
  return expr.kind === "identifier" || expr.kind === "memberAccess";
};

/**
 * Check if an expression has an `as out<T>`, `as ref<T>`, or `as inref<T>` cast.
 * Returns the modifier ("out", "ref", "in") or undefined if not a passing modifier cast.
 *
 * When TypeScript code has `value as out<int>`, the frontend converts this to
 * an expression with `inferredType: { kind: "referenceType", name: "out", ... }`.
 */
export const getPassingModifierFromCast = (
  expr: IrExpression
): "out" | "ref" | "in" | undefined => {
  const inferredType = expr.inferredType;
  if (!inferredType || inferredType.kind !== "referenceType") {
    return undefined;
  }

  const typeName = inferredType.name;
  if (typeName === "out") return "out";
  if (typeName === "ref") return "ref";
  if (typeName === "inref") return "in"; // inref maps to C# 'in' keyword

  return undefined;
};

/**
 * Check if a member access expression targets System.Text.Json.JsonSerializer
 */
export const isJsonSerializerCall = (
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
 * Check if a call targets global JSON.stringify or JSON.parse
 * These global JSON methods compile to JsonSerializer
 */
export const isGlobalJsonCall = (
  callee: IrExpression,
  context: EmitterContext
): { method: "Serialize" | "Deserialize" } | null => {
  if (callee.kind !== "memberAccess") return null;
  if (!callee.memberBinding) return null;

  const descriptor = context.bindingRegistry?.getExactBindingByKind(
    "JSON",
    "global"
  );
  if (!descriptor) return null;

  const expectedOwnerType = descriptor.staticType ?? descriptor.type;
  if (callee.memberBinding.type !== expectedOwnerType) return null;

  // Check property name
  const prop = callee.property;
  if (typeof prop !== "string") return null;

  if (prop === "stringify") return { method: "Serialize" };
  if (prop === "parse") return { method: "Deserialize" };

  return null;
};

/**
 * Determine if a member access is an instance-style access (receiver.value)
 * vs a static type reference (Type.Member).
 *
 * Extension-method lowering only applies to instance-style member accesses.
 * If the frontend did not attach a receiver type, do not guess.
 */
export const isInstanceMemberAccess = (
  expr: Extract<IrExpression, { kind: "memberAccess" }>,
  context: EmitterContext
): boolean => {
  // Imported types (e.g., `Enumerable.Where(...)`) are static receiver expressions,
  // even if TypeScript assigns them an inferredType.
  if (expr.object.kind === "identifier") {
    const importBinding = context.importBindings?.get(expr.object.name);
    if (importBinding?.kind === "type") {
      return false;
    }
  }

  const objectType = expr.object.inferredType;
  return (
    objectType?.kind === "referenceType" ||
    objectType?.kind === "arrayType" ||
    objectType?.kind === "intersectionType" ||
    objectType?.kind === "unionType" ||
    objectType?.kind === "primitiveType" ||
    objectType?.kind === "literalType" ||
    objectType?.kind === "typeParameterType" ||
    objectType?.kind === "unknownType"
  );
};

/**
 * Whether to emit an extension method call using fluent instance syntax (receiver.Method(...))
 * instead of explicit static invocation (Type.Method(receiver, ...)).
 *
 * Default: prefer static invocation to avoid relying on `using` directives and to avoid
 * accidental binding to an instance member when a type has both an instance method and
 * an extension method with the same name.
 *
 * Exception: certain toolchains (notably EF query precompilation) require the *syntax*
 * of extension-method invocation so the analyzer can locate queries in user code.
 */
export const shouldEmitFluentExtensionCall = (memberBinding: {
  readonly type: string;
  readonly member: string;
  readonly emitSemantics?: {
    readonly callStyle: "receiver" | "static";
  };
}): boolean => {
  if (memberBinding.emitSemantics?.callStyle === "receiver") {
    return true;
  }

  if (memberBinding.emitSemantics?.callStyle === "static") {
    return false;
  }
  return false;
};

export const getTypeNamespace = (typeName: string): string | undefined => {
  const lastDot = typeName.lastIndexOf(".");
  if (lastDot <= 0) return undefined;
  return typeName.slice(0, lastDot);
};

/**
 * Register a type with the JSON AOT registry.
 * Ensures types are fully qualified with namespace for the AOT source generator.
 */
export const registerJsonAotType = (
  type: IrType | undefined,
  context: EmitterContext
): void => {
  if (!type) return;
  if (!context.options.jsonAotRegistry) return;

  // NativeAOT JSON source generation requires CLOSED types.
  // If the type contains any generic parameters in the current scope (T, U, ...),
  // we cannot emit `[JsonSerializable(typeof(T))]` because `T` is not in scope in the
  // generated context class. Skip registration to keep emission valid.
  if (containsTypeParameter(type)) {
    context.options.jsonAotRegistry.needsJsonAot = true;
    return;
  }

  const registry = context.options.jsonAotRegistry;
  const [rawTypeAst] = emitTypeAst(type, {
    ...context,
    qualifyLocalTypes: true,
  });
  const normalizedTypeAst: CSharpTypeAst = globallyQualifyTypeAst(
    stripNullableTypeAst(rawTypeAst)
  );
  registry.rootTypes.set(
    stableTypeKeyFromAst(normalizedTypeAst),
    normalizedTypeAst
  );
  registry.needsJsonAot = true;
};

const boxedJsNumberJsonType: IrType = {
  kind: "referenceType",
  name: "double",
  resolvedClrType: "System.Double",
};

const isJsNumberishType = (
  type: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!type) return false;
  const resolved = resolveTypeAlias(stripNullish(type), context);
  return (
    (resolved.kind === "primitiveType" &&
      (resolved.name === "number" || resolved.name === "int")) ||
    (resolved.kind === "literalType" && typeof resolved.value === "number") ||
    (resolved.kind === "referenceType" &&
      (resolved.name === "int" ||
        resolved.name === "double" ||
        resolved.resolvedClrType === "System.Int32" ||
        resolved.resolvedClrType === "global::System.Int32" ||
        resolved.resolvedClrType === "System.Double" ||
        resolved.resolvedClrType === "global::System.Double"))
  );
};

const expectsBoxedObjectJsonType = (
  type: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!type) return false;
  if (type.kind === "unknownType" || type.kind === "anyType") {
    return true;
  }

  const resolved = resolveTypeAlias(stripNullish(type), context);
  return (
    resolved.kind === "referenceType" &&
    (resolved.name === "object" ||
      resolved.resolvedClrType === "System.Object" ||
      resolved.resolvedClrType === "global::System.Object")
  );
};

const getJsonObjectValueExpectedType = (
  containerType: IrType | undefined,
  propertyName: string,
  context: EmitterContext
): IrType | undefined => {
  if (!containerType) return undefined;

  const propertyType = getPropertyType(containerType, propertyName, context);
  if (propertyType) return propertyType;

  const resolved = resolveTypeAlias(stripNullish(containerType), context);
  return resolved.kind === "dictionaryType" ? resolved.valueType : undefined;
};

const getJsonArrayElementExpectedType = (
  containerType: IrType | undefined,
  index: number,
  context: EmitterContext
): IrType | undefined => {
  if (!containerType) return undefined;

  const resolved = resolveTypeAlias(stripNullish(containerType), context);
  if (resolved.kind === "arrayType") return resolved.elementType;
  if (resolved.kind === "tupleType") {
    return resolved.elementTypes[index] ?? undefined;
  }
  return undefined;
};

const shouldRegisterBoxedJsNumberJsonType = (
  expr: IrExpression,
  expectedType: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (context.options.surface !== "@tsonic/js") return false;
  return (
    isJsNumberishType(expr.inferredType, context) &&
    expectsBoxedObjectJsonType(expectedType, context)
  );
};

export const registerJsonAotExpressionTypes = (
  expr: IrExpression | undefined,
  context: EmitterContext,
  expectedType?: IrType
): void => {
  if (!expr) return;

  registerJsonAotType(
    shouldRegisterBoxedJsNumberJsonType(expr, expectedType, context)
      ? boxedJsNumberJsonType
      : expr.inferredType,
    context
  );

  switch (expr.kind) {
    case "object": {
      for (const property of expr.properties) {
        if (property.kind === "property") {
          const propertyName =
            typeof property.key === "string"
              ? property.key
              : property.key.kind === "literal" &&
                  typeof property.key.value === "string"
                ? property.key.value
                : undefined;
          registerJsonAotExpressionTypes(
            property.value,
            context,
            propertyName
              ? getJsonObjectValueExpectedType(
                  expectedType ?? expr.inferredType,
                  propertyName,
                  context
                )
              : undefined
          );
        } else {
          registerJsonAotExpressionTypes(property.expression, context);
        }
      }
      return;
    }
    case "array": {
      let elementIndex = 0;
      for (const element of expr.elements) {
        if (!element) continue;
        if (element.kind === "spread") {
          registerJsonAotExpressionTypes(element.expression, context);
        } else {
          registerJsonAotExpressionTypes(
            element,
            context,
            getJsonArrayElementExpectedType(
              expectedType ?? expr.inferredType,
              elementIndex,
              context
            )
          );
        }
        elementIndex += 1;
      }
      return;
    }
    case "conditional":
      registerJsonAotExpressionTypes(expr.whenTrue, context, expectedType);
      registerJsonAotExpressionTypes(expr.whenFalse, context, expectedType);
      return;
    case "logical":
    case "binary":
      registerJsonAotExpressionTypes(expr.left, context, expectedType);
      registerJsonAotExpressionTypes(expr.right, context, expectedType);
      return;
    case "assignment":
      registerJsonAotExpressionTypes(expr.right, context, expectedType);
      return;
    case "await":
    case "yield":
    case "unary":
    case "update":
    case "typeAssertion":
    case "asinterface":
    case "trycast":
      registerJsonAotExpressionTypes(expr.expression, context, expectedType);
      return;
    case "templateLiteral":
      for (const embedded of expr.expressions) {
        registerJsonAotExpressionTypes(embedded, context, expectedType);
      }
      return;
    default:
      return;
  }
};

/**
 * Check if a call expression needs an explicit cast because the inferred type
 * differs from the C# return type. This handles cases like Math.floor() which
 * returns double in C# but is cast to int in TypeScript via `as int`.
 */
export const needsIntCast = (
  expr: Extract<IrExpression, { kind: "call" }>,
  calleeName: string
): boolean => {
  // Check if the inferred type is int.
  const inferredType = expr.inferredType;
  if (!inferredType) {
    return false;
  }

  const returnsInt =
    (inferredType.kind === "primitiveType" && inferredType.name === "int") ||
    (inferredType.kind === "referenceType" && inferredType.name === "int");

  if (!returnsInt) {
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
  ];

  return mathMethodsReturningDouble.some(
    (m) => calleeName === m || calleeName.endsWith(`.${m.split(".").pop()}`)
  );
};

const ASYNC_WRAPPER_NAMES = new Set([
  "Promise",
  "PromiseLike",
  "Task",
  "ValueTask",
]);

export const isAsyncWrapperType = (
  type: IrType | undefined,
  visited: Set<IrType> = new Set()
): boolean => {
  if (!type || visited.has(type)) return false;
  visited.add(type);

  if (type.kind === "referenceType") {
    const simple = type.name.includes(".")
      ? type.name.slice(type.name.lastIndexOf(".") + 1)
      : type.name;
    if (ASYNC_WRAPPER_NAMES.has(simple)) return true;
  }

  if (type.kind === "unionType" || type.kind === "intersectionType") {
    return type.types.some((t) => isAsyncWrapperType(t, visited));
  }

  return false;
};

const PROMISE_CHAIN_METHODS = new Set(["then", "catch", "finally"]);

export const isPromiseChainMethod = (name: string): boolean =>
  PROMISE_CHAIN_METHODS.has(name);
