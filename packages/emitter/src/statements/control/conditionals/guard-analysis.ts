/**
 * Guard analysis and type narrowing helpers for conditional statements.
 *
 * Contains the 5 guard types (GuardInfo, InstanceofGuardInfo, InGuardInfo,
 * DiscriminantEqualityGuardInfo, NullableGuardInfo) and all detection/analysis
 * helper functions used by the if-statement emitter.
 */

import { IrExpression, IrStatement, IrType } from "@tsonic/frontend";
import {
  EmitterContext,
  LocalTypeInfo,
  NarrowedBinding,
} from "../../../types.js";
import { emitExpression } from "../../../expression-emitter.js";
import { emitIdentifier } from "../../../expressions/identifiers.js";
import {
  resolveTypeAlias,
  stripNullish,
  findUnionMemberIndex,
  getPropertyType,
  getAllPropertySignatures,
  isDefinitelyValueType,
} from "../../../core/semantic/type-resolution.js";
import { escapeCSharpIdentifier } from "../../../emitter-types/index.js";
import { emitRemappedLocalName } from "../../../core/format/local-names.js";

/**
 * Information extracted from a type predicate guard call.
 * Used to generate Union.IsN()/AsN() narrowing code.
 */
export type GuardInfo = {
  readonly originalName: string;
  readonly targetType: IrType;
  readonly memberN: number;
  readonly unionArity: number; // Number of members in the union (for negation handling)
  readonly ctxWithId: EmitterContext;
  readonly narrowedName: string;
  readonly escapedOrig: string;
  readonly escapedNarrow: string;
  readonly narrowedMap: Map<string, NarrowedBinding>;
};

/**
 * Information extracted from an `instanceof` condition.
 * Used to generate C# pattern variables for narrowing:
 *   if (x is Foo x__is_1) { ... }
 */
export type InstanceofGuardInfo = {
  readonly originalName: string;
  readonly rhsTypeText: string;
  readonly ctxWithId: EmitterContext;
  readonly ctxAfterRhs: EmitterContext;
  readonly narrowedName: string;
  readonly escapedOrig: string;
  readonly escapedNarrow: string;
  readonly narrowedMap: Map<string, NarrowedBinding>;
  readonly targetType?: IrType;
};

/**
 * Information extracted from an `("prop" in x)` condition.
 *
 * This is used for union narrowing over structural union members (Union<T1..Tn>):
 *   if ("error" in auth) { ... } → if (auth.IsN()) { var auth__N_k = auth.AsN(); ... }
 *
 * NOTE: We only support the common "2-member union" narrowing case today:
 * - RHS must be an identifier
 * - RHS inferred type must resolve to unionType (arity 2..8)
 * - LHS must be a string literal
 * - The property must exist on exactly ONE union member (so narrowing is single-type)
 */
export type InGuardInfo = {
  readonly originalName: string;
  readonly propertyName: string;
  readonly memberN: number;
  readonly unionArity: number;
  readonly ctxWithId: EmitterContext;
  readonly narrowedName: string;
  readonly escapedOrig: string;
  readonly escapedNarrow: string;
  readonly narrowedMap: Map<string, NarrowedBinding>;
};

/**
 * Information extracted from a discriminant literal equality check:
 *   if (x.kind === "circle") { ... }
 *
 * Airplane-grade narrowing is only enabled when:
 * - x is a union (2..8 members)
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
  readonly ctxWithId: EmitterContext;
  readonly narrowedName: string;
  readonly escapedOrig: string;
  readonly escapedNarrow: string;
  readonly narrowedMap: Map<string, NarrowedBinding>;
};

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
const hasLocalProperty = (
  type: Extract<IrType, { kind: "referenceType" }>,
  propertyName: string,
  context: EmitterContext
): boolean => {
  if (!context.localTypes) return false;

  const info = context.localTypes.get(type.name);
  if (!info) return false;

  if (info.kind === "interface") {
    const props = getAllPropertySignatures(type, context);
    return props?.some((p) => p.name === propertyName) ?? false;
  }

  if (info.kind === "class") {
    return info.members.some(
      (m) => m.kind === "propertyDeclaration" && m.name === propertyName
    );
  }

  return false;
};

/**
 * Check if a nominal type has a property, including cross-module local types.
 *
 * For same-module types, consult `context.localTypes`.
 * For cross-module types, consult the batch `typeMemberIndex` and resolve the
 * member's fully-qualified name deterministically.
 */
const hasProperty = (
  type: Extract<IrType, { kind: "referenceType" }>,
  propertyName: string,
  context: EmitterContext
): boolean => {
  if (hasLocalProperty(type, propertyName, context)) {
    return true;
  }

  const index = context.options.typeMemberIndex;
  if (!index) return false;

  const stripGlobalPrefix = (name: string): string =>
    name.startsWith("global::") ? name.slice("global::".length) : name;

  const candidates: string[] = [];

  if (type.resolvedClrType) {
    candidates.push(stripGlobalPrefix(type.resolvedClrType));
  } else if (type.name.includes(".")) {
    candidates.push(type.name);
  } else {
    // Resolve by suffix match in the type member index.
    const matches: string[] = [];
    for (const fqn of index.keys()) {
      if (
        fqn.endsWith(`.${type.name}`) ||
        fqn.endsWith(`.${type.name}__Alias`)
      ) {
        matches.push(fqn);
      }
    }

    if (matches.length === 1) {
      candidates.push(matches[0]!);
    } else if (matches.length > 1) {
      const list = matches.sort().join(", ");
      throw new Error(
        `ICE: Ambiguous union member type '${type.name}' for \`in\` narrowing. Candidates: ${list}`
      );
    }
  }

  return candidates.some((fqn) => {
    const perType = index.get(fqn);
    return perType?.has(propertyName) ?? false;
  });
};

/**
 * Resolve a reference type's LocalTypeInfo map (possibly from a different module).
 *
 * This is required for airplane-grade narrowing features that depend on member *types*
 * (not just member names), e.g. discriminant literal equality checks.
 */
const resolveLocalTypesForReference = (
  type: Extract<IrType, { kind: "referenceType" }>,
  context: EmitterContext
): ReadonlyMap<string, LocalTypeInfo> | undefined => {
  const lookupName = type.name.includes(".")
    ? (type.name.split(".").pop() ?? type.name)
    : type.name;

  if (context.localTypes?.has(lookupName)) {
    return context.localTypes;
  }

  const moduleMap = context.options.moduleMap;
  if (!moduleMap) return undefined;

  const matches: {
    readonly namespace: string;
    readonly localTypes: ReadonlyMap<string, LocalTypeInfo>;
  }[] = [];
  for (const m of moduleMap.values()) {
    if (!m.localTypes) continue;
    if (m.localTypes.has(lookupName)) {
      matches.push({
        namespace: m.namespace,
        localTypes: m.localTypes,
      });
    }
  }

  if (matches.length === 0) return undefined;
  if (matches.length === 1) return matches[0]!.localTypes;

  // Disambiguate by CLR FQN when available.
  const fqn =
    type.resolvedClrType ?? (type.name.includes(".") ? type.name : undefined);
  if (fqn && fqn.includes(".")) {
    const lastDot = fqn.lastIndexOf(".");
    const ns = fqn.slice(0, lastDot);
    const filtered = matches.filter((m) => m.namespace === ns);
    if (filtered.length === 1) return filtered[0]!.localTypes;
  }

  // Ambiguous: refuse to guess.
  return undefined;
};

/**
 * Extract the set of allowed discriminant literal values from a type.
 *
 * Airplane-grade rule:
 * - The discriminant property must be typed as a literal or a union of literals.
 * - If it includes any non-literal members (including null/undefined), we refuse to treat
 *   it as a discriminant for equality-guard narrowing.
 */
const tryGetLiteralSet = (
  type: IrType,
  context: EmitterContext
): ReadonlySet<string | number | boolean> | undefined => {
  const resolved = resolveTypeAlias(type, context);

  if (resolved.kind === "literalType") {
    return new Set([resolved.value]);
  }

  if (resolved.kind === "unionType") {
    const out = new Set<string | number | boolean>();
    for (const t of resolved.types) {
      const r = resolveTypeAlias(t, context);
      if (r.kind !== "literalType") return undefined;
      out.add(r.value);
    }
    return out;
  }

  return undefined;
};

/**
 * Try to extract guard info from `x.prop === <literal>` or `x.prop !== <literal>`.
 *
 * This supports airplane-grade discriminated union narrowing without relying on
 * TypeScript flow analysis, by mapping the literal to exactly one union member.
 */
export const tryResolveDiscriminantEqualityGuard = (
  condition: IrExpression,
  context: EmitterContext
): DiscriminantEqualityGuardInfo | undefined => {
  // Normalize `!(x.prop === lit)` to `x.prop !== lit` (and vice versa).
  if (condition.kind === "unary" && condition.operator === "!") {
    const inner = tryResolveDiscriminantEqualityGuard(
      condition.expression,
      context
    );
    if (!inner) return undefined;

    const flipped =
      inner.operator === "==="
        ? "!=="
        : inner.operator === "!=="
          ? "==="
          : inner.operator === "=="
            ? "!="
            : inner.operator === "!="
              ? "=="
              : inner.operator;

    return { ...inner, operator: flipped as typeof inner.operator };
  }

  if (condition.kind !== "binary") return undefined;
  if (
    condition.operator !== "===" &&
    condition.operator !== "!==" &&
    condition.operator !== "==" &&
    condition.operator !== "!="
  ) {
    return undefined;
  }

  const extract = (
    left: IrExpression,
    right: IrExpression
  ):
    | {
        readonly receiver: Extract<IrExpression, { kind: "identifier" }>;
        readonly propertyName: string;
        readonly literal: string | number | boolean;
      }
    | undefined => {
    if (left.kind !== "memberAccess") return undefined;
    if (left.isOptional) return undefined;
    if (left.isComputed) return undefined;
    if (left.object.kind !== "identifier") return undefined;
    if (typeof left.property !== "string") return undefined;
    if (right.kind !== "literal") return undefined;
    if (
      typeof right.value !== "string" &&
      typeof right.value !== "number" &&
      typeof right.value !== "boolean"
    ) {
      return undefined;
    }

    return {
      receiver: left.object,
      propertyName: left.property,
      literal: right.value,
    };
  };

  const direct = extract(condition.left, condition.right);
  const swapped = direct ? undefined : extract(condition.right, condition.left);
  const match = direct ?? swapped;
  if (!match) return undefined;

  const { receiver, propertyName, literal } = match;
  const originalName = receiver.name;

  // If this identifier is already narrowed (union guard emitted earlier), do NOT try to
  // apply another union narrowing rule. This avoids mis-emitting `.IsN()` on a narrowed member type.
  if (context.narrowedBindings?.has(originalName)) return undefined;

  const unionSourceType = receiver.inferredType;
  if (!unionSourceType) return undefined;

  const resolved = resolveTypeAlias(stripNullish(unionSourceType), context);
  if (resolved.kind !== "unionType") return undefined;

  const unionArity = resolved.types.length;
  if (unionArity < 2 || unionArity > 8) return undefined;

  // Find which union members have a discriminant property type that includes the literal.
  const matchingMembers: number[] = [];

  for (let i = 0; i < resolved.types.length; i++) {
    const member = resolved.types[i];
    if (!member) continue;

    let propType: IrType | undefined;

    if (member.kind === "objectType") {
      const prop = member.members.find(
        (m): m is Extract<typeof m, { kind: "propertySignature" }> =>
          m.kind === "propertySignature" && m.name === propertyName
      );
      propType = prop?.type;
    } else if (member.kind === "referenceType") {
      const localTypes = resolveLocalTypesForReference(member, context);
      if (!localTypes) continue;

      const lookupName = member.name.includes(".")
        ? (member.name.split(".").pop() ?? member.name)
        : member.name;

      // Use the target module's localTypes for property type resolution.
      propType = getPropertyType(
        { ...member, name: lookupName },
        propertyName,
        { ...context, localTypes }
      );
    } else {
      continue;
    }

    if (!propType) continue;

    const literals = tryGetLiteralSet(propType, context);
    if (!literals) continue;

    if (literals.has(literal)) {
      matchingMembers.push(i + 1);
    }
  }

  // Only support the common airplane-grade case: exactly one matching member.
  if (matchingMembers.length !== 1) return undefined;

  const memberN = matchingMembers[0];
  if (!memberN) return undefined;

  const nextId = (context.tempVarId ?? 0) + 1;
  const ctxWithId: EmitterContext = { ...context, tempVarId: nextId };

  const narrowedName = `${originalName}__${memberN}_${nextId}`;
  const escapedOrig = emitRemappedLocalName(originalName, context);
  const escapedNarrow = escapeCSharpIdentifier(narrowedName);

  const narrowedMap = new Map(ctxWithId.narrowedBindings ?? []);
  const memberType = resolved.types[memberN - 1];
  narrowedMap.set(originalName, {
    kind: "rename",
    name: narrowedName,
    type: memberType,
  });

  return {
    originalName,
    propertyName,
    literal,
    operator: condition.operator,
    memberN,
    unionArity,
    ctxWithId,
    narrowedName,
    escapedOrig,
    escapedNarrow,
    narrowedMap,
  };
};

/**
 * Try to extract guard info from an `("prop" in x)` binary expression.
 */
export const tryResolveInGuard = (
  condition: IrExpression,
  context: EmitterContext
): InGuardInfo | undefined => {
  if (condition.kind !== "binary") return undefined;
  if (condition.operator !== "in") return undefined;

  // LHS must be a string literal
  if (condition.left.kind !== "literal") return undefined;
  if (typeof condition.left.value !== "string") return undefined;

  // RHS must be an identifier (the name we can narrow)
  if (condition.right.kind !== "identifier") return undefined;

  const propertyName = condition.left.value;
  const originalName = condition.right.name;

  const unionSourceType = condition.right.inferredType;
  if (!unionSourceType) return undefined;

  const resolved = resolveTypeAlias(stripNullish(unionSourceType), context);
  if (resolved.kind !== "unionType") return undefined;

  const unionArity = resolved.types.length;
  if (unionArity < 2 || unionArity > 8) return undefined;

  // Find which union members contain the property.
  const matchingMembers: number[] = [];
  for (let i = 0; i < resolved.types.length; i++) {
    const member = resolved.types[i];
    if (!member || member.kind !== "referenceType") continue;
    if (hasProperty(member, propertyName, context)) {
      matchingMembers.push(i + 1);
    }
  }

  // Only support the common "exactly one matching member" narrowing case.
  if (matchingMembers.length !== 1) return undefined;

  const memberN = matchingMembers[0];
  if (!memberN) return undefined;

  const nextId = (context.tempVarId ?? 0) + 1;
  const ctxWithId: EmitterContext = { ...context, tempVarId: nextId };

  const narrowedName = `${originalName}__${memberN}_${nextId}`;
  const [rhsFrag] = emitIdentifier(condition.right, context);
  const escapedOrig = rhsFrag.text;
  const escapedNarrow = escapeCSharpIdentifier(narrowedName);

  const narrowedMap = new Map(ctxWithId.narrowedBindings ?? []);
  const memberType = resolved.types[memberN - 1];
  narrowedMap.set(originalName, {
    kind: "rename",
    name: narrowedName,
    type: memberType,
  });

  return {
    originalName,
    propertyName,
    memberN,
    unionArity,
    ctxWithId,
    narrowedName,
    escapedOrig,
    escapedNarrow,
    narrowedMap,
  };
};

/**
 * Conservative check: does a statement definitely terminate control flow?
 * Used to apply post-if narrowing in patterns like:
 *   if (guard(x)) return ...;
 *   // x is now narrowed in the remainder of the block (2-member unions only)
 */
export const isDefinitelyTerminating = (stmt: IrStatement): boolean => {
  if (stmt.kind === "returnStatement" || stmt.kind === "throwStatement") {
    return true;
  }
  if (stmt.kind === "blockStatement") {
    const last = stmt.statements[stmt.statements.length - 1];
    return last ? isDefinitelyTerminating(last) : false;
  }
  return false;
};

/**
 * Try to extract guard info from a predicate call expression.
 * Returns GuardInfo if:
 * - call.narrowing is typePredicate
 * - predicate arg is identifier
 * - arg.inferredType resolves to unionType
 * - targetType exists in union
 */
export const tryResolvePredicateGuard = (
  call: Extract<IrExpression, { kind: "call" }>,
  context: EmitterContext
): GuardInfo | undefined => {
  const narrowing = call.narrowing;
  if (!narrowing || narrowing.kind !== "typePredicate") return undefined;

  const arg = call.arguments[narrowing.argIndex];
  if (
    !arg ||
    ("kind" in arg && arg.kind === "spread") ||
    arg.kind !== "identifier"
  ) {
    return undefined;
  }

  const originalName = arg.name;
  const unionSourceType = arg.inferredType;
  if (!unionSourceType) return undefined;

  const resolved = resolveTypeAlias(stripNullish(unionSourceType), context);
  if (resolved.kind !== "unionType") return undefined;

  const idx = findUnionMemberIndex(resolved, narrowing.targetType, context);
  if (idx === undefined) return undefined;

  const memberN = idx + 1;
  const unionArity = resolved.types.length;

  const nextId = (context.tempVarId ?? 0) + 1;
  const ctxWithId: EmitterContext = { ...context, tempVarId: nextId };

  const narrowedName = `${originalName}__${memberN}_${nextId}`;
  const [argFrag] = emitIdentifier(arg, context);
  const escapedOrig = argFrag.text;
  const escapedNarrow = escapeCSharpIdentifier(narrowedName);

  const narrowedMap = new Map(ctxWithId.narrowedBindings ?? []);
  narrowedMap.set(originalName, {
    kind: "rename",
    name: narrowedName,
    type: narrowing.targetType,
  });

  return {
    originalName,
    targetType: narrowing.targetType,
    memberN,
    unionArity,
    ctxWithId,
    narrowedName,
    escapedOrig,
    escapedNarrow,
    narrowedMap,
  };
};

/**
 * Try to extract guard info from an `instanceof` binary expression.
 * Returns guard info if:
 * - condition is `binary` with operator `instanceof`
 * - lhs is identifier
 *
 * Note: rhs is emitted as a type name (C# pattern).
 */
export const tryResolveInstanceofGuard = (
  condition: IrExpression,
  context: EmitterContext
): InstanceofGuardInfo | undefined => {
  if (condition.kind !== "binary") return undefined;
  if (condition.operator !== "instanceof") return undefined;
  if (condition.left.kind !== "identifier") return undefined;

  const originalName = condition.left.name;
  const [lhsFrag, ctxAfterLhs] = emitIdentifier(condition.left, context);
  const escapedOrig = lhsFrag.text;

  const nextId = (ctxAfterLhs.tempVarId ?? 0) + 1;
  const ctxWithId: EmitterContext = { ...ctxAfterLhs, tempVarId: nextId };

  // Emit RHS as a type name (e.g., global::System.String)
  const [rhsFrag, ctxAfterRhs] = emitExpression(condition.right, ctxWithId);
  const rhsTypeText = rhsFrag.text;

  // Pattern variable name for the narrowed value.
  const narrowedName = `${originalName}__is_${nextId}`;
  const escapedNarrow = escapeCSharpIdentifier(narrowedName);

  const narrowedMap = new Map(ctxAfterRhs.narrowedBindings ?? []);
  narrowedMap.set(originalName, {
    kind: "rename",
    name: narrowedName,
    type: condition.right.inferredType ?? undefined,
  });

  return {
    originalName,
    rhsTypeText,
    ctxWithId,
    ctxAfterRhs,
    narrowedName,
    escapedOrig,
    escapedNarrow,
    narrowedMap,
    targetType: condition.right.inferredType ?? undefined,
  };
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

export const getMemberAccessNarrowKey = (
  expr: Extract<IrExpression, { kind: "memberAccess" }>
): string | undefined => {
  if (expr.isComputed) return undefined;
  if (typeof expr.property !== "string") return undefined;

  const obj = expr.object;
  if (obj.kind === "identifier") {
    return `${obj.name}.${expr.property}`;
  }

  if (obj.kind === "memberAccess") {
    const prefix = getMemberAccessNarrowKey(obj);
    return prefix ? `${prefix}.${expr.property}` : undefined;
  }

  if (obj.kind === "this") {
    return `this.${expr.property}`;
  }

  return undefined;
};

/**
 * Try to extract nullable guard info from a simple comparison expression.
 * This is the core check for patterns like: id !== undefined, id !== null, id != null
 */
export const tryResolveSimpleNullableGuard = (
  condition: IrExpression
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

  if (
    isNullOrUndefined(condition.right) &&
    (condition.left.kind === "identifier" ||
      condition.left.kind === "memberAccess")
  ) {
    operand = condition.left;
  } else if (
    isNullOrUndefined(condition.left) &&
    (condition.right.kind === "identifier" ||
      condition.right.kind === "memberAccess")
  ) {
    operand = condition.right;
  }

  if (!operand) return undefined;

  if (operand.kind === "identifier") {
    key = operand.name;
  } else {
    key = getMemberAccessNarrowKey(operand);
  }

  if (!key) return undefined;

  const idType = operand.inferredType;
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
  _context: EmitterContext
): NullableGuardInfo | undefined => {
  // First try the simple case
  const simple = tryResolveSimpleNullableGuard(condition);
  if (simple) return simple;

  // If this is a && logical expression, search inside it
  if (condition.kind === "logical" && condition.operator === "&&") {
    // Check left side
    const leftGuard = tryResolveNullableGuard(condition.left, _context);
    if (leftGuard) return leftGuard;

    // Check right side
    const rightGuard = tryResolveNullableGuard(condition.right, _context);
    if (rightGuard) return rightGuard;
  }

  return undefined;
};
