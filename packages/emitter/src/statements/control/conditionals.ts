/**
 * Conditional statement emitters (if, switch)
 */

import { IrExpression, IrStatement, IrType } from "@tsonic/frontend";
import {
  EmitterContext,
  getIndent,
  indent,
  dedent,
  NarrowedBinding,
} from "../../types.js";
import { emitExpression } from "../../expression-emitter.js";
import { emitIdentifier } from "../../expressions/identifiers.js";
import { emitStatement } from "../../statement-emitter.js";
import {
  resolveTypeAlias,
  stripNullish,
  findUnionMemberIndex,
  getAllPropertySignatures,
  isDefinitelyValueType,
} from "../../core/type-resolution.js";
import { escapeCSharpIdentifier } from "../../emitter-types/index.js";
import { emitBooleanCondition, toBooleanCondition } from "../../core/boolean-context.js";

/**
 * Information extracted from a type predicate guard call.
 * Used to generate Union.IsN()/AsN() narrowing code.
 */
type GuardInfo = {
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
type InstanceofGuardInfo = {
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
type InGuardInfo = {
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
      if (fqn.endsWith(`.${type.name}`) || fqn.endsWith(`.${type.name}__Alias`)) {
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
 * Try to extract guard info from an `("prop" in x)` binary expression.
 */
const tryResolveInGuard = (
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
const isDefinitelyTerminating = (stmt: IrStatement): boolean => {
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
const tryResolvePredicateGuard = (
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
const tryResolveInstanceofGuard = (
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
const isNullOrUndefined = (expr: IrExpression): boolean => {
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
 * Information extracted from a nullable guard condition.
 * Used to generate .Value access for narrowed nullable value types.
 */
type NullableGuardInfo = {
  readonly identifierName: string;
  readonly identifierExpr: Extract<IrExpression, { kind: "identifier" }>;
  readonly strippedType: IrType;
  readonly narrowsInThen: boolean; // true for !== null, false for === null
  readonly isValueType: boolean;
};

/**
 * Try to extract nullable guard info from a simple comparison expression.
 * This is the core check for patterns like: id !== undefined, id !== null, id != null
 */
const tryResolveSimpleNullableGuard = (
  condition: IrExpression
): NullableGuardInfo | undefined => {
  if (condition.kind !== "binary") return undefined;

  const op = condition.operator;
  const isNotEqual = op === "!==" || op === "!=";
  const isEqual = op === "===" || op === "==";
  if (!isNotEqual && !isEqual) return undefined;

  // Find identifier and null/undefined expression
  let identifier: Extract<IrExpression, { kind: "identifier" }> | undefined;

  if (
    isNullOrUndefined(condition.right) &&
    condition.left.kind === "identifier"
  ) {
    identifier = condition.left;
  } else if (
    isNullOrUndefined(condition.left) &&
    condition.right.kind === "identifier"
  ) {
    identifier = condition.right;
  }

  if (!identifier) return undefined;

  const idType = identifier.inferredType;
  if (!idType) return undefined;

  // Check if type is nullable (has null or undefined in union)
  const stripped = stripNullish(idType);
  if (stripped === idType) return undefined; // Not a nullable type

  // Check if it's a value type that needs .Value
  const isValueType = isDefinitelyValueType(stripped);

  return {
    identifierName: identifier.name,
    identifierExpr: identifier,
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
const tryResolveNullableGuard = (
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

/**
 * Emit a forced block with a preamble line (e.g., var narrowed = x.AsN()).
 * If bodyStmt is already a block, emits its statements directly to avoid nesting.
 */
const emitForcedBlockWithPreamble = (
  preambleLine: string,
  bodyStmt: IrStatement,
  bodyCtx: EmitterContext,
  outerInd: string
): [string, EmitterContext] => {
  const parts: string[] = [preambleLine];

  const emitBodyStatements = (
    statements: readonly IrStatement[],
    ctx: EmitterContext
  ): EmitterContext => {
    let currentCtx = ctx;
    for (const s of statements) {
      const [code, next] = emitStatement(s, currentCtx);
      parts.push(code);
      currentCtx = next;
    }
    return currentCtx;
  };

  const finalCtx =
    bodyStmt.kind === "blockStatement"
      ? emitBodyStatements(bodyStmt.statements, bodyCtx)
      : (() => {
          const [code, next] = emitStatement(bodyStmt, bodyCtx);
          parts.push(code);
          return next;
        })();

  const blockBody = parts.join("\n");
  const code = `${outerInd}{\n${blockBody}\n${outerInd}}`;
  return [code, finalCtx];
};

/**
 * Emit an if statement
 */
export const emitIfStatement = (
  stmt: Extract<IrStatement, { kind: "ifStatement" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  const ind = getIndent(context);

  // Case A: if (isUser(account)) { ... }
  // Predicate narrowing rewrite → if (account.IsN()) { var account__N_k = account.AsN(); ... }
  if (stmt.condition.kind === "call") {
    const guard = tryResolvePredicateGuard(stmt.condition, context);
    if (guard) {
      const { memberN, ctxWithId, escapedOrig, escapedNarrow, narrowedMap } =
        guard;
      const condText = `${escapedOrig}.Is${memberN}()`;

      const thenCtx: EmitterContext = {
        ...indent(ctxWithId),
        narrowedBindings: narrowedMap,
      };

      const thenInd = getIndent(thenCtx);
      const castLine = `${thenInd}var ${escapedNarrow} = ${escapedOrig}.As${memberN}();`;

      const [thenCode, thenBodyCtx] = emitForcedBlockWithPreamble(
        castLine,
        stmt.thenStatement,
        thenCtx,
        ind
      );

      let finalContext = dedent(thenBodyCtx);
      finalContext = {
        ...finalContext,
        narrowedBindings: ctxWithId.narrowedBindings,
      };

      let code = `${ind}if (${condText})\n${thenCode}`;

      if (stmt.elseStatement) {
        const [elseCode, elseCtx] = emitStatement(
          stmt.elseStatement,
          indent(finalContext)
        );
        code += `\n${ind}else\n${elseCode}`;
        finalContext = dedent(elseCtx);
      }

      return [code, finalContext];
    }
  }

  // Case A3: if ("error" in auth) { ... }
  // Union 'in' narrowing rewrite → if (auth.IsN()) { var auth__N_k = auth.AsN(); ... }
  const inGuard = tryResolveInGuard(stmt.condition, context);
  if (inGuard) {
    const {
      originalName,
      memberN,
      unionArity,
      ctxWithId,
      escapedOrig,
      escapedNarrow,
      narrowedMap,
    } = inGuard;

    const condText = `${escapedOrig}.Is${memberN}()`;

    const thenCtx: EmitterContext = {
      ...indent(ctxWithId),
      narrowedBindings: narrowedMap,
    };

    const thenInd = getIndent(thenCtx);
    const castLine = `${thenInd}var ${escapedNarrow} = ${escapedOrig}.As${memberN}();`;

    const [thenCode, thenBodyCtx] = emitForcedBlockWithPreamble(
      castLine,
      stmt.thenStatement,
      thenCtx,
      ind
    );

    let finalContext = dedent(thenBodyCtx);

    let code = `${ind}if (${condText})\n${thenCode}`;

    // Optional else branch narrowing (2-member unions only)
    if (stmt.elseStatement) {
      if (unionArity === 2) {
        const otherMemberN = memberN === 1 ? 2 : 1;
        const inlineExpr = `(${escapedOrig}.As${otherMemberN}())`;
        const elseNarrowedMap = new Map(ctxWithId.narrowedBindings ?? []);
        elseNarrowedMap.set(originalName, { kind: "expr", exprText: inlineExpr });

        const elseCtx: EmitterContext = {
          ...indent({ ...finalContext, narrowedBindings: elseNarrowedMap }),
        };

        const [elseCode, elseCtxAfter] = emitStatement(
          stmt.elseStatement,
          elseCtx
        );
        code += `\n${ind}else\n${elseCode}`;
        finalContext = dedent(elseCtxAfter);
        finalContext = { ...finalContext, narrowedBindings: ctxWithId.narrowedBindings };
        return [code, finalContext];
      }

      // If we can't narrow ELSE safely, emit it without narrowing.
      const [elseCode, elseCtx] = emitStatement(
        stmt.elseStatement,
        indent({ ...finalContext, narrowedBindings: ctxWithId.narrowedBindings })
      );
      code += `\n${ind}else\n${elseCode}`;
      finalContext = dedent(elseCtx);
      finalContext = { ...finalContext, narrowedBindings: ctxWithId.narrowedBindings };
      return [code, finalContext];
    }

    // Post-if narrowing for early-exit patterns (2-member unions only):
    // if (auth.Is2()) return ...;
    // // auth is now member 1 in the remainder
    if (unionArity === 2 && isDefinitelyTerminating(stmt.thenStatement)) {
      const otherMemberN = memberN === 1 ? 2 : 1;
      const inlineExpr = `(${escapedOrig}.As${otherMemberN}())`;
      const postMap = new Map(ctxWithId.narrowedBindings ?? []);
      postMap.set(originalName, { kind: "expr", exprText: inlineExpr });
      finalContext = { ...finalContext, narrowedBindings: postMap };
      return [code, finalContext];
    }

    // Restore narrowedBindings to the incoming scope.
    finalContext = { ...finalContext, narrowedBindings: ctxWithId.narrowedBindings };
    return [code, finalContext];
  }

  // Case A2: if (x instanceof Foo) { ... }
  // C# pattern var narrowing → if (x is Foo x__is_k) { ... } (then-branch sees narrowed x)
  const instanceofGuard = tryResolveInstanceofGuard(stmt.condition, context);
  if (instanceofGuard) {
    const {
      ctxAfterRhs,
      escapedOrig,
      escapedNarrow,
      rhsTypeText,
      narrowedMap,
    } = instanceofGuard;

    const condText = `${escapedOrig} is ${rhsTypeText} ${escapedNarrow}`;

    const thenCtx: EmitterContext = {
      ...indent(ctxAfterRhs),
      narrowedBindings: narrowedMap,
    };
    const [thenCode, thenCtxAfter] = emitStatement(stmt.thenStatement, thenCtx);

    let code = `${ind}if (${condText})\n${thenCode}`;
    let finalContext = dedent(thenCtxAfter);
    finalContext = { ...finalContext, narrowedBindings: ctxAfterRhs.narrowedBindings };

    if (stmt.elseStatement) {
      const [elseCode, elseCtx] = emitStatement(
        stmt.elseStatement,
        indent(finalContext)
      );
      code += `\n${ind}else\n${elseCode}`;
      finalContext = dedent(elseCtx);
    }

    return [code, finalContext];
  }

  // Case B: if (!isUser(account)) { ... } else { ... }
  // Negated guard → for 2-member unions, narrow THEN to OTHER member, ELSE to guard's target
  if (
    stmt.condition.kind === "unary" &&
    stmt.condition.operator === "!" &&
    stmt.condition.expression.kind === "call" &&
    stmt.elseStatement
  ) {
    const innerCall = stmt.condition.expression;
    const guard = tryResolvePredicateGuard(innerCall, context);
    if (guard) {
      const {
        originalName,
        memberN,
        unionArity,
        ctxWithId,
        escapedOrig,
        escapedNarrow,
        narrowedMap,
      } = guard;

      const condText = `!${escapedOrig}.Is${memberN}()`;

      // For 2-member unions: narrow THEN branch to the OTHER member
      // For N>2 unions: can't narrow THEN to a single type (it could be any of N-1 members)
      let thenCode: string;
      let thenCtx: EmitterContext;

      if (unionArity === 2) {
        // Calculate the other member index (if memberN is 1, other is 2; if memberN is 2, other is 1)
        const otherMemberN = memberN === 1 ? 2 : 1;
        const nextId = (ctxWithId.tempVarId ?? 0) + 1;
        const thenCtxWithId: EmitterContext = {
          ...ctxWithId,
          tempVarId: nextId,
        };

        const thenNarrowedName = `${originalName}__${otherMemberN}_${nextId}`;
        const escapedThenNarrow = escapeCSharpIdentifier(thenNarrowedName);

        const thenNarrowedMap = new Map(thenCtxWithId.narrowedBindings ?? []);
        thenNarrowedMap.set(originalName, {
          kind: "rename",
          name: thenNarrowedName,
        });

        const thenCtxNarrowed: EmitterContext = {
          ...indent(thenCtxWithId),
          narrowedBindings: thenNarrowedMap,
        };
        const thenInd = getIndent(thenCtxNarrowed);
        const thenCastLine = `${thenInd}var ${escapedThenNarrow} = ${escapedOrig}.As${otherMemberN}();`;

        [thenCode, thenCtx] = emitForcedBlockWithPreamble(
          thenCastLine,
          stmt.thenStatement,
          thenCtxNarrowed,
          ind
        );
      } else {
        // N>2 unions: can't narrow THEN branch to a single type
        [thenCode, thenCtx] = emitStatement(
          stmt.thenStatement,
          indent(context)
        );
      }

      // else branch: narrowing applies (to guard's target type)
      const elseCtxNarrowed: EmitterContext = {
        ...indent(ctxWithId),
        narrowedBindings: narrowedMap,
      };
      const elseInd = getIndent(elseCtxNarrowed);
      const castLine = `${elseInd}var ${escapedNarrow} = ${escapedOrig}.As${memberN}();`;

      const [elseBlock, _elseBodyCtx] = emitForcedBlockWithPreamble(
        castLine,
        stmt.elseStatement,
        elseCtxNarrowed,
        ind
      );

      // Note: narrow bindings should not leak from if-else branches
      // We return thenCtx to preserve original semantics
      const code = `${ind}if (${condText})\n${thenCode}\n${ind}else\n${elseBlock}`;
      return [code, dedent(thenCtx)];
    }
  }

  // Case B2: if (!(x instanceof Foo)) { ... } else { ... }
  // Swap branches so ELSE runs under the narrowed pattern var.
  if (
    stmt.condition.kind === "unary" &&
    stmt.condition.operator === "!" &&
    stmt.elseStatement
  ) {
    const inner = stmt.condition.expression;
    const guard = tryResolveInstanceofGuard(inner, context);
    if (guard) {
      const {
        ctxAfterRhs,
        escapedOrig,
        escapedNarrow,
        rhsTypeText,
        narrowedMap,
      } = guard;

      const condText = `${escapedOrig} is ${rhsTypeText} ${escapedNarrow}`;

      // THEN branch is the original ELSE (narrowed)
      const thenCtx: EmitterContext = {
        ...indent(ctxAfterRhs),
        narrowedBindings: narrowedMap,
      };
      const [thenCode, thenCtxAfter] = emitStatement(stmt.elseStatement, thenCtx);

      // ELSE branch is the original THEN (not narrowed)
      const [elseCode, elseCtxAfter] = emitStatement(
        stmt.thenStatement,
        indent({ ...dedent(thenCtxAfter), narrowedBindings: ctxAfterRhs.narrowedBindings })
      );

      const code = `${ind}if (${condText})\n${thenCode}\n${ind}else\n${elseCode}`;
      return [code, dedent(elseCtxAfter)];
    }
  }

  // Case C: if (isUser(account) && account.foo) { ... }
  // Logical AND with predicate guard on left → nested-if lowering (preserves short-circuit)
  if (stmt.condition.kind === "logical" && stmt.condition.operator === "&&") {
    const left = stmt.condition.left;
    const right = stmt.condition.right;

    if (left.kind === "call") {
      const guard = tryResolvePredicateGuard(left, context);
      if (guard) {
        const { memberN, ctxWithId, escapedOrig, escapedNarrow, narrowedMap } =
          guard;

        // Outer: if (x.IsN())
        const outerCond = `${escapedOrig}.Is${memberN}()`;

        // Outer-then creates narrowed var
        const outerThenCtx: EmitterContext = {
          ...indent(ctxWithId),
          narrowedBindings: narrowedMap,
        };
        const outerThenInd = getIndent(outerThenCtx);
        const castLine = `${outerThenInd}var ${escapedNarrow} = ${escapedOrig}.As${memberN}();`;

        // Emit RHS condition under narrowed context (TS semantics: rhs sees narrowed x)
        const [rhsFrag, rhsCtxAfterEmit] = emitExpression(right, outerThenCtx);
        const [rhsCondText, rhsCtxAfterCond] = toBooleanCondition(
          right,
          rhsFrag.text,
          rhsCtxAfterEmit
        );

        // When RHS true: emit original THEN under narrowed context
        const [thenCode, thenCtxAfter] = emitStatement(
          stmt.thenStatement,
          indent(rhsCtxAfterCond)
        );

        // Helper to clear narrowing from context
        const clearNarrowing = (ctx: EmitterContext): EmitterContext => ({
          ...ctx,
          narrowedBindings: ctxWithId.narrowedBindings,
        });

        let inner = `${outerThenInd}if (${rhsCondText})\n${thenCode}`;
        let currentCtx = dedent(thenCtxAfter);

        if (stmt.elseStatement) {
          const [elseCode, elseCtx] = emitStatement(
            stmt.elseStatement,
            indent(clearNarrowing(currentCtx))
          );
          inner += `\n${outerThenInd}else\n${elseCode}`;
          currentCtx = dedent(elseCtx);
        }

        const outerThenBlock = `${ind}{\n${castLine}\n${inner}\n${ind}}`;

        // Outer else: emit ELSE as-is (no narrowing)
        let code = `${ind}if (${outerCond})\n${outerThenBlock}`;
        let finalContext = clearNarrowing(currentCtx);

        if (stmt.elseStatement) {
          const [outerElseCode, outerElseCtx] = emitStatement(
            stmt.elseStatement,
            indent(finalContext)
          );
          code += `\n${ind}else\n${outerElseCode}`;
          finalContext = dedent(outerElseCtx);
        }

        return [code, finalContext];
      }
    }

    // Case C2: if (x instanceof Foo && x.foo) { ... }
    // Preserve short-circuit and expose narrowed x in RHS and THEN.
    if (left.kind === "binary" && left.operator === "instanceof") {
      const guard = tryResolveInstanceofGuard(left, context);
      if (guard) {
        const {
          ctxAfterRhs,
          escapedOrig,
          escapedNarrow,
          rhsTypeText,
          narrowedMap,
        } = guard;

        const rhsCtx: EmitterContext = {
          ...ctxAfterRhs,
          narrowedBindings: narrowedMap,
        };

        const [rhsFrag, rhsCtxAfterEmit] = emitExpression(right, rhsCtx);
        const [rhsCondText, rhsCtxAfterCond] = toBooleanCondition(
          right,
          rhsFrag.text,
          rhsCtxAfterEmit
        );

        const condText = `(${escapedOrig} is ${rhsTypeText} ${escapedNarrow} && ${rhsCondText})`;

        const thenCtx: EmitterContext = {
          ...indent(rhsCtxAfterCond),
          narrowedBindings: narrowedMap,
        };
        const [thenCode, thenCtxAfter] = emitStatement(stmt.thenStatement, thenCtx);

        let code = `${ind}if (${condText})\n${thenCode}`;
        let finalContext = dedent(thenCtxAfter);
        finalContext = { ...finalContext, narrowedBindings: ctxAfterRhs.narrowedBindings };

        if (stmt.elseStatement) {
          const [elseCode, elseCtx] = emitStatement(
            stmt.elseStatement,
            indent(finalContext)
          );
          code += `\n${ind}else\n${elseCode}`;
          finalContext = dedent(elseCtx);
        }

        return [code, finalContext];
      }
    }
  }

  // Case D: Nullable value type narrowing
  // if (id !== null) { ... } → id becomes id.Value in then-branch
  const nullableGuard = tryResolveNullableGuard(stmt.condition, context);
  if (nullableGuard && nullableGuard.isValueType) {
    const { identifierName, identifierExpr, narrowsInThen, strippedType } =
      nullableGuard;
    // IMPORTANT: The identifier may be remapped due to CS0136 shadowing avoidance.
    // Use the normal identifier emitter so we respect `localNameMap`.
    const [idFrag] = emitIdentifier(identifierExpr, context);

    // Create narrowed binding: id → id.Value
    const narrowedMap = new Map(context.narrowedBindings ?? []);
    narrowedMap.set(identifierName, {
      kind: "expr",
      exprText: `${idFrag.text}.Value`,
      type: strippedType,
    });

    // Emit condition (boolean context)
    const [condText, condCtxAfterCond] = emitBooleanCondition(
      stmt.condition,
      (e, ctx) => emitExpression(e, ctx),
      context
    );

    // Apply narrowing to appropriate branch
    const thenCtx: EmitterContext = {
      ...indent(condCtxAfterCond),
      narrowedBindings: narrowsInThen
        ? narrowedMap
        : condCtxAfterCond.narrowedBindings,
    };

    const [thenCode, thenCtxAfter] = emitStatement(stmt.thenStatement, thenCtx);

    let code = `${ind}if (${condText})\n${thenCode}`;
    let finalContext = dedent(thenCtxAfter);

    // Clear narrowing after branch
    finalContext = {
      ...finalContext,
      narrowedBindings: context.narrowedBindings,
    };

    if (stmt.elseStatement) {
      const elseCtx: EmitterContext = {
        ...indent(finalContext),
        narrowedBindings: !narrowsInThen
          ? narrowedMap
          : context.narrowedBindings,
      };
      const [elseCode, elseCtxAfter] = emitStatement(
        stmt.elseStatement,
        elseCtx
      );
      code += `\n${ind}else\n${elseCode}`;
      finalContext = dedent(elseCtxAfter);
      finalContext = {
        ...finalContext,
        narrowedBindings: context.narrowedBindings,
      };
    }

    return [code, finalContext];
  }

  // Standard if-statement emission (no narrowing)
  const [condText, condCtxAfterCond] = emitBooleanCondition(
    stmt.condition,
    (e, ctx) => emitExpression(e, ctx),
    context
  );

  const [thenCode, thenContext] = emitStatement(
    stmt.thenStatement,
    indent(condCtxAfterCond)
  );

  let code = `${ind}if (${condText})\n${thenCode}`;
  let finalContext = dedent(thenContext);

  if (stmt.elseStatement) {
    const [elseCode, elseContext] = emitStatement(
      stmt.elseStatement,
      indent(finalContext)
    );
    code += `\n${ind}else\n${elseCode}`;
    finalContext = dedent(elseContext);
  }

  return [code, finalContext];
};

/**
 * Emit a switch statement
 */
export const emitSwitchStatement = (
  stmt: Extract<IrStatement, { kind: "switchStatement" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  const ind = getIndent(context);
  const [exprFrag, exprContext] = emitExpression(stmt.expression, context);

  let currentContext = indent(exprContext);
  const caseInd = getIndent(currentContext);
  const cases: string[] = [];

  for (const switchCase of stmt.cases) {
    if (switchCase.test) {
      const [testFrag, testContext] = emitExpression(
        switchCase.test,
        currentContext
      );
      currentContext = testContext;
      cases.push(`${caseInd}case ${testFrag.text}:`);
    } else {
      cases.push(`${caseInd}default:`);
    }

    const stmtContext = indent(currentContext);
    for (const s of switchCase.statements) {
      const [code, newContext] = emitStatement(s, stmtContext);
      cases.push(code);
      currentContext = newContext;
    }

    // Emit break only when case has non-empty body that doesn't terminate.
    // Empty bodies represent intentional fall-through labels (TypeScript semantics).
    const hasBody = switchCase.statements.length > 0;
    if (hasBody) {
      const lastStmt = switchCase.statements[switchCase.statements.length - 1];
      const terminates =
        lastStmt?.kind === "breakStatement" ||
        lastStmt?.kind === "returnStatement" ||
        lastStmt?.kind === "throwStatement";
      if (!terminates) {
        cases.push(`${getIndent(stmtContext)}break;`);
      }
    }
  }

  const code = `${ind}switch (${exprFrag.text})\n${ind}{\n${cases.join("\n")}\n${ind}}`;
  return [code, dedent(currentContext)];
};
