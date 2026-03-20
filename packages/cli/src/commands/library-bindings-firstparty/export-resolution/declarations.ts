import type { IrModule, IrStatement } from "@tsonic/frontend";
import type { Result } from "../../../types.js";
import {
  isRelativeModuleSpecifier,
  normalizeModuleFileKey,
  resolveReexportModuleKey,
} from "../module-paths.js";
import type {
  ExportedSymbolKind,
  InternalHelperTypeKind,
  ResolvedExportDeclaration,
} from "../types.js";

export const classifyLocalTypeDeclarationKind = (
  statement: IrStatement
): InternalHelperTypeKind | undefined => {
  switch (statement.kind) {
    case "classDeclaration":
      return "class";
    case "interfaceDeclaration":
      return "interface";
    case "enumDeclaration":
      return "enum";
    case "typeAliasDeclaration":
      return "typeAlias";
    default:
      return undefined;
  }
};

export const declarationNameOf = (
  statement: IrStatement
): string | undefined => {
  switch (statement.kind) {
    case "functionDeclaration":
    case "classDeclaration":
    case "interfaceDeclaration":
    case "enumDeclaration":
    case "typeAliasDeclaration":
      return statement.name;
    default:
      return undefined;
  }
};

export const resolveModuleLocalDeclaration = (
  module: IrModule,
  localName: string
): IrStatement | undefined => {
  for (const statement of module.body) {
    const statementName = declarationNameOf(statement);
    if (statementName === localName) return statement;

    if (statement.kind === "variableDeclaration") {
      for (const declarator of statement.declarations) {
        if (
          declarator.name.kind === "identifierPattern" &&
          declarator.name.name === localName
        ) {
          return statement;
        }
      }
    }
  }
  return undefined;
};

export const classifyDeclarationKind = (
  statement: IrStatement,
  filePath: string,
  exportName: string
): Result<ExportedSymbolKind, string> => {
  switch (statement.kind) {
    case "functionDeclaration":
      return { ok: true, value: "function" };
    case "variableDeclaration":
      return { ok: true, value: "variable" };
    case "classDeclaration":
      return { ok: true, value: "class" };
    case "interfaceDeclaration":
      return { ok: true, value: "interface" };
    case "enumDeclaration":
      return { ok: true, value: "enum" };
    case "typeAliasDeclaration":
      return { ok: true, value: "typeAlias" };
    default:
      return {
        ok: false,
        error:
          `Unsupported export '${exportName}' in ${filePath}: ${statement.kind}.\n` +
          "First-party bindings generation requires explicit support for each exported declaration kind.",
      };
  }
};

export const resolveImportedLocalDeclaration = (
  module: IrModule,
  localName: string,
  modulesByFileKey: ReadonlyMap<string, IrModule>,
  visited: ReadonlySet<string>
): Result<ResolvedExportDeclaration, string> => {
  for (const importEntry of module.imports) {
    for (const specifier of importEntry.specifiers) {
      if (specifier.localName !== localName) continue;
      if (specifier.kind === "namespace") {
        return {
          ok: false,
          error: `Unable to re-export '${localName}' from ${module.filePath}: namespace imports are not supported for first-party bindings generation.`,
        };
      }
      if (!importEntry.isLocal) {
        return {
          ok: false,
          error:
            `Unsupported re-export in ${module.filePath}: '${localName}' resolves to non-local module '${importEntry.source}'.\n` +
            "First-party bindings generation currently supports only local source-module exports.",
        };
      }
      const targetModule = modulesByFileKey.get(
        resolveReexportModuleKey(module.filePath, importEntry.source)
      );
      if (!targetModule) {
        return {
          ok: false,
          error:
            `Unable to resolve local import target for '${localName}' in ${module.filePath}: '${importEntry.source}'.\n` +
            "First-party bindings generation requires local import targets to resolve deterministically.",
        };
      }
      const importedName =
        specifier.kind === "named" ? specifier.name : "default";
      return resolveExportedDeclaration(
        targetModule,
        importedName,
        modulesByFileKey,
        visited
      );
    }
  }
  return {
    ok: false,
    error:
      `Unable to resolve local symbol '${localName}' in ${module.filePath}.\n` +
      "First-party bindings generation requires resolvable local exports and aliases.",
  };
};

export const resolveExportedDeclaration = (
  module: IrModule,
  exportName: string,
  modulesByFileKey: ReadonlyMap<string, IrModule>,
  visited: ReadonlySet<string> = new Set()
): Result<ResolvedExportDeclaration, string> => {
  const cycleKey = `${normalizeModuleFileKey(module.filePath)}::${exportName}`;
  if (visited.has(cycleKey)) {
    return {
      ok: false,
      error:
        `Cyclic re-export detected while resolving '${exportName}' in ${module.filePath}.\n` +
        "First-party bindings generation requires acyclic local re-export graphs.",
    };
  }
  const nextVisited = new Set(visited);
  nextVisited.add(cycleKey);

  for (const item of module.exports) {
    if (item.kind === "declaration") {
      const declaration = item.declaration;
      if (declaration.kind === "variableDeclaration") {
        for (const declarator of declaration.declarations) {
          if (declarator.name.kind !== "identifierPattern") continue;
          if (declarator.name.name !== exportName) continue;
          return {
            ok: true,
            value: {
              declaration,
              module,
              clrName: declarator.name.name,
            },
          };
        }
        continue;
      }
      const declarationName = declarationNameOf(declaration);
      if (declarationName !== exportName) continue;
      return {
        ok: true,
        value: {
          declaration,
          module,
          clrName: declarationName,
        },
      };
    }

    if (item.kind === "named") {
      if (item.name !== exportName) continue;
      const declaration = resolveModuleLocalDeclaration(module, item.localName);
      if (declaration) {
        return {
          ok: true,
          value: {
            declaration,
            module,
            clrName: item.localName,
          },
        };
      }
      return resolveImportedLocalDeclaration(
        module,
        item.localName,
        modulesByFileKey,
        nextVisited
      );
    }

    if (item.kind === "reexport") {
      if (item.name !== exportName) continue;
      if (!isRelativeModuleSpecifier(item.fromModule)) {
        return {
          ok: false,
          error:
            `Unsupported re-export in ${module.filePath}: '${item.name}' from '${item.fromModule}'.\n` +
            "First-party bindings generation currently supports only relative re-exports from local source modules.",
        };
      }
      const targetModule = modulesByFileKey.get(
        resolveReexportModuleKey(module.filePath, item.fromModule)
      );
      if (!targetModule) {
        return {
          ok: false,
          error:
            `Unable to resolve local re-export target for '${item.name}' in ${module.filePath}: '${item.fromModule}'.\n` +
            "First-party bindings generation requires local re-export targets to resolve deterministically.",
        };
      }
      return resolveExportedDeclaration(
        targetModule,
        item.originalName,
        modulesByFileKey,
        nextVisited
      );
    }

    if (item.kind === "default" && exportName === "default") {
      return {
        ok: false,
        error:
          `Unsupported default export in ${module.filePath}.\n` +
          "First-party bindings generation currently requires named/declaration exports for deterministic namespace facades.",
      };
    }
  }

  return {
    ok: false,
    error:
      `Unable to resolve exported symbol '${exportName}' in ${module.filePath}.\n` +
      "First-party bindings generation requires explicit resolvable exports.",
  };
};
