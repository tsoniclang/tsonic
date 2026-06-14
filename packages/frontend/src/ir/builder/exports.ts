/**
 * Export extraction from TSTS source files.
 *
 * Uses ProgramContext for statement/expression conversion.
 */

import type { TstsNode, TstsSourceFile } from "@tsonic/tsts";
import {
  getTstsStatementNodes,
} from "@tsonic/tsts";
import { IrExport, IrStatement } from "../types.js";
import { convertExpression } from "../expression-converter.js";
import type { ProgramContext } from "../program-context.js";

const DEFAULT_EXPORT_NAME = "default";

const normalizeSourcePath = (fileName: string): string =>
  fileName.replace(/\\/g, "/");

const resolvedSourceFileForExport = (
  sourceFile: TstsSourceFile,
  sourceSpecifier: string,
  ctx: ProgramContext
): TstsSourceFile | undefined => {
  const resolved =
    ctx.moduleGraph.getResolvedModule(sourceFile, sourceSpecifier)
      ?.resolvedFileName;
  return resolved ? ctx.sourceFilesByPath.get(normalizeSourcePath(resolved)) : undefined;
};

const expandExportStarNames = (
  sourceFile: TstsSourceFile,
  sourceSpecifier: string,
  ctx: ProgramContext,
  seen: Set<string>
): readonly string[] => {
  const targetSourceFile = resolvedSourceFileForExport(
    sourceFile,
    sourceSpecifier,
    ctx
  );
  if (!targetSourceFile) return [];

  const seenKey = `${normalizeSourcePath(targetSourceFile.FileName())}\0*`;
  if (seen.has(seenKey)) return [];
  seen.add(seenKey);

  const names: string[] = [];
  for (const binding of ctx.moduleGraph.getExports(targetSourceFile)) {
    if (binding.kind === "star" && binding.sourceSpecifier) {
      names.push(
        ...expandExportStarNames(
          targetSourceFile,
          binding.sourceSpecifier,
          ctx,
          seen
        )
      );
      continue;
    }

    if (
      binding.exportedName &&
      binding.exportedName !== DEFAULT_EXPORT_NAME
    ) {
      names.push(binding.exportedName);
    }
  }
  return [...new Set(names)];
};

/**
 * Extract export declarations from source file with full conversion.
 *
 * @param sourceFile - The TSTS source file
 * @param ctx - ProgramContext for full statement/expression conversion
 */
export const extractExportsWithContext = (
  sourceFile: TstsSourceFile,
  topLevelStatementGroups: ReadonlyMap<number, readonly IrStatement[]>,
  ctx: ProgramContext
): readonly IrExport[] => {
  const exports: IrExport[] = [];
  const sourceStatements = getTstsStatementNodes(sourceFile).filter(
    (statement): statement is TstsNode => statement !== undefined
  );
  const statementIndexByNode = new Map<TstsNode, number>();
  for (let index = 0; index < sourceStatements.length; index += 1) {
    const statement = sourceStatements[index];
    if (statement) {
      statementIndexByNode.set(statement, index);
    }
  }

  const emittedDeclarationNodes = new Set<TstsNode>();

  for (const exportBinding of ctx.moduleGraph.getExports(sourceFile)) {
    const sourceSpecifier = exportBinding.sourceSpecifier;
    if (exportBinding.kind === "star" && sourceSpecifier) {
      for (const name of expandExportStarNames(
        sourceFile,
        sourceSpecifier,
        ctx,
        new Set()
      )) {
        exports.push({
          kind: "reexport",
          name,
          originalName: name,
          fromModule: sourceSpecifier,
        });
      }
      continue;
    }

    if (sourceSpecifier && exportBinding.exportedName) {
      exports.push({
        kind: "reexport",
        name: exportBinding.exportedName,
        originalName: exportBinding.localName ?? exportBinding.exportedName,
        fromModule: sourceSpecifier,
      });
      continue;
    }

    const exportNode = exportBinding.exportNode;
    const statementIndex = exportNode
      ? statementIndexByNode.get(exportNode)
      : undefined;
    const statements =
      statementIndex === undefined
        ? []
        : (topLevelStatementGroups.get(statementIndex) ?? []);

    if (exportBinding.kind === "default") {
      if (statements.length > 0) {
        exports.push({
          kind: "default",
          expression: {
            kind: "identifier",
            name: "_default",
          },
        });
        continue;
      }

      if (exportBinding.bindingNode) {
        exports.push({
          kind: "default",
          expression: convertExpression(exportBinding.bindingNode, ctx, undefined),
        });
      }
      continue;
    }

    if (statements.length > 0 && exportNode) {
      if (emittedDeclarationNodes.has(exportNode)) {
        continue;
      }
      emittedDeclarationNodes.add(exportNode);
      for (const stmt of statements) {
        exports.push({
          kind: "declaration",
          declaration: stmt,
        });
      }
      continue;
    }

    if (exportBinding.exportedName && exportBinding.localName) {
      exports.push({
        kind: "named",
        name: exportBinding.exportedName,
        localName: exportBinding.localName,
      });
    }
  }

  return exports;
};
