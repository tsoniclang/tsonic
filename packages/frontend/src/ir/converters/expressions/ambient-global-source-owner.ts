import {
  getTstsContainingSourceFile,
  getTstsDeclarationKind,
  getTstsDeclaredTypeNode,
  getTstsIdentifierText,
  getTstsNodeNameText,
  getTstsNodeText,
  tstsSymbolMeaningValue,
  TstsSyntax,
  type TstsNode,
  type TstsSourceFile,
} from "@tsonic/tsts";
import { getClassNameFromPath } from "../../../resolver/naming.js";
import { resolveImport } from "../../../resolver.js";
import type { ProgramContext } from "../../program-context.js";
import { resolveSourceFileNamespace } from "../../../program/source-file-identity.js";
import { readSourcePackageMetadata } from "../../../program/source-package-metadata.js";

const normalizeFilePath = (filePath: string): string =>
  filePath.replace(/\\/g, "/");

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

const getAmbientDeclarationName = (
  declaration: TstsNode
): string | undefined => {
  switch (declaration.Kind) {
    case TstsSyntax.KindFunctionDeclaration:
    case TstsSyntax.KindVariableDeclaration:
    case TstsSyntax.KindClassDeclaration:
    case TstsSyntax.KindInterfaceDeclaration:
    case TstsSyntax.KindEnumDeclaration:
      return getTstsIdentifierText(TstsSyntax.Node_Name(declaration));
    default:
      return undefined;
  }
};

const readEntityNameText = (name: TstsNode): string => {
  if (name.Kind === TstsSyntax.KindIdentifier) {
    return getTstsIdentifierText(name) ?? "";
  }
  if (name.Kind === TstsSyntax.KindQualifiedName) {
    const qualified = TstsSyntax.AsQualifiedName(name);
    if (!qualified?.Left || !qualified.Right) return "";
    return `${readEntityNameText(qualified.Left)}.${getTstsIdentifierText(
      qualified.Right
    )}`;
  }
  if (name.Kind === TstsSyntax.KindPropertyAccessExpression) {
    const access = TstsSyntax.AsPropertyAccessExpression(name);
    if (!access?.Expression || !access.name) return "";
    return `${readEntityNameText(access.Expression)}.${getTstsIdentifierText(
      access.name
    )}`;
  }
  return getTstsNodeText(name) ?? "";
};

const extractImportTypeTarget = (
  declaration: TstsNode,
  ctx: ProgramContext
): { readonly specifier: string; readonly exportName: string } | undefined => {
  const typeNode = getTstsDeclaredTypeNode(declaration);
  if (!typeNode) {
    return undefined;
  }

  if (typeNode.Kind === TstsSyntax.KindImportType) {
    const importType = TstsSyntax.AsImportTypeNode(typeNode);
    if (!importType?.IsTypeOf) {
      return undefined;
    }

    const argument = importType.Argument
      ? TstsSyntax.AsLiteralTypeNode(importType.Argument)
      : undefined;
    const literal =
      argument?.Literal?.Kind === TstsSyntax.KindStringLiteral
        ? argument.Literal
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
      specifier: getTstsNodeText(literal) ?? "",
      exportName,
    };
  }

  if (typeNode.Kind !== TstsSyntax.KindTypeQuery) {
    return undefined;
  }

  const exprName = TstsSyntax.AsTypeQueryNode(typeNode)?.ExprName;
  const rootIdentifier =
    exprName?.Kind === TstsSyntax.KindIdentifier
      ? exprName
      : exprName?.Kind === TstsSyntax.KindQualifiedName
        ? TstsSyntax.AsQualifiedName(exprName)?.Left
        : undefined;
  const rootIdentifierName =
    rootIdentifier?.Kind === TstsSyntax.KindIdentifier
      ? getTstsIdentifierText(rootIdentifier)
      : undefined;
  if (!rootIdentifierName) {
    return undefined;
  }

  const sourceFile = getTstsContainingSourceFile(declaration);
  if (!sourceFile) {
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

const resolveDeclarationOwner = (
  sourceFile: TstsSourceFile,
  declaration: TstsNode,
  ctx: ProgramContext
): string | undefined => {
  const namespace = resolveSourceFileNamespace(
    sourceFile.FileName(),
    ctx.sourceRoot,
    ctx.rootNamespace
  );
  const fileClass = getClassNameFromPath(sourceFile.FileName());
  const localName = getTstsNodeNameText(declaration);
  if (!localName) {
    return undefined;
  }

  const declarationKind = getTstsDeclarationKind(declaration);
  return declarationKind === "class" ||
    declarationKind === "enum" ||
    declarationKind === "interface"
    ? `${namespace}.${localName}`
    : `${namespace}.${fileClass}.${localName}`;
};

const resolveExportOwnerFromSourceFile = (
  sourceFile: TstsSourceFile,
  exportName: string,
  ctx: ProgramContext,
  _visited: Set<string>
): string | undefined => {
  const declaration = ctx.sourceSemantics.getExportedDeclaration(
    sourceFile,
    exportName
  );
  if (!declaration) {
    return undefined;
  }
  const declarationSourceFile =
    getTstsContainingSourceFile(declaration) ?? sourceFile;
  return resolveDeclarationOwner(
    declarationSourceFile,
    declaration,
    ctx
  );
};

const resolveAmbientExportOwnerByName = (
  declaration: TstsNode,
  exportName: string,
  ctx: ProgramContext
): string | undefined => {
  const declarationSourceFile = getTstsContainingSourceFile(declaration);
  if (!declarationSourceFile) {
    return undefined;
  }
  const declarationFilePath = normalizeFilePath(declarationSourceFile.FileName());

  const packageMetadata = [...ctx.authoritativeTsonicPackageRoots.values()]
    .map((packageRoot) => readSourcePackageMetadata(packageRoot))
    .find(
      (metadata) =>
        metadata !== null &&
        metadata.ambientPaths.some(
          (ambientPath) =>
            normalizeFilePath(ambientPath) === declarationFilePath
        )
    );

  if (!packageMetadata) {
    return undefined;
  }

  const owners = new Set<string>();
  for (const exportPath of packageMetadata.exportPaths) {
    const sourceFile = ctx.sourceFilesByPath.get(normalizeFilePath(exportPath));
    if (!sourceFile || sourceFile.IsDeclarationFile) {
      continue;
    }

    const owner = resolveExportOwnerFromSourceFile(
      sourceFile,
      exportName,
      ctx,
      new Set()
    );
    if (owner) {
      owners.add(owner);
    }
  }

  if (owners.size !== 1) {
    return undefined;
  }

  return [...owners][0];
};

export const resolveAmbientGlobalSourceOwner = (
  declarations: readonly TstsNode[],
  ctx: ProgramContext
): string | undefined => {
  for (const declaration of declarations) {
    const target = extractImportTypeTarget(declaration, ctx);
    if (!target) {
      continue;
    }

    const resolved = resolveImportForContext(
      target.specifier,
      getTstsContainingSourceFile(declaration)?.FileName() ?? "",
      ctx
    );
    if (!resolved.ok || !resolved.value.resolvedPath) {
      continue;
    }

    const targetSourceFile = ctx.sourceFilesByPath.get(
      normalizeFilePath(resolved.value.resolvedPath)
    );
    if (!targetSourceFile || targetSourceFile.IsDeclarationFile) {
      continue;
    }

    const owner = resolveExportOwnerFromSourceFile(
      targetSourceFile,
      target.exportName,
      ctx,
      new Set()
    );
    if (owner) {
      return owner;
    }
  }

  for (const declaration of declarations) {
    const declarationName = getAmbientDeclarationName(declaration);
    if (!declarationName) {
      continue;
    }

    const owner = resolveAmbientExportOwnerByName(
      declaration,
      declarationName,
      ctx
    );
    if (owner) {
      return owner;
    }
  }

  return undefined;
};

export const resolveAmbientGlobalSourceOwnerByName = (
  name: string,
  location: TstsNode,
  ctx: ProgramContext,
  meaning: number = tstsSymbolMeaningValue
): string | undefined => {
  const symbols = ctx.sourceSemantics.getSymbolsInScope(location, meaning);
  const symbol = symbols.find((candidate) => candidate?.Name === name);
  if (!symbol) {
    return undefined;
  }

  return resolveAmbientGlobalSourceOwner(
    ctx.sourceSemantics.getSymbolDeclarations(symbol),
    ctx
  );
};
