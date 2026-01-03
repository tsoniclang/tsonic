/**
 * Expression converter - TypeScript AST to IR expressions
 * Main dispatcher - delegates to specialized modules
 */

import * as ts from "typescript";
import {
  IrExpression,
  IrNumericNarrowingExpression,
  IrType,
  NumericKind,
  TSONIC_TO_NUMERIC_KIND,
} from "./types.js";
import type { ProgramContext } from "./program-context.js";

// Import expression converters from specialized modules
import { convertLiteral } from "./converters/expressions/literals.js";
import {
  convertArrayLiteral,
  convertObjectLiteral,
} from "./converters/expressions/collections.js";
import { convertMemberExpression } from "./converters/expressions/access.js";
import {
  convertCallExpression,
  convertNewExpression,
} from "./converters/expressions/calls.js";
import {
  convertBinaryExpression,
  convertUnaryExpression,
  convertUpdateExpression,
} from "./converters/expressions/operators.js";
import {
  convertFunctionExpression,
  convertArrowFunction,
} from "./converters/expressions/functions.js";
import {
  convertConditionalExpression,
  convertTemplateLiteral,
} from "./converters/expressions/other.js";
import {
  deriveIdentifierType,
  getSourceSpan,
} from "./converters/expressions/helpers.js";

/**
 * Extract the NumericKind from a type node if it references a known numeric alias.
 *
 * Examples:
 * - `int` → "Int32"
 * - `byte` → "Byte"
 * - `long` → "Int64"
 * - `string` → undefined (not numeric)
 */
const getNumericKindFromTypeNode = (
  typeNode: ts.TypeNode
): NumericKind | undefined => {
  // Handle type reference nodes (e.g., `int`, `byte`, `Int32`)
  if (ts.isTypeReferenceNode(typeNode)) {
    const typeName = typeNode.typeName;
    if (ts.isIdentifier(typeName)) {
      const name = typeName.text;
      // Look up the type alias name in our mapping
      const kind = TSONIC_TO_NUMERIC_KIND.get(name);
      if (kind !== undefined) {
        return kind;
      }
    }
  }

  return undefined;
};

const inferThisType = (node: ts.Node): IrType | undefined => {
  let current: ts.Node | undefined = node;

  while (current) {
    if (ts.isClassDeclaration(current) || ts.isClassExpression(current)) {
      const className = current.name?.text;
      if (!className) return undefined;

      const typeArguments =
        current.typeParameters?.map(
          (tp): IrType => ({ kind: "typeParameterType", name: tp.name.text })
        ) ?? [];

      return {
        kind: "referenceType",
        name: className,
        ...(typeArguments.length > 0 ? { typeArguments } : {}),
      };
    }

    current = current.parent;
  }

  return undefined;
};

const stripNullish = (type: IrType | undefined): IrType | undefined => {
  if (!type) return undefined;
  if (type.kind !== "unionType") return type;
  const nonNullish = type.types.filter(
    (t) =>
      !(
        t.kind === "primitiveType" &&
        (t.name === "null" || t.name === "undefined")
      )
  );
  if (nonNullish.length === 0) return undefined;
  if (nonNullish.length === 1) return nonNullish[0];
  return { kind: "unionType", types: nonNullish };
};

/**
 * Main expression conversion dispatcher
 * Converts TypeScript expression nodes to IR expressions
 *
 * @param node - The TypeScript expression node to convert
 * @param ctx - The ProgramContext for symbol resolution and type system access
 * @param expectedType - Expected type from context (e.g., LHS annotation, parameter type).
 *                       Pass `undefined` explicitly when no contextual type exists.
 *                       Used for deterministic typing of literals and arrays.
 */
export const convertExpression = (
  node: ts.Expression,
  ctx: ProgramContext,
  expectedType: IrType | undefined
): IrExpression => {
  // DETERMINISTIC TYPING: No top-level getInferredType() call.
  // Each expression type derives its inferredType from the appropriate source.

  if (ts.isStringLiteral(node) || ts.isNumericLiteral(node)) {
    return convertLiteral(node, ctx);
  }
  if (
    node.kind === ts.SyntaxKind.TrueKeyword ||
    node.kind === ts.SyntaxKind.FalseKeyword
  ) {
    // Boolean literals have deterministic type
    return {
      kind: "literal",
      value: node.kind === ts.SyntaxKind.TrueKeyword,
      raw: node.getText(),
      inferredType: { kind: "primitiveType", name: "boolean" },
      sourceSpan: getSourceSpan(node),
    };
  }
  if (node.kind === ts.SyntaxKind.NullKeyword) {
    // Null literal - type is context-dependent, undefined for now
    return {
      kind: "literal",
      value: null,
      raw: "null",
      inferredType: undefined,
      sourceSpan: getSourceSpan(node),
    };
  }
  if (
    node.kind === ts.SyntaxKind.UndefinedKeyword ||
    ts.isVoidExpression(node)
  ) {
    // Undefined literal - type is void
    return {
      kind: "literal",
      value: undefined,
      raw: "undefined",
      inferredType: { kind: "voidType" },
      sourceSpan: getSourceSpan(node),
    };
  }
  if (ts.isIdentifier(node)) {
    // DETERMINISTIC: Derive type from declaration TypeNode
    const identifierType =
      deriveIdentifierType(node, ctx) ?? ctx.lambdaTypeEnv?.get(node.text);

    // Check if this identifier is an aliased import (e.g., import { String as ClrString })
    // ALICE'S SPEC: Use TypeSystem.getFQNameOfDecl() to get the original name
    let originalName: string | undefined;
    const declId = ctx.binding.resolveIdentifier(node);
    if (declId) {
      const fqName = ctx.typeSystem.getFQNameOfDecl(declId);
      // If the fqName differs from the identifier text, it's an aliased import
      if (fqName && fqName !== node.text) {
        originalName = fqName;
      }
    }

    // Check if this identifier is bound to a CLR type (e.g., console, Math, etc.)
    const clrBinding = ctx.bindings.getBinding(node.text);
    if (clrBinding && clrBinding.kind === "global") {
      return {
        kind: "identifier",
        name: node.text,
        inferredType: identifierType,
        sourceSpan: getSourceSpan(node),
        resolvedClrType: clrBinding.type,
        resolvedAssembly: clrBinding.assembly,
        csharpName: clrBinding.csharpName, // Optional C# name from binding
        originalName,
        declId,
      };
    }
    return {
      kind: "identifier",
      name: node.text,
      inferredType: identifierType,
      sourceSpan: getSourceSpan(node),
      originalName,
      declId,
    };
  }
  if (ts.isArrayLiteralExpression(node)) {
    return convertArrayLiteral(node, ctx, expectedType);
  }
  if (ts.isObjectLiteralExpression(node)) {
    return convertObjectLiteral(node, ctx, expectedType);
  }
  if (
    ts.isPropertyAccessExpression(node) ||
    ts.isElementAccessExpression(node)
  ) {
    return convertMemberExpression(node, ctx);
  }
  if (ts.isCallExpression(node)) {
    return convertCallExpression(node, ctx);
  }
  if (ts.isNewExpression(node)) {
    return convertNewExpression(node, ctx);
  }
  if (ts.isBinaryExpression(node)) {
    return convertBinaryExpression(node, ctx, expectedType);
  }
  if (ts.isPrefixUnaryExpression(node)) {
    return convertUnaryExpression(node, ctx);
  }
  if (ts.isPostfixUnaryExpression(node)) {
    return convertUpdateExpression(node, ctx);
  }
  if (ts.isTypeOfExpression(node)) {
    // typeof always returns string
    return {
      kind: "unary",
      operator: "typeof",
      expression: convertExpression(node.expression, ctx, undefined),
      inferredType: { kind: "primitiveType", name: "string" },
      sourceSpan: getSourceSpan(node),
    };
  }
  if (ts.isVoidExpression(node)) {
    // void always returns undefined (void type)
    return {
      kind: "unary",
      operator: "void",
      expression: convertExpression(node.expression, ctx, undefined),
      inferredType: { kind: "voidType" },
      sourceSpan: getSourceSpan(node),
    };
  }
  if (ts.isDeleteExpression(node)) {
    // delete always returns boolean
    return {
      kind: "unary",
      operator: "delete",
      expression: convertExpression(node.expression, ctx, undefined),
      inferredType: { kind: "primitiveType", name: "boolean" },
      sourceSpan: getSourceSpan(node),
    };
  }
  if (ts.isConditionalExpression(node)) {
    return convertConditionalExpression(node, ctx, expectedType);
  }
  if (ts.isFunctionExpression(node)) {
    // DETERMINISTIC: Pass expectedType for parameter type inference
    return convertFunctionExpression(node, ctx, expectedType);
  }
  if (ts.isArrowFunction(node)) {
    // DETERMINISTIC: Pass expectedType for parameter type inference
    return convertArrowFunction(node, ctx, expectedType);
  }
  if (
    ts.isTemplateExpression(node) ||
    ts.isNoSubstitutionTemplateLiteral(node)
  ) {
    return convertTemplateLiteral(node, ctx);
  }
  if (ts.isSpreadElement(node)) {
    // Spread inherits type from expression (the array being spread)
    const spreadExpr = convertExpression(node.expression, ctx, undefined);
    return {
      kind: "spread",
      expression: spreadExpr,
      inferredType: spreadExpr.inferredType,
      sourceSpan: getSourceSpan(node),
    };
  }
  if (node.kind === ts.SyntaxKind.ThisKeyword) {
    // Deterministic `this` typing: derive from the enclosing class declaration.
    return {
      kind: "this",
      inferredType: inferThisType(node),
      sourceSpan: getSourceSpan(node),
    };
  }
  if (ts.isAwaitExpression(node)) {
    // await unwraps Promise - for now pass through the expression's type
    // (full unwrapping would require detecting Promise<T> and returning T)
    const awaitedExpr = convertExpression(node.expression, ctx, undefined);
    return {
      kind: "await",
      expression: awaitedExpr,
      inferredType: undefined, // Would need Promise unwrapping
      sourceSpan: getSourceSpan(node),
    };
  }
  if (ts.isYieldExpression(node)) {
    // yield type depends on generator context - undefined for now
    return {
      kind: "yield",
      expression: node.expression
        ? convertExpression(node.expression, ctx, undefined)
        : undefined,
      delegate: !!node.asteriskToken,
      inferredType: undefined,
      sourceSpan: getSourceSpan(node),
    };
  }
  if (ts.isParenthesizedExpression(node)) {
    return convertExpression(node.expression, ctx, expectedType);
  }
  if (ts.isNonNullExpression(node)) {
    // `expr!` has no runtime semantics but DOES narrow the type (T | null → T).
    // Preserve the inner expression, but strip null/undefined from its inferredType.
    const inner = convertExpression(node.expression, ctx, expectedType);
    const narrowed = stripNullish(inner.inferredType);
    return narrowed ? { ...inner, inferredType: narrowed } : inner;
  }
  if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
    // Get the asserted type
    // PHASE 4 (Alice's spec): Use captureTypeSyntax + typeFromSyntax
    const assertedTypeNode = node.type;
    const assertedType = ctx.typeSystem.typeFromSyntax(
      ctx.binding.captureTypeSyntax(assertedTypeNode)
    );

    // Check if this is a numeric narrowing (e.g., `as int`, `as byte`)
    const numericKind = getNumericKindFromTypeNode(assertedTypeNode);
    if (numericKind !== undefined) {
      // Convert the inner expression with no expected type so we preserve its natural classification.
      const innerExpr = convertExpression(node.expression, ctx, undefined);

      // Determine the inferredType based on the targetKind
      // INVARIANT: "Int32" → primitiveType(name="int")
      // Other numeric kinds remain as referenceType (handled by assertedType)
      const inferredType =
        numericKind === "Int32"
          ? { kind: "primitiveType" as const, name: "int" as const }
          : assertedType;

      // Create a numeric narrowing expression that preserves the inner expression
      const narrowingExpr: IrNumericNarrowingExpression = {
        kind: "numericNarrowing",
        expression: innerExpr,
        targetKind: numericKind,
        inferredType,
        sourceSpan: getSourceSpan(node),
      };
      return narrowingExpr;
    }

    // Check if this is `as number` or `as double` - explicit widening intent
    // This creates a numericNarrowing with targetKind: "Double" to distinguish
    // from a plain literal (which also has inferredType: number but no assertion)
    if (
      assertedType.kind === "primitiveType" &&
      assertedType.name === "number"
    ) {
      // Convert the inner expression with no expected type so we preserve its natural classification.
      const innerExpr = convertExpression(node.expression, ctx, undefined);

      // Check if the inner expression is numeric (literal or already classified)
      const isNumericInner =
        (innerExpr.kind === "literal" && typeof innerExpr.value === "number") ||
        innerExpr.kind === "numericNarrowing";

      if (isNumericInner) {
        const narrowingExpr: IrNumericNarrowingExpression = {
          kind: "numericNarrowing",
          expression: innerExpr,
          targetKind: "Double",
          inferredType: assertedType,
          sourceSpan: getSourceSpan(node),
        };
        return narrowingExpr;
      }
    }

    // Check if this is a type erasure (unknown/any) - NOT a runtime cast
    // `x as unknown` or `x as any` just tells TS to forget the type
    if (
      assertedType.kind === "unknownType" ||
      assertedType.kind === "anyType"
    ) {
      // Preserve contextual typing from the outer position.
      return convertExpression(node.expression, ctx, expectedType);
    }

    // Check if this is a parameter modifier type (out<T>, ref<T>, in<T>)
    // These are not real type casts - they're parameter passing annotations
    const isParameterModifierType =
      assertedType.kind === "referenceType" &&
      (assertedType.name === "out" ||
        assertedType.name === "ref" ||
        assertedType.name === "in" ||
        assertedType.name === "inref");

    if (isParameterModifierType) {
      // Preserve contextual typing from the outer position.
      // The parameter modifier itself is handled in call lowering / argument emission.
      return convertExpression(node.expression, ctx, expectedType);
    }

    // Convert the inner expression contextually, using the asserted type as the target.
    // This prevents `({ ... } as T)` from becoming an anonymous object cast to T (invalid in C#).
    const innerExpr = convertExpression(node.expression, ctx, assertedType);

    // Non-numeric assertion - create type assertion node for C# cast
    return {
      kind: "typeAssertion",
      expression: innerExpr,
      targetType: assertedType,
      inferredType: assertedType,
      sourceSpan: getSourceSpan(node),
    };
  }

  // Fallback - treat as identifier with unknown type
  return {
    kind: "identifier",
    name: node.getText(),
    inferredType: undefined,
    sourceSpan: getSourceSpan(node),
  };
};

// Re-export commonly used functions for backward compatibility
export {
  deriveIdentifierType,
  extractTypeArguments,
  checkIfRequiresSpecialization,
} from "./converters/expressions/helpers.js";
