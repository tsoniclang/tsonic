import * as fs from "node:fs";
import type { TstsNode, TstsSymbol } from "@tsonic/tsts";
import { getTstsContainingSourceFileName } from "@tsonic/tsts";
import type { TstsFrontendSourceSemanticView } from "../source-frontend/index.js";
import * as path from "node:path";
import {
  CORE_PACKAGE_NAME,
  GLOBALS_PACKAGE_NAME,
  type CoreModule,
  coreDeclarationFileBaseName,
} from "../source-frontend/core-module-identity.js";
import { getSourcePrimitiveNames } from "../source-frontend/source-primitive-taxonomy.js";

export const CORE_TYPES_TYPE_NAMES = new Set([
  ...getSourcePrimitiveNames(),
  "half",
  "int128",
  "uint128",
  "ptr",
  "out",
  "ref",
  "inref",
  "struct",
]);

export const CORE_LANG_TYPE_NAMES = new Set(["thisarg", "field", "Interface"]);

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
    if (fs.existsSync(pkgPath)) {
      try {
        const raw = fs.readFileSync(pkgPath, "utf8");
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
  return isDeclarationFileFromPackage(
    fileName,
    CORE_PACKAGE_NAME,
    coreDeclarationFileBaseName(module)
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
  sourceSemantics: TstsFrontendSourceSemanticView,
  symbol: TstsSymbol | undefined
): TstsSymbol | undefined => {
  if (!symbol) return undefined;
  return sourceSemantics.resolveAlias(symbol);
};

const symbolDeclarationFileNames = (
  sourceSemantics: TstsFrontendSourceSemanticView,
  symbol: TstsSymbol
): readonly string[] =>
  sourceSemantics
    .getSymbolDeclarations(symbol)
    .map(getTstsContainingSourceFileName)
    .filter((fileName): fileName is string => fileName !== undefined);

export const isSymbolFromCore = (
  sourceSemantics: TstsFrontendSourceSemanticView,
  symbol: TstsSymbol | undefined,
  module: CoreModule
): boolean => {
  const resolved = resolveAliasedSymbol(sourceSemantics, symbol);
  if (!resolved) return false;

  return symbolDeclarationFileNames(sourceSemantics, resolved).some((fileName) =>
    isCoreDeclarationFile(fileName, module)
  );
};

export const isSymbolFromPackage = (
  sourceSemantics: TstsFrontendSourceSemanticView,
  symbol: TstsSymbol | undefined,
  packageName: string,
  expectedBase?: string
): boolean => {
  const resolved = resolveAliasedSymbol(sourceSemantics, symbol);
  if (!resolved) return false;

  return symbolDeclarationFileNames(sourceSemantics, resolved).some((fileName) =>
    isDeclarationFileFromPackage(
      fileName,
      packageName,
      expectedBase
    )
  );
};

export const isSymbolFromGlobals = (
  sourceSemantics: TstsFrontendSourceSemanticView,
  symbol: TstsSymbol | undefined
): boolean => {
  const resolved = resolveAliasedSymbol(sourceSemantics, symbol);
  if (!resolved) return false;

  return symbolDeclarationFileNames(sourceSemantics, resolved).some((fileName) =>
    isGlobalsDeclarationFile(fileName)
  );
};

export const isIdentifierFromCore = (
  sourceSemantics: TstsFrontendSourceSemanticView,
  node: TstsNode,
  module: CoreModule
): boolean =>
  isSymbolFromCore(sourceSemantics, sourceSemantics.getSymbol(node), module);

export const isIdentifierFromPackage = (
  sourceSemantics: TstsFrontendSourceSemanticView,
  node: TstsNode,
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
  sourceSemantics: TstsFrontendSourceSemanticView,
  node: TstsNode
): boolean =>
  isSymbolFromGlobals(sourceSemantics, sourceSemantics.getSymbol(node));
