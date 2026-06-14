/**
 * Binary operator expression emitter — main dispatch function.
 *
 * Extracted from binary-emitter.ts — contains the emitBinary entry point
 * that handles comparison, nullish, arithmetic, and standard binary operators.
 * The `instanceof` special case is delegated to binary-special-ops.ts.
 *
 * NEW NUMERIC SPEC:
 * - Literals use raw lexeme (no contextual widening)
 * - Integer casts only from IrCastExpression (not inferred from expectedType)
 * - Binary ops: int op int = int, double op anything = double (C# semantics)
 */

import { IrExpression, IrType } from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import { emitExpressionAst } from "../../expression-emitter.js";
import { resolveEffectiveExpressionType } from "../../core/semantic/narrowed-expression-types.js";
import {
  resolveTypeAlias,
  stripNullish,
  isDefinitelyValueType,
  splitRuntimeNullishUnionMembers,
} from "../../core/semantic/type-resolution.js";
import { willCarryAsRuntimeUnion } from "../../core/semantic/union-semantics.js";
import {
  isCharTyped,
  isCharType,
  isStringTyped,
  getSingleCharLiteral,
  isNullishLiteral,
  getDictionaryComputedAccess,
} from "./helpers.js";
import {
  charLiteral,
  decimalIntegerLiteral,
  identifierExpression,
  identifierType,
  nullLiteral,
  stringLiteral,
} from "../../core/format/backend-ast/builders.js";
import type { CSharpExpressionAst } from "../../core/format/backend-ast/types.js";
import { astTypeMatchesClrIdentity } from "../../core/format/backend-ast/utils.js";
import { stripNullableTypeAst } from "../../core/format/backend-ast/utils.js";
import {
  getTransparentComparisonTarget,
  resolveComparisonOperandType,
  isNumericOperandType,
  chooseComparisonExpectedType,
  buildNullishComparisonContext,
} from "./binary-helpers.js";
import {
  emitInstanceof,
  emitRuntimeUnionPropertyExistence,
  emitTypeofComparison,
} from "./binary-special-ops.js";
import { emitRuntimeUnionLiteralComparison } from "./binary-runtime-union-comparison.js";
import { isBroadObjectSlotType } from "../../core/semantic/broad-object-types.js";
import {
  BITWISE_OPERATORS,
  castBitwiseOperandToInt,
  castEnumOperandToDouble,
  emitJsNumberBitwiseOperation,
  isEnumLikeType,
} from "./bitwise-helpers.js";
import { emitTypeAst } from "../../type-emitter.js";
import { areIrTypesEquivalent } from "../../core/semantic/type-equivalence.js";
import { matchesExpectedEmissionType } from "../../core/semantic/expected-type-matching.js";

const emitInOperator = (
  expr: Extract<IrExpression, { kind: "binary" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  const plan = expr.inOperatorPlan;
  if (!plan) {
    throw new Error(
      "ICE: in-operator reached emitter without frontend materialization plan"
    );
  }

  if (plan.kind === "dictionaryKey") {
    const [rightAst, nextContext] = emitExpressionAst(
      expr.right,
      context,
      undefined
    );
    return [
      {
        kind: "invocationExpression",
        expression: {
          kind: "memberAccessExpression",
          expression: rightAst,
          memberName: "ContainsKey",
        },
        arguments: [stringLiteral(plan.key)],
      },
      nextContext,
    ];
  }

  if (plan.kind === "unionProperty") {
    const emitted = emitRuntimeUnionPropertyExistence(expr, context);
    if (emitted) {
      return emitted;
    }
    throw new Error(
      "ICE: union property-existence in-operator reached generic expression emission without a resolvable runtime-union carrier"
    );
  }

  throw new Error(`ICE: unknown in-operator plan ${JSON.stringify(plan)}`);
};

const isNullableValueComparisonTarget = (type: IrType | undefined): boolean => {
  if (!type) {
    return false;
  }

  const stripped = stripNullish(type);
  return stripped !== type && isDefinitelyValueType(stripped);
};

const stripNullableValueReadForNullishComparison = (
  ast: CSharpExpressionAst,
  targetType: IrType | undefined
): CSharpExpressionAst => {
  if (
    ast.kind === "memberAccessExpression" &&
    ast.memberName === "Value" &&
    isNullableValueComparisonTarget(targetType)
  ) {
    return ast.expression;
  }

  return ast;
};

const stripObjectBoxForNumericComparison = (
  ast: CSharpExpressionAst,
  ownType: IrType | undefined,
  otherType: IrType | undefined
): CSharpExpressionAst => {
  if (
    !isNumericOperandType(ownType ? stripNullish(ownType) : undefined) ||
    !isNumericOperandType(otherType ? stripNullish(otherType) : undefined)
  ) {
    return ast;
  }

  if (ast.kind === "parenthesizedExpression") {
    const stripped = stripObjectBoxForNumericComparison(
      ast.expression,
      ownType,
      otherType
    );
    return stripped === ast.expression ? ast : { ...ast, expression: stripped };
  }

  return ast.kind === "castExpression" &&
    astTypeMatchesClrIdentity(ast.type, ["System.Object"])
    ? ast.expression
    : ast;
};

const isBigIntType = (
  type: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!type) {
    return false;
  }

  const effective = resolveTypeAlias(stripNullish(type), context);
  return (
    (effective.kind === "primitiveType" && effective.name === "bigint") ||
    (effective.kind === "referenceType" &&
      astTypeMatchesClrIdentity(
        identifierType(effective.externalQualifiedName ?? effective.name),
        ["System.Numerics.BigInteger"]
      ))
  );
};

const buildInt32CreateCheckedCall = (
  value: CSharpExpressionAst
): CSharpExpressionAst => ({
  kind: "invocationExpression",
  expression: {
    kind: "memberAccessExpression",
    expression: identifierExpression("global::System.Int32"),
    memberName: "CreateChecked",
  },
  arguments: [value],
});

const buildExponentiationAst = (
  leftAst: CSharpExpressionAst,
  rightAst: CSharpExpressionAst,
  leftType: IrType | undefined,
  rightType: IrType | undefined,
  context: EmitterContext
): CSharpExpressionAst => {
  if (isBigIntType(leftType, context) && isBigIntType(rightType, context)) {
    return {
      kind: "invocationExpression",
      expression: {
        kind: "memberAccessExpression",
        expression: identifierExpression("global::System.Numerics.BigInteger"),
        memberName: "Pow",
      },
      arguments: [leftAst, buildInt32CreateCheckedCall(rightAst)],
    };
  }

  return {
    kind: "invocationExpression",
    expression: {
      kind: "memberAccessExpression",
      expression: identifierExpression("global::System.Math"),
      memberName: "Pow",
    },
    arguments: [leftAst, rightAst],
  };
};

const isRawIdentifierAst = (
  ast: CSharpExpressionAst,
  emittedIdentifier: string
): boolean => {
  switch (ast.kind) {
    case "identifierExpression":
      return ast.identifier === emittedIdentifier;
    case "parenthesizedExpression":
    case "suppressNullableWarningExpression":
      return isRawIdentifierAst(ast.expression, emittedIdentifier);
    default:
      return false;
  }
};

const nullableValueStorageMatchesNumericExpected = (
  nullableSourceType: IrType | undefined,
  actualType: IrType | undefined,
  expectedType: IrType,
  context: EmitterContext
): boolean => {
  const nullableSourceSplit = nullableSourceType
    ? splitRuntimeNullishUnionMembers(nullableSourceType)
    : undefined;
  const nonNullishSourceType =
    nullableSourceSplit?.nonNullishMembers.length === 1
      ? nullableSourceSplit.nonNullishMembers[0]
      : undefined;
  if (
    !nullableSourceSplit?.hasRuntimeNullish ||
    !nonNullishSourceType ||
    !isDefinitelyValueType(stripNullish(expectedType), context) ||
    !isNumericOperandType(stripNullish(expectedType))
  ) {
    return false;
  }

  const sourceMatchesExpected =
    areIrTypesEquivalent(
      resolveTypeAlias(stripNullish(nonNullishSourceType), context),
      resolveTypeAlias(stripNullish(expectedType), context),
      context
    ) || matchesExpectedEmissionType(nonNullishSourceType, expectedType, context);
  if (!sourceMatchesExpected) {
    return false;
  }

  return (
    !actualType ||
    areIrTypesEquivalent(
      resolveTypeAlias(stripNullish(actualType), context),
      resolveTypeAlias(stripNullish(expectedType), context),
      context
    ) ||
    matchesExpectedEmissionType(actualType, expectedType, context)
  );
};

const castNullableNumericOperandStorageAst = (
  operand: IrExpression,
  operandAst: CSharpExpressionAst,
  actualType: IrType | undefined,
  expectedType: IrType | undefined,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  if (!expectedType) {
    return [operandAst, context];
  }

  const target = getTransparentComparisonTarget(operand);
  if (target.kind !== "identifier") {
    return [operandAst, context];
  }

  const emittedIdentifier =
    context.localNameMap?.get(target.name) ?? target.name;
  if (!isRawIdentifierAst(operandAst, emittedIdentifier)) {
    return [operandAst, context];
  }

  const narrowed = context.narrowedBindings?.get(target.name);
  const narrowedSourceType =
    narrowed?.kind === "expr" ||
    narrowed?.kind === "runtimeSubset" ||
    narrowed?.kind === "rename"
      ? narrowed.sourceType
      : undefined;
  const narrowedStorageType =
    narrowed?.kind === "expr" ? narrowed.storageType : undefined;
  const nullableSourceType =
    narrowedSourceType ??
    narrowedStorageType ??
    context.localValueTypes?.get(target.name);

  if (
    !nullableValueStorageMatchesNumericExpected(
      nullableSourceType,
      actualType,
      expectedType,
      context
    )
  ) {
    return [operandAst, context];
  }

  const [expectedTypeAst, expectedTypeContext] = emitTypeAst(
    expectedType,
    context
  );
  return [
    {
      kind: "castExpression",
      type: stripNullableTypeAst(expectedTypeAst),
      expression: operandAst,
    },
    expectedTypeContext,
  ];
};

const isTypeParameterBackedType = (
  type: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!type) {
    return false;
  }

  const resolved = resolveTypeAlias(stripNullish(type), context);
  if (resolved.kind === "typeParameterType") {
    return true;
  }

  return (
    resolved.kind === "referenceType" &&
    (context.typeParameters?.has(resolved.name) ?? false) &&
    (!resolved.typeArguments || resolved.typeArguments.length === 0)
  );
};

const emitStrictEqualityCall = (
  op: string,
  leftAst: CSharpExpressionAst,
  rightAst: CSharpExpressionAst
): CSharpExpressionAst => {
  const equalsAst: CSharpExpressionAst = {
    kind: "invocationExpression",
    expression: {
      kind: "memberAccessExpression",
      expression: identifierExpression(
        "global::Tsonic.Internal.StrictEquality"
      ),
      memberName: "Equals",
    },
    arguments: [leftAst, rightAst],
  };

  return op === "=="
    ? equalsAst
    : {
        kind: "prefixUnaryExpression",
        operatorToken: "!",
        operand: equalsAst,
    };
};

const isBooleanIrType = (
  type: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!type) {
    return false;
  }
  const resolved = resolveTypeAlias(stripNullish(type), context);
  return (
    (resolved.kind === "primitiveType" && resolved.name === "boolean") ||
    (resolved.kind === "referenceType" &&
      astTypeMatchesClrIdentity(
        identifierType(resolved.externalQualifiedName ?? resolved.name),
        ["System.Boolean"]
      ))
  );
};

const isNullableBooleanIrType = (
  type: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!type) {
    return false;
  }
  const split = splitRuntimeNullishUnionMembers(type);
  const nonNullish =
    split?.nonNullishMembers.length === 1
      ? split.nonNullishMembers[0]
      : undefined;
  return (
    split?.hasRuntimeNullish === true && isBooleanIrType(nonNullish, context)
  );
};

const isBooleanLiteralComparisonOperand = (expr: IrExpression): boolean =>
  expr.kind === "literal" && typeof expr.value === "boolean";

const isEnumNumericComparisonOperand = (
  type: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!type) {
    return false;
  }
  const stripped = stripNullish(type);
  return isEnumLikeType(stripped, context) || isNumericOperandType(stripped);
};

const shouldEmitNativeEnumBitwise = (
  leftType: IrType | undefined,
  rightType: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!leftType || !rightType) {
    return false;
  }
  return (
    isEnumLikeType(leftType, context) &&
    isEnumLikeType(rightType, context) &&
    areIrTypesEquivalent(
      stripNullish(leftType),
      stripNullish(rightType),
      context
    )
  );
};

const resolveNativeEnumBitwiseType = (
  expr: IrExpression,
  resolvedType: IrType | undefined,
  context: EmitterContext
): IrType | undefined => {
  if (resolvedType && isEnumLikeType(resolvedType, context)) {
    return stripNullish(resolvedType);
  }
  if (expr.kind === "unary" && expr.operator === "~") {
    return resolveNativeEnumBitwiseType(
      expr.expression,
      expr.expression.inferredType,
      context
    );
  }
  if (expr.kind === "binary" && BITWISE_OPERATORS.has(expr.operator)) {
    const leftEnum = resolveNativeEnumBitwiseType(
      expr.left,
      expr.left.inferredType,
      context
    );
    const rightEnum = resolveNativeEnumBitwiseType(
      expr.right,
      expr.right.inferredType,
      context
    );
    return leftEnum &&
      rightEnum &&
      areIrTypesEquivalent(leftEnum, rightEnum, context)
      ? leftEnum
      : undefined;
  }
  return undefined;
};

const stripNullableBooleanComparisonCast = (
  ast: CSharpExpressionAst,
  operand: IrExpression,
  operandType: IrType | undefined,
  otherOperand: IrExpression,
  context: EmitterContext
): CSharpExpressionAst => {
  if (
    !isBooleanLiteralComparisonOperand(otherOperand) ||
    ast.kind !== "castExpression" ||
    !astTypeMatchesClrIdentity(ast.type, ["System.Boolean"])
  ) {
    return ast;
  }

  const transparentOperand = getTransparentComparisonTarget(operand);
  return isNullableBooleanIrType(
    operandType ?? transparentOperand.inferredType,
    context
  )
    ? ast.expression
    : ast;
};

/**
 * Emit a binary operator expression as CSharpExpressionAst
 *
 * NEW NUMERIC SPEC: No contextual type propagation for numeric literals.
 * Literals use their raw lexeme - C# will naturally handle int + int = int,
 * int + double = double, etc.
 *
 * Explicit casts come from IrCastExpression nodes (generated by type-checker
 * when user intent allows int -> double coercion).
 *
 * STRING INDEXER FIX: In C#, string[int] returns char, not string.
 * When comparing a string indexer result with a single-character string literal,
 * we emit the string as a char literal to avoid CS0019 (char == string).
 *
 * @param expr - The binary expression
 * @param context - Emitter context
 * @param _expectedType - Currently unused
 */
export const emitBinary = (
  expr: Extract<IrExpression, { kind: "binary" }>,
  context: EmitterContext,
  _expectedType?: IrType
): [CSharpExpressionAst, EmitterContext] => {
  // Map JavaScript operators to C# operators
  const operatorMap: Record<string, string> = {
    "===": "==",
    "!==": "!=",
    "==": "==", // Loose equality - needs special handling
    "!=": "!=", // Loose inequality - needs special handling
    instanceof: "is",
    in: "/* in */", // Needs special handling
  };

  const op = operatorMap[expr.operator] ?? expr.operator;

  if (expr.operator === "in") {
    return emitInOperator(expr, context);
  }

  const typeofComparison = emitTypeofComparison(expr, context);
  if (typeofComparison) {
    return typeofComparison;
  }

  // Handle instanceof operator specially
  if (expr.operator === "instanceof") {
    return emitInstanceof(expr, context);
  }

  const runtimeUnionLiteralComparison = emitRuntimeUnionLiteralComparison(
    expr,
    context
  );
  if (runtimeUnionLiteralComparison) {
    return runtimeUnionLiteralComparison;
  }

  // CHAR VS STRING COMPARISON FIX:
  // In C#, string[int] returns char, but in TypeScript it returns string.
  // When comparing a char-typed expression with a single-character string literal,
  // emit the string as a char literal to avoid CS0019 (char == string).
  const isComparisonOp =
    op === "==" ||
    op === "!=" ||
    op === "<" ||
    op === ">" ||
    op === "<=" ||
    op === ">=";

  if (isComparisonOp) {
    const charExpectedType: IrType = {
      kind: "primitiveType",
      name: "char",
    };
    const leftIsChar =
      isCharTyped(expr.left) ||
      isCharType(resolveComparisonOperandType(expr.left, context));
    const rightIsChar =
      isCharTyped(expr.right) ||
      isCharType(resolveComparisonOperandType(expr.right, context));
    const leftSingleChar = getSingleCharLiteral(expr.left);
    const rightSingleChar = getSingleCharLiteral(expr.right);

    // Case 1: left is char-typed, right is single-char literal -> emit right as char
    if (leftIsChar && rightSingleChar !== undefined) {
      const [leftAst, leftContext] = emitExpressionAst(
        expr.left,
        context,
        charExpectedType
      );
      const charLiteralAst = charLiteral(rightSingleChar);
      return [
        {
          kind: "binaryExpression",
          operatorToken: op,
          left: leftAst,
          right: charLiteralAst,
        },
        leftContext,
      ];
    }

    // Case 2: right is char-typed, left is single-char literal -> emit left as char
    if (rightIsChar && leftSingleChar !== undefined) {
      const [rightAst, rightContext] = emitExpressionAst(
        expr.right,
        context,
        charExpectedType
      );
      const charLiteralAst = charLiteral(leftSingleChar);
      return [
        {
          kind: "binaryExpression",
          operatorToken: op,
          left: charLiteralAst,
          right: rightAst,
        },
        rightContext,
      ];
    }
  }

  // C# does not support relational operators directly on strings.
  // TypeScript's lexicographic ordering maps to ordinal string comparison.
  if (
    isComparisonOp &&
    (op === "<" || op === ">" || op === "<=" || op === ">=") &&
    isStringTyped(expr.left) &&
    isStringTyped(expr.right)
  ) {
    const [leftAst, leftContext] = emitExpressionAst(expr.left, context);
    const [rightAst, rightContext] = emitExpressionAst(expr.right, leftContext);
    const compareAst: CSharpExpressionAst = {
      kind: "invocationExpression",
      expression: {
        ...identifierExpression("global::System.String.CompareOrdinal"),
      },
      arguments: [leftAst, rightAst],
    };
    return [
      {
        kind: "binaryExpression",
        operatorToken: op,
        left: compareAst,
        right: decimalIntegerLiteral(0),
      },
      rightContext,
    ];
  }

  // NULLISH COMPARISONS:
  //
  // Prefer `== null` / `!= null` for normal reference/nullable types so the result
  // is expression-tree friendly (EF Core query providers do not support pattern matching).
  //
  // For unconstrained generics (T), `== null` is not always valid, so we instead cast
  // to `object` to force reference-equality semantics and avoid operator overloads:
  //   ((object)x) == null
  //
  // TypeScript:  x === undefined  ->  C#: x == null
  // TypeScript:  x !== undefined  ->  C#: x != null
  // TypeScript:  x === null       ->  C#: x == null
  // TypeScript:  x !== null       ->  C#: x != null
  const leftIsNullish = isNullishLiteral(expr.left);
  const rightIsNullish = isNullishLiteral(expr.right);
  const isNullishComparison =
    isComparisonOp &&
    (op === "==" || op === "!=") &&
    (leftIsNullish || rightIsNullish);

  if (isNullishComparison) {
    // One side is null/undefined literal, emit the other side as a C# null check.
    // Suppress only direct nullable unwrapping for the comparison target
    // (e.g. `id.Value == null` should stay `id == null`) while preserving
    // unrelated narrowing such as renamed union members.
    const nonNullishExpr = leftIsNullish ? expr.right : expr.left;
    const nonNullishTarget = getTransparentComparisonTarget(nonNullishExpr);
    const nullishExpr = leftIsNullish ? expr.left : expr.right;

    const isUndefinedLiteral =
      (nullishExpr.kind === "literal" && nullishExpr.value === undefined) ||
      (nullishExpr.kind === "identifier" && nullishExpr.name === "undefined");

    const dictionaryPresenceLocal =
      isUndefinedLiteral && nonNullishTarget.kind === "identifier"
        ? context.dictionaryReadPresenceLocals?.get(nonNullishTarget.name)
        : undefined;
    if (dictionaryPresenceLocal) {
      const presenceAst = identifierExpression(dictionaryPresenceLocal);
      return [
        op === "=="
          ? {
              kind: "prefixUnaryExpression",
              operatorToken: "!",
              operand: presenceAst,
            }
          : presenceAst,
        context,
      ];
    }

    // JS dictionary-style access (`dict[key]`) with undefined comparison should
    // model key existence, not CLR value-type nullability.
    //
    //   dict[key] === undefined  -> !dict.ContainsKey(key)
    //   dict[key] !== undefined  ->  dict.ContainsKey(key)
    const dictionaryTarget = isUndefinedLiteral
      ? getDictionaryComputedAccess(nonNullishTarget, context)
      : undefined;
    if (dictionaryTarget) {
      const nonNullishContext = buildNullishComparisonContext(
        dictionaryTarget,
        context
      );
      const [dictAst, dictContext] = emitExpressionAst(
        dictionaryTarget.object,
        nonNullishContext
      );
      const [keyAst, keyContext] = emitExpressionAst(
        dictionaryTarget.property,
        dictContext
      );
      const containsAst: CSharpExpressionAst = {
        kind: "invocationExpression",
        expression: {
          kind: "memberAccessExpression",
          expression: {
            kind: "parenthesizedExpression",
            expression: dictAst,
          },
          memberName: "ContainsKey",
        },
        arguments: [keyAst],
      };
      const resultAst: CSharpExpressionAst =
        op === "=="
          ? {
              kind: "prefixUnaryExpression",
              operatorToken: "!",
              operand: containsAst,
            }
          : containsAst;
      return [resultAst, keyContext];
    }

    const nonNullishContext = buildNullishComparisonContext(
      nonNullishTarget,
      context
    );
    const [nonNullishAst, resultContext] = emitExpressionAst(
      nonNullishTarget,
      nonNullishContext
    );

    const inferred = resolveComparisonOperandType(
      nonNullishExpr,
      resultContext
    );
    const nullableComparisonAst = stripNullableValueReadForNullishComparison(
      nonNullishAst,
      inferred ?? nonNullishTarget.inferredType
    );
    const base = inferred ? stripNullish(inferred) : undefined;
    const sourceBase = nonNullishTarget.inferredType
      ? stripNullish(nonNullishTarget.inferredType)
      : undefined;
    const activeNarrowedBinding = (() => {
      const targetKey =
        nonNullishTarget.kind === "identifier"
          ? nonNullishTarget.name
          : undefined;
      return targetKey
        ? resultContext.narrowedBindings?.get(targetKey)
        : undefined;
    })();
    const narrowedSourceBase = activeNarrowedBinding?.sourceType
      ? stripNullish(activeNarrowedBinding.sourceType)
      : undefined;
    const emissionType =
      resolveEffectiveExpressionType(nonNullishTarget, nonNullishContext) ??
      nonNullishTarget.inferredType;
    const emissionBase = emissionType ? stripNullish(emissionType) : undefined;
    const runtimeUnionCarrierType =
      emissionBase !== undefined &&
      willCarryAsRuntimeUnion(emissionBase, resultContext)
        ? emissionBase
        : narrowedSourceBase !== undefined &&
            willCarryAsRuntimeUnion(narrowedSourceBase, resultContext)
          ? narrowedSourceBase
          : sourceBase !== undefined &&
              willCarryAsRuntimeUnion(sourceBase, resultContext)
            ? sourceBase
            : undefined;
    const runtimeCarrierAst =
      activeNarrowedBinding?.kind === "expr" &&
      activeNarrowedBinding.carrierExprAst !== undefined
        ? activeNarrowedBinding.carrierExprAst
        : nullableComparisonAst;
    const bareTypeParamName = (() => {
      if (!base) return undefined;
      if (base.kind === "typeParameterType") return base.name;
      if (
        base.kind === "referenceType" &&
        (resultContext.typeParameters?.has(base.name) ?? false) &&
        (!base.typeArguments || base.typeArguments.length === 0)
      ) {
        return base.name;
      }
      return undefined;
    })();

    const isDefiniteNonUnionValueType =
      inferred !== undefined &&
      inferred.kind !== "unionType" &&
      isDefinitelyValueType(inferred);

    const typeParamConstraint =
      bareTypeParamName !== undefined
        ? (resultContext.typeParamConstraints?.get(bareTypeParamName) ??
          "unconstrained")
        : undefined;

    const needsObjectCastForTypeParam =
      bareTypeParamName !== undefined &&
      (typeParamConstraint === "unconstrained" ||
        typeParamConstraint === "struct");
    const needsObjectCastForValueType = isDefiniteNonUnionValueType;
    const needsObjectCastForRuntimeUnion =
      runtimeUnionCarrierType !== undefined;

    const nullLiteralAst = nullLiteral();
    const nullOp = op === "==" ? "==" : "!=";

    if (
      needsObjectCastForTypeParam ||
      needsObjectCastForValueType ||
      needsObjectCastForRuntimeUnion
    ) {
      // ((global::System.Object)(expr)) == null
      const castExpr: CSharpExpressionAst = {
        kind: "castExpression",
        type: identifierType("global::System.Object"),
        expression: {
          kind: "parenthesizedExpression",
          expression: needsObjectCastForRuntimeUnion
            ? runtimeCarrierAst
            : nullableComparisonAst,
        },
      };
      return [
        {
          kind: "binaryExpression",
          operatorToken: nullOp,
          left: {
            kind: "parenthesizedExpression",
            expression: castExpr,
          },
          right: nullLiteralAst,
        },
        resultContext,
      ];
    }

    return [
      {
        kind: "binaryExpression",
        operatorToken: nullOp,
        left: nullableComparisonAst,
        right: nullLiteralAst,
      },
      resultContext,
    ];
  }

  const leftResolvedType = resolveComparisonOperandType(expr.left, context);
  const rightResolvedType = resolveComparisonOperandType(expr.right, context);
  const leftComparisonTarget = getTransparentComparisonTarget(expr.left);
  const rightComparisonTarget = getTransparentComparisonTarget(expr.right);
  const leftSemanticType =
    resolveEffectiveExpressionType(leftComparisonTarget, context) ??
    leftComparisonTarget.inferredType;
  const rightSemanticType =
    resolveEffectiveExpressionType(rightComparisonTarget, context) ??
    rightComparisonTarget.inferredType;
  const leftResolved = leftResolvedType
    ? resolveTypeAlias(stripNullish(leftResolvedType), context)
    : undefined;
  const rightResolved = rightResolvedType
    ? resolveTypeAlias(stripNullish(rightResolvedType), context)
    : undefined;
  if (
    (op === "==" || op === "!=") &&
    (isTypeParameterBackedType(leftResolvedType, context) ||
      isTypeParameterBackedType(rightResolvedType, context))
  ) {
    const [leftAst, leftContext] = emitExpressionAst(expr.left, context);
    const [rightAst, rightContext] = emitExpressionAst(expr.right, leftContext);
    return [emitStrictEqualityCall(op, leftAst, rightAst), rightContext];
  }

  const needsRuntimeEquality =
    (op === "==" || op === "!=") &&
    (leftResolved?.kind === "unknownType" ||
      rightResolved?.kind === "unknownType" ||
      isBroadObjectSlotType(leftResolvedType, context) ||
      isBroadObjectSlotType(rightResolvedType, context) ||
      isBroadObjectSlotType(leftSemanticType, context) ||
      isBroadObjectSlotType(rightSemanticType, context));

  if (needsRuntimeEquality) {
    const [leftAst, leftContext] = emitExpressionAst(expr.left, context);
    const [rightAst, rightContext] = emitExpressionAst(expr.right, leftContext);
    const equalsAst: CSharpExpressionAst = {
      kind: "invocationExpression",
      expression: {
        kind: "memberAccessExpression",
        expression: {
          ...identifierExpression("global::System.Object"),
        },
        memberName: "Equals",
      },
      arguments: [leftAst, rightAst],
    };
    if (op === "==") {
      return [equalsAst, rightContext];
    }
    return [
      {
        kind: "prefixUnaryExpression",
        operatorToken: "!",
        operand: equalsAst,
      },
      rightContext,
    ];
  }

  if (BITWISE_OPERATORS.has(op)) {
    const [leftAst, leftContext] = emitExpressionAst(expr.left, context);
    const [rightAst, rightContext] = emitExpressionAst(expr.right, leftContext);
    const jsNumberBitwiseAst = emitJsNumberBitwiseOperation(
      op,
      leftAst,
      rightAst,
      leftResolvedType,
      rightResolvedType,
      rightContext
    );

    if (jsNumberBitwiseAst) {
      return [jsNumberBitwiseAst, rightContext];
    }

    const leftNativeEnumType = resolveNativeEnumBitwiseType(
      expr.left,
      leftResolvedType,
      rightContext
    );
    const rightNativeEnumType = resolveNativeEnumBitwiseType(
      expr.right,
      rightResolvedType,
      rightContext
    );
    if (
      leftNativeEnumType &&
      rightNativeEnumType &&
      shouldEmitNativeEnumBitwise(
        leftNativeEnumType,
        rightNativeEnumType,
        rightContext
      )
    ) {
      return [
        {
          kind: "binaryExpression",
          operatorToken: op,
          left: leftAst,
          right: rightAst,
        },
        rightContext,
      ];
    }

    return [
      {
        kind: "binaryExpression",
        operatorToken: op,
        left: castBitwiseOperandToInt(leftAst, leftResolvedType, context),
        right: castBitwiseOperandToInt(
          rightAst,
          rightResolvedType,
          rightContext
        ),
      },
      rightContext,
    ];
  }

  const isArithmeticOp =
    op === "+" || op === "-" || op === "*" || op === "/" || op === "%";
  const shouldContextuallyTypeComparisonOperand = (
    operand: IrExpression
  ): boolean => getTransparentComparisonTarget(operand).kind === "literal";
  const resolveArithmeticOperandExpectedType = (
    operand: IrExpression,
    operandType: IrType | undefined,
    counterpartType: IrType | undefined
  ): IrType | undefined => {
    if (
      operand.kind === "numericNarrowing" &&
      isNumericOperandType(stripNullish(operand.inferredType)) &&
      isNumericOperandType(
        counterpartType ? stripNullish(counterpartType) : undefined
      )
    ) {
      return operand.inferredType;
    }

    if (
      operand.kind === "typeAssertion" &&
      isNumericOperandType(stripNullish(operand.targetType)) &&
      isNumericOperandType(
        counterpartType ? stripNullish(counterpartType) : undefined
      )
    ) {
      return operand.targetType;
    }

    const strippedOperandType = operandType
      ? stripNullish(operandType)
      : undefined;
    return strippedOperandType &&
      isNumericOperandType(strippedOperandType) &&
      isNumericOperandType(
        counterpartType ? stripNullish(counterpartType) : undefined
      )
      ? strippedOperandType
      : undefined;
  };
  // Standard emission path
  // Emit operands without contextual type propagation
  // Literals will emit using their raw lexeme (42 vs 42.0)
  // Parenthesization is handled by the printer's precedence system
  const leftExpectedType = isComparisonOp
    ? shouldContextuallyTypeComparisonOperand(expr.left)
      ? chooseComparisonExpectedType(
          leftResolvedType,
          rightResolvedType,
          context
        )
      : undefined
    : isArithmeticOp &&
        expr.left.kind === "conditional" &&
        isNumericOperandType(rightResolvedType)
      ? rightResolvedType
      : isArithmeticOp
        ? resolveArithmeticOperandExpectedType(
            expr.left,
            leftResolvedType,
            rightResolvedType
          )
        : undefined;
  const [leftAst, leftContext] = emitExpressionAst(
    expr.left,
    context,
    leftExpectedType
  );
  const rightExpectedType = isComparisonOp
    ? shouldContextuallyTypeComparisonOperand(expr.right)
      ? chooseComparisonExpectedType(
          rightResolvedType,
          leftResolvedType,
          context
        )
      : undefined
    : isArithmeticOp &&
        expr.right.kind === "conditional" &&
        isNumericOperandType(leftResolvedType)
      ? leftResolvedType
      : isArithmeticOp
        ? resolveArithmeticOperandExpectedType(
            expr.right,
            rightResolvedType,
            leftResolvedType
          )
        : undefined;
  const [rightAst, rightContext] = emitExpressionAst(
    expr.right,
    leftContext,
    rightExpectedType
  );

  if (op === "**") {
    return [
      buildExponentiationAst(
        leftAst,
        rightAst,
        leftResolvedType,
        rightResolvedType,
        rightContext
      ),
      rightContext,
    ];
  }

  const comparisonLeftAst = isComparisonOp
    ? castEnumOperandToDouble(
        stripNullableBooleanComparisonCast(
          stripObjectBoxForNumericComparison(
            leftAst,
            leftResolvedType,
            rightResolvedType
          ),
          expr.left,
          leftResolvedType,
          expr.right,
          rightContext
        ),
        isEnumNumericComparisonOperand(leftResolvedType, rightContext) &&
          isEnumNumericComparisonOperand(rightResolvedType, rightContext)
          ? leftResolvedType
          : undefined,
        rightContext
      )
    : leftAst;
  const comparisonRightAst = isComparisonOp
    ? castEnumOperandToDouble(
        stripNullableBooleanComparisonCast(
          stripObjectBoxForNumericComparison(
            rightAst,
            rightResolvedType,
            leftResolvedType
          ),
          expr.right,
          rightResolvedType,
          expr.left,
          rightContext
        ),
        isEnumNumericComparisonOperand(leftResolvedType, rightContext) &&
          isEnumNumericComparisonOperand(rightResolvedType, rightContext)
          ? rightResolvedType
          : undefined,
        rightContext
      )
    : rightAst;
  const [arithmeticLeftAst, arithmeticLeftContext] = isArithmeticOp
    ? castNullableNumericOperandStorageAst(
        expr.left,
        comparisonLeftAst,
        leftResolvedType,
        leftExpectedType,
        rightContext
      )
    : [comparisonLeftAst, rightContext];
  const [arithmeticRightAst, arithmeticRightContext] = isArithmeticOp
    ? castNullableNumericOperandStorageAst(
        expr.right,
        comparisonRightAst,
        rightResolvedType,
        rightExpectedType,
        arithmeticLeftContext
      )
    : [comparisonRightAst, arithmeticLeftContext];

  return [
    {
      kind: "binaryExpression",
      operatorToken: op,
      left: arithmeticLeftAst,
      right: arithmeticRightAst,
    },
    arithmeticRightContext,
  ];
};
