import type { AstReader, Node } from "@tsonic/tsts";

import { tsonicCompileTimeProviderNames } from "../compile-time/declarations.js";

import { tsonicCoreSafetyProviderNames } from "../safety/declarations.js";
import { tsonicCoreNativePointerProviderNames } from "../pointers/provider-declarations.js";

import { tsonicCoreLangModule, tsonicCoreSourceExtensionId, tsonicCoreTypesModule } from "../identity.js";
import { tsonicCoreSourceSemanticsModules } from "../extension/source-modules.js";

import { tsonicMemorySignatureIds, tsonicMemoryTypeExports } from "../memory-layout/declarations.js";

import type { ExtensionDiagnosticWriter } from "@tsonic/tsts";

const unsupportedCoreReExportDiagnostic = {
  extensionCode: "SOURCE_SEMANTICS_CORE_REEXPORT_UNSUPPORTED",
  numericCode: 9901110,
  message: "Re-exporting @tsonic/core intrinsics through a local barrel is unsupported; import source-core intrinsics directly so provider ownership remains proven.",
} as const;

const sourceCoreExportNamesByModule = new Map(
  tsonicCoreSourceSemanticsModules().map((module) => [
    module.moduleSpecifier,
    new Set([
      ...module.exports.map((entry) => entry.exportName),
      ...(module.moduleSpecifier === tsonicCoreTypesModule
        ? [tsonicCoreNativePointerProviderNames.nativePointerExport, ...tsonicMemoryTypeExports]
        : module.moduleSpecifier === tsonicCoreLangModule
        ? [
            tsonicCoreNativePointerProviderNames.loadExport,
            tsonicCoreNativePointerProviderNames.storeExport,
            tsonicCoreNativePointerProviderNames.offsetExport,
            "viewptr",
            tsonicCoreSafetyProviderNames.unsafeContextExport,
            tsonicCoreSafetyProviderNames.safetyExport,
            ...Object.keys(tsonicMemorySignatureIds),
            ...Object.values(tsonicCompileTimeProviderNames),
          ]
        : []),
    ]),
  ]),
);

export function recordUnsupportedTsonicCoreReExportDiagnostics(
  sourceFile: Node,
  ast: AstReader,
  diagnostics: ExtensionDiagnosticWriter,
): void {
  let exportDeclarationIndex = 0;
  for (const statement of ast.statements(sourceFile)) {
    if (statement === undefined || !ast.is.IsExportDeclaration(statement)) {
      continue;
    }
    const statementIdentity = exportDeclarationIndex;
    exportDeclarationIndex += 1;
    const moduleSpecifierNode = ast.as.AsExportDeclaration(statement)?.ModuleSpecifier;
    const moduleSpecifier = moduleSpecifierNode === undefined ? undefined : ast.text(moduleSpecifierNode);
    const sourceCoreExportNames = moduleSpecifier === undefined
      ? undefined
      : sourceCoreExportNamesByModule.get(moduleSpecifier);
    if (moduleSpecifier === undefined || sourceCoreExportNames === undefined) {
      continue;
    }
    const exportedNames = exportedSourceCoreIntrinsicNames(statement, ast, sourceCoreExportNames);
    if (exportedNames.length === 0) {
      continue;
    }
    diagnostics.append({
      extensionId: tsonicCoreSourceExtensionId,
      extensionCode: unsupportedCoreReExportDiagnostic.extensionCode,
      numericCode: unsupportedCoreReExportDiagnostic.numericCode,
      publicCode: `TSONIC_SOURCE_CORE_${unsupportedCoreReExportDiagnostic.numericCode}`,
      category: "error",
      message: unsupportedCoreReExportDiagnostic.message,
      nodeOrSpan: statement,
      evidence: [{
        message: "Source-core portable intrinsic ownership does not flow through local re-export barrels.",
        details: {
          moduleSpecifier,
          exportedNames,
        },
      }],
      identity: `source-core-reexport:${statementIdentity}:${moduleSpecifier}:${exportedNames.join(",")}`,
    });
  }
}

function exportedSourceCoreIntrinsicNames(
  exportDeclaration: Node,
  ast: AstReader,
  sourceCoreExportNames: ReadonlySet<string>,
): readonly string[] {
  const exportClause = ast.as.AsExportDeclaration(exportDeclaration)?.ExportClause;
  if (exportClause === undefined) {
    return ["*"];
  }
  if (!ast.is.IsNamedExports(exportClause)) {
    return ["*"];
  }
  const exportedNames: string[] = [];
  for (const specifier of ast.elements(exportClause)) {
    if (specifier === undefined || !ast.is.IsExportSpecifier(specifier)) {
      continue;
    }
    const exportNameNode = ast.as.AsExportSpecifier(specifier)?.PropertyName ??
      ast.name(specifier);
    const exportName = exportNameNode === undefined ? undefined : ast.text(exportNameNode);
    if (exportName !== undefined && sourceCoreExportNames.has(exportName)) {
      exportedNames.push(exportName);
    }
  }
  return exportedNames;
}
