import * as ts from "typescript";
import type { FrontendSourceSemanticView } from "../source-frontend/index.js";
import * as path from "node:path";

export type CoreModule = "types" | "lang";

export const CORE_PACKAGE_NAME = "@tsonic/core";
export const GLOBALS_PACKAGE_NAME = "@tsonic/globals";

export const CORE_TYPES_TYPE_NAMES = new Set([
  "sbyte",
  "short",
  "int",
  "long",
  "nint",
  "int128",
  "byte",
  "ushort",
  "uint",
  "ulong",
  "nuint",
  "uint128",
  "half",
  "float",
  "double",
  "decimal",
  "bool",
  "char",
  "ptr",
  "out",
  "ref",
  "inref",
  "struct",
]);

export const CORE_LANG_TYPE_NAMES = new Set(["thisarg", "field"]);

export const CORE_LANG_VALUE_NAMES = new Set([
  "stackalloc",
  "trycast",
  "out",
  "ref",
  "inref",
  "asinterface",
  "istype",
  "nameof",
  "sizeof",
  "defaultof",
]);

const packageNameCache = new Map<string, string | null>();

const readNearestPackageName = (fileName: string): string | undefined => {
  let dir = path.dirname(fileName);

  for (;;) {
    const cached = packageNameCache.get(dir);
    if (cached !== undefined) {
      return cached ?? undefined;
    }

    const pkgPath = path.join(dir, "package.json");
    if (ts.sys.fileExists(pkgPath)) {
      try {
        const raw = ts.sys.readFile(pkgPath);
        if (!raw) {
          packageNameCache.set(dir, null);
          return undefined;
        }
        const parsed = JSON.parse(raw) as { name?: unknown };
        const name = typeof parsed.name === "string" ? parsed.name : undefined;
        packageNameCache.set(dir, name ?? null);
        return name;
      } catch {
        packageNameCache.set(dir, null);
        return undefined;
      }
    }

    const parent = path.dirname(dir);
    if (parent === dir) {
      packageNameCache.set(dir, null);
      return undefined;
    }
    dir = parent;
  }
};

export const isDeclarationFileFromPackage = (
  fileName: string,
  packageName: string,
  expectedBase?: string
): boolean => {
  if (expectedBase && path.basename(fileName) !== expectedBase) {
    return false;
  }
  return readNearestPackageName(fileName) === packageName;
};

export const isCoreDeclarationFile = (
  fileName: string,
  module: CoreModule
): boolean => {
  const expectedBase = module === "types" ? "types.d.ts" : "lang.d.ts";
  return isDeclarationFileFromPackage(
    fileName,
    CORE_PACKAGE_NAME,
    expectedBase
  );
};

export const isGlobalsDeclarationFile = (fileName: string): boolean => {
  return isDeclarationFileFromPackage(
    fileName,
    GLOBALS_PACKAGE_NAME,
    "core-globals.d.ts"
  );
};

export const resolveAliasedSymbol = (
  sourceSemantics: FrontendSourceSemanticView,
  symbol: ts.Symbol | undefined
): ts.Symbol | undefined => {
  if (!symbol) return undefined;
  return symbol.flags & ts.SymbolFlags.Alias
    ? sourceSemantics.getAliasedSymbol(symbol)
    : symbol;
};

export const isSymbolFromCore = (
  sourceSemantics: FrontendSourceSemanticView,
  symbol: ts.Symbol | undefined,
  module: CoreModule
): boolean => {
  const resolved = resolveAliasedSymbol(sourceSemantics, symbol);
  if (!resolved) return false;

  const decls = resolved.getDeclarations?.() ?? [];
  return decls.some((decl) =>
    isCoreDeclarationFile(decl.getSourceFile().fileName, module)
  );
};

export const isSymbolFromPackage = (
  sourceSemantics: FrontendSourceSemanticView,
  symbol: ts.Symbol | undefined,
  packageName: string,
  expectedBase?: string
): boolean => {
  const resolved = resolveAliasedSymbol(sourceSemantics, symbol);
  if (!resolved) return false;

  const decls = resolved.getDeclarations?.() ?? [];
  return decls.some((decl) =>
    isDeclarationFileFromPackage(
      decl.getSourceFile().fileName,
      packageName,
      expectedBase
    )
  );
};

export const isSymbolFromGlobals = (
  sourceSemantics: FrontendSourceSemanticView,
  symbol: ts.Symbol | undefined
): boolean => {
  const resolved = resolveAliasedSymbol(sourceSemantics, symbol);
  if (!resolved) return false;

  const decls = resolved.getDeclarations?.() ?? [];
  return decls.some((decl) =>
    isGlobalsDeclarationFile(decl.getSourceFile().fileName)
  );
};

export const isIdentifierFromCore = (
  sourceSemantics: FrontendSourceSemanticView,
  node: ts.Identifier,
  module: CoreModule
): boolean =>
  isSymbolFromCore(sourceSemantics, sourceSemantics.getSymbol(node), module);

export const isIdentifierFromPackage = (
  sourceSemantics: FrontendSourceSemanticView,
  node: ts.Identifier,
  packageName: string,
  expectedBase?: string
): boolean =>
  isSymbolFromPackage(
    sourceSemantics,
    sourceSemantics.getSymbol(node),
    packageName,
    expectedBase
  );

export const isIdentifierFromGlobals = (
  sourceSemantics: FrontendSourceSemanticView,
  node: ts.Identifier
): boolean =>
  isSymbolFromGlobals(sourceSemantics, sourceSemantics.getSymbol(node));
