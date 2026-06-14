/**
 * Core intrinsic provenance validation
 *
 * Airplane-grade rule: Intrinsics (core numeric types, ptr/out/ref wrappers, and
 * language intrinsics like stackalloc/trycast/thisarg) must come from @tsonic/core.
 *
 * If a project defines or imports a same-named symbol from somewhere else, it must
 * NOT be treated as an intrinsic. We enforce this as a hard error to avoid
 * silent miscompilation.
 */

import type { TstsNode, TstsSourceFile, TstsSymbol } from "@tsonic/tsts";
import {
  forEachTstsChild,
  getTstsContainingSourceFile,
  getTstsContainingSourceFileName,
  getTstsTypeArguments,
  TstsSyntax,
} from "@tsonic/tsts";
import * as fs from "node:fs";
import * as path from "node:path";
import { TsonicProgram } from "../program.js";
import {
  DiagnosticsCollector,
  addDiagnostic,
  createDiagnostic,
} from "../types/diagnostic.js";
import { getNodeLocation } from "./helpers.js";
import {
  CORE_PACKAGE_NAME,
  type CoreModule,
  canonicalCoreModuleSpecifier,
  coreDeclarationFileBaseName,
} from "../source-frontend/core-module-identity.js";
import { getSourcePrimitiveNames } from "../source-frontend/source-primitive-taxonomy.js";
import { identifierText } from "./tsts-helpers.js";

const CORE_TYPES_TYPE_NAMES = new Set([
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

const CORE_LANG_TYPE_NAMES = new Set(["thisarg", "field", "Interface"]);

const CORE_LANG_VALUE_NAMES = new Set([
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

const isCoreDeclarationFile = (
  fileName: string,
  module: CoreModule
): boolean =>
  path.basename(fileName) === coreDeclarationFileBaseName(module) &&
  readNearestPackageName(fileName) === CORE_PACKAGE_NAME;

const isCanonicalCoreModuleFile = (
  fileName: string,
  module: CoreModule
): boolean => {
  if (readNearestPackageName(fileName) !== CORE_PACKAGE_NAME) {
    return false;
  }

  const baseName = path.basename(fileName);
  const moduleStem = module === "types" ? "types" : "lang";
  return (
    baseName === `${moduleStem}.ts` ||
    baseName === `${moduleStem}.tsx` ||
    baseName === `${moduleStem}.d.ts` ||
    baseName === `${moduleStem}.js`
  );
};

const coreModuleStem = (module: CoreModule): string =>
  module === "types" ? "types" : "lang";

const isCanonicalCoreResolvedModule = (
  resolvedModule:
    | {
        readonly packageName?: string | undefined;
        readonly packageSubmoduleName?: string | undefined;
        readonly resolvedFileName?: string | undefined;
      }
    | undefined,
  module: CoreModule
): boolean => {
  if (!resolvedModule || resolvedModule.packageName !== CORE_PACKAGE_NAME) {
    return false;
  }

  const moduleStem = coreModuleStem(module);
  const submoduleName = resolvedModule.packageSubmoduleName
    ? path.basename(resolvedModule.packageSubmoduleName)
    : undefined;
  const resolvedBaseName = resolvedModule.resolvedFileName
    ? path.basename(resolvedModule.resolvedFileName)
    : undefined;
  return [submoduleName, resolvedBaseName].some(
    (name) =>
      name === `${moduleStem}.ts` ||
      name === `${moduleStem}.tsx` ||
      name === `${moduleStem}.d.ts` ||
      name === `${moduleStem}.js` ||
      name === `${moduleStem}.js.d.ts`
  );
};

const isNodeInsideCanonicalCoreModule = (
  node: TstsNode,
  module: CoreModule
): boolean => {
  const fileName = getTstsContainingSourceFileName(node);
  return fileName ? isCanonicalCoreModuleFile(fileName, module) : false;
};

const getRightmostTypeNameIdentifier = (
  typeName: TstsNode | undefined
): TstsNode | undefined => {
  if (typeName?.Kind === TstsSyntax.KindIdentifier) return typeName;
  if (typeName?.Kind === TstsSyntax.KindQualifiedName) {
    return TstsSyntax.AsQualifiedName(typeName)?.Right;
  }
  return undefined;
};

const isSymbolFromCore = (
  program: TsonicProgram,
  symbol: TstsSymbol | undefined,
  module: CoreModule
): boolean => {
  const resolved = symbol ? program.sourceSemantics.resolveAlias(symbol) : undefined;
  if (!resolved) return false;

  return program.sourceSemantics
    .getSymbolDeclarations(resolved)
    .some((declaration) => {
      const fileName = getTstsContainingSourceFileName(declaration);
      return fileName ? isCoreDeclarationFile(fileName, module) : false;
    });
};

const isImportedFromCore = (
  program: TsonicProgram,
  node: TstsNode,
  name: string,
  module: CoreModule
): boolean => {
  const sourceFile = getTstsContainingSourceFile(node);
  if (!sourceFile) {
    return false;
  }

  const importBinding = program.sourceProgram.moduleGraph.getImportBinding(
    sourceFile,
    name
  );
  if (!importBinding || importBinding.importedName !== name) {
    return false;
  }

  return program.sourceProgram.moduleGraph
    .getImports(sourceFile)
    .some(
      (importModule) =>
        importModule.bindings.includes(importBinding) &&
        isCanonicalCoreResolvedModule(importModule.resolvedModule, module)
    );
};

const isCoreUse = (
  program: TsonicProgram,
  node: TstsNode,
  name: string,
  module: CoreModule
): boolean => {
  const symbol = program.sourceSemantics.getSymbol(node);
  return (
    isSymbolFromCore(program, symbol, module) ||
    isImportedFromCore(program, node, name, module)
  );
};

const isCoreLangTypeWrapperUse = (name: string, node: TstsNode): boolean => {
  if (name === "Interface") {
    return getTstsTypeArguments(node).length === 1;
  }

  return CORE_LANG_TYPE_NAMES.has(name);
};

export const validateCoreIntrinsics = (
  sourceFile: TstsSourceFile,
  program: TsonicProgram,
  collector: DiagnosticsCollector
): DiagnosticsCollector => {
  const report = (
    acc: DiagnosticsCollector,
    node: TstsNode,
    name: string,
    module: CoreModule,
    hint: string
  ): DiagnosticsCollector =>
    addDiagnostic(
      acc,
      createDiagnostic(
        "TSN7440",
        "error",
        `Core intrinsic '${name}' must resolve to ${CORE_PACKAGE_NAME}/${module}.js`,
        getNodeLocation(sourceFile, node),
        hint
      )
    );

  const visitor = (
    node: TstsNode | undefined,
    acc: DiagnosticsCollector
  ): DiagnosticsCollector => {
    if (!node) return acc;
    let current = acc;

    if (
      node.Kind === TstsSyntax.KindTypeAliasDeclaration ||
      node.Kind === TstsSyntax.KindInterfaceDeclaration ||
      node.Kind === TstsSyntax.KindClassDeclaration ||
      node.Kind === TstsSyntax.KindEnumDeclaration
    ) {
      const nameNode = TstsSyntax.Node_Name(node);
      const name = identifierText(nameNode);
      if (nameNode && name && CORE_TYPES_TYPE_NAMES.has(name)) {
        if (!isNodeInsideCanonicalCoreModule(nameNode, "types")) {
          current = report(
            current,
            nameNode,
            name,
            "types",
            `Remove this declaration and import '${name}' from "${canonicalCoreModuleSpecifier(
              "types"
            )}".`
          );
        }
      }
      if (
        nameNode &&
        name &&
        CORE_LANG_TYPE_NAMES.has(name) &&
        name !== "Interface"
      ) {
        if (!isNodeInsideCanonicalCoreModule(nameNode, "lang")) {
          current = report(
            current,
            nameNode,
            name,
            "lang",
            `Remove this declaration and import '${name}' from "${canonicalCoreModuleSpecifier(
              "lang"
            )}".`
          );
        }
      }
    }

    if (node.Kind === TstsSyntax.KindFunctionDeclaration) {
      const nameNode = TstsSyntax.Node_Name(node);
      const name = identifierText(nameNode);
      if (nameNode && name && CORE_LANG_VALUE_NAMES.has(name)) {
        if (!isNodeInsideCanonicalCoreModule(nameNode, "lang")) {
          current = report(
            current,
            nameNode,
            name,
            "lang",
            `Remove this declaration and import '${name}' from "${canonicalCoreModuleSpecifier(
              "lang"
            )}".`
          );
        }
      }
    }

    if (node.Kind === TstsSyntax.KindTypeReference) {
      const typeName = TstsSyntax.AsTypeReferenceNode(node)?.TypeName;
      const nameNode = getRightmostTypeNameIdentifier(typeName);
      const name = identifierText(nameNode);
      if (nameNode && name && CORE_TYPES_TYPE_NAMES.has(name)) {
        if (!isCoreUse(program, nameNode, name, "types")) {
          current = report(
            current,
            nameNode,
            name,
            "types",
            `Import '${name}' from "${canonicalCoreModuleSpecifier(
              "types"
            )}" (do not redefine or spoof it).`
          );
        }
      }
      if (nameNode && name && isCoreLangTypeWrapperUse(name, node)) {
        if (!isCoreUse(program, nameNode, name, "lang")) {
          current = report(
            current,
            nameNode,
            name,
            "lang",
            `Import '${name}' from "${canonicalCoreModuleSpecifier(
              "lang"
            )}" (do not redefine or spoof it).`
          );
        }
      }
    }

    if (node.Kind === TstsSyntax.KindExpressionWithTypeArguments) {
      const expression = TstsSyntax.Node_Expression(node);
      const name = identifierText(expression);
      if (expression && name && isCoreLangTypeWrapperUse(name, node)) {
        if (!isCoreUse(program, expression, name, "lang")) {
          current = report(
            current,
            expression,
            name,
            "lang",
            `Import '${name}' from "${canonicalCoreModuleSpecifier(
              "lang"
            )}" (do not redefine or spoof it).`
          );
        }
      }
    }

    if (node.Kind === TstsSyntax.KindCallExpression) {
      const expression = TstsSyntax.AsCallExpression(node)?.Expression;
      const name = identifierText(expression);
      if (expression && name && CORE_LANG_VALUE_NAMES.has(name)) {
        if (!isCoreUse(program, expression, name, "lang")) {
          current = report(
            current,
            expression,
            name,
            "lang",
            `Import '${name}' from "${canonicalCoreModuleSpecifier(
              "lang"
            )}" (do not redefine or spoof it).`
          );
        }
      }
    }

    forEachTstsChild(node, (child) => {
      current = visitor(child, current);
    });
    return current;
  };

  return visitor(sourceFile, collector);
};
