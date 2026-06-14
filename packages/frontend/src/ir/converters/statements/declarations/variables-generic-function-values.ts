import {
  getTstsContainingSourceFileName,
  getTstsDeclaredTypeNode,
  getTstsInitializerNode,
  getTstsNodeNameText,
  getTstsParameters,
  getTstsTypeParameterNodes,
  TstsSyntax,
  type TstsNode,
  type TstsSymbol,
} from "@tsonic/tsts";
import {
  IrArrowFunctionExpression,
  IrBlockStatement,
  IrExpression,
  IrFunctionDeclaration,
  IrFunctionExpression,
  IrStatement,
  IrType,
} from "../../../types.js";
import { convertExpression } from "../../../expression-converter.js";
import type { ProgramContext } from "../../../program-context.js";
import type { TstsFrontendSourceSemanticView } from "../../../../source-frontend/index.js";
import {
  convertParameters,
  convertTypeParameters,
  definedTstsNodes,
  hasExportModifier,
} from "../helpers.js";
import {
  getSupportedGenericFunctionValueSymbol,
  isGenericFunctionDeclarationNode,
  isDeterministicGenericFunctionAliasTargetSymbol,
  isGenericFunctionValueNode,
  type GenericFunctionValueNode,
} from "../../../../generic-function-values.js";

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

export const isSupportedGenericFunctionValueDeclaration = (
  decl: TstsNode,
  sourceSemantics: TstsFrontendSourceSemanticView,
  writtenSymbols: ReadonlySet<TstsSymbol>
): boolean => {
  const name = TstsSyntax.Node_Name(decl);
  const initializer = getTstsInitializerNode(decl);
  if (!name || !TstsSyntax.IsIdentifier(name)) return false;
  if (!initializer || !isGenericFunctionValueNode(initializer)) {
    return false;
  }
  const symbol = getSupportedGenericFunctionValueSymbol(
    initializer,
    sourceSemantics,
    writtenSymbols
  );
  return symbol !== undefined;
};

const resolveSymbol = (
  sourceSemantics: TstsFrontendSourceSemanticView,
  node: TstsNode
): TstsSymbol | undefined => {
  const symbol = sourceSemantics.getSymbol(node);
  if (!symbol) return undefined;
  return sourceSemantics.resolveAlias(symbol);
};

type GenericFunctionAliasTarget =
  | {
      readonly kind: "genericValue";
      readonly name: string;
      readonly initializer: GenericFunctionValueNode;
    }
  | {
      readonly kind: "functionDeclaration";
      readonly declaration: TstsNode;
    };

const resolveGenericFunctionAliasTargetFromSymbol = (
  symbol: TstsSymbol,
  sourceSemantics: TstsFrontendSourceSemanticView,
  seen: Set<TstsSymbol>
): GenericFunctionAliasTarget | undefined => {
  if (seen.has(symbol)) return undefined;
  seen.add(symbol);

  for (const declaration of sourceSemantics.getSymbolDeclarations(symbol)) {
    if (isGenericFunctionDeclarationNode(declaration)) {
      return {
        kind: "functionDeclaration",
        declaration,
      };
    }

    if (
      TstsSyntax.IsVariableDeclaration(declaration) &&
      TstsSyntax.Node_Name(declaration) &&
      TstsSyntax.IsIdentifier(TstsSyntax.Node_Name(declaration))
    ) {
      const initializer = getTstsInitializerNode(declaration);
      if (initializer && isGenericFunctionValueNode(initializer)) {
        return {
          kind: "genericValue",
          name: getTstsNodeNameText(declaration) ?? "_",
          initializer,
        };
      }

      if (initializer && TstsSyntax.IsIdentifier(initializer)) {
        const targetSymbol = resolveSymbol(sourceSemantics, initializer);
        if (!targetSymbol) continue;
        const resolved = resolveGenericFunctionAliasTargetFromSymbol(
          targetSymbol,
          sourceSemantics,
          seen
        );
        if (resolved) return resolved;
      }
    }
  }

  return undefined;
};

export const isSupportedGenericFunctionAliasDeclaration = (
  decl: TstsNode,
  sourceSemantics: TstsFrontendSourceSemanticView,
  writtenSymbols: ReadonlySet<TstsSymbol>,
  supportedSymbols: ReadonlySet<TstsSymbol>
): boolean => {
  const name = TstsSyntax.Node_Name(decl);
  const initializer = getTstsInitializerNode(decl);
  if (!name || !TstsSyntax.IsIdentifier(name)) return false;
  if (!initializer || !TstsSyntax.IsIdentifier(initializer)) return false;

  const declarationList = decl.Parent;
  if (
    !declarationList ||
    !TstsSyntax.IsVariableDeclarationList(declarationList)
  ) {
    return false;
  }
  const declarationFlags =
    TstsSyntax.AsVariableDeclarationList(declarationList)?.Flags ?? 0;
  const isConst = (declarationFlags & TstsSyntax.NodeFlagsConst) !== 0;
  const isLet = (declarationFlags & TstsSyntax.NodeFlagsLet) !== 0;
  if (!isConst && !isLet) return false;

  const aliasSymbol = resolveSymbol(sourceSemantics, name);
  if (!aliasSymbol) return false;
  if (!isConst && writtenSymbols.has(aliasSymbol)) return false;

  const targetSymbol = resolveSymbol(sourceSemantics, initializer);
  if (!targetSymbol) return false;
  return isDeterministicGenericFunctionAliasTargetSymbol(
    targetSymbol,
    supportedSymbols,
    sourceSemantics
  );
};

const createTypeParameterTypeArgs = (
  typeParameters: readonly TstsNode[] | undefined
): readonly IrType[] | undefined => {
  if (!typeParameters || typeParameters.length === 0) return undefined;
  return typeParameters.map((typeParameter) => ({
    kind: "typeParameterType" as const,
    name: getTstsNodeNameText(typeParameter) ?? "_",
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
  node: TstsNode,
  decl: TstsNode,
  ctx: ProgramContext
): IrFunctionDeclaration | null => {
  const initializerNode = getTstsInitializerNode(decl);
  if (!initializerNode || !isGenericFunctionValueNode(initializerNode)) {
    return null;
  }

  const initializer = convertExpression(initializerNode, ctx, undefined);
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
    name: getTstsNodeNameText(decl) ?? "_",
    typeParameters: convertTypeParameters(
      definedTstsNodes(getTstsTypeParameterNodes(initializerNode)),
      ctx
    ),
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
  node: TstsNode,
  decl: TstsNode,
  ctx: ProgramContext
): IrFunctionDeclaration | null => {
  const initializerNode = getTstsInitializerNode(decl);
  if (!initializerNode || !TstsSyntax.IsIdentifier(initializerNode)) {
    return null;
  }

  const targetSymbol = resolveSymbol(ctx.sourceSemantics, initializerNode);
  if (!targetSymbol) return null;

  const target = resolveGenericFunctionAliasTargetFromSymbol(
    targetSymbol,
    ctx.sourceSemantics,
    new Set<TstsSymbol>()
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
      definedTstsNodes(getTstsTypeParameterNodes(target.initializer)),
      ctx
    );
    parameters = convertedTarget.parameters;
    returnType = resolveGenericFunctionValueReturnType(convertedTarget);
    typeArguments = createTypeParameterTypeArgs(
      definedTstsNodes(getTstsTypeParameterNodes(target.initializer))
    );
    callee = {
      kind: "identifier",
      name: targetName,
    };
  } else {
    const declaration = target.declaration;
    targetName = getTstsNodeNameText(declaration) ?? "_";
    typeParameters = convertTypeParameters(
      definedTstsNodes(getTstsTypeParameterNodes(declaration)),
      ctx
    );
    parameters = convertParameters(
      definedTstsNodes(getTstsParameters(declaration)),
      ctx
    );
    const returnTypeNode = getTstsDeclaredTypeNode(declaration);
    returnType = returnTypeNode
      ? ctx.typeSystem.typeFromSyntax(
          ctx.binding.captureTypeSyntax(returnTypeNode)
        )
      : undefined;
    if (!returnType) {
      const targetIdentifier = convertExpression(
        initializerNode,
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
    typeArguments = createTypeParameterTypeArgs(
      definedTstsNodes(getTstsTypeParameterNodes(declaration))
    );
    const isCrossModuleTarget =
      getTstsContainingSourceFileName(declaration) !==
      getTstsContainingSourceFileName(decl);
    if (isCrossModuleTarget) {
      callee = convertExpression(initializerNode, ctx, undefined);
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
  if (!callArguments || callArguments.length !== parameters.length || !callee) {
    return null;
  }

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
    name: getTstsNodeNameText(decl) ?? "_",
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
