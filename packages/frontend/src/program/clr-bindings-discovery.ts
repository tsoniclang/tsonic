/**
 * CLR bindings discovery
 *
 * Airplane-grade behavior:
 * - Detect CLR imports only via bindings.json presence (no heuristics).
 * - Load bindings.json for all directly-imported CLR namespaces.
 * - Also load bindings.json for any CLR namespaces re-exported by those facades.
 *
 * This is required for library entrypoints that re-export multiple CLR namespaces
 * (e.g. `@jotster/core/Jotster.Core.js` re-exporting `Jotster.Core.db`, etc.).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as ts from "typescript";
import { loadBindingsFromPath } from "./bindings.js";
import type { TsonicProgram } from "./types.js";

const extractNamespaceKey = (subpath: string): string | null => {
  const slashIdx = subpath.indexOf("/");
  const backslashIdx = subpath.indexOf("\\");
  const firstSep =
    slashIdx === -1
      ? backslashIdx
      : backslashIdx === -1
        ? slashIdx
        : Math.min(slashIdx, backslashIdx);
  const firstSeg = (
    firstSep === -1 ? subpath : subpath.slice(0, firstSep)
  ).trim();
  if (!firstSeg) return null;
  return firstSeg.endsWith(".js") ? firstSeg.slice(0, -3) : firstSeg;
};

const discoverReexportedBindingPaths = (
  bindingsPath: string,
  program: TsonicProgram,
  verbose?: boolean
): readonly string[] => {
  // bindingsPath is expected to be:
  //   <...>/dist/tsonic/bindings/<Namespace>/bindings.json
  //
  // The sibling facade is:
  //   <...>/dist/tsonic/bindings/<Namespace>.d.ts
  const namespaceDir = path.dirname(bindingsPath);
  const namespaceKey = path.basename(namespaceDir);
  const bindingsRoot = path.dirname(namespaceDir);
  const facadeDts = path.join(bindingsRoot, `${namespaceKey}.d.ts`);
  if (!fs.existsSync(facadeDts)) return [];

  let sourceText: string;
  try {
    sourceText = fs.readFileSync(facadeDts, "utf-8");
  } catch {
    return [];
  }

  const sourceFile = ts.createSourceFile(
    facadeDts,
    sourceText,
    ts.ScriptTarget.ES2022,
    false,
    ts.ScriptKind.TS
  );

  const results: string[] = [];

  for (const stmt of sourceFile.statements) {
    if (
      ts.isExportDeclaration(stmt) &&
      stmt.moduleSpecifier &&
      ts.isStringLiteral(stmt.moduleSpecifier)
    ) {
      const spec = stmt.moduleSpecifier.text.trim();
      if (!spec) continue;

      // Case 1: local re-exports within the bindings directory (most common for entrypoints).
      if (spec.startsWith(".")) {
        const resolved = path.resolve(bindingsRoot, spec);
        const rel = path.relative(bindingsRoot, resolved);
        const nsKey = extractNamespaceKey(rel);
        if (!nsKey) continue;
        const candidate = path.join(bindingsRoot, nsKey, "bindings.json");
        if (fs.existsSync(candidate)) {
          results.push(candidate);
        }
        continue;
      }

      // Case 2: package re-exports (rare, but valid). If this resolves as a CLR import,
      // include it as well.
      const clr = program.clrResolver.resolve(spec);
      if (clr.isClr) {
        results.push(clr.bindingsPath);
      }
    }
  }

  if (verbose && results.length > 0) {
    console.log(
      `[CLR Bindings] ${namespaceKey}: discovered ${results.length} re-exported bindings`
    );
  }

  return results;
};

/**
 * Scan all source files for import statements and discover CLR bindings.
 *
 * Must be called BEFORE IR building to ensure bindings are loaded.
 */
export const discoverAndLoadClrBindings = (
  program: TsonicProgram,
  verbose?: boolean
): void => {
  const pending: string[] = [];
  const enqueued = new Set<string>();
  const processed = new Set<string>();

  const enqueue = (bindingsPath: string): void => {
    if (enqueued.has(bindingsPath)) return;
    enqueued.add(bindingsPath);
    pending.push(bindingsPath);
  };

  if (verbose) {
    console.log(
      `[CLR Bindings] Scanning ${program.sourceFiles.length} source files`
    );
  }

  // First: discover direct CLR imports from source files.
  for (const sourceFile of program.sourceFiles) {
    if (verbose) {
      console.log(`[CLR Bindings] Scanning: ${sourceFile.fileName}`);
    }
    ts.forEachChild(sourceFile, (node) => {
      const moduleSpecifier =
        (ts.isImportDeclaration(node) &&
          ts.isStringLiteral(node.moduleSpecifier) &&
          node.moduleSpecifier.text) ||
        (ts.isExportDeclaration(node) &&
          node.moduleSpecifier &&
          ts.isStringLiteral(node.moduleSpecifier) &&
          node.moduleSpecifier.text);

      if (!moduleSpecifier) return;

      if (verbose) {
        console.log(`[CLR Bindings] Found import: ${moduleSpecifier}`);
      }

      const resolution = program.clrResolver.resolve(moduleSpecifier);
      if (resolution.isClr) {
        if (verbose) {
          console.log(
            `[CLR Bindings] CLR import detected: ${resolution.bindingsPath}`
          );
        }
        enqueue(resolution.bindingsPath);
      }
    });
  }

  if (pending.length === 0) {
    if (verbose) console.log(`[CLR Bindings] No CLR bindings discovered`);
    return;
  }

  // Second: load discovered bindings, expanding through facade re-exports.
  while (pending.length > 0) {
    const bindingsPath = pending.shift();
    if (!bindingsPath) continue;
    if (processed.has(bindingsPath)) continue;
    processed.add(bindingsPath);

    loadBindingsFromPath(program.bindings, bindingsPath);

    for (const extra of discoverReexportedBindingPaths(
      bindingsPath,
      program,
      verbose
    )) {
      enqueue(extra);
    }
  }

  if (verbose) {
    console.log(
      `[CLR Bindings] Bindings loaded successfully (${processed.size} files)`
    );
  }
};
