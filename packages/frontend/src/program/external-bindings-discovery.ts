/**
 * external bindings discovery
 *
 * Airplane-grade behavior:
 * - Detect external imports only via bindings.json presence.
 * - Load bindings.json for all directly-imported external namespaces.
 * - Also load bindings.json for any external namespaces re-exported by those facades.
 *
 * This is required for library entrypoints that re-export multiple external namespaces
 * (e.g. `@jotster/core/Jotster.Core.js` re-exporting `Jotster.Core.db`, etc.).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import {
  createExtensionModuleGraph,
  parseTstsSourceFile,
} from "@tsonic/tsts";
import { loadBindingsFromPath } from "./bindings.js";
import type { TsonicProgram } from "./types.js";
import { getProgramAllSourceFiles } from "./queries.js";

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

  const sourceFile = parseTstsSourceFile(sourceText, { fileName: facadeDts });

  const results: string[] = [];

  const module = createExtensionModuleGraph(undefined, [
    sourceFile,
  ]).getSourceFileModule(sourceFile);

  for (const binding of module?.exports ?? []) {
    const spec = binding.sourceSpecifier?.trim() ?? "";
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

      // Case 2: package re-exports (rare, but valid). If this resolves as a external import,
      // include it as well.
      const external = program.externalResolver.resolve(spec);
      if (external.kind === "externalSurface") {
        results.push(external.bindingsPath);
      }
  }

  if (verbose && results.length > 0) {
    console.log(
      `[External Bindings] ${namespaceKey}: discovered ${results.length} re-exported bindings`
    );
  }

  return results;
};

/**
 * Scan all source files for import statements and discover external bindings.
 *
 * Must be called BEFORE IR building to ensure bindings are loaded.
 */
export const discoverAndLoadExternalBindings = (
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

  const filesToScan = getProgramAllSourceFiles(program);

  if (verbose) {
    console.log(
      `[External Bindings] Scanning ${filesToScan.length} source and declaration files`
    );
  }

  // First: discover direct external imports from program files, including declaration
  // files. Generated/source-package .d.ts surfaces can import external namespaces from
  // external packages, and those bindings must be loaded before IR building.
  for (const sourceFile of filesToScan) {
    if (verbose) {
      console.log(`[External Bindings] Scanning: ${sourceFile.FileName()}`);
    }

    const module = program.sourceProgram.moduleGraph.getSourceFileModule(sourceFile);
    const moduleSpecifiers = [
      ...(module?.imports.map((importModule) => importModule.specifier) ?? []),
      ...(module?.exports
        .map((binding) => binding.sourceSpecifier)
        .filter((specifier): specifier is string => specifier !== undefined) ??
        []),
    ];

    for (const moduleSpecifier of moduleSpecifiers) {

      if (verbose) {
        console.log(`[External Bindings] Found import: ${moduleSpecifier}`);
      }

      const resolution = program.externalResolver.resolve(moduleSpecifier);
      if (resolution.kind === "externalSurface") {
        if (verbose) {
          console.log(
            `[External Bindings] external import detected: ${resolution.bindingsPath}`
          );
        }
        enqueue(resolution.bindingsPath);
      }
    }
  }

  if (pending.length === 0) {
    if (verbose)
      console.log(`[External Bindings] No external bindings discovered`);
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
      `[External Bindings] Bindings loaded successfully (${processed.size} files)`
    );
  }
};
