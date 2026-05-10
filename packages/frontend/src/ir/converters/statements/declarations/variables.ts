/**
 * Variable declaration converter
 */

import * as ts from "typescript";
import {
  IrVariableDeclaration,
  IrVariableDeclarator,
  IrStatement,
} from "../../../types.js";
import { convertExpression } from "../../../expression-converter.js";
import { convertBindingName } from "../../../syntax/binding-patterns.js";
import { hasExportModifier } from "../helpers.js";
import type { ProgramContext } from "../../../program-context.js";
import {
  collectWrittenSymbols,
  collectSupportedGenericFunctionValueSymbols,
} from "../../../../generic-function-values.js";
import {
  deriveTypeFromExpression,
  withVariableDeclaratorTypeEnv,
} from "../../type-env.js";
import {
  convertGenericFunctionValueAliasDeclaration,
  convertGenericFunctionValueDeclaration,
  isSupportedGenericFunctionAliasDeclaration,
  isSupportedGenericFunctionValueDeclaration,
} from "./variables-generic-function-values.js";

/**
 * Derive the type from a converted IR expression using deterministic rules.
 * NO TYPESCRIPT FALLBACK - types must be derivable from IR or undefined.
 *
 * DETERMINISTIC TYPING RULES:
 * - Literals → use inferredType (already set deterministically in literals.ts)
 * - Arrays → derive from element inferredType
 * - Call/New expressions → use inferredType (has numeric recovery)
 * - Identifiers → use inferredType
 * - Other → use inferredType if available, otherwise undefined
 */
/**
 * Check if a variable statement is at module level (not inside a function).
 * Module-level variables become static fields in C# and need explicit types.
 */
const isModuleLevelVariable = (node: ts.VariableStatement): boolean => {
  // Walk up the parent chain to check if we're inside a function/method
  let current: ts.Node = node;
  while (current.parent) {
    current = current.parent;
    // If we hit a function-like node, we're not at module level
    if (
      ts.isFunctionDeclaration(current) ||
      ts.isFunctionExpression(current) ||
      ts.isArrowFunction(current) ||
      ts.isMethodDeclaration(current) ||
      ts.isConstructorDeclaration(current) ||
      ts.isGetAccessorDeclaration(current) ||
      ts.isSetAccessorDeclaration(current)
    ) {
      return false;
    }
    // If we hit the source file, we're at module level
    if (ts.isSourceFile(current)) {
      return true;
    }
  }
  return false;
};

/**
 * Check if a variable declaration has a binding pattern (destructuring).
 * Binding patterns include array patterns ([a, b]) and object patterns ({x, y}).
 */
const isBindingPattern = (decl: ts.VariableDeclaration): boolean => {
  return (
    ts.isArrayBindingPattern(decl.name) || ts.isObjectBindingPattern(decl.name)
  );
};

/**
 * Get the expected type for initializer conversion (only from explicit annotations).
 * This is used for deterministic contextual typing - only explicit annotations
 * should influence literal type inference.
 */
const getExpectedTypeForInitializer = (
  decl: ts.VariableDeclaration,
  ctx: ProgramContext
) => {
  // Only use explicit type annotation as expectedType
  // Inferred types should NOT influence literal typing
  if (decl.type) {
    // Convert variable declaration syntax through the TypeSystem.
    return ctx.typeSystem.typeFromSyntax(
      ctx.binding.captureTypeSyntax(decl.type)
    );
  }
  return undefined;
};

/**
 * Convert variable statement
 *
 * Passes the LHS type annotation (if present) to the initializer conversion
 * for deterministic contextual typing. This ensures that:
 * - `const a: number[] = [1,2,3]` produces `double[]` not `int[]`
 * - `const x: int = 5` produces `int` not `double`
 *
 * For module-level variables (without explicit annotation), we infer the type
 * from TypeScript and pass it as expectedType to ensure consistent typing
 * between the variable declaration and its initializer.
 */
export const convertVariableStatement = (
  node: ts.VariableStatement,
  ctx: ProgramContext
): IrVariableDeclaration | IrStatement | readonly IrStatement[] => {
  const isConst = !!(node.declarationList.flags & ts.NodeFlags.Const);
  const isLet = !!(node.declarationList.flags & ts.NodeFlags.Let);
  const declarationKind = isConst ? "const" : isLet ? "let" : "var";
  const isExported = hasExportModifier(node);

  // Module-level variables need explicit types in C# (they become static fields)
  const isModuleLevel = isModuleLevelVariable(node);
  const needsExplicitType = isExported || isModuleLevel;

  let currentCtx = ctx;
  const declarations: IrVariableDeclarator[] = [];
  const loweredStatements: IrStatement[] = [];
  const sourceFile = (() => {
    try {
      return node.getSourceFile();
    } catch {
      return undefined;
    }
  })();
  const writtenSymbols = sourceFile
    ? collectWrittenSymbols(sourceFile, ctx.checker)
    : new Set<ts.Symbol>();
  const supportedGenericFunctionValueSymbols = sourceFile
    ? collectSupportedGenericFunctionValueSymbols(
        sourceFile,
        ctx.checker,
        writtenSymbols
      )
    : new Set<ts.Symbol>();

  // Convert declarations sequentially so later declarators can refer to earlier ones:
  //   const a = false, b = !a;
  for (const decl of node.declarationList.declarations) {
    if (
      isSupportedGenericFunctionValueDeclaration(
        decl,
        ctx.checker,
        writtenSymbols
      )
    ) {
      const lowered = convertGenericFunctionValueDeclaration(
        node,
        decl,
        currentCtx
      );
      if (lowered) {
        loweredStatements.push(lowered);
        continue;
      }
    }

    if (
      isSupportedGenericFunctionAliasDeclaration(
        decl,
        ctx.checker,
        writtenSymbols,
        supportedGenericFunctionValueSymbols
      )
    ) {
      const loweredAlias = convertGenericFunctionValueAliasDeclaration(
        node,
        decl,
        currentCtx
      );
      if (loweredAlias) {
        loweredStatements.push(loweredAlias);
        continue;
      }
    }

    // expectedType for initializer: ONLY from explicit type annotation
    // This ensures deterministic literal typing (e.g., 100 -> int unless annotated)
    const expectedType = getExpectedTypeForInitializer(decl, currentCtx);

    // Convert initializer first so we can deterministically derive types from IR.
    const convertedInitializer = decl.initializer
      ? convertExpression(decl.initializer, currentCtx, expectedType)
      : undefined;

    // Determine declared type:
    // 1) Explicit annotation wins.
    // 2) For module-level/static variables (and exports), C# requires explicit type.
    //    Derive from initializer deterministically (no TS fallback).
    const declaredType = decl.type
      ? currentCtx.typeSystem.typeFromSyntax(
          currentCtx.binding.captureTypeSyntax(decl.type)
        )
      : convertedInitializer?.kind === "object" &&
          convertedInitializer.behaviorMembers?.length
        ? undefined
        : needsExplicitType && convertedInitializer && !isBindingPattern(decl)
          ? deriveTypeFromExpression(convertedInitializer)
          : undefined;

    const irDecl: IrVariableDeclarator = {
      kind: "variableDeclarator",
      name: convertBindingName(decl.name, currentCtx),
      type: declaredType,
      initializer: convertedInitializer,
    };

    declarations.push(irDecl);

    // Thread deterministic local types forward within the same statement.
    currentCtx = withVariableDeclaratorTypeEnv(currentCtx, decl.name, irDecl);
  }

  const variableStatement: IrVariableDeclaration = {
    kind: "variableDeclaration",
    declarationKind,
    declarations,
    isExported,
  };

  if (loweredStatements.length === 0) {
    return variableStatement;
  }

  if (declarations.length === 0) {
    if (loweredStatements.length === 1 && loweredStatements[0]) {
      return loweredStatements[0];
    }
    return loweredStatements;
  }

  return [...loweredStatements, variableStatement];
};
