import * as ts from "typescript";
import { getClassNameFromPath } from "../../../resolver/naming.js";
import { resolveImport } from "../../../resolver.js";
import type { ProgramContext } from "../../program-context.js";
import { resolveSourceFileNamespace } from "../../../program/source-file-identity.js";

const normalizeFilePath = (filePath: string): string =>
  filePath.replace(/\\/g, "/");

const getDeclarationTypeNode = (
  declaration: ts.Declaration
): ts.TypeNode | undefined => {
  if (ts.isVariableDeclaration(declaration)) {
    return declaration.type;
  }
  if (ts.isPropertySignature(declaration) || ts.isPropertyDeclaration(declaration)) {
    return declaration.type;
  }
  return undefined;
};

const readEntityNameText = (name: ts.Node): string => {
  if (ts.isIdentifier(name)) {
    return name.text;
  }
  if (ts.isQualifiedName(name)) {
    return `${readEntityNameText(name.left)}.${name.right.text}`;
  }
  if (ts.isPropertyAccessExpression(name)) {
    return `${readEntityNameText(name.expression)}.${name.name.text}`;
  }
  return ts.isStringLiteral(name) ? name.text : name.getText();
};

const extractImportTypeTarget = (
  declaration: ts.Declaration
): { readonly specifier: string; readonly exportName: string } | undefined => {
  const typeNode = getDeclarationTypeNode(declaration);
  if (!typeNode || !ts.isImportTypeNode(typeNode) || !typeNode.isTypeOf) {
    return undefined;
  }

  const literal =
    ts.isLiteralTypeNode(typeNode.argument) &&
    ts.isStringLiteral(typeNode.argument.literal)
      ? typeNode.argument.literal
      : undefined;
  if (!literal) {
    return undefined;
  }

  const exportName = typeNode.qualifier
    ? readEntityNameText(typeNode.qualifier).trim()
    : undefined;
  if (!exportName) {
    return undefined;
  }

  return {
    specifier: literal.text,
    exportName,
  };
};

const resolveTopLevelLocalOwner = (
  sourceFile: ts.SourceFile,
  localName: string,
  ctx: ProgramContext
): string | undefined => {
  const namespace = resolveSourceFileNamespace(
    sourceFile.fileName,
    ctx.sourceRoot,
    ctx.rootNamespace
  );
  const fileClass = getClassNameFromPath(sourceFile.fileName);

  for (const statement of sourceFile.statements) {
    if (
      (ts.isClassDeclaration(statement) || ts.isEnumDeclaration(statement)) &&
      statement.name?.text === localName
    ) {
      return `${namespace}.${localName}`;
    }

    if (ts.isFunctionDeclaration(statement) && statement.name?.text === localName) {
      return `${namespace}.${fileClass}.${localName}`;
    }

    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.name.text === localName) {
          return `${namespace}.${fileClass}.${localName}`;
        }
      }
    }
  }

  return undefined;
};

const resolveExportOwnerFromSourceFile = (
  sourceFile: ts.SourceFile,
  exportName: string,
  ctx: ProgramContext,
  visited: Set<string>
): string | undefined => {
  const visitKey = `${normalizeFilePath(sourceFile.fileName)}::${exportName}`;
  if (visited.has(visitKey)) {
    return undefined;
  }
  visited.add(visitKey);

  for (const statement of sourceFile.statements) {
    if (
      (ts.isClassDeclaration(statement) ||
        ts.isEnumDeclaration(statement) ||
        ts.isFunctionDeclaration(statement)) &&
      statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) &&
      statement.name?.text === exportName
    ) {
      return resolveTopLevelLocalOwner(sourceFile, exportName, ctx);
    }

    if (
      ts.isVariableStatement(statement) &&
      statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
    ) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.name.text === exportName) {
          return resolveTopLevelLocalOwner(sourceFile, exportName, ctx);
        }
      }
    }

    if (!ts.isExportDeclaration(statement) || !statement.exportClause) {
      continue;
    }

    if (!ts.isNamedExports(statement.exportClause)) {
      continue;
    }

    for (const element of statement.exportClause.elements) {
      if (element.name.text !== exportName) {
        continue;
      }

      const targetName = element.propertyName?.text ?? element.name.text;
      if (!statement.moduleSpecifier || !ts.isStringLiteral(statement.moduleSpecifier)) {
        return resolveTopLevelLocalOwner(sourceFile, targetName, ctx);
      }

      const redirected = resolveImport(
        statement.moduleSpecifier.text,
        sourceFile.fileName,
        ctx.sourceRoot,
        {
          clrResolver: ctx.clrResolver,
          bindings: ctx.bindings,
          projectRoot: ctx.projectRoot,
          surface: ctx.surface,
          authoritativeTsonicPackageRoots: ctx.authoritativeTsonicPackageRoots,
          declarationModuleAliases: ctx.declarationModuleAliases,
        }
      );
      if (!redirected.ok || !redirected.value.resolvedPath) {
        return undefined;
      }

      const redirectedSourceFile = ctx.sourceFilesByPath.get(
        normalizeFilePath(redirected.value.resolvedPath)
      );
      if (!redirectedSourceFile || redirectedSourceFile.isDeclarationFile) {
        return undefined;
      }

      return resolveExportOwnerFromSourceFile(
        redirectedSourceFile,
        targetName,
        ctx,
        visited
      );
    }
  }

  return undefined;
};

export const resolveAmbientGlobalSourceOwner = (
  declarations: readonly ts.Declaration[],
  ctx: ProgramContext
): string | undefined => {
  for (const declaration of declarations) {
    const target = extractImportTypeTarget(declaration);
    if (!target) {
      continue;
    }

    const resolved = resolveImport(
      target.specifier,
      declaration.getSourceFile().fileName,
      ctx.sourceRoot,
      {
        clrResolver: ctx.clrResolver,
        bindings: ctx.bindings,
        projectRoot: ctx.projectRoot,
        surface: ctx.surface,
        authoritativeTsonicPackageRoots: ctx.authoritativeTsonicPackageRoots,
        declarationModuleAliases: ctx.declarationModuleAliases,
      }
    );
    if (!resolved.ok || !resolved.value.resolvedPath) {
      continue;
    }

    const targetSourceFile = ctx.sourceFilesByPath.get(
      normalizeFilePath(resolved.value.resolvedPath)
    );
    if (!targetSourceFile || targetSourceFile.isDeclarationFile) {
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

  return undefined;
};

export const resolveAmbientGlobalSourceOwnerByName = (
  name: string,
  location: ts.Node,
  ctx: ProgramContext,
  meaning: ts.SymbolFlags = ts.SymbolFlags.Value
): string | undefined => {
  const symbols = ctx.checker.getSymbolsInScope(location, meaning);
  const symbol = symbols.find((candidate) => candidate.name === name);
  if (!symbol) {
    return undefined;
  }

  return resolveAmbientGlobalSourceOwner(symbol.getDeclarations() ?? [], ctx);
};
