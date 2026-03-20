import type { IrModule } from "@tsonic/frontend";
import type { Result } from "../../../types.js";
import type { ExportedSymbol } from "../types.js";
import {
  classifyDeclarationKind,
  declarationNameOf,
  resolveExportedDeclaration,
} from "./declarations.js";

export const collectModuleExports = (
  module: IrModule,
  modulesByFileKey: ReadonlyMap<string, IrModule>
): Result<readonly ExportedSymbol[], string> => {
  const exportedSymbols: ExportedSymbol[] = [];
  const seen = new Set<string>();

  const pushExport = (symbol: ExportedSymbol): void => {
    const key = `${symbol.exportName}|${symbol.localName}|${symbol.kind}`;
    if (seen.has(key)) return;
    seen.add(key);
    exportedSymbols.push(symbol);
  };

  for (const item of module.exports) {
    if (item.kind === "default") {
      return {
        ok: false,
        error:
          `Unsupported default export in ${module.filePath}.\n` +
          "First-party bindings generation currently requires named/declaration exports for deterministic namespace facades.",
      };
    }

    if (item.kind === "declaration") {
      const declaration = item.declaration;
      if (declaration.kind === "variableDeclaration") {
        for (const declarator of declaration.declarations) {
          if (declarator.name.kind !== "identifierPattern") {
            return {
              ok: false,
              error:
                `Unsupported exported variable declarator in ${module.filePath}: ${declarator.name.kind}.\n` +
                "First-party bindings generation requires identifier-based exported variables.",
            };
          }
          const localName = declarator.name.name;
          pushExport({
            exportName: localName,
            localName,
            kind: "variable",
            declaration,
            declaringNamespace: module.namespace,
            declaringClassName: module.className,
            declaringFilePath: module.filePath,
          });
        }
        continue;
      }

      const declarationName = declarationNameOf(declaration);
      if (!declarationName) {
        return {
          ok: false,
          error:
            `Unsupported exported declaration in ${module.filePath}: ${declaration.kind}.\n` +
            "First-party bindings generation requires explicit support for each exported declaration kind.",
        };
      }
      const declarationKind = classifyDeclarationKind(
        declaration,
        module.filePath,
        declarationName
      );
      if (!declarationKind.ok) return declarationKind;
      pushExport({
        exportName: declarationName,
        localName: declarationName,
        kind: declarationKind.value,
        declaration,
        declaringNamespace: module.namespace,
        declaringClassName: module.className,
        declaringFilePath: module.filePath,
      });
      continue;
    }

    if (item.kind === "reexport") continue;

    const resolved = resolveExportedDeclaration(
      module,
      item.name,
      modulesByFileKey
    );
    if (!resolved.ok) return resolved;
    const declaration = resolved.value.declaration;
    const declarationName = declarationNameOf(declaration);
    if (!declarationName && declaration.kind !== "variableDeclaration") {
      return {
        ok: false,
        error:
          `Unsupported named export '${item.name}' in ${module.filePath}: ${declaration.kind}.\n` +
          "First-party bindings generation requires explicit support for each exported declaration kind.",
      };
    }
    const declarationKind = classifyDeclarationKind(
      declaration,
      module.filePath,
      item.name
    );
    if (!declarationKind.ok) return declarationKind;
    pushExport({
      exportName: item.name,
      localName: resolved.value.clrName,
      kind: declarationKind.value,
      declaration,
      declaringNamespace: resolved.value.module.namespace,
      declaringClassName: resolved.value.module.className,
      declaringFilePath: resolved.value.module.filePath,
    });
  }

  return {
    ok: true,
    value: exportedSymbols.sort((left, right) =>
      left.exportName.localeCompare(right.exportName)
    ),
  };
};

export const finalizeCrossNamespaceReexports = (
  grouped: ReadonlyMap<string, readonly string[]>
): {
  readonly dtsStatements: readonly string[];
  readonly jsValueStatements: readonly string[];
  readonly valueExportNames: ReadonlySet<string>;
} => {
  const dtsStatements: string[] = [];
  const jsValueStatements: string[] = [];
  const valueExportNames = new Set<string>();

  for (const [key, specs] of Array.from(grouped.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  )) {
    const [moduleSpecifier, kind] = key.split("|") as [
      string,
      "type" | "value",
    ];
    const unique = Array.from(new Set(specs)).sort((a, b) =>
      a.localeCompare(b)
    );
    if (kind === "type") {
      dtsStatements.push(
        `export type { ${unique.join(", ")} } from '${moduleSpecifier}';`
      );
      continue;
    }
    const statement = `export { ${unique.join(", ")} } from '${moduleSpecifier}';`;
    dtsStatements.push(statement);
    jsValueStatements.push(statement);
    for (const spec of unique) {
      const aliasParts = spec.split(/\s+as\s+/);
      const aliasName = aliasParts[1];
      valueExportNames.add(
        aliasParts.length === 2 && aliasName ? aliasName : spec
      );
    }
  }

  return { dtsStatements, jsValueStatements, valueExportNames };
};
