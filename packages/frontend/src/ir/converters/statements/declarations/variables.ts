/**
 * Variable declaration converter
 */

import {
  getTstsContainingSourceFile,
  getTstsDeclaredTypeNode,
  getTstsInitializerNode,
  TstsSyntax,
  type TstsNode,
  type TstsSymbol,
} from "@tsonic/tsts";
import {
  IrVariableDeclaration,
  IrVariableDeclarator,
  IrStatement,
} from "../../../types.js";
import { convertExpression } from "../../../expression-converter.js";
import { convertBindingName } from "../../../syntax/binding-patterns.js";
import { definedTstsNodes, hasExportModifier } from "../helpers.js";
import type { ProgramContext } from "../../../program-context.js";
import {
  collectWrittenSymbols,
  collectSupportedGenericFunctionValueSymbols,
} from "../../../../generic-function-values.js";
import {
  deriveTypeFromExpression,
  resolveMutableNumericLiteralDeclarationType,
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
 * Module-level variables become static fields in target and need explicit types.
 */
const isModuleLevelVariable = (node: TstsNode): boolean => {
  // Walk up the parent chain to check if we're inside a function/method
  let current: TstsNode = node;
  while (current.Parent) {
    current = current.Parent;
    // If we hit a function-like node, we're not at module level
    if (
      TstsSyntax.IsFunctionDeclaration(current) ||
      TstsSyntax.IsFunctionExpression(current) ||
      TstsSyntax.IsArrowFunction(current) ||
      TstsSyntax.IsMethodDeclaration(current) ||
      TstsSyntax.IsConstructorDeclaration(current) ||
      TstsSyntax.IsGetAccessorDeclaration(current) ||
      TstsSyntax.IsSetAccessorDeclaration(current)
    ) {
      return false;
    }
    // If we hit the source file, we're at module level
    if (current.Kind === TstsSyntax.KindSourceFile) {
      return true;
    }
  }
  return false;
};

/**
 * Check if a variable declaration has a binding pattern (destructuring).
 * Binding patterns include array patterns ([a, b]) and object patterns ({x, y}).
 */
const isBindingPattern = (decl: TstsNode): boolean => {
  const name = TstsSyntax.Node_Name(decl);
  return (
    !!name &&
    (TstsSyntax.IsArrayBindingPattern(name) ||
      TstsSyntax.IsObjectBindingPattern(name))
  );
};

/**
 * Get the expected type for initializer conversion (only from explicit annotations).
 * This is used for deterministic contextual typing - only explicit annotations
 * should influence literal type inference.
 */
const getExpectedTypeForInitializer = (
  decl: TstsNode,
  ctx: ProgramContext
) => {
  // Only use explicit type annotation as expectedType
  // Inferred types should NOT influence literal typing
  const typeNode = getTstsDeclaredTypeNode(decl);
  if (typeNode) {
    // Convert variable declaration syntax through the TypeSystem.
    return ctx.typeSystem.typeFromSyntax(
      ctx.binding.captureTypeSyntax(typeNode)
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
  node: TstsNode,
  ctx: ProgramContext
): IrVariableDeclaration | IrStatement | readonly IrStatement[] => {
  const declarationList = TstsSyntax.AsVariableStatement(node)?.DeclarationList;
  const declarationFlags =
    declarationList !== undefined
      ? (TstsSyntax.AsVariableDeclarationList(declarationList)?.Flags ?? 0)
      : 0;
  const isConst = (declarationFlags & TstsSyntax.NodeFlagsConst) !== 0;
  const isLet = (declarationFlags & TstsSyntax.NodeFlagsLet) !== 0;
  const declarationKind = isConst ? "const" : isLet ? "let" : "var";
  const isExported = hasExportModifier(node);

  // Module-level variables need explicit types in target (they become static fields)
  const isModuleLevel = isModuleLevelVariable(node);
  const needsExplicitType = isExported || isModuleLevel;

  let currentCtx = ctx;
  const declarations: IrVariableDeclarator[] = [];
  const loweredStatements: IrStatement[] = [];
  const sourceFile = getTstsContainingSourceFile(node);
  const writtenSymbols = sourceFile
    ? collectWrittenSymbols(sourceFile, ctx.sourceSemantics)
    : new Set<TstsSymbol>();
  const supportedGenericFunctionValueSymbols = sourceFile
    ? collectSupportedGenericFunctionValueSymbols(
        sourceFile,
        ctx.sourceSemantics,
        writtenSymbols
      )
    : new Set<TstsSymbol>();

  // Convert declarations sequentially so later declarators can refer to earlier ones:
  //   const a = false, b = !a;
  for (const decl of definedTstsNodes(
    TstsSyntax.AsVariableDeclarationList(declarationList)?.Declarations?.Nodes
  )) {
    if (
      isSupportedGenericFunctionValueDeclaration(
        decl,
        ctx.sourceSemantics,
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
        ctx.sourceSemantics,
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
    const initializerNode = getTstsInitializerNode(decl);
    const convertedInitializer = initializerNode
      ? convertExpression(initializerNode, currentCtx, expectedType)
      : undefined;

    // Determine declared type:
    // 1) Explicit annotation wins.
    // 2) For module-level/static variables (and exports), target requires explicit type.
    //    Derive from converted initializer metadata.
    const explicitTypeNode = getTstsDeclaredTypeNode(decl);
    const explicitDeclaredType = explicitTypeNode
      ? currentCtx.typeSystem.typeFromSyntax(
          currentCtx.binding.captureTypeSyntax(explicitTypeNode)
        )
      : undefined;
    const mutableNumericLiteralType =
      resolveMutableNumericLiteralDeclarationType(
        declarationKind,
        explicitDeclaredType,
        convertedInitializer,
        TstsSyntax.Node_Name(decl) &&
          TstsSyntax.IsIdentifier(TstsSyntax.Node_Name(decl))
          ? (currentCtx.mutableNumericLiteralWideningDeclIds?.has(
              currentCtx.binding.resolveIdentifier(
                TstsSyntax.Node_Name(decl) ?? decl
              )?.id ?? -1
            ) ?? false)
          : false
      );
    const declaredType = explicitDeclaredType
      ? explicitDeclaredType
      : convertedInitializer?.kind === "object" &&
          convertedInitializer.behaviorMembers?.length
        ? undefined
        : mutableNumericLiteralType
          ? mutableNumericLiteralType
          : needsExplicitType && convertedInitializer && !isBindingPattern(decl)
            ? deriveTypeFromExpression(convertedInitializer)
            : undefined;

    const irDecl: IrVariableDeclarator = {
      kind: "variableDeclarator",
      name: convertBindingName(TstsSyntax.Node_Name(decl) ?? decl, currentCtx),
      type: declaredType,
      initializer: convertedInitializer,
    };

    declarations.push(irDecl);

    // Thread deterministic local types forward within the same statement.
    currentCtx = withVariableDeclaratorTypeEnv(
      currentCtx,
      TstsSyntax.Node_Name(decl) ?? decl,
      irDecl
    );
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
