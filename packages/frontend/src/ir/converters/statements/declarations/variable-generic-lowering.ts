/**
 * Generic function value lowering for variable declarations
 *
 * Handles conversion of generic arrow/function expressions assigned to
 * variables into function declarations, and resolution of generic
 * function alias chains:
 * - resolveGenericFunctionValueReturnType
 * - isSupportedGenericFunctionValueDeclaration
 * - resolveSymbol
 * - resolveGenericFunctionAliasTargetFromSymbol
 * - isSupportedGenericFunctionAliasDeclaration
 * - createTypeParameterTypeArgs
 * - createIdentifierArgumentsForParameters
 * - convertGenericFunctionValueDeclaration
 * - convertGenericFunctionValueAliasDeclaration
 */

import * as ts from "typescript";
import {
  IrArrowFunctionExpression,
  IrBlockStatement,
  IrExpression,
  IrFunctionDeclaration,
  IrFunctionExpression,
  IrType,
  IrStatement,
} from "../../../types.js";
import { convertExpression } from "../../../expression-converter.js";
import {
  convertParameters,
  convertTypeParameters,
  hasExportModifier,
} from "../helpers.js";
import type { ProgramContext } from "../../../program-context.js";
import {
  type GenericFunctionValueNode,
  getSupportedGenericFunctionValueSymbol,
  isDeterministicGenericFunctionAliasTargetSymbol,
  isGenericFunctionValueNode,
} from "../../../../generic-function-values.js";

export const resolveGenericFunctionValueReturnType = (
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

export const isSupportedGenericFunctionValueDeclaration = (
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

export const resolveSymbol = (
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

export type GenericFunctionAliasTarget =
  | {
      readonly kind: "genericValue";
      readonly name: string;
      readonly initializer: GenericFunctionValueNode;
    }
  | {
      readonly kind: "functionDeclaration";
      readonly declaration: ts.FunctionDeclaration & {
        readonly name: ts.Identifier;
      };
    };

export const resolveGenericFunctionAliasTargetFromSymbol = (
  symbol: ts.Symbol,
  checker: ts.TypeChecker,
  seen: Set<ts.Symbol>
): GenericFunctionAliasTarget | undefined => {
  if (seen.has(symbol)) return undefined;
  seen.add(symbol);

  for (const declaration of symbol.declarations ?? []) {
    if (
      ts.isFunctionDeclaration(declaration) &&
      declaration.name &&
      ts.isIdentifier(declaration.name) &&
      declaration.typeParameters &&
      declaration.typeParameters.length > 0
    ) {
      return {
        kind: "functionDeclaration",
        declaration: declaration as ts.FunctionDeclaration & {
          readonly name: ts.Identifier;
        },
      };
    }

    if (
      ts.isVariableDeclaration(declaration) &&
      ts.isIdentifier(declaration.name)
    ) {
      const initializer = declaration.initializer;
      if (initializer && isGenericFunctionValueNode(initializer)) {
        return {
          kind: "genericValue",
          name: declaration.name.text,
          initializer,
        };
      }

      if (initializer && ts.isIdentifier(initializer)) {
        const targetSymbol = resolveSymbol(checker, initializer);
        if (!targetSymbol) continue;
        const resolved = resolveGenericFunctionAliasTargetFromSymbol(
          targetSymbol,
          checker,
          seen
        );
        if (resolved) return resolved;
      }
    }
  }

  return undefined;
};

export const isSupportedGenericFunctionAliasDeclaration = (
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
  if (!declarationList || !ts.isVariableDeclarationList(declarationList)) {
    return false;
  }
  const isConst = (declarationList.flags & ts.NodeFlags.Const) !== 0;
  const isLet = (declarationList.flags & ts.NodeFlags.Let) !== 0;
  if (!isConst && !isLet) return false;

  const aliasSymbol = resolveSymbol(checker, decl.name);
  if (!aliasSymbol) return false;
  if (!isConst && writtenSymbols.has(aliasSymbol)) return false;

  const targetSymbol = resolveSymbol(checker, decl.initializer);
  if (!targetSymbol) return false;
  return isDeterministicGenericFunctionAliasTargetSymbol(
    targetSymbol,
    supportedSymbols
  );
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
    const identifierExpression: IrExpression = {
      kind: "identifier",
      name: parameter.pattern.name,
      inferredType: parameter.type,
    };
    if (parameter.isRest) {
      args.push({
        kind: "spread",
        expression: identifierExpression,
        inferredType: identifierExpression.inferredType,
      });
      continue;
    }
    args.push(identifierExpression);
  }
  return args;
};

export const convertGenericFunctionValueDeclaration = (
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

export const convertGenericFunctionValueAliasDeclaration = (
  node: ts.VariableStatement,
  decl: ts.VariableDeclaration & {
    readonly name: ts.Identifier;
    readonly initializer: ts.Identifier;
  },
  ctx: ProgramContext
): IrFunctionDeclaration | null => {
  const targetSymbol = resolveSymbol(ctx.checker, decl.initializer);
  if (!targetSymbol) return null;

  const target = resolveGenericFunctionAliasTargetFromSymbol(
    targetSymbol,
    ctx.checker,
    new Set<ts.Symbol>()
  );
  if (!target) return null;

  let targetName: string;
  let typeParameters: IrFunctionDeclaration["typeParameters"];
  let parameters: IrFunctionDeclaration["parameters"];
  let returnType: IrType | undefined;
  let typeArguments: readonly IrType[] | undefined;
  let callee: IrExpression | undefined;

  if (target.kind === "genericValue") {
    const convertedTarget = convertExpression(
      target.initializer,
      ctx,
      undefined
    );
    if (
      convertedTarget.kind !== "arrowFunction" &&
      convertedTarget.kind !== "functionExpression"
    ) {
      return null;
    }
    targetName = target.name;
    typeParameters = convertTypeParameters(
      target.initializer.typeParameters,
      ctx
    );
    parameters = convertedTarget.parameters;
    returnType = resolveGenericFunctionValueReturnType(convertedTarget);
    typeArguments = createTypeParameterTypeArgs(
      target.initializer.typeParameters
    );
    callee = {
      kind: "identifier",
      name: targetName,
    };
  } else {
    const declaration = target.declaration;
    targetName = declaration.name.text;
    typeParameters = convertTypeParameters(declaration.typeParameters, ctx);
    parameters = convertParameters(declaration.parameters, ctx);
    returnType = declaration.type
      ? ctx.typeSystem.typeFromSyntax(
          ctx.binding.captureTypeSyntax(declaration.type)
        )
      : undefined;
    if (!returnType) {
      const targetIdentifier = convertExpression(
        decl.initializer,
        ctx,
        undefined
      );
      if (
        targetIdentifier.inferredType &&
        targetIdentifier.inferredType.kind === "functionType"
      ) {
        returnType = targetIdentifier.inferredType.returnType;
      }
    }
    if (!returnType) {
      return null;
    }
    typeArguments = createTypeParameterTypeArgs(declaration.typeParameters);
    const isCrossModuleTarget =
      declaration.getSourceFile() !== decl.getSourceFile();
    if (isCrossModuleTarget) {
      callee = convertExpression(decl.initializer, ctx, undefined);
    } else {
      callee = {
        kind: "identifier",
        name: targetName,
      };
    }
  }

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
  if (!callee) return null;

  const callExpression: IrExpression = {
    kind: "call",
    callee,
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
    typeParameters,
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
