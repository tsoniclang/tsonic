/**
 * Guard info types, shared helpers, and utility functions for guard analysis.
 *
 * Contains:
 * - All guard info type definitions (GuardInfo, InstanceofGuardInfo, etc.)
 * - Shared helper functions (getGuardPropertyType, buildRenameNarrowedMap, etc.)
 * - Truthiness/termination analysis (isDefinitelyTerminating, isNullOrUndefined, etc.)
 * - resolveRuntimeUnionFrame alias
 */

import { IrExpression, IrStatement, IrType } from "@tsonic/frontend";
import { EmitterContext, NarrowedBinding } from "../../../types.js";
import {
  resolveTypeAlias,
  getPropertyType,
  isDefinitelyValueType,
  stripNullish,
} from "../../../core/semantic/type-resolution.js";
import {
  resolveNarrowedUnionMembers,
  resolveAlignedRuntimeUnionMembers,
  type NarrowedUnionMembers,
} from "../../../core/semantic/narrowed-union-resolution.js";
import { getMemberAccessNarrowKey } from "../../../core/semantic/narrowing-keys.js";
import { unwrapTransparentNarrowingTarget } from "../../../core/semantic/transparent-expressions.js";
import {
  resolveLocalTypesForReference,
  tryGetLiteralSet,
} from "../../../core/semantic/guard-primitives.js";
import { resolveEffectiveExpressionType } from "../../../core/semantic/narrowed-expression-types.js";
import { resolveIdentifierRuntimeCarrierType } from "../../../expressions/direct-storage-types.js";
import type {
  CSharpExpressionAst,
  CSharpTypeAst,
} from "../../../core/format/backend-ast/types.js";

/**
 * Information extracted from a type predicate guard call.
 * Used to generate Union.IsN()/AsN() narrowing code.
 */
export type GuardInfo = {
  readonly originalName: string;
  readonly receiverAst: CSharpExpressionAst;
  readonly targetType: IrType;
  readonly memberN?: number;
  readonly memberNs: readonly number[];
  readonly unionArity: number; // Number of currently reachable members
  readonly runtimeUnionArity: number;
  readonly candidateMemberNs: readonly number[];
  readonly candidateMembers: readonly IrType[];
  readonly ctxWithId: EmitterContext;
  readonly narrowedName: string;
  readonly escapedNarrow: string;
  readonly narrowedMap: Map<string, NarrowedBinding>;
  readonly sourceType?: IrType;
  readonly sourceMembers?: readonly IrType[];
  readonly sourceCandidateMemberNs?: readonly number[];
};

/**
 * Information extracted from an `instanceof` condition.
 * Used to generate C# pattern variables for narrowing:
 *   if (x is Foo x__is_1) { ... }
 */
export type InstanceofGuardInfo = {
  readonly originalName: string;
  readonly receiverAst: CSharpExpressionAst;
  readonly rhsTypeAst: CSharpTypeAst;
  readonly ctxWithId: EmitterContext;
  readonly ctxAfterRhs: EmitterContext;
  readonly narrowedName: string;
  readonly escapedOrig: string;
  readonly escapedNarrow: string;
  readonly narrowedMap: Map<string, NarrowedBinding>;
  readonly targetType?: IrType;
  readonly memberN?: number;
  readonly memberNeedsPatternCheck?: boolean;
  readonly receiverMayBeNullish?: boolean;
  readonly runtimeUnionArity?: number;
  readonly candidateMemberNs?: readonly number[];
  readonly candidateMembers?: readonly IrType[];
};

/**
 * Information extracted from a discriminant literal equality check:
 *   if (x.kind === "circle") { ... }
 *
 * Airplane-grade narrowing is only enabled when:
 * - x is a carried runtime union (2+ members)
 * - x is an identifier
 * - kind is a non-computed property name
 * - the compared value is a literal (string/number/boolean)
 * - exactly ONE union member's discriminant property type includes that literal
 *
 * Lowering uses union tags (not runtime property equality):
 *   x.kind === "circle"  ->  x.IsN()
 *   x.kind !== "circle"  ->  !x.IsN()
 */
export type DiscriminantEqualityGuardInfo = {
  readonly originalName: string;
  readonly propertyName: string;
  readonly literal: string | number | boolean;
  readonly operator: "===" | "!==" | "==" | "!=";
  readonly memberN: number;
  readonly unionArity: number;
  readonly runtimeUnionArity: number;
  readonly candidateMemberNs: readonly number[];
  readonly candidateMembers: readonly IrType[];
  readonly ctxWithId: EmitterContext;
  readonly narrowedName: string;
  readonly escapedOrig: string;
  readonly escapedNarrow: string;
  readonly narrowedMap: Map<string, NarrowedBinding>;
};

/**
 * Information extracted from a truthy/falsy property guard:
 *   if (result.success) { ... }
 *   if (!result.success) { ... }
 *
 * Supports the airplane-grade case where a union member property is definitively
 * truthy or falsy by literal/nullish contract, and exactly one member matches the
 * condition branch.
 */
export type PropertyTruthinessGuardInfo = {
  readonly originalName: string;
  readonly propertyName: string;
  readonly wantTruthy: boolean;
  readonly memberN: number;
  readonly unionArity: number;
  readonly runtimeUnionArity: number;
  readonly candidateMemberNs: readonly number[];
  readonly candidateMembers: readonly IrType[];
  readonly ctxWithId: EmitterContext;
  readonly narrowedName: string;
  readonly escapedOrig: string;
  readonly escapedNarrow: string;
  readonly narrowedMap: Map<string, NarrowedBinding>;
};

export type RuntimeUnionFrame = NarrowedUnionMembers;

/**
 * Information extracted from a nullable guard condition.
 * Used to generate .Value access for narrowed nullable value types.
 */
export type NullableGuardInfo = {
  readonly key: string;
  readonly targetExpr: Extract<
    IrExpression,
    { kind: "identifier" | "memberAccess" }
  >;
  readonly strippedType: IrType;
  readonly narrowsInThen: boolean; // true for !== null, false for === null
  readonly isValueType: boolean;
};

/**
 * Check if a local nominal type (class/interface) has a property with the given TS name.
 */
export const getGuardPropertyType = (
  type: IrType,
  propertyName: string,
  context: EmitterContext
): IrType | undefined => {
  if (type.kind === "objectType") {
    const prop = type.members.find(
      (
        member
      ): member is Extract<typeof member, { kind: "propertySignature" }> =>
        member.kind === "propertySignature" && member.name === propertyName
    );
    return prop?.type;
  }

  if (type.kind === "referenceType") {
    if (type.structuralMembers?.length) {
      const prop = type.structuralMembers.find(
        (
          member
        ): member is Extract<typeof member, { kind: "propertySignature" }> =>
          member.kind === "propertySignature" && member.name === propertyName
      );
      if (prop) return prop.type;
    }

    const localTypes = resolveLocalTypesForReference(type, context);
    if (localTypes) {
      const lookupName = type.name.includes(".")
        ? (type.name.split(".").pop() ?? type.name)
        : type.name;
      const localPropType = getPropertyType(
        { ...type, name: lookupName },
        propertyName,
        { ...context, localTypes }
      );
      if (localPropType) return localPropType;
    }

    const resolvedPropType = getPropertyType(type, propertyName, context);
    if (resolvedPropType) return resolvedPropType;
  }

  return undefined;
};

export const extractTransparentIdentifierTarget = (
  expr: IrExpression
): Extract<IrExpression, { kind: "identifier" }> | undefined => {
  const target = unwrapTransparentNarrowingTarget(expr);
  return target?.kind === "identifier" ? target : undefined;
};

export type PlainMemberAccessTarget = Extract<
  IrExpression,
  { kind: "memberAccess" }
> & {
  readonly property: string;
  readonly isComputed: false;
  readonly isOptional: false;
};

export const extractTransparentMemberAccessTarget = (
  expr: IrExpression
):
  | {
      readonly access: PlainMemberAccessTarget;
      readonly receiver: Extract<IrExpression, { kind: "identifier" }>;
    }
  | undefined => {
  const access = unwrapTransparentNarrowingTarget(expr);
  if (!access || access.kind !== "memberAccess") {
    return undefined;
  }
  if (access.isOptional || access.isComputed) {
    return undefined;
  }

  const receiver = extractTransparentIdentifierTarget(access.object);
  if (!receiver) {
    return undefined;
  }

  return { access: access as PlainMemberAccessTarget, receiver };
};

export const resolveRuntimeUnionFrame = resolveNarrowedUnionMembers;

export const resolveGuardRuntimeUnionFrame = (
  originalName: string,
  effectiveType: IrType,
  identifierTarget: Extract<IrExpression, { kind: "identifier" }> | undefined,
  context: EmitterContext
): RuntimeUnionFrame | undefined => {
  const carrierSourceType =
    (identifierTarget
      ? resolveIdentifierRuntimeCarrierType(identifierTarget, context)
      : undefined) ??
    context.narrowedBindings?.get(originalName)?.sourceType ??
    context.narrowedBindings?.get(originalName)?.type;

  return (
    resolveAlignedRuntimeUnionMembers(
      undefined,
      effectiveType,
      carrierSourceType,
      context
    ) ?? resolveRuntimeUnionFrame(originalName, effectiveType, context)
  );
};

export const stripGlobalPrefix = (name: string): string =>
  name.startsWith("global::") ? name.slice("global::".length) : name;

export const buildRenameNarrowedMap = (
  originalName: string,
  narrowedName: string,
  memberType: IrType,
  sourceType: IrType | undefined,
  ctxWithId: EmitterContext
): Map<string, NarrowedBinding> => {
  const narrowedMap = new Map(ctxWithId.narrowedBindings ?? []);
  const existingBinding = ctxWithId.narrowedBindings?.get(originalName);
  narrowedMap.set(originalName, {
    kind: "rename",
    name: narrowedName,
    type: memberType,
    sourceType:
      sourceType ?? existingBinding?.sourceType ?? existingBinding?.type,
  });
  return narrowedMap;
};

export const withoutNarrowedBinding = (
  context: EmitterContext,
  bindingKey: string
): EmitterContext => {
  if (!context.narrowedBindings?.has(bindingKey)) {
    return context;
  }

  const narrowedBindings = new Map(context.narrowedBindings);
  narrowedBindings.delete(bindingKey);
  return {
    ...context,
    narrowedBindings,
  };
};

export const isDefinitelyTruthyLiteral = (
  value: string | number | boolean
): boolean => {
  if (typeof value === "string") return value.length > 0;
  if (typeof value === "number") return value !== 0 && !Number.isNaN(value);
  return value === true;
};

export const isDefinitelyFalsyType = (
  type: IrType,
  context: EmitterContext
): boolean => {
  const resolved = resolveTypeAlias(type, context);
  if (resolved.kind === "literalType") {
    const value = resolved.value;
    return value === false || value === 0 || value === "";
  }
  if (resolved.kind === "primitiveType") {
    return resolved.name === "undefined" || resolved.name === "null";
  }
  if (resolved.kind === "unionType") {
    return resolved.types.every((member) =>
      isDefinitelyFalsyType(member, context)
    );
  }
  return false;
};

export const isDefinitelyTruthyType = (
  type: IrType,
  context: EmitterContext
): boolean => {
  const literals = tryGetLiteralSet(type, context);
  if (literals) {
    return Array.from(literals).every(isDefinitelyTruthyLiteral);
  }

  const resolved = resolveTypeAlias(type, context);
  if (resolved.kind === "unionType") {
    return resolved.types.every((member) =>
      isDefinitelyTruthyType(member, context)
    );
  }

  return false;
};

/**
 * Conservative check: does a statement definitely terminate control flow?
 * Used to apply post-if narrowing in patterns like:
 *   if (guard(x)) return ...;
 *   // x is now narrowed in the remainder of the block (2-member unions only)
 */
export const isDefinitelyTerminating = (stmt: IrStatement): boolean => {
  if (
    stmt.kind === "returnStatement" ||
    stmt.kind === "throwStatement" ||
    stmt.kind === "breakStatement" ||
    stmt.kind === "continueStatement"
  ) {
    return true;
  }
  if (stmt.kind === "blockStatement") {
    const last = stmt.statements[stmt.statements.length - 1];
    return last ? isDefinitelyTerminating(last) : false;
  }
  return false;
};

/**
 * Check if an expression represents null or undefined.
 * Handles both literal form (from null/undefined keyword) and identifier form
 * (when TypeScript parses "undefined" as an identifier rather than keyword).
 */
export const isNullOrUndefined = (expr: IrExpression): boolean => {
  // Literal form: null or undefined keyword
  if (
    expr.kind === "literal" &&
    (expr.value === null || expr.value === undefined)
  ) {
    return true;
  }

  // Identifier form: the identifier "undefined"
  // (TypeScript sometimes parses undefined as identifier)
  if (expr.kind === "identifier" && expr.name === "undefined") {
    return true;
  }

  return false;
};

/**
 * Try to extract nullable guard info from a simple comparison expression.
 * This is the core check for patterns like: id !== undefined, id !== null, id != null
 */
export const tryResolveSimpleNullableGuard = (
  condition: IrExpression,
  context: EmitterContext
): NullableGuardInfo | undefined => {
  if (condition.kind !== "binary") return undefined;

  const op = condition.operator;
  const isNotEqual = op === "!==" || op === "!=";
  const isEqual = op === "===" || op === "==";
  if (!isNotEqual && !isEqual) return undefined;

  // Find operand (identifier or member access) and null/undefined expression
  let operand:
    | Extract<IrExpression, { kind: "identifier" | "memberAccess" }>
    | undefined;
  let key: string | undefined;

  if (isNullOrUndefined(condition.right)) {
    operand = unwrapTransparentNarrowingTarget(condition.left);
  } else if (isNullOrUndefined(condition.left)) {
    operand = unwrapTransparentNarrowingTarget(condition.right);
  }

  if (!operand) return undefined;

  if (operand.kind === "identifier") {
    key = operand.name;
  } else {
    key = getMemberAccessNarrowKey(operand);
  }

  if (!key) return undefined;

  const idType =
    resolveEffectiveExpressionType(operand, context) ?? operand.inferredType;
  if (!idType) return undefined;

  // Check if type is nullable (has null or undefined in union)
  const stripped = stripNullish(idType);
  if (stripped === idType) return undefined; // Not a nullable type

  // Check if it's a value type that needs .Value
  const isValueType = isDefinitelyValueType(stripped);

  return {
    key,
    targetExpr: operand,
    strippedType: stripped,
    narrowsInThen: isNotEqual,
    isValueType,
  };
};

/**
 * Try to extract nullable guard info from a condition.
 * Detects patterns like: id !== undefined, id !== null, id != null
 * Also searches inside && (logical AND) conditions recursively.
 *
 * For compound conditions like `method === "GET" && id !== undefined`,
 * we search both sides of the && for a nullable guard pattern.
 *
 * Returns guard info if the condition is a null/undefined check on an identifier
 * with a nullable type that is a value type (needs .Value in C#).
 */
export const tryResolveNullableGuard = (
  condition: IrExpression,
  context: EmitterContext
): NullableGuardInfo | undefined => {
  // First try the simple case
  const simple = tryResolveSimpleNullableGuard(condition, context);
  if (simple) return simple;

  // If this is a && logical expression, search inside it
  if (condition.kind === "logical" && condition.operator === "&&") {
    // Check left side
    const leftGuard = tryResolveNullableGuard(condition.left, context);
    if (leftGuard) return leftGuard;

    // Check right side
    const rightGuard = tryResolveNullableGuard(condition.right, context);
    if (rightGuard) return rightGuard;
  }

  return undefined;
};
