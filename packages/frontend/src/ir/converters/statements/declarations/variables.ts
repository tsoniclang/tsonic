/**
 * Variable declaration converter
 */

import * as ts from "typescript";
import {
  IrArrowFunctionExpression,
  IrBlockStatement,
  IrExpression,
  IrFunctionDeclaration,
  IrFunctionExpression,
  IrType,
  IrVariableDeclaration,
  IrVariableDeclarator,
  IrStatement,
} from "../../../types.js";
import { convertExpression } from "../../../expression-converter.js";
import { convertBindingName } from "../../../syntax/binding-patterns.js";
import { convertTypeParameters, hasExportModifier } from "../helpers.js";
import type { ProgramContext } from "../../../program-context.js";
import {
  collectWrittenSymbols,
  collectSupportedGenericFunctionValueSymbols,
  type GenericFunctionValueNode,
  getSupportedGenericFunctionValueSymbol,
  isGenericFunctionValueNode,
} from "../../../../generic-function-values.js";
import {
  deriveTypeFromExpression,
  withVariableDeclaratorTypeEnv,
} from "../../type-env.js";

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
    // PHASE 4 (Alice's spec): Use captureTypeSyntax + typeFromSyntax
    return ctx.typeSystem.typeFromSyntax(
      ctx.binding.captureTypeSyntax(decl.type)
    );
  }
  return undefined;
};

const resolveGenericFunctionValueReturnType = (
  initializer: IrArrowFunctionExpression | IrFunctionExpression
): IrType | undefined => {
  if (initializer.returnType) return initializer.returnType;
  if (
    initializer.inferredType &&
    initializer.inferredType.kind === "functionType"
  ) {
    return initializer.inferredType.returnType;
  }
  return undefined;
};

const isSupportedGenericFunctionValueDeclaration = (
  decl: ts.VariableDeclaration,
  checker: ts.TypeChecker,
  writtenSymbols: ReadonlySet<ts.Symbol>
): decl is ts.VariableDeclaration & {
  readonly name: ts.Identifier;
  readonly initializer: GenericFunctionValueNode;
} => {
  if (!ts.isIdentifier(decl.name)) return false;
  if (!decl.initializer || !isGenericFunctionValueNode(decl.initializer)) {
    return false;
  }
  const symbol = getSupportedGenericFunctionValueSymbol(
    decl.initializer,
    checker,
    writtenSymbols
  );
  return symbol !== undefined;
};

const resolveSymbol = (
  checker: ts.TypeChecker,
  node: ts.Node
): ts.Symbol | undefined => {
  const symbol = checker.getSymbolAtLocation(node);
  if (!symbol) return undefined;
  if (symbol.flags & ts.SymbolFlags.Alias) {
    return checker.getAliasedSymbol(symbol);
  }
  return symbol;
};

const resolveGenericFunctionValueDeclarationFromSymbol = (
  symbol: ts.Symbol,
  checker: ts.TypeChecker,
  seen: Set<ts.Symbol>
):
  | {
      readonly name: string;
      readonly initializer: GenericFunctionValueNode;
    }
  | undefined => {
  if (seen.has(symbol)) return undefined;
  seen.add(symbol);

  for (const declaration of symbol.declarations ?? []) {
    if (!ts.isVariableDeclaration(declaration)) continue;
    if (!ts.isIdentifier(declaration.name)) continue;

    const initializer = declaration.initializer;
    if (initializer && isGenericFunctionValueNode(initializer)) {
      return {
        name: declaration.name.text,
        initializer,
      };
    }

    if (initializer && ts.isIdentifier(initializer)) {
      const targetSymbol = resolveSymbol(checker, initializer);
      if (!targetSymbol) continue;
      const resolved = resolveGenericFunctionValueDeclarationFromSymbol(
        targetSymbol,
        checker,
        seen
      );
      if (resolved) return resolved;
    }
  }

  return undefined;
};

const isSupportedGenericFunctionAliasDeclaration = (
  decl: ts.VariableDeclaration,
  checker: ts.TypeChecker,
  writtenSymbols: ReadonlySet<ts.Symbol>,
  supportedSymbols: ReadonlySet<ts.Symbol>
): decl is ts.VariableDeclaration & {
  readonly name: ts.Identifier;
  readonly initializer: ts.Identifier;
} => {
  if (!ts.isIdentifier(decl.name)) return false;
  if (!decl.initializer || !ts.isIdentifier(decl.initializer)) return false;

  const declarationList = decl.parent;
  if (!ts.isVariableDeclarationList(declarationList)) return false;
  const isConst = (declarationList.flags & ts.NodeFlags.Const) !== 0;
  const isLet = (declarationList.flags & ts.NodeFlags.Let) !== 0;
  if (!isConst && !isLet) return false;

  const aliasSymbol = resolveSymbol(checker, decl.name);
  if (!aliasSymbol) return false;
  if (!isConst && writtenSymbols.has(aliasSymbol)) return false;

  const targetSymbol = resolveSymbol(checker, decl.initializer);
  if (!targetSymbol) return false;
  return supportedSymbols.has(targetSymbol);
};

const createTypeParameterTypeArgs = (
  typeParameters: readonly ts.TypeParameterDeclaration[] | undefined
): readonly IrType[] | undefined => {
  if (!typeParameters || typeParameters.length === 0) return undefined;
  return typeParameters.map((typeParameter) => ({
    kind: "typeParameterType" as const,
    name: typeParameter.name.text,
  }));
};

const createIdentifierArgumentsForParameters = (
  parameters: IrFunctionDeclaration["parameters"]
): readonly IrExpression[] | undefined => {
  const args: IrExpression[] = [];
  for (const parameter of parameters) {
    if (parameter.pattern.kind !== "identifierPattern") {
      return undefined;
    }
    args.push({
      kind: "identifier",
      name: parameter.pattern.name,
      inferredType: parameter.type,
    });
  }
  return args;
};

const convertGenericFunctionValueDeclaration = (
  node: ts.VariableStatement,
  decl: ts.VariableDeclaration & {
    readonly name: ts.Identifier;
    readonly initializer: GenericFunctionValueNode;
  },
  ctx: ProgramContext
): IrFunctionDeclaration | null => {
  const initializer = convertExpression(decl.initializer, ctx, undefined);
  if (
    initializer.kind !== "arrowFunction" &&
    initializer.kind !== "functionExpression"
  ) {
    return null;
  }

  let body: IrBlockStatement;
  if (initializer.kind === "functionExpression") {
    body = initializer.body;
  } else if (initializer.body.kind === "blockStatement") {
    body = initializer.body;
  } else {
    body = {
      kind: "blockStatement",
      statements: [
        {
          kind: "returnStatement",
          expression: initializer.body,
        },
      ],
    };
  }

  return {
    kind: "functionDeclaration",
    name: decl.name.text,
    typeParameters: convertTypeParameters(decl.initializer.typeParameters, ctx),
    parameters: initializer.parameters,
    returnType: resolveGenericFunctionValueReturnType(initializer),
    body,
    isAsync: initializer.isAsync,
    isGenerator:
      initializer.kind === "functionExpression"
        ? initializer.isGenerator
        : false,
    isExported: hasExportModifier(node),
  };
};

const convertGenericFunctionValueAliasDeclaration = (
  node: ts.VariableStatement,
  decl: ts.VariableDeclaration & {
    readonly name: ts.Identifier;
    readonly initializer: ts.Identifier;
  },
  ctx: ProgramContext
): IrFunctionDeclaration | null => {
  const targetSymbol = resolveSymbol(ctx.checker, decl.initializer);
  if (!targetSymbol) return null;

  const target = resolveGenericFunctionValueDeclarationFromSymbol(
    targetSymbol,
    ctx.checker,
    new Set<ts.Symbol>()
  );
  if (!target) return null;

  const convertedTarget = convertExpression(target.initializer, ctx, undefined);
  if (
    convertedTarget.kind !== "arrowFunction" &&
    convertedTarget.kind !== "functionExpression"
  ) {
    return null;
  }

  const parameters = convertedTarget.parameters;
  if (
    parameters.some(
      (parameter) => parameter.pattern.kind !== "identifierPattern"
    )
  ) {
    return null;
  }

  const callArguments = createIdentifierArgumentsForParameters(parameters);
  if (!callArguments || callArguments.length !== parameters.length) {
    return null;
  }

  const typeArguments = createTypeParameterTypeArgs(
    target.initializer.typeParameters
  );
  const returnType = resolveGenericFunctionValueReturnType(convertedTarget);

  const callExpression: IrExpression = {
    kind: "call",
    callee: { kind: "identifier", name: target.name },
    arguments: [...callArguments],
    isOptional: false,
    typeArguments,
    inferredType: returnType,
  };

  const callStatements: IrStatement[] =
    returnType?.kind === "voidType"
      ? [
          {
            kind: "expressionStatement",
            expression: callExpression,
          },
        ]
      : [
          {
            kind: "returnStatement",
            expression: callExpression,
          },
        ];

  return {
    kind: "functionDeclaration",
    name: decl.name.text,
    typeParameters: convertTypeParameters(
      target.initializer.typeParameters,
      ctx
    ),
    parameters,
    returnType,
    body: {
      kind: "blockStatement",
      statements: callStatements,
    },
    isAsync: false,
    isGenerator: false,
    isExported: hasExportModifier(node),
  };
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
  const writtenSymbols = collectWrittenSymbols(
    node.getSourceFile(),
    ctx.checker
  );
  const supportedGenericFunctionValueSymbols =
    collectSupportedGenericFunctionValueSymbols(
      node.getSourceFile(),
      ctx.checker,
      writtenSymbols
    );

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
