/**
 * Numeric Coercion Pass - Widening/Narrowing Validation
 *
 * This pass validates numeric conversions between different numeric kinds.
 *
 * RULE: Implicit WIDENING is allowed, implicit NARROWING is rejected.
 *
 * Widening (allowed implicitly):
 * - Int32 → Double (int → number)
 * - Int32 → Int64 (int → long)
 * - Single → Double (float → number)
 * - etc. (see isWideningConversion in numeric-kind.ts)
 *
 * Narrowing (requires explicit cast):
 * - Double → Int32 (number → int) requires `as int`
 * - Int64 → Int32 (long → int) requires `as int`
 * - etc.
 *
 * Examples that now PASS:
 * - `const x: number = 42` ✓ (Int32 → Double is widening)
 * - `foo(42)` where foo expects `number` ✓
 * - `return 42` where function returns `number` ✓
 * - `[1, 2, 3]` in `number[]` context ✓
 *
 * Examples that still FAIL (narrowing):
 * - `const x: int = 1.5` ✗ (Double → Int32 is narrowing)
 * - Must use: `const x: int = 1.5 as int` ✓
 *
 * This pass runs AFTER the IR is built, BEFORE emission.
 * It is a HARD GATE - any errors prevent emission.
 */

import {
  Diagnostic,
  createDiagnostic,
  SourceLocation,
} from "../../types/diagnostic.js";
import {
  IrModule,
  IrStatement,
  IrExpression,
  IrType,
  IrInterfaceMember,
  getBinaryResultKind,
} from "../types.js";
import {
  NumericKind,
  isWideningConversion,
  TSONIC_TO_NUMERIC_KIND,
  literalFitsInKind,
} from "../types/numeric-kind.js";

/**
 * Maximum absolute value for a 32-bit float (Single).
 * Used for validating literal narrowing to float.
 */
const MAX_FLOAT_ABS = 3.4028235e38;

/**
 * Result of numeric expression classification.
 * - "Int32": Expression definitely produces an Int32 value
 * - "Double": Expression definitely produces a Double value
 * - "Unknown": Cannot determine at compile time (e.g., untyped identifier, complex call)
 */
export type NumericExprKind = "Int32" | "Double" | "Unknown";

/**
 * Arithmetic operators that produce numeric results.
 * Used to classify binary expression results.
 */
const ARITHMETIC_OPERATORS = new Set(["+", "-", "*", "/", "%"]);

/**
 * Classify an expression's numeric kind.
 *
 * This function propagates numeric kind through:
 * - Literals (via numericIntent)
 * - Identifiers with primitiveType(name="int") or primitiveType(name="number")
 * - Arithmetic operations (uses C# promotion rules)
 * - Unary +/- (preserves operand kind)
 * - Ternary (requires both branches to have same kind)
 * - Parentheses (pass through)
 * - numericNarrowing expressions (uses targetKind)
 *
 * Returns "Unknown" for expressions that cannot be classified.
 */
export const classifyNumericExpr = (expr: IrExpression): NumericExprKind => {
  switch (expr.kind) {
    case "literal": {
      // Check numericIntent on literal expressions
      if (typeof expr.value === "number" && expr.numericIntent) {
        return expr.numericIntent === "Int32" ? "Int32" : "Double";
      }
      // Non-numeric literals
      return "Unknown";
    }

    case "identifier": {
      // Check inferredType on identifiers
      if (expr.inferredType?.kind === "primitiveType") {
        if (expr.inferredType.name === "int") return "Int32";
        if (expr.inferredType.name === "number") return "Double";
      }
      // Also check for CLR numeric reference types
      if (expr.inferredType?.kind === "referenceType") {
        const name = expr.inferredType.name;
        if (name === "Int32" || name === "int") return "Int32";
        if (name === "Double" || name === "double") return "Double";
      }
      return "Unknown";
    }

    case "unary": {
      // Unary +/- preserves operand kind
      if (expr.operator === "+" || expr.operator === "-") {
        return classifyNumericExpr(expr.expression);
      }
      // Bitwise NOT (~) produces Int32
      if (expr.operator === "~") {
        return "Int32";
      }
      return "Unknown";
    }

    case "binary": {
      // Only classify arithmetic operators
      if (!ARITHMETIC_OPERATORS.has(expr.operator)) {
        return "Unknown";
      }
      const leftKind = classifyNumericExpr(expr.left);
      const rightKind = classifyNumericExpr(expr.right);

      // If either is Unknown, we can't classify
      if (leftKind === "Unknown" || rightKind === "Unknown") {
        return "Unknown";
      }

      // Use C# binary promotion rules
      // Note: getBinaryResultKind returns NumericKind, we map to our simplified type
      const resultKind = getBinaryResultKind(
        leftKind === "Int32" ? "Int32" : "Double",
        rightKind === "Int32" ? "Int32" : "Double"
      );

      // Map back to our simplified kind
      if (resultKind === "Double" || resultKind === "Single") return "Double";
      return "Int32"; // All integer promotions end up as at least Int32
    }

    case "conditional": {
      // Ternary: both branches must have same kind
      const trueKind = classifyNumericExpr(expr.whenTrue);
      const falseKind = classifyNumericExpr(expr.whenFalse);

      if (trueKind === falseKind) return trueKind;
      // Mismatched branches - use promotion
      if (trueKind === "Double" || falseKind === "Double") return "Double";
      return "Unknown";
    }

    case "numericNarrowing": {
      // numericNarrowing has explicit targetKind
      if (expr.targetKind === "Int32") return "Int32";
      if (expr.targetKind === "Double") return "Double";
      // Other numeric kinds (Byte, Int64, etc.) - treat as Unknown for this pass
      return "Unknown";
    }

    case "call": {
      // Check return type
      if (expr.inferredType?.kind === "primitiveType") {
        if (expr.inferredType.name === "int") return "Int32";
        if (expr.inferredType.name === "number") return "Double";
      }
      return "Unknown";
    }

    case "memberAccess": {
      // Check inferredType for member access results
      if (expr.inferredType?.kind === "primitiveType") {
        if (expr.inferredType.name === "int") return "Int32";
        if (expr.inferredType.name === "number") return "Double";
      }
      return "Unknown";
    }

    case "update": {
      // ++/-- on int produces int
      const operandKind = classifyNumericExpr(expr.expression);
      return operandKind;
    }

    default:
      return "Unknown";
  }
};

/**
 * Check if an expression has explicit double intent.
 * This is true when:
 * - It's a numericNarrowing with targetKind "Double" (i.e., `42 as number`)
 * - It's a literal with numericIntent "Double" (i.e., `42.0`)
 *
 * Used to exempt explicit casts from TSN5110 errors.
 */
export const hasExplicitDoubleIntent = (expr: IrExpression): boolean => {
  // Case 1: numericNarrowing targeting Double (e.g., `42 as number`, `42 as double`)
  if (expr.kind === "numericNarrowing" && expr.targetKind === "Double") {
    return true;
  }

  // Case 2: Literal with double lexeme (e.g., `42.0`)
  if (
    expr.kind === "literal" &&
    typeof expr.value === "number" &&
    expr.numericIntent === "Double"
  ) {
    return true;
  }

  return false;
};

/**
 * Result of numeric coercion validation
 */
export type NumericCoercionResult = {
  readonly ok: boolean;
  readonly module: IrModule;
  readonly diagnostics: readonly Diagnostic[];
};

/**
 * Context for tracking coercion validation
 */
type CoercionContext = {
  readonly filePath: string;
  readonly diagnostics: Diagnostic[];
};

/**
 * Create a source location for a module
 */
const moduleLocation = (ctx: CoercionContext): SourceLocation => ({
  file: ctx.filePath,
  line: 1,
  column: 1,
  length: 1,
});

/**
 * Get the expected numeric kind from a type.
 * Returns undefined if the type is not a numeric type.
 *
 * Maps:
 * - primitiveType("number") → "Double"
 * - primitiveType("int") → "Int32"
 * - referenceType with name in TSONIC_TO_NUMERIC_KIND → corresponding kind
 */
const getExpectedNumericKind = (
  type: IrType | undefined
): NumericKind | undefined => {
  if (!type) return undefined;

  // Strip nullish wrapper if present (T | null | undefined → T)
  const baseType =
    type.kind === "unionType"
      ? type.types.find(
          (t) =>
            !(
              t.kind === "primitiveType" &&
              (t.name === "null" || t.name === "undefined")
            )
        )
      : type;

  if (!baseType) return undefined;

  // primitiveType mapping
  if (baseType.kind === "primitiveType") {
    if (baseType.name === "number") return "Double";
    if (baseType.name === "int") return "Int32";
    // Check if it's a known numeric type alias
    const kind = TSONIC_TO_NUMERIC_KIND.get(baseType.name);
    if (kind) return kind;
  }

  // referenceType mapping (CLR types like Int32, Double, etc.)
  if (baseType.kind === "referenceType") {
    const name = baseType.name;
    // Direct CLR type names
    if (name === "Int32" || name === "int") return "Int32";
    if (name === "Double" || name === "double") return "Double";
    if (name === "Int64" || name === "long") return "Int64";
    if (name === "Single" || name === "float") return "Single";
    // Check the mapping table
    const kind = TSONIC_TO_NUMERIC_KIND.get(name.toLowerCase());
    if (kind) return kind;
  }

  return undefined;
};

/**
 * Extract the expected type of a property from a structural type.
 *
 * Used for validating object literal properties against their expected types.
 * Returns undefined if the property type cannot be determined (conservative).
 *
 * Handles:
 * - objectType: inline object types like `{ x: number }`
 * - referenceType with structuralMembers: interfaces and type aliases
 */
const tryGetObjectPropertyType = (
  expectedType: IrType | undefined,
  propName: string
): IrType | undefined => {
  if (!expectedType) return undefined;

  // Structural object type: objectType has members directly
  if (expectedType.kind === "objectType") {
    const member = expectedType.members.find(
      (m): m is IrInterfaceMember & { kind: "propertySignature" } =>
        m.kind === "propertySignature" && m.name === propName
    );
    return member?.type;
  }

  // Reference type with structural members (interfaces, type aliases)
  if (expectedType.kind === "referenceType" && expectedType.structuralMembers) {
    const member = expectedType.structuralMembers.find(
      (m): m is IrInterfaceMember & { kind: "propertySignature" } =>
        m.kind === "propertySignature" && m.name === propName
    );
    return member?.type;
  }

  return undefined;
};

/**
 * Extract the expected type of a tuple element at a given index.
 *
 * Used for validating tuple literal elements against their expected types.
 * Returns undefined if the element type cannot be determined.
 */
const tryGetTupleElementType = (
  expectedType: IrType | undefined,
  index: number
): IrType | undefined => {
  if (!expectedType) return undefined;

  if (expectedType.kind === "tupleType") {
    return expectedType.elementTypes[index];
  }

  return undefined;
};

/**
 * Check if an expression needs coercion to match an expected numeric type.
 *
 * Returns true (error) only for NARROWING conversions.
 * Widening conversions (e.g., Int32 → Double) are implicitly allowed.
 *
 * Rules:
 * - Same kind → OK
 * - Widening (isWideningConversion returns true) → OK
 * - Narrowing → requires explicit intent (numericNarrowing node)
 */
const needsCoercion = (
  expr: IrExpression,
  expectedType: IrType | undefined
): boolean => {
  // Get numeric kinds
  const expectedKind = getExpectedNumericKind(expectedType);
  const actualKind = classifyNumericExpr(expr);

  // If either is not a numeric type, no coercion check needed
  if (expectedKind === undefined || actualKind === "Unknown") {
    return false;
  }

  // Map actualKind to NumericKind (classifyNumericExpr returns "Int32" | "Double" | "Unknown")
  const actualNumericKind: NumericKind =
    actualKind === "Int32" ? "Int32" : "Double";

  // Same kind → OK
  if (actualNumericKind === expectedKind) {
    return false;
  }

  // Widening conversion → OK (e.g., Int32 → Double)
  if (isWideningConversion(actualNumericKind, expectedKind)) {
    return false;
  }

  // Narrowing conversion → check for explicit intent
  // numericNarrowing expressions represent explicit user intent (e.g., `x as int`)
  if (expr.kind === "numericNarrowing") {
    return false;
  }

  // Allow constant-literal narrowing when the literal fits the target type.
  // This mirrors C#'s constant expression conversion rules and is ONLY allowed for literals.
  if (expr.kind === "literal" && typeof expr.value === "number") {
    const v = expr.value;

    // Integer target kinds: require safe integer, integral value, and in-range.
    if (
      expectedKind === "SByte" ||
      expectedKind === "Byte" ||
      expectedKind === "Int16" ||
      expectedKind === "UInt16" ||
      expectedKind === "UInt32" ||
      expectedKind === "UInt64" ||
      expectedKind === "Int64"
    ) {
      if (
        Number.isSafeInteger(v) &&
        Number.isInteger(v) &&
        literalFitsInKind(v, expectedKind)
      ) {
        return false;
      }
    }

    // Float target kind: allow finite values in float range.
    if (expectedKind === "Single") {
      if (Number.isFinite(v) && Math.abs(v) <= MAX_FLOAT_ABS) {
        return false;
      }
    }
  }

  // Narrowing without explicit intent → error
  return true;
};

/**
 * Get a human-readable description of an expression for error messages.
 */
const describeExpression = (expr: IrExpression): string => {
  switch (expr.kind) {
    case "literal":
      return `literal '${expr.raw ?? String(expr.value)}'`;
    case "identifier":
      return `identifier '${expr.name}'`;
    case "binary":
      return `arithmetic expression`;
    case "unary":
      return `unary expression`;
    case "conditional":
      return `ternary expression`;
    case "call":
      return `call result`;
    case "memberAccess":
      return typeof expr.property === "string"
        ? `property '${expr.property}'`
        : `computed property`;
    default:
      return `expression`;
  }
};

/**
 * Emit an error diagnostic for implicit narrowing conversion.
 * Only called when a narrowing conversion is attempted without explicit intent.
 */
const emitCoercionError = (
  expr: IrExpression,
  expectedType: IrType | undefined,
  ctx: CoercionContext,
  context: string
): void => {
  const location = expr.sourceSpan ?? moduleLocation(ctx);
  const description = describeExpression(expr);
  const actualKind = classifyNumericExpr(expr);
  const expectedKind = getExpectedNumericKind(expectedType);

  // Build descriptive type names
  const actualName = actualKind === "Int32" ? "int" : "double";
  const expectedName =
    expectedKind === "Double"
      ? "number"
      : expectedKind === "Int32"
        ? "int"
        : String(expectedKind).toLowerCase();

  ctx.diagnostics.push(
    createDiagnostic(
      "TSN5110",
      "error",
      `Implicit narrowing not allowed: ${description} (${actualName}) cannot be converted to '${expectedName}' ${context}`,
      location,
      `Add an explicit cast ('as ${expectedName}') to indicate intent.`
    )
  );
};

/**
 * Validate an expression in a context where a specific type is expected.
 * This is the core of the strict coercion check.
 */
const validateExpression = (
  expr: IrExpression,
  expectedType: IrType | undefined,
  ctx: CoercionContext,
  context: string
): void => {
  // Check for narrowing conversion (widening is allowed)
  if (needsCoercion(expr, expectedType)) {
    emitCoercionError(expr, expectedType, ctx, context);
    return;
  }

  // Recursively check sub-expressions based on kind
  switch (expr.kind) {
    case "array": {
      // For tuple types, validate each element against its specific expected type
      if (expectedType?.kind === "tupleType") {
        expr.elements.forEach((el, i) => {
          if (el && el.kind !== "spread") {
            const tupleElementType = tryGetTupleElementType(expectedType, i);
            validateExpression(
              el,
              tupleElementType,
              ctx,
              `in tuple element ${i}`
            );
          }
        });
      } else {
        // For array types, check each element against the element type
        const elementType =
          expectedType?.kind === "arrayType"
            ? expectedType.elementType
            : undefined;
        expr.elements.forEach((el, i) => {
          if (el && el.kind !== "spread") {
            validateExpression(el, elementType, ctx, `in array element ${i}`);
          }
        });
      }
      break;
    }

    case "object": {
      // For object literals, check each property against expected property type
      // Uses contextual expectedType only - no guessing
      expr.properties.forEach((prop) => {
        if (prop.kind === "spread") {
          // For spreads, scan for nested call expressions
          scanExpressionForCalls(prop.expression, ctx);
        } else {
          // Only handle string keys (not computed expressions)
          if (typeof prop.key === "string") {
            // Get expected type for this property from contextual type
            const expectedPropType = tryGetObjectPropertyType(
              expectedType,
              prop.key
            );
            if (expectedPropType) {
              validateExpression(
                prop.value,
                expectedPropType,
                ctx,
                `in property '${prop.key}'`
              );
            } else {
              // Can't determine property type - scan for nested calls
              scanExpressionForCalls(prop.value, ctx);
            }
          } else {
            // Computed property key - can't resolve type, scan for calls
            scanExpressionForCalls(prop.value, ctx);
          }
        }
      });
      break;
    }

    case "conditional": {
      // Check both branches
      validateExpression(expr.whenTrue, expectedType, ctx, context);
      validateExpression(expr.whenFalse, expectedType, ctx, context);
      break;
    }

    case "logical": {
      // For ?? and ||, the result could be either operand
      if (expr.operator === "??" || expr.operator === "||") {
        validateExpression(expr.left, expectedType, ctx, context);
        validateExpression(expr.right, expectedType, ctx, context);
      }
      break;
    }

    case "call": {
      // Check each argument against expected parameter type
      if (expr.parameterTypes) {
        expr.arguments.forEach((arg, i) => {
          if (arg.kind !== "spread" && expr.parameterTypes?.[i]) {
            validateExpression(
              arg,
              expr.parameterTypes[i],
              ctx,
              `in argument ${i + 1}`
            );
          }
        });
      }
      break;
    }

    // Other expression kinds don't need recursive checking for this pass
  }
};

/**
 * Scan an expression tree for call expressions and validate their arguments.
 * This is used for expressions without an explicit type context.
 */
const scanExpressionForCalls = (
  expr: IrExpression,
  ctx: CoercionContext
): void => {
  switch (expr.kind) {
    case "call": {
      // Validate call arguments against parameter types
      if (expr.parameterTypes) {
        expr.arguments.forEach((arg, i) => {
          if (arg.kind !== "spread" && expr.parameterTypes?.[i]) {
            validateExpression(
              arg,
              expr.parameterTypes[i],
              ctx,
              `in argument ${i + 1}`
            );
          }
        });
      }
      // Also scan the callee for nested calls
      scanExpressionForCalls(expr.callee, ctx);
      // Scan arguments for nested calls
      expr.arguments.forEach((arg) => {
        if (arg.kind !== "spread") {
          scanExpressionForCalls(arg, ctx);
        }
      });
      break;
    }

    case "array": {
      expr.elements.forEach((el) => {
        if (el && el.kind !== "spread") {
          scanExpressionForCalls(el, ctx);
        }
      });
      break;
    }

    case "object": {
      expr.properties.forEach((prop) => {
        if (prop.kind !== "spread") {
          scanExpressionForCalls(prop.value, ctx);
        }
      });
      break;
    }

    case "binary":
      scanExpressionForCalls(expr.left, ctx);
      scanExpressionForCalls(expr.right, ctx);
      break;

    case "unary":
      scanExpressionForCalls(expr.expression, ctx);
      break;

    case "update":
      scanExpressionForCalls(expr.expression, ctx);
      break;

    case "conditional":
      scanExpressionForCalls(expr.condition, ctx);
      scanExpressionForCalls(expr.whenTrue, ctx);
      scanExpressionForCalls(expr.whenFalse, ctx);
      break;

    case "logical":
      scanExpressionForCalls(expr.left, ctx);
      scanExpressionForCalls(expr.right, ctx);
      break;

    case "memberAccess":
      scanExpressionForCalls(expr.object, ctx);
      // For computed access, property is an expression
      if (expr.isComputed && typeof expr.property !== "string") {
        scanExpressionForCalls(expr.property, ctx);
      }
      break;

    case "arrowFunction":
      // Arrow function body can be expression or block
      if ("kind" in expr.body && expr.body.kind !== "blockStatement") {
        scanExpressionForCalls(expr.body as IrExpression, ctx);
      }
      break;

    case "new":
      expr.arguments.forEach((arg) => {
        if (arg.kind !== "spread") {
          scanExpressionForCalls(arg, ctx);
        }
      });
      break;

    case "await":
      scanExpressionForCalls(expr.expression, ctx);
      break;

    case "assignment":
      scanExpressionForCalls(expr.right, ctx);
      break;

    case "numericNarrowing":
      scanExpressionForCalls(expr.expression, ctx);
      break;

    case "yield":
      if (expr.expression) {
        scanExpressionForCalls(expr.expression, ctx);
      }
      break;

    // Leaf expressions: literal, identifier, this - no nested calls
    default:
      break;
  }
};

/**
 * Process a statement, checking for int→double coercion at intent sites.
 */
const processStatement = (stmt: IrStatement, ctx: CoercionContext): void => {
  switch (stmt.kind) {
    case "variableDeclaration": {
      for (const decl of stmt.declarations) {
        if (decl.initializer) {
          // Check if there's an explicit type annotation
          if (decl.type) {
            validateExpression(
              decl.initializer,
              decl.type,
              ctx,
              "in variable initialization"
            );
          } else {
            // Even without explicit type, scan for call expressions
            // to check their arguments
            scanExpressionForCalls(decl.initializer, ctx);
          }
        }
      }
      break;
    }

    case "returnStatement": {
      // We'd need function context to know expected return type
      // For now, skip - this requires threading function return type through
      break;
    }

    case "expressionStatement": {
      // Check call expressions for parameter coercion
      if (stmt.expression.kind === "call") {
        const call = stmt.expression;
        // Check each argument against expected parameter type
        if (call.parameterTypes) {
          call.arguments.forEach((arg, i) => {
            if (arg.kind !== "spread" && call.parameterTypes?.[i]) {
              validateExpression(
                arg,
                call.parameterTypes[i],
                ctx,
                `in argument ${i + 1}`
              );
            }
          });
        }
      }
      break;
    }

    case "functionDeclaration": {
      // Check default parameters for int→double coercion
      for (const param of stmt.parameters) {
        if (param.initializer && param.type) {
          validateExpression(
            param.initializer,
            param.type,
            ctx,
            "in default parameter"
          );
        }
      }
      // Process function body with return type context
      processStatementWithReturnType(stmt.body, stmt.returnType, ctx);
      break;
    }

    case "classDeclaration": {
      for (const member of stmt.members) {
        if (member.kind === "methodDeclaration") {
          // Check default parameters for int→double coercion
          for (const param of member.parameters) {
            if (param.initializer && param.type) {
              validateExpression(
                param.initializer,
                param.type,
                ctx,
                "in default parameter"
              );
            }
          }
          if (member.body) {
            processStatementWithReturnType(member.body, member.returnType, ctx);
          }
        }
        if (member.kind === "propertyDeclaration" && member.initializer) {
          validateExpression(
            member.initializer,
            member.type,
            ctx,
            "in property initialization"
          );
        }
      }
      break;
    }

    case "blockStatement": {
      for (const s of stmt.statements) {
        processStatement(s, ctx);
      }
      break;
    }

    case "ifStatement": {
      processStatement(stmt.thenStatement, ctx);
      if (stmt.elseStatement) {
        processStatement(stmt.elseStatement, ctx);
      }
      break;
    }

    case "whileStatement":
    case "forStatement":
    case "forOfStatement": {
      processStatement(stmt.body, ctx);
      break;
    }

    case "tryStatement": {
      processStatement(stmt.tryBlock, ctx);
      if (stmt.catchClause) {
        processStatement(stmt.catchClause.body, ctx);
      }
      if (stmt.finallyBlock) {
        processStatement(stmt.finallyBlock, ctx);
      }
      break;
    }

    case "switchStatement": {
      for (const caseClause of stmt.cases) {
        for (const s of caseClause.statements) {
          processStatement(s, ctx);
        }
      }
      break;
    }
  }
};

/**
 * Process a statement with return type context for checking return statements
 */
const processStatementWithReturnType = (
  stmt: IrStatement,
  returnType: IrType | undefined,
  ctx: CoercionContext
): void => {
  switch (stmt.kind) {
    case "returnStatement": {
      if (stmt.expression && returnType) {
        validateExpression(
          stmt.expression,
          returnType,
          ctx,
          "in return statement"
        );
      }
      break;
    }

    case "blockStatement": {
      for (const s of stmt.statements) {
        processStatementWithReturnType(s, returnType, ctx);
      }
      break;
    }

    case "ifStatement": {
      processStatementWithReturnType(stmt.thenStatement, returnType, ctx);
      if (stmt.elseStatement) {
        processStatementWithReturnType(stmt.elseStatement, returnType, ctx);
      }
      break;
    }

    case "tryStatement": {
      processStatementWithReturnType(stmt.tryBlock, returnType, ctx);
      if (stmt.catchClause) {
        processStatementWithReturnType(stmt.catchClause.body, returnType, ctx);
      }
      if (stmt.finallyBlock) {
        processStatementWithReturnType(stmt.finallyBlock, returnType, ctx);
      }
      break;
    }

    case "switchStatement": {
      for (const caseClause of stmt.cases) {
        for (const s of caseClause.statements) {
          processStatementWithReturnType(s, returnType, ctx);
        }
      }
      break;
    }

    default:
      // For other statements, use regular processing
      processStatement(stmt, ctx);
  }
};

/**
 * Run numeric coercion pass on a module.
 */
const processModule = (module: IrModule): NumericCoercionResult => {
  const ctx: CoercionContext = {
    filePath: module.filePath,
    diagnostics: [],
  };

  // Process module body
  for (const stmt of module.body) {
    processStatement(stmt, ctx);
  }

  // Process exports
  for (const exp of module.exports) {
    if (exp.kind === "declaration") {
      processStatement(exp.declaration, ctx);
    }
  }

  return {
    ok: ctx.diagnostics.length === 0,
    module,
    diagnostics: ctx.diagnostics,
  };
};

/**
 * Run numeric coercion validation on all modules.
 *
 * HARD GATE: If any diagnostics are returned, the emitter MUST NOT run.
 */
export const runNumericCoercionPass = (
  modules: readonly IrModule[]
): {
  readonly ok: boolean;
  readonly modules: readonly IrModule[];
  readonly diagnostics: readonly Diagnostic[];
} => {
  const allDiagnostics: Diagnostic[] = [];

  for (const module of modules) {
    const result = processModule(module);
    allDiagnostics.push(...result.diagnostics);
  }

  return {
    ok: allDiagnostics.length === 0,
    modules, // Pass through unchanged - this pass only validates, doesn't transform
    diagnostics: allDiagnostics,
  };
};
