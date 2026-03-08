import * as ts from "typescript";

const isDynamicImportCall = (node: ts.CallExpression): boolean =>
  node.expression.kind === ts.SyntaxKind.ImportKeyword;

export const getDynamicImportLiteralSpecifier = (
  node: ts.CallExpression
): string | undefined => {
  if (!isDynamicImportCall(node)) return undefined;
  if (node.arguments.length !== 1) return undefined;
  const [arg] = node.arguments;
  return arg && ts.isStringLiteral(arg) ? arg.text : undefined;
};

export const isClosedWorldDynamicImportSpecifier = (
  specifier: string
): boolean => specifier.startsWith("./") || specifier.startsWith("../");

export const isSideEffectOnlyDynamicImport = (
  node: ts.CallExpression
): boolean => {
  const parent = node.parent;
  return (
    ts.isAwaitExpression(parent) &&
    parent.expression === node &&
    ts.isExpressionStatement(parent.parent)
  );
};

export type DynamicImportSite = {
  readonly node: ts.CallExpression;
  readonly specifier: string;
};

export type DynamicImportNamespaceEntry = {
  readonly exportName: string;
  readonly ownerFilePath: string;
  readonly memberName: string;
  readonly memberKind: "function" | "variable";
  readonly declarationName: ts.Identifier;
};

export type DynamicImportNamespaceResolution =
  | {
      readonly ok: true;
      readonly specifier: string;
      readonly resolvedFilePath: string;
      readonly entries: readonly DynamicImportNamespaceEntry[];
    }
  | {
      readonly ok: false;
      readonly reason: string;
    };

type DynamicImportModuleContext = {
  readonly checker: ts.TypeChecker;
  readonly compilerOptions: ts.CompilerOptions;
  readonly sourceFilesByPath: ReadonlyMap<string, ts.SourceFile>;
};

const normalizeFilePath = (filePath: string): string =>
  filePath.replace(/\\/g, "/");

const resolveDynamicImportTargetPath = (
  node: ts.CallExpression,
  containingFile: string,
  compilerOptions: ts.CompilerOptions
): string | undefined => {
  const specifier = getDynamicImportLiteralSpecifier(node);
  if (!specifier || !isClosedWorldDynamicImportSpecifier(specifier)) {
    return undefined;
  }

  const resolved = ts.resolveModuleName(
    specifier,
    containingFile,
    compilerOptions,
    ts.sys
  );

  const targetPath = resolved.resolvedModule?.resolvedFileName;
  if (!targetPath || targetPath.endsWith(".d.ts")) {
    return undefined;
  }

  return normalizeFilePath(targetPath);
};

const getModuleSymbol = (
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker
): ts.Symbol | undefined => {
  const direct = checker.getSymbolAtLocation(sourceFile);
  if (direct) return direct;

  const withSymbol = sourceFile as ts.SourceFile & { symbol?: ts.Symbol };
  return withSymbol.symbol;
};

const getSupportedValueExportDeclaration = (
  exportSymbol: ts.Symbol,
  checker: ts.TypeChecker,
  sourceFilesByPath: ReadonlyMap<string, ts.SourceFile>
): DynamicImportNamespaceEntry | undefined | null => {
  const actualSymbol =
    exportSymbol.flags & ts.SymbolFlags.Alias
      ? checker.getAliasedSymbol(exportSymbol)
      : exportSymbol;

  if ((actualSymbol.flags & ts.SymbolFlags.Value) === 0) {
    return null;
  }

  for (const declaration of actualSymbol.getDeclarations() ?? []) {
    if (
      ts.isFunctionDeclaration(declaration) &&
      declaration.name &&
      sourceFilesByPath.has(
        normalizeFilePath(declaration.getSourceFile().fileName)
      )
    ) {
      return {
        exportName: exportSymbol.getName(),
        ownerFilePath: normalizeFilePath(declaration.getSourceFile().fileName),
        memberName: declaration.name.text,
        memberKind: "function",
        declarationName: declaration.name,
      };
    }

    if (
      ts.isVariableDeclaration(declaration) &&
      ts.isIdentifier(declaration.name) &&
      sourceFilesByPath.has(
        normalizeFilePath(declaration.getSourceFile().fileName)
      )
    ) {
      return {
        exportName: exportSymbol.getName(),
        ownerFilePath: normalizeFilePath(declaration.getSourceFile().fileName),
        memberName: declaration.name.text,
        memberKind: "variable",
        declarationName: declaration.name,
      };
    }
  }

  return undefined;
};

export const resolveDynamicImportNamespace = (
  node: ts.CallExpression,
  containingFile: string,
  ctx: DynamicImportModuleContext
): DynamicImportNamespaceResolution => {
  const specifier = getDynamicImportLiteralSpecifier(node);
  if (!specifier) {
    return {
      ok: false,
      reason: "Dynamic import specifier must be a string literal.",
    };
  }

  if (!isClosedWorldDynamicImportSpecifier(specifier)) {
    return {
      ok: false,
      reason:
        "Dynamic import is only supported for closed-world local specifiers ('./' or '../').",
    };
  }

  const resolvedFilePath = resolveDynamicImportTargetPath(
    node,
    containingFile,
    ctx.compilerOptions
  );
  if (!resolvedFilePath) {
    return {
      ok: false,
      reason:
        "Dynamic import target could not be resolved to a local TypeScript source file.",
    };
  }

  const targetSourceFile = ctx.sourceFilesByPath.get(resolvedFilePath);
  if (!targetSourceFile) {
    return {
      ok: false,
      reason:
        "Dynamic import target is not part of the current closed-world source graph.",
    };
  }

  const moduleSymbol = getModuleSymbol(targetSourceFile, ctx.checker);
  if (!moduleSymbol) {
    return {
      ok: false,
      reason:
        "Dynamic import target does not expose a module symbol for deterministic export analysis.",
    };
  }

  const exportSymbols = [...ctx.checker.getExportsOfModule(moduleSymbol)].sort(
    (left, right) => left.getName().localeCompare(right.getName())
  );

  const entries: DynamicImportNamespaceEntry[] = [];
  for (const exportSymbol of exportSymbols) {
    const entry = getSupportedValueExportDeclaration(
      exportSymbol,
      ctx.checker,
      ctx.sourceFilesByPath
    );
    if (entry === null) {
      continue;
    }
    if (entry === undefined) {
      return {
        ok: false,
        reason: `Dynamic import namespace for '${specifier}' requires runtime exports to lower to named function/variable members. Unsupported export: '${exportSymbol.getName()}'.`,
      };
    }
    entries.push(entry);
  }

  return {
    ok: true,
    specifier,
    resolvedFilePath,
    entries,
  };
};

export const collectClosedWorldDynamicImportSites = (
  sourceFile: ts.SourceFile
): readonly DynamicImportSite[] => {
  const sites: DynamicImportSite[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const specifier = getDynamicImportLiteralSpecifier(node);
      if (specifier && isClosedWorldDynamicImportSpecifier(specifier)) {
        sites.push({ node, specifier });
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return sites;
};
