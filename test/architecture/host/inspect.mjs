import { readFileSync, realpathSync } from "node:fs";
import { isBuiltin } from "node:module";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { hostCatalogue, publicEntry, sourceOwner, testOwner } from "./catalogue.mjs";
import { cyclicSources, parseSources, readImportGraph } from "./import-graph.mjs";
import { sourceFindings } from "./source-rules.mjs";

export const inspectionDeps = Object.freeze({
  readText: path => readFileSync(path, "utf8"), canonical: realpathSync,
  parse: parseSources, graph: readImportGraph,
});

/** @type {import("./contracts.d.mts").InspectHost} */
export function inspectHost(deps, inputs) {
  const root = deps.canonical(inputs.root);
  if (new Set(inputs.files).size !== inputs.files.length) throw new Error("Distinct complete source inventory required.");
  const catalogue = inputs.catalogue;
  if (catalogue.length !== hostCatalogue.length || catalogue.some((module, index) =>
    JSON.stringify(module) !== JSON.stringify(hostCatalogue[index]))) throw new Error("The exact agreed Host catalogue is required.");
  const findings = [];
  const add = (code, path, line = 1, column = 1) => {
    if (!findings.some(finding => finding.code === code && finding.path === path && finding.line === line && finding.column === column))
      findings.push(Object.freeze({ code, path, line, column }));
  };
  const ownedPath = path => {
    if (typeof path !== "string" || path.length === 0 || isAbsolute(path) || path.includes("\\") || path.includes("\0") ||
      path.split("/").some(part => ["", ".", ".."].includes(part))) throw new Error("Canonical repository-relative path required.");
    const absolute = resolve(root, path);
    const canonical = deps.canonical(absolute);
    const child = relative(root, canonical);
    if (canonical !== absolute || child.startsWith(`..${sep}`) || child === ".." || isAbsolute(child))
      throw new Error("Original owned source required; aliases and escapes are forbidden.");
    return absolute;
  };
  const files = new Map(inputs.files.map(path => [path, deps.readText(ownedPath(path))]));
  for (const path of files.keys()) if (sourceOwner(catalogue, path) === undefined && testOwner(catalogue, path) === undefined) add("unknown-module", path);
  const source = deps.parse(files);
  const graph = deps.graph(source, files);
  for (const edge of graph) {
    const ownTest = testOwner(catalogue, edge.source);
    const from = sourceOwner(catalogue, edge.source) ?? ownTest;
    const to = edge.target === null ? undefined : sourceOwner(catalogue, edge.target);
    let allowed = false;
    if (from !== undefined) {
      if (edge.specifier.split("/").includes("_old")) allowed = false;
      else if (!edge.specifier.startsWith(".")) {
        allowed = edge.specifier === "@tsonic/tsts" && from.name === "front" && edge.source !== from.contract ||
          isBuiltin(edge.specifier) && (ownTest !== undefined || ["front", "project", "packages", "plugins", "artifacts", "orchestration", "cli", "create-tsonic"].includes(from.name))
            && edge.source !== from.contract;
      } else if (to !== undefined && from.name === to.name) allowed = true;
      else if (to !== undefined && from.imports.includes(to.name)) {
        allowed = to.kind === "library" ? publicEntry(to, edge.target)
          : from.kind === "pipeline" && to.kind === "component" ||
            from.kind === "orchestration" && ["pipeline", "driver"].includes(to.kind) || from.kind === "cli" && to.kind === "orchestration";
      }
      if (edge.source === from.contract && to !== undefined && to.kind !== "library" && to.name !== from.name) allowed = false;
    }
    if (!allowed) add("forbidden-import", edge.source, edge.line, edge.column);
  }
  const cycles = cyclicSources(graph);
  for (const edge of graph) if (cycles.has(edge.source) && cycles.get(edge.source) === cycles.get(edge.target)) add("source-cycle", edge.source, edge.line, edge.column);
  for (const finding of sourceFindings(source, files, catalogue, graph)) add(finding.code, finding.path, finding.line, finding.column);
  const expected = new Set(inputs.files.map(path => deps.canonical(resolve(root, path))));
  for (const loaded of inputs.loadedFiles) if (!expected.has(deps.canonical(loaded))) add("loaded-source-escape", loaded);
  for (const path of inputs.configurations) {
    const data = JSON.parse(deps.readText(ownedPath(path)));
    const visit = (value, key) => {
      if (key === "oldSource") return;
      if (typeof value === "string" && value.replaceAll("\\", "/").split("/").includes("_old")) add("forbidden-import", path);
      else if (Array.isArray(value)) value.forEach(child => visit(child, ""));
      else if (value !== null && typeof value === "object") for (const [name, child] of Object.entries(value)) visit(child, name);
    };
    visit(data, "");
  }
  return Object.freeze(findings.sort((left, right) => left.path.localeCompare(right.path) || left.line - right.line || left.column - right.column || left.code.localeCompare(right.code)));
}
