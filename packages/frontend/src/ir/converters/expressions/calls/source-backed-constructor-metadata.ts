import fs from "node:fs";
import {
  getTstsContainingSourceFile,
  getTstsContainingSourceFileName,
  getTstsIdentifierText,
  getTstsNodeText,
  getTstsStatementNodes,
  isTstsDeclarationFileNode,
  parseTstsSourceFile,
  TstsSyntax,
  type TstsNode,
  type TstsSourceFile,
} from "@tsonic/tsts";
import type { IrNewExpression, IrType } from "../../../types.js";
import type { ProgramContext } from "../../../program-context.js";
import { substituteTypeParameters } from "./call-site-analysis.js";
import {
  expandAuthoritativeSourceBackedSurfaceType,
  selectDeterministicSourceBackedParameterType,
} from "./invocation-finalization.js";
import {
  buildResolvedRestParameter,
  expandParameterTypesForArguments,
} from "../../../type-system/type-system-call-resolution.js";
import { addUndefinedToType } from "../../../type-system/type-system-state-helpers.js";
import { resolveImport } from "../../../../resolver/import-resolution.js";
import { externalSurfaceTypesMatch } from "../../../../program/external-surface-type-identity.js";

const definedNodes = (
  nodes: readonly (TstsNode | undefined)[] | undefined
): readonly TstsNode[] =>
  nodes?.filter((node): node is TstsNode => node !== undefined) ?? [];

const statementNodesOf = (sourceFile: TstsSourceFile): readonly TstsNode[] =>
  definedNodes(getTstsStatementNodes(sourceFile));

export type SourceBackedConstructorParameterTypes = {
  readonly parameterTypes: readonly (IrType | undefined)[];
  readonly surfaceParameterTypes: readonly (IrType | undefined)[];
  readonly restParameter:
    | {
        readonly index: number;
        readonly arrayType: IrType | undefined;
        readonly elementType: IrType | undefined;
      }
    | undefined;
};

const getSourceFileForPath = (
  sourceFilePath: string,
  ctx: ProgramContext
): TstsSourceFile | undefined => {
  const normalizedSourceFilePath = sourceFilePath.replace(/\\/g, "/");
  const realSourceFilePath = (() => {
    try {
      return fs.realpathSync(sourceFilePath).replace(/\\/g, "/");
    } catch {
      return undefined;
    }
  })();

  const fromProgram =
    ctx.sourceFilesByPath.get(normalizedSourceFilePath) ??
    (realSourceFilePath
      ? ctx.sourceFilesByPath.get(realSourceFilePath)
      : undefined);
  if (fromProgram) {
    return fromProgram;
  }

  if (!fs.existsSync(sourceFilePath)) {
    return undefined;
  }

  return parseTstsSourceFile(fs.readFileSync(sourceFilePath, "utf-8"), {
    fileName: sourceFilePath,
  });
};

const targetBindingTypesMatch = (left: string, right: string): boolean =>
  externalSurfaceTypesMatch(left, right);

const resolveImportForContext = (
  importSpecifier: string,
  containingFile: string,
  ctx: ProgramContext
) =>
  resolveImport(importSpecifier, containingFile, ctx.sourceRoot, {
    externalResolver: ctx.externalResolver,
    bindings: ctx.bindings,
    projectRoot: ctx.projectRoot,
    surface: ctx.surface,
    authoritativeTsonicPackageRoots: ctx.authoritativeTsonicPackageRoots,
    declarationModuleAliases: ctx.declarationModuleAliases,
  });

const resolveReferencedClassDeclaration = (
  expression: TstsNode,
  ctx: ProgramContext
): TstsNode | undefined => {
  const symbol = ctx.sourceSemantics.getSymbol(expression);
  if (!symbol) {
    return undefined;
  }

  const declaration = ctx.sourceSemantics
    .getSymbolDeclarations(symbol)
    .find((candidate) =>
      candidate.Kind === TstsSyntax.KindClassDeclaration
    );
  return declaration?.Kind === TstsSyntax.KindClassDeclaration
    ? declaration
    : undefined;
};

const getDeclarationTypeNode = (declaration: TstsNode): TstsNode | undefined =>
  declaration.Kind === TstsSyntax.KindVariableDeclaration ||
  declaration.Kind === TstsSyntax.KindPropertySignature ||
  declaration.Kind === TstsSyntax.KindPropertyDeclaration
    ? TstsSyntax.Node_Type(declaration)
    : undefined;

const readEntityNameText = (name: TstsNode): string => {
  if (name.Kind === TstsSyntax.KindIdentifier) {
    return getTstsIdentifierText(name) ?? "";
  }
  if (name.Kind === TstsSyntax.KindQualifiedName) {
    const qualifiedName = TstsSyntax.AsQualifiedName(name);
    if (!qualifiedName?.Left || !qualifiedName.Right) return "";
    return `${readEntityNameText(qualifiedName.Left)}.${getTstsIdentifierText(qualifiedName.Right) ?? ""}`;
  }
  if (name.Kind === TstsSyntax.KindPropertyAccessExpression) {
    const propertyAccess = TstsSyntax.AsPropertyAccessExpression(name);
    if (!propertyAccess?.Expression) return "";
    return `${readEntityNameText(propertyAccess.Expression)}.${getTstsIdentifierText(propertyAccess.name) ?? ""}`;
  }
  return name.Kind === TstsSyntax.KindStringLiteral
    ? (getTstsIdentifierText(name) ?? TstsSyntax.Node_Text(name))
    : (getTstsNodeText(name) ?? "");
};

const extractImportTypeTarget = (
  declaration: TstsNode,
  ctx: ProgramContext
): { readonly specifier: string; readonly exportName: string } | undefined => {
  const typeNode = getDeclarationTypeNode(declaration);
  if (!typeNode) {
    return undefined;
  }

  const importType =
    typeNode.Kind === TstsSyntax.KindImportType
      ? TstsSyntax.AsImportTypeNode(typeNode)
      : undefined;
  if (importType?.IsTypeOf) {
    const argument = importType.Argument;
    const literalType =
      argument?.Kind === TstsSyntax.KindLiteralType
        ? TstsSyntax.AsLiteralTypeNode(argument)
        : undefined;
    const literal =
      argument?.Kind === TstsSyntax.KindLiteralType &&
      literalType?.Literal?.Kind === TstsSyntax.KindStringLiteral
        ? literalType.Literal
        : undefined;
    if (!literal) {
      return undefined;
    }

    const exportName = importType.Qualifier
      ? readEntityNameText(importType.Qualifier).trim()
      : undefined;
    if (!exportName) {
      return undefined;
    }

    return {
      specifier: TstsSyntax.Node_Text(literal),
      exportName,
    };
  }

  if (typeNode.Kind !== TstsSyntax.KindTypeQuery) {
    return undefined;
  }

  const exprName = TstsSyntax.AsTypeQueryNode(typeNode)?.ExprName;
  if (!exprName) return undefined;
  const rootIdentifier =
    exprName.Kind === TstsSyntax.KindIdentifier
      ? exprName
      : exprName.Kind === TstsSyntax.KindQualifiedName
        ? TstsSyntax.AsQualifiedName(exprName)?.Left
        : undefined;
  if (!rootIdentifier || rootIdentifier.Kind !== TstsSyntax.KindIdentifier) {
    return undefined;
  }

  const sourceFile = getTstsContainingSourceFile(declaration);
  if (!sourceFile) return undefined;
  const rootIdentifierName = getTstsIdentifierText(rootIdentifier);
  if (!rootIdentifierName) {
    return undefined;
  }

  const importBinding = ctx.moduleGraph.getImportBinding(
    sourceFile,
    rootIdentifierName
  );
  if (!importBinding || importBinding.kind !== "named") {
    return undefined;
  }

  const importModule = ctx.moduleGraph
    .getImports(sourceFile)
    .find((candidate) =>
      candidate.bindings.some((binding) => binding === importBinding)
    );
  if (!importModule) {
    return undefined;
  }

  return {
    specifier: importModule.specifier,
    exportName: importBinding.importedName,
  };
};

const collectTopLevelClassDeclarations = (
  sourceFile: TstsSourceFile
): ReadonlyMap<string, TstsNode> => {
  const classes = new Map<string, TstsNode>();
  for (const statement of statementNodesOf(sourceFile)) {
    if (statement.Kind === TstsSyntax.KindClassDeclaration) {
      const name = getTstsIdentifierText(TstsSyntax.Node_Name(statement));
      if (name) classes.set(name, statement);
    }
  }
  return classes;
};

const resolveSourceBackedConstructedClassDeclaration = (opts: {
  readonly sourceNode: TstsNode;
  readonly constructorExpression?: TstsNode;
  readonly callee: IrNewExpression["callee"];
  readonly ctx: ProgramContext;
}): TstsNode | undefined => {
  const { sourceNode, constructorExpression, callee, ctx } = opts;
  if (constructorExpression) {
    const referencedClass = resolveReferencedClassDeclaration(
      constructorExpression,
      ctx
    );
    if (referencedClass && !isTstsDeclarationFileNode(referencedClass)) {
      return referencedClass;
    }
  }

  const constructorSymbol = constructorExpression
    ? ctx.sourceSemantics.getSymbol(constructorExpression)
    : undefined;
  if (constructorSymbol) {
    for (const declaration of ctx.sourceSemantics.getSymbolDeclarations(
      constructorSymbol
    )) {
      const target = extractImportTypeTarget(declaration, ctx);
      if (!target) {
        continue;
      }

      const resolved = resolveImportForContext(
        target.specifier,
        getTstsContainingSourceFileName(declaration) ?? ctx.sourceRoot,
        ctx
      );
      if (!resolved.ok || !resolved.value.resolvedPath) {
        continue;
      }

      const sourceFile = getSourceFileForPath(resolved.value.resolvedPath, ctx);
      if (!sourceFile || sourceFile.IsDeclarationFile) {
        continue;
      }

      const ambientTargetClass = collectTopLevelClassDeclarations(
        sourceFile
      ).get(target.exportName.split(".").pop() ?? target.exportName);
      if (ambientTargetClass) {
        return ambientTargetClass;
      }
    }
  }

  if (
    callee.kind !== "identifier" ||
    !callee.providerOwnerIdentity ||
    !callee.providerQualifiedName
  ) {
    return undefined;
  }

  const binding = ctx.bindings.getExactBindingByKind(callee.name, "global");
  if (
    !binding ||
    binding.ownerIdentity !== callee.providerOwnerIdentity ||
    !targetBindingTypesMatch(binding.type, callee.providerQualifiedName) ||
    !binding.sourceImport
  ) {
    return undefined;
  }

  const resolved = resolveImportForContext(
    binding.sourceImport,
    getTstsContainingSourceFileName(sourceNode) ?? ctx.sourceRoot,
    ctx
  );
  if (!resolved.ok || !resolved.value.resolvedPath) {
    return undefined;
  }

  const sourceFile = getSourceFileForPath(resolved.value.resolvedPath, ctx);
  if (!sourceFile || sourceFile.IsDeclarationFile) {
    return undefined;
  }

  return collectTopLevelClassDeclarations(sourceFile).get(callee.name);
};

export const buildSourceBackedConstructorParameterTypes = (opts: {
  readonly sourceNode: TstsNode;
  readonly constructorExpression?: TstsNode;
  readonly callee: IrNewExpression["callee"];
  readonly constructedType: IrType | undefined;
  readonly argumentCount: number;
  readonly actualArgTypes: readonly (IrType | undefined)[];
  readonly ctx: ProgramContext;
}): SourceBackedConstructorParameterTypes | undefined => {
  const {
    sourceNode,
    constructorExpression,
    callee,
    constructedType,
    argumentCount,
    actualArgTypes,
    ctx,
  } = opts;
  const ownerClass = resolveSourceBackedConstructedClassDeclaration({
    sourceNode,
    constructorExpression,
    callee,
    ctx,
  });
  if (!ownerClass) {
    return undefined;
  }

  const declaration = definedNodes(TstsSyntax.Node_Members(ownerClass)).find(
    (member) => member.Kind === TstsSyntax.KindConstructor
  );
  if (!declaration || declaration.Kind !== TstsSyntax.KindConstructor) {
    return {
      parameterTypes: [],
      surfaceParameterTypes: [],
      restParameter: undefined,
    };
  }

  const ownerTypeParameterNames =
    definedNodes(TstsSyntax.Node_TypeParameters(ownerClass)).flatMap((parameter) => {
      const name = getTstsIdentifierText(TstsSyntax.Node_Name(parameter));
      return name ? [name] : [];
    });
  const ownerSubstitution =
    constructedType?.kind === "referenceType" &&
    constructedType.typeArguments?.length === ownerTypeParameterNames.length &&
    ownerTypeParameterNames.length > 0
      ? new Map(
          ownerTypeParameterNames.flatMap((name, index) => {
            const typeArgument = constructedType.typeArguments?.[index];
            return name && typeArgument ? [[name, typeArgument] as const] : [];
          })
        )
      : undefined;

  const parameters = definedNodes(TstsSyntax.Node_Parameters(declaration));
  const declaredParameterTypes = parameters.map((parameter) => {
    const declaredTypeNode = TstsSyntax.Node_Type(parameter);
    const declaredType = declaredTypeNode
      ? ctx.typeSystem.typeFromSyntax(
          ctx.binding.captureTypeSyntax(declaredTypeNode)
        )
      : ({ kind: "unknownType" } as const);
    const specializedType =
      ownerSubstitution && ownerSubstitution.size > 0
        ? (substituteTypeParameters(declaredType, ownerSubstitution) ??
          declaredType)
        : declaredType;
    return TstsSyntax.Node_QuestionToken(parameter)
      ? addUndefinedToType(specializedType)
      : specializedType;
  });

  const expandedDeclaredParameterTypes = expandParameterTypesForArguments(
    parameters.map((parameter) => ({
      isRest:
        TstsSyntax.AsParameterDeclaration(parameter)?.DotDotDotToken !== undefined,
    })),
    declaredParameterTypes,
    argumentCount
  );
  const surfaceParameterTypes = expandedDeclaredParameterTypes;
  const selectionParameterTypes = surfaceParameterTypes.map(
    (parameterType) =>
      expandAuthoritativeSourceBackedSurfaceType(
        parameterType,
        ctx,
        new Set(),
        {
          preserveCarrierIdentity: false,
        }
      ) ?? parameterType
  );

  return {
    parameterTypes: selectionParameterTypes.map((parameterType, index) =>
      selectDeterministicSourceBackedParameterType(
        parameterType,
        actualArgTypes[index],
        ctx
      )
    ),
    surfaceParameterTypes,
    restParameter: buildResolvedRestParameter(
      parameters.map((parameter) => ({
        isRest:
          TstsSyntax.AsParameterDeclaration(parameter)?.DotDotDotToken !==
          undefined,
      })),
      surfaceParameterTypes
    ),
  };
};
