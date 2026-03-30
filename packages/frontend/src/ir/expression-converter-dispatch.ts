/**
 * Expression converter — Main dispatcher
 *
 * Converts TypeScript expression nodes to IR expressions by delegating
 * to specialized converter modules.
 */

import * as ts from "typescript";
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import type {
  IrExpression,
  IrNumericNarrowingExpression,
  IrType,
} from "./types.js";
import type { ProgramContext } from "./program-context.js";
import type { TypeBinding } from "../program/binding-types.js";

// Import expression converters from specialized modules
import {
  convertLiteral,
  convertRegularExpressionLiteral,
} from "./converters/expressions/literals.js";
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
  convertImportMetaObject,
  isImportMetaMetaProperty,
} from "./converters/expressions/import-meta.js";
import { getSourceSpan } from "./converters/expressions/helpers.js";
import { shouldWrapExpressionWithAssertion } from "./converters/assertion-wrapping.js";
import {
  getNumericKindFromTypeNode,
  inferThisType,
  getIdentifierStorageType,
  shouldPreserveExplicitStorageType,
  stripNullish,
} from "./expression-converter-helpers.js";
import { resolveAmbientGlobalSourceOwner } from "./converters/expressions/ambient-global-source-owner.js";
import type { DeclId } from "./type-system/types.js";

const isImportLikeDeclaration = (decl: ts.Declaration): boolean =>
  ts.isImportClause(decl) ||
  ts.isImportSpecifier(decl) ||
  ts.isNamespaceImport(decl) ||
  ts.isImportEqualsDeclaration(decl);

const isDeclarationModuleGlobal = (decl: ts.Declaration): boolean => {
  for (
    let current: ts.Node | undefined = decl.parent;
    current;
    current = current.parent
  ) {
    if (
      ts.isModuleDeclaration(current) &&
      ts.isIdentifier(current.name) &&
      current.name.text === "global"
    ) {
      return true;
    }
  }

  return false;
};

const isAmbientGlobalDeclaration = (decl: ts.Declaration): boolean => {
  const sourceFile = decl.getSourceFile();
  if (isDeclarationModuleGlobal(decl)) {
    return true;
  }
  return (
    (sourceFile.isDeclarationFile && !ts.isExternalModule(sourceFile)) ||
    (ts.getCombinedModifierFlags(decl) & ts.ModifierFlags.Ambient) !== 0
  );
};

const isMemberAccessReceiverExpression = (node: ts.Expression): boolean => {
  let current: ts.Node = node;

  while (ts.isParenthesizedExpression(current.parent)) {
    current = current.parent;
  }

  const parent = current.parent;
  return (
    (ts.isPropertyAccessExpression(parent) ||
      ts.isElementAccessExpression(parent)) &&
    parent.expression === current
  );
};

const resolveReferencedIdentifierSymbol = (
  checker: ts.TypeChecker,
  node: ts.Identifier
): ts.Symbol | undefined => {
  const symbol = checker.getSymbolAtLocation(node);
  if (!symbol) {
    return undefined;
  }

  if (symbol.flags & ts.SymbolFlags.Alias) {
    return checker.getAliasedSymbol(symbol);
  }

  return symbol;
};

const findNearestBindingsJson = (filePath: string): string | undefined => {
  let dir = dirname(filePath);
  for (let i = 0; i < 12; i += 1) {
    const candidate = join(dir, "bindings.json");
    if (existsSync(candidate)) {
      return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      return undefined;
    }
    dir = parent;
  }
  return undefined;
};

const findOwningBindingsJson = (filePath: string): string | undefined => {
  const nearest = findNearestBindingsJson(filePath);
  if (nearest) {
    return nearest;
  }

  const namespaceKey = (() => {
    if (filePath.endsWith(".d.ts")) {
      return basename(filePath).slice(0, -".d.ts".length);
    }
    if (filePath.endsWith(".ts")) {
      return basename(filePath).slice(0, -".ts".length);
    }
    if (filePath.endsWith(".js")) {
      return basename(filePath).slice(0, -".js".length);
    }
    return undefined;
  })();
  if (!namespaceKey) {
    return undefined;
  }

  const sibling = join(dirname(filePath), namespaceKey, "bindings.json");
  return existsSync(sibling) ? sibling : undefined;
};

const readNamespaceFromBindingsJson = (
  bindingsPath: string
): string | undefined => {
  try {
    const raw = readFileSync(bindingsPath, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    return parsed &&
      typeof parsed === "object" &&
      typeof (parsed as { readonly namespace?: unknown }).namespace === "string"
      ? (parsed as { readonly namespace: string }).namespace
      : undefined;
  } catch {
    return undefined;
  }
};

const resolveImportedIdentifierClrType = (
  declId: DeclId,
  declarations: readonly ts.Declaration[],
  ctx: ProgramContext
): string | undefined => {
  const importSpecifier = declarations.find(ts.isImportSpecifier);
  if (!importSpecifier) {
    return undefined;
  }

  const exportName =
    importSpecifier.propertyName?.text ?? importSpecifier.name.text;
  const declPath = ctx.binding.getSourceFilePathOfDecl(declId);
  if (!declPath) {
    return undefined;
  }

  const bindingsPath = findOwningBindingsJson(declPath);
  if (!bindingsPath) {
    return undefined;
  }

  const namespace = readNamespaceFromBindingsJson(bindingsPath);
  if (!namespace) {
    return undefined;
  }

  const namespaceBinding = ctx.bindings.getNamespace(namespace);
  if (!namespaceBinding) {
    return undefined;
  }

  const matchesExportName = (type: TypeBinding): boolean => {
    if (type.alias === exportName) {
      return true;
    }

    const arityAlias = type.alias.match(/^(.+)_(\d+)$/);
    if (arityAlias?.[1] === exportName) {
      return true;
    }

    const simpleClrName = type.name.split(".").pop() ?? type.name;
    return simpleClrName.replace(/`\d+$/, "") === exportName;
  };

  return namespaceBinding.types.find(matchesExportName)?.name;
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
  if (ts.isRegularExpressionLiteral(node)) {
    return convertRegularExpressionLiteral(node, ctx);
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
    // Null literal is deterministically null. Context may later adapt it, but
    // the literal itself must not erase nullish information here.
    return {
      kind: "literal",
      value: null,
      raw: "null",
      inferredType: { kind: "primitiveType", name: "null" },
      sourceSpan: getSourceSpan(node),
    };
  }
  if (node.kind === ts.SyntaxKind.UndefinedKeyword) {
    // Undefined literal - type is void
    return {
      kind: "literal",
      value: undefined,
      raw: "undefined",
      inferredType: { kind: "voidType" },
      sourceSpan: getSourceSpan(node),
    };
  }
  if (ts.isVoidExpression(node)) {
    // `void expr` evaluates `expr` and yields `undefined` (void type).
    // Do NOT drop the operand: `void foo()` must still call foo().
    return {
      kind: "unary",
      operator: "void",
      expression: convertExpression(node.expression, ctx, undefined),
      inferredType: { kind: "voidType" },
      sourceSpan: getSourceSpan(node),
    };
  }
  if (ts.isIdentifier(node)) {
    if (node.text === "undefined") {
      return {
        kind: "identifier",
        name: node.text,
        inferredType: { kind: "primitiveType", name: "undefined" },
        sourceSpan: getSourceSpan(node),
      };
    }

    const declId = ctx.binding.resolveIdentifier(node);
    const referencedSymbol = resolveReferencedIdentifierSymbol(
      ctx.checker,
      node
    );
    const contextualGenericFunctionType = (() => {
      if (
        !expectedType ||
        !referencedSymbol ||
        !ctx.genericFunctionValueSymbols.has(referencedSymbol)
      ) {
        return undefined;
      }

      const expectedCallableType =
        expectedType.kind === "functionType"
          ? expectedType
          : ctx.typeSystem.delegateToFunctionType(expectedType);

      if (
        !expectedCallableType ||
        ctx.typeSystem.containsTypeParameter(expectedCallableType)
      ) {
        return undefined;
      }

      return expectedCallableType;
    })();

    // DETERMINISTIC: Prefer lexical flow type (narrowing / lambda params), then decl type.
    const fromEnv = declId ? ctx.typeEnv?.get(declId.id) : undefined;
    const fromDecl = declId
      ? ctx.typeSystem.typeOfValueRead(declId)
      : undefined;

    const identifierStorageType = getIdentifierStorageType(
      ctx,
      declId,
      fromDecl,
      fromEnv
    );
    const effectiveIdentifierType =
      contextualGenericFunctionType ?? identifierStorageType;

    // Check if this identifier is an aliased import (e.g., import { String as ClrString })
    // ALICE'S SPEC: Use TypeSystem.getFQNameOfDecl() to get the original name
    let originalName: string | undefined;
    if (declId) {
      const fqName = ctx.typeSystem.getFQNameOfDecl(declId);
      // If the fqName differs from the identifier text, it's an aliased import
      if (fqName && fqName !== node.text) {
        originalName = fqName;
      }
    }

    const symbolDeclarations =
      ctx.checker.getSymbolAtLocation(node)?.getDeclarations() ?? [];
    const hasImportLikeDeclaration = symbolDeclarations.some(
      isImportLikeDeclaration
    );
    const isAmbientGlobal =
      symbolDeclarations.length > 0 &&
      !hasImportLikeDeclaration &&
      symbolDeclarations.every(isAmbientGlobalDeclaration);
    const importResolvedClrType =
      declId && hasImportLikeDeclaration
        ? resolveImportedIdentifierClrType(declId, symbolDeclarations, ctx)
        : undefined;
    const suppressSyntheticFlowAssertion =
      isMemberAccessReceiverExpression(node);
    const preserveExplicitStorageType = shouldPreserveExplicitStorageType(
      ctx,
      declId,
      fromDecl,
      fromEnv
    );

    // Check if this identifier is bound to a CLR type (e.g., console, Math, etc.)
    const clrBinding = ctx.bindings.getExactBindingByKind(node.text, "global");
    if (
      clrBinding &&
      clrBinding.kind === "global" &&
      (!declId || isAmbientGlobal)
    ) {
      const baseIdentifier: IrExpression = {
        kind: "identifier",
        name: node.text,
        inferredType: effectiveIdentifierType,
        sourceSpan: getSourceSpan(node),
        resolvedClrType: clrBinding.type,
        resolvedAssembly: clrBinding.assembly,
        csharpName: clrBinding.csharpName, // Optional C# name from binding
        originalName,
        declId,
      };
      if (
        !suppressSyntheticFlowAssertion &&
        !preserveExplicitStorageType &&
        shouldWrapExpressionWithAssertion(ctx, fromDecl, fromEnv) &&
        fromEnv
      ) {
        return {
          kind: "typeAssertion",
          expression: baseIdentifier,
          targetType: fromEnv,
          inferredType: fromEnv,
          sourceSpan: getSourceSpan(node),
        };
      }
      return baseIdentifier;
    }
    const ambientSourceOwner =
      !clrBinding && isAmbientGlobal
        ? resolveAmbientGlobalSourceOwner(symbolDeclarations, ctx)
        : undefined;
    const baseIdentifier: IrExpression = {
      kind: "identifier",
      name: node.text,
      inferredType: effectiveIdentifierType,
      sourceSpan: getSourceSpan(node),
      resolvedClrType: importResolvedClrType ?? ambientSourceOwner,
      originalName,
      declId,
    };
    if (
      !suppressSyntheticFlowAssertion &&
      !preserveExplicitStorageType &&
      shouldWrapExpressionWithAssertion(ctx, fromDecl, fromEnv) &&
      fromEnv
    ) {
      return {
        kind: "typeAssertion",
        expression: baseIdentifier,
        targetType: fromEnv,
        inferredType: fromEnv,
        sourceSpan: getSourceSpan(node),
      };
    }
    return baseIdentifier;
  }
  if (isImportMetaMetaProperty(node)) {
    return convertImportMetaObject(node, ctx);
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
    return convertCallExpression(node, ctx, expectedType);
  }
  if (ts.isNewExpression(node)) {
    return convertNewExpression(node, ctx, expectedType);
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
    // Deterministic `this` typing:
    // 1. object-literal synthetic receiver (when converting method/accessor bodies)
    // 2. enclosing class declaration
    return {
      kind: "this",
      inferredType: ctx.objectLiteralThisType ?? inferThisType(node),
      sourceSpan: getSourceSpan(node),
    };
  }
  if (ts.isAwaitExpression(node)) {
    const awaitedExpr = convertExpression(node.expression, ctx, undefined);
    const awaitedType = awaitedExpr.inferredType
      ? ctx.typeSystem.expandUtility("Awaited", [awaitedExpr.inferredType])
      : undefined;
    return {
      kind: "await",
      expression: awaitedExpr,
      inferredType: awaitedType,
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

      const sourceNeedsRuntimeCast =
        innerExpr.inferredType === undefined ||
        innerExpr.inferredType.kind === "unknownType" ||
        innerExpr.inferredType.kind === "anyType";

      // If the source type is unknown/any (or unresolved), we cannot prove a
      // compile-time numeric narrowing. Preserve explicit user intent as a
      // runtime cast (`(int)x`) via a regular typeAssertion.
      if (sourceNeedsRuntimeCast) {
        return {
          kind: "typeAssertion",
          expression: innerExpr,
          targetType: assertedType,
          inferredType: assertedType,
          sourceSpan: getSourceSpan(node),
        };
      }

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
