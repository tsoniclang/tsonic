/**
 * Boolean-context emission (truthiness / ToBoolean)
 *
 * In TypeScript, any value can be used in a boolean context (truthy/falsy).
 * In C#, only boolean expressions are valid conditions (if/while/for/?:/!).
 *
 * This module provides a shared, deterministic lowering for boolean contexts.
 *
 * IMPORTANT:
 * - This operates on IR + emitted text; it must not import emitExpression to avoid cycles.
 * - Callers provide an emitExpression-like function.
 */

import type { IrExpression, IrType } from "@tsonic/frontend";
import type { CSharpFragment, EmitterContext } from "../types.js";
import { allocateLocalName } from "./local-names.js";
import { substituteTypeArgs } from "./type-resolution.js";

export type EmitExprFn = (
  expr: IrExpression,
  context: EmitterContext
) => [CSharpFragment, EmitterContext];

const stripGlobalPrefix = (name: string): string =>
  name.startsWith("global::") ? name.slice("global::".length) : name;

/**
 * Coerce CLR primitive reference types (System.Boolean, System.Int32, ...) to IR primitiveType.
 *
 * This prevents boolean-context lowering from emitting `x != null` for CLR value types,
 * which is both semantically wrong and can silently miscompile (it compiles with boxing).
 */
const coerceClrPrimitiveToPrimitiveType = (type: IrType): IrType | undefined => {
  if (type.kind !== "referenceType") return undefined;

  const resolved = type.resolvedClrType ?? type.typeId?.clrName;
  if (!resolved) return undefined;

  const clr = stripGlobalPrefix(resolved);

  switch (clr) {
    case "System.Boolean":
    case "bool":
      return { kind: "primitiveType", name: "boolean" } as IrType;

    case "System.String":
    case "string":
      return { kind: "primitiveType", name: "string" } as IrType;

    case "System.Int32":
    case "int":
      return { kind: "primitiveType", name: "int" } as IrType;

    case "System.Double":
    case "double":
      return { kind: "primitiveType", name: "number" } as IrType;

    case "System.Char":
    case "char":
      return { kind: "primitiveType", name: "char" } as IrType;
  }

  return undefined;
};

/**
 * Check if an expression's inferred type is boolean.
 */
const isBooleanCondition = (expr: IrExpression): boolean => {
  const type = expr.inferredType;
  if (!type) return false;
  if (type.kind === "primitiveType") {
    return type.name === "boolean";
  }

  // Some CLR APIs (via bindings) surface as referenceType with a resolved CLR primitive
  // (e.g. System.Boolean). Treat those as booleans for C# conditions.
  const coerced = coerceClrPrimitiveToPrimitiveType(type);
  return !!coerced && coerced.kind === "primitiveType" && coerced.name === "boolean";
};

/**
 * Expressions that are always boolean in JS/TS, even if the IR is missing inferredType.
 *
 * This makes boolean-context emission robust: comparisons and `!expr` are already valid
 * C# conditions and should not be rewritten to `!= null` fallbacks.
 */
const isInherentlyBooleanExpression = (expr: IrExpression): boolean => {
  if (expr.kind === "binary") {
    return (
      expr.operator === "==" ||
      expr.operator === "!=" ||
      expr.operator === "===" ||
      expr.operator === "!==" ||
      expr.operator === "<" ||
      expr.operator === ">" ||
      expr.operator === "<=" ||
      expr.operator === ">=" ||
      expr.operator === "instanceof" ||
      expr.operator === "in"
    );
  }

  if (expr.kind === "unary") {
    return expr.operator === "!";
  }

  return false;
};

const isSimpleOperandExpression = (expr: IrExpression): boolean => {
  // These IR kinds emit C# primary/postfix expressions that don't need parentheses
  // before appending a comparison like `!= null` / `!= 0`.
  switch (expr.kind) {
    case "identifier":
    case "memberAccess":
    case "call":
    case "new":
    case "this":
    case "literal":
      return true;
    default:
      return false;
  }
};

const emitRuntimeTruthinessCondition = (
  expr: IrExpression,
  emittedText: string,
  context: EmitterContext
): [string, EmitterContext] => {
  // Use a pattern variable to evaluate the operand exactly once, then apply JS-like truthiness.
  //
  // This is the airplane-grade fallback when we cannot trust inferredType:
  // - Never emit `x != null` for unknowns (silently miscompiles boxed value types like bool/int).
  // - Use runtime type checks to preserve semantics deterministically.
  const nextId = (context.tempVarId ?? 0) + 1;
  let ctxWithId: EmitterContext = { ...context, tempVarId: nextId };
  const alloc = allocateLocalName(`__tsonic_truthy_${nextId}`, ctxWithId);
  ctxWithId = alloc.context;
  const tmp = alloc.emittedName;

  const operand = isSimpleOperandExpression(expr) ? emittedText : `(${emittedText})`;

  // Note: avoid pattern variables inside the switch arms to prevent C# name collisions.
  // This switch is the canonical JS-like truthiness for runtime CLR values:
  // - null → false (handled by `operand is object tmp`)
  // - bool → itself
  // - string → length != 0
  // - numeric primitives → != 0 (and NaN is falsy for floating-point)
  // - other objects → truthy
  const truthySwitch = `${tmp} switch { ` +
    `bool => (bool)${tmp}, ` +
    `string => ((string)${tmp}).Length != 0, ` +
    `sbyte => (sbyte)${tmp} != 0, ` +
    `byte => (byte)${tmp} != 0, ` +
    `short => (short)${tmp} != 0, ` +
    `ushort => (ushort)${tmp} != 0, ` +
    `int => (int)${tmp} != 0, ` +
    `uint => (uint)${tmp} != 0U, ` +
    `long => (long)${tmp} != 0L, ` +
    `ulong => (ulong)${tmp} != 0UL, ` +
    `nint => (nint)${tmp} != 0, ` +
    `nuint => (nuint)${tmp} != 0, ` +
    `global::System.Int128 => (global::System.Int128)${tmp} != 0, ` +
    `global::System.UInt128 => (global::System.UInt128)${tmp} != 0, ` +
    `global::System.Half => ((global::System.Half)${tmp}) != (global::System.Half)0 && !global::System.Half.IsNaN((global::System.Half)${tmp}), ` +
    `float => ((float)${tmp}) != 0f && !float.IsNaN((float)${tmp}), ` +
    `double => ((double)${tmp}) != 0d && !double.IsNaN((double)${tmp}), ` +
    `decimal => (decimal)${tmp} != 0m, ` +
    `char => (char)${tmp} != '\\0', ` +
    `_ => true }`;

  return [`(${operand} is object ${tmp} && (${truthySwitch}))`, ctxWithId];
};

const resolveLocalTypeAlias = (
  type: IrType,
  context: EmitterContext
): IrType => {
  let current = type;
  const visited = new Set<string>();

  while (current.kind === "referenceType") {
    const name = current.name;
    if (visited.has(name)) break;
    visited.add(name);

    const local = context.localTypes?.get(name);
    if (!local || local.kind !== "typeAlias") break;

    // If the alias is generic, substitute type arguments when provided.
    if (local.typeParameters.length > 0) {
      if (!current.typeArguments || current.typeArguments.length === 0) break;
      current = substituteTypeArgs(
        local.type,
        local.typeParameters,
        current.typeArguments
      );
      continue;
    }

    current = local.type;
  }

  return current;
};

const isNullishType = (type: IrType): boolean =>
  type.kind === "primitiveType" && (type.name === "null" || type.name === "undefined");

const getLiteralUnionBasePrimitive = (
  types: readonly IrType[]
): "string" | "number" | "boolean" | undefined => {
  let base: "string" | "number" | "boolean" | undefined;
  for (const t of types) {
    if (t.kind !== "literalType") return undefined;
    const v = t.value;
    const next =
      typeof v === "string"
        ? "string"
        : typeof v === "number"
          ? "number"
          : typeof v === "boolean"
            ? "boolean"
            : undefined;
    if (!next) return undefined;
    if (!base) base = next;
    else if (base !== next) return undefined;
  }
  return base;
};

const emitUnionTruthinessCondition = (
  expr: IrExpression,
  emittedText: string,
  unionType: Extract<IrType, { kind: "unionType" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  // Align boolean-context emission with union type emission:
  // - (T | null | undefined) behaves like a nullable (falsy when nullish)
  // - literal unions behave like their primitive base at runtime
  // - 2-8 unions emit as global::Tsonic.Runtime.Union<T1..Tn>, which requires per-variant truthiness

  const nonNullTypes = unionType.types.filter((t) => !isNullishType(t));
  const hasNullish = nonNullTypes.length !== unionType.types.length;

  const literalBase = getLiteralUnionBasePrimitive(nonNullTypes);
  if (literalBase) {
    const baseType: IrType = { kind: "primitiveType", name: literalBase } as IrType;
    if (!hasNullish) {
      return toBooleanCondition({ ...expr, inferredType: baseType }, emittedText, context);
    }

    // Nullable literal union (e.g. "a" | "b" | null) → value is falsy when nullish.
    const nextId = (context.tempVarId ?? 0) + 1;
    let ctxWithId: EmitterContext = { ...context, tempVarId: nextId };
    const alloc = allocateLocalName(`__tsonic_truthy_nullable_${nextId}`, ctxWithId);
    ctxWithId = alloc.context;
    const tmp = alloc.emittedName;

    const operand = isSimpleOperandExpression(expr) ? emittedText : `(${emittedText})`;
    const [innerCond, innerCtx] = toBooleanCondition(
      { kind: "identifier", name: tmp, inferredType: baseType } as IrExpression,
      tmp,
      ctxWithId
    );
    const emittedNonNull =
      literalBase === "string" ? "string" : literalBase === "number" ? "double" : "bool";
    return [`(${operand} is ${emittedNonNull} ${tmp} && ${innerCond})`, innerCtx];
  }

  // Nullable union: (T | null | undefined) → treat as `T?` truthiness.
  if (hasNullish && nonNullTypes.length === 1) {
    const nonNull = nonNullTypes[0];
    if (!nonNull) return ["false", context];

    const nextId = (context.tempVarId ?? 0) + 1;
    let ctxWithId: EmitterContext = { ...context, tempVarId: nextId };
    const alloc = allocateLocalName(`__tsonic_truthy_nullable_${nextId}`, ctxWithId);
    ctxWithId = alloc.context;
    const tmp = alloc.emittedName;

    const operand = isSimpleOperandExpression(expr) ? emittedText : `(${emittedText})`;
    // Pattern-match the non-null value into a strongly-typed temp and apply truthiness to it.
    // This handles both nullable value types (int?) and nullable reference types (string?).
    const [innerCond, innerCtx] = toBooleanCondition(
      { kind: "identifier", name: tmp, inferredType: nonNull } as IrExpression,
      tmp,
      ctxWithId
    );
    const emittedNonNull =
      nonNull.kind === "primitiveType" ? (
        nonNull.name === "number" ? "double" :
        nonNull.name === "int" ? "int" :
        nonNull.name === "string" ? "string" :
        nonNull.name === "boolean" ? "bool" :
        nonNull.name === "char" ? "char" :
        "object"
      ) : "var";
    return [`(${operand} is ${emittedNonNull} ${tmp} && ${innerCond})`, innerCtx];
  }

  // 2-8 unions use runtime Union<T1..Tn>. We must inspect the active variant.
  if (unionType.types.length >= 2 && unionType.types.length <= 8) {
    const nextId = (context.tempVarId ?? 0) + 1;
    let ctxWithId: EmitterContext = { ...context, tempVarId: nextId };
    const alloc = allocateLocalName(`__tsonic_truthy_union_${nextId}`, ctxWithId);
    ctxWithId = alloc.context;
    const u = alloc.emittedName;

    const operand = isSimpleOperandExpression(expr) ? emittedText : `(${emittedText})`;

    // Build nested conditional chain: u.Is1() ? truth(u.As1()) : u.Is2() ? truth(u.As2()) : ...
    let chainCtx = ctxWithId;
    const branchExprs: string[] = [];

    for (let i = 0; i < unionType.types.length; i++) {
      const memberN = i + 1;
      const memberType = unionType.types[i];
      if (!memberType) {
        branchExprs.push("false");
        continue;
      }

      if (isNullishType(memberType)) {
        branchExprs.push("false");
        continue;
      }

      const [memberCond, memberCtx] = toBooleanCondition(
        { kind: "identifier", name: `${u}__${memberN}`, inferredType: memberType } as IrExpression,
        `${u}.As${memberN}()`,
        chainCtx
      );
      branchExprs.push(memberCond);
      chainCtx = memberCtx;
    }

    let chain = branchExprs[branchExprs.length - 1] ?? "false";
    for (let i = branchExprs.length - 2; i >= 0; i--) {
      const n = i + 1;
      chain = `${u}.Is${n}() ? (${branchExprs[i]}) : (${chain})`;
    }

    return [
      `(${operand} is var ${u} && ${u} is not null && (${chain}))`,
      chainCtx,
    ];
  }

  // Fallback for unions >8 (emitted as object): runtime truthiness matches JS semantics.
  return emitRuntimeTruthinessCondition(expr, emittedText, context);
};

/**
 * Convert an expression to a valid C# boolean condition.
 *
 * Rules (deterministic):
 * - Booleans: use as-is
 * - Reference types (objects, arrays, dictionaries, unions, ...): `expr != null`
 * - Strings: `!string.IsNullOrEmpty(expr)`
 * - Numbers: JS truthiness check: false iff 0 or NaN
 * - int: `expr != 0`
 * - char: `expr != '\\0'`
 * - null/undefined literals: `false`
 */
export const toBooleanCondition = (
  expr: IrExpression,
  emittedText: string,
  context: EmitterContext
): [string, EmitterContext] => {
  const inferredType = expr.inferredType;
  const resolved = inferredType
    ? resolveLocalTypeAlias(
        coerceClrPrimitiveToPrimitiveType(inferredType) ?? inferredType,
        context
      )
    : undefined;
  const type = resolved;

  // Literal truthiness can be fully resolved without re-evaluating anything.
  if (expr.kind === "literal") {
    if (expr.value === null || expr.value === undefined) {
      return ["false", context];
    }
    if (typeof expr.value === "boolean") {
      return [expr.value ? "true" : "false", context];
    }
    if (typeof expr.value === "number") {
      return [expr.value === 0 ? "false" : "true", context];
    }
    if (typeof expr.value === "string") {
      return [expr.value.length === 0 ? "false" : "true", context];
    }
  }

  // If already boolean, use as-is
  if (isBooleanCondition(expr)) {
    return [emittedText, context];
  }

  // If we can prove from syntax alone that this is a boolean expression, use as-is.
  if (isInherentlyBooleanExpression(expr)) {
    return [emittedText, context];
  }

  // Unknown/any/missing type: use a safe runtime truthiness check instead of `!= null`,
  // which can silently miscompile boxed value types (e.g., bool).
  if (!type || type.kind === "unknownType" || type.kind === "anyType") {
    return emitRuntimeTruthinessCondition(expr, emittedText, context);
  }

  if (type.kind === "unionType") {
    return emitUnionTruthinessCondition(expr, emittedText, type, context);
  }

  // Non-primitive types in TS can still map to CLR value types (e.g. `long`, `System.Boolean` wrappers).
  // Never emit `x != null` here: it can silently miscompile boxed value types (always true).
  // Use canonical runtime truthiness instead.
  if (type.kind !== "primitiveType") {
    return emitRuntimeTruthinessCondition(expr, emittedText, context);
  }

  // For primitives that are not boolean
  if (type.kind === "primitiveType") {
    switch (type.name) {
      case "null":
      case "undefined":
        return ["false", context];

      case "string":
        return [`!string.IsNullOrEmpty(${emittedText})`, context];

      case "int":
        return [
          `${isSimpleOperandExpression(expr) ? emittedText : `(${emittedText})`} != 0`,
          context,
        ];

      case "char":
        return [
          `${isSimpleOperandExpression(expr) ? emittedText : `(${emittedText})`} != '\\0'`,
          context,
        ];

      case "number": {
        // JS truthiness for numbers: falsy iff 0 or NaN.
        // Use a pattern var to avoid evaluating the expression twice.
        const nextId = (context.tempVarId ?? 0) + 1;
        let ctxWithId: EmitterContext = { ...context, tempVarId: nextId };
        const alloc = allocateLocalName(`__tsonic_truthy_num_${nextId}`, ctxWithId);
        ctxWithId = alloc.context;
        const tmp = alloc.emittedName;
        const operand = isSimpleOperandExpression(expr) ? emittedText : `(${emittedText})`;
        return [
          `(${operand} is double ${tmp} && ${tmp} != 0 && !double.IsNaN(${tmp}))`,
          ctxWithId,
        ];
      }

      case "boolean":
        return [emittedText, context];
    }
  }

  return [emittedText, context];
};

/**
 * Emit a boolean-context expression.
 *
 * Special-cases logical &&/|| so that `ToBoolean(a && b)` is emitted as
 * `ToBoolean(a) && ToBoolean(b)` (and similarly for `||`), matching JS.
 */
export const emitBooleanCondition = (
  expr: IrExpression,
  emitExpr: EmitExprFn,
  context: EmitterContext
): [string, EmitterContext] => {
  const getLogicalPrecedence = (op: "&&" | "||"): number => (op === "&&" ? 6 : 5);

  const maybeParenthesizeLogicalOperand = (
    operandExpr: IrExpression,
    operandText: string,
    parentOp: "&&" | "||"
  ): string => {
    if (operandExpr.kind !== "logical") return operandText;
    if (operandExpr.operator !== "&&" && operandExpr.operator !== "||") return operandText;

    const parentPrec = getLogicalPrecedence(parentOp);
    const childPrec = getLogicalPrecedence(operandExpr.operator);
    return childPrec < parentPrec ? `(${operandText})` : operandText;
  };

  if (expr.kind === "logical" && (expr.operator === "&&" || expr.operator === "||")) {
    const [lhsText, lhsCtx] = emitBooleanCondition(expr.left, emitExpr, context);
    const [rhsText, rhsCtx] = emitBooleanCondition(expr.right, emitExpr, lhsCtx);

    const lhsWrapped = maybeParenthesizeLogicalOperand(expr.left, lhsText, expr.operator);
    const rhsWrapped = maybeParenthesizeLogicalOperand(expr.right, rhsText, expr.operator);
    return [`${lhsWrapped} ${expr.operator} ${rhsWrapped}`, rhsCtx];
  }

  const [frag, next] = emitExpr(expr, context);
  return toBooleanCondition(expr, frag.text, next);
};

/**
 * Whether a type is boolean.
 *
 * Used by callers that need a fast check (e.g., logical operator selection).
 */
export const isBooleanType = (type: IrType | undefined): boolean => {
  return !!type && type.kind === "primitiveType" && type.name === "boolean";
};
