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
import { emitStatement } from "../../statement-emitter.js";
import {
  resolveTypeAlias,
  stripNullish,
  findUnionMemberIndex,
  isDefinitelyValueType,
} from "../../core/type-resolution.js";
import { escapeCSharpIdentifier } from "../../emitter-types/index.js";

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
  const escapedOrig = escapeCSharpIdentifier(originalName);
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
  readonly identifierExpr: IrExpression;
  readonly strippedType: IrType;
  readonly narrowsInThen: boolean; // true for !== null, false for === null
  readonly isValueType: boolean;
};

/**
 * Try to extract nullable guard info from a condition.
 * Detects patterns like: id !== undefined, id !== null, id != null
 *
 * Returns guard info if the condition is a null/undefined check on an identifier
 * with a nullable type that is a value type (needs .Value in C#).
 */
const tryResolveNullableGuard = (
  condition: IrExpression,
  _context: EmitterContext
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
 * Check if an expression's inferred type is boolean
 */
const isBooleanCondition = (expr: IrExpression): boolean => {
  const type = expr.inferredType;
  if (!type) return false;
  return type.kind === "primitiveType" && type.name === "boolean";
};

/**
 * Convert an expression to a valid C# boolean condition.
 * In TypeScript, any value can be used in a boolean context (truthy/falsy).
 * In C#, only boolean expressions are valid conditions.
 *
 * For non-boolean expressions:
 * - Reference types (objects, arrays): emit `expr != null`
 * - Numbers: could emit `expr != 0` (not implemented yet)
 * - Strings: could emit `!string.IsNullOrEmpty(expr)` (not implemented yet)
 */
const toBooleanCondition = (
  expr: IrExpression,
  emittedText: string
): string => {
  // If already boolean, use as-is
  if (isBooleanCondition(expr)) {
    return emittedText;
  }

  // For reference types (non-primitive), add != null check
  const type = expr.inferredType;
  if (type && type.kind !== "primitiveType") {
    return `${emittedText} != null`;
  }

  // Default: assume it's a reference type and add null check
  // This handles cases where type inference didn't work
  if (!type) {
    return `${emittedText} != null`;
  }

  // For primitives that are not boolean, just use as-is for now
  // TODO: Handle number truthiness (x != 0) and string truthiness
  return emittedText;
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
        const rhsCondText = toBooleanCondition(right, rhsFrag.text);

        // When RHS true: emit original THEN under narrowed context
        const [thenCode, thenCtxAfter] = emitStatement(
          stmt.thenStatement,
          indent(rhsCtxAfterEmit)
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
  }

  // Case D: Nullable value type narrowing
  // if (id !== null) { ... } → id becomes id.Value in then-branch
  const nullableGuard = tryResolveNullableGuard(stmt.condition, context);
  if (nullableGuard && nullableGuard.isValueType) {
    const { identifierName, narrowsInThen, strippedType } = nullableGuard;
    const escapedName = escapeCSharpIdentifier(identifierName);

    // Create narrowed binding: id → id.Value
    const narrowedMap = new Map(context.narrowedBindings ?? []);
    narrowedMap.set(identifierName, {
      kind: "expr",
      exprText: `${escapedName}.Value`,
      type: strippedType,
    });

    // Emit condition
    const [condFrag, condContext] = emitExpression(stmt.condition, context);

    // Convert to boolean condition if needed
    const condText = toBooleanCondition(stmt.condition, condFrag.text);

    // Apply narrowing to appropriate branch
    const thenCtx: EmitterContext = {
      ...indent(condContext),
      narrowedBindings: narrowsInThen
        ? narrowedMap
        : condContext.narrowedBindings,
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
  const [condFrag, condContext] = emitExpression(stmt.condition, context);

  // Convert to boolean condition if needed
  const condText = toBooleanCondition(stmt.condition, condFrag.text);

  const [thenCode, thenContext] = emitStatement(
    stmt.thenStatement,
    indent(condContext)
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

    // Add break if not already present
    const lastStmt = switchCase.statements[switchCase.statements.length - 1];
    if (
      !lastStmt ||
      (lastStmt.kind !== "breakStatement" &&
        lastStmt.kind !== "returnStatement")
    ) {
      cases.push(`${getIndent(stmtContext)}break;`);
    }
  }

  const code = `${ind}switch (${exprFrag.text})\n${ind}{\n${cases.join("\n")}\n${ind}}`;
  return [code, dedent(currentContext)];
};
