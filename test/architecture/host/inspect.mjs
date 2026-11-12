import { readFileSync, realpathSync } from "node:fs";
import { isBuiltin } from "node:module";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { hostCatalogue, publicEntry, sourceOwner, testOwner } from "./catalogue.mjs";
import { cyclicSources, parseSources, quarantineReference, readImportGraph, sourceSymbol } from "./import-graph.mjs";
import { sourceFindings } from "./source-rules.mjs";

const limitOwners = ({ NavigationCaptureLimits: "front", LiteralCaptureLimits: "front", InferenceLimits: "infer",
  EvaluatorLimits: "evaluate", DataflowLimits: "dataflow", SummaryLimits: "summaries", MetadataLimits: "metadata",
  TypeExpansionLimits: "ir-types", QueryLimits: "query", InstantiationLimits: "ir-program" });

export function createInspectionDeps(quarantineRoots) {
  if (quarantineRoots.length === 0 || quarantineRoots.some(root => typeof root !== "string" || root.split("/").some(part => ["", ".", ".."].includes(part))))
    throw new Error("The explicit admitted quarantine area roots are required.");
  return ({ catalogue: hostCatalogue, readText: path => readFileSync(path, "utf8"), canonical: realpathSync,
    parse: parseSources, graph: readImportGraph, quarantineRoots: ([...quarantineRoots]) });
}

/** @type {import("./contracts.d.mts").InspectHost} */
export function inspectHost(deps, inputs) {
  const root = deps.canonical(inputs.root);
  if (new Set(inputs.files).size !== inputs.files.length) throw new Error("Distinct complete source inventory required.");
  const catalogue = inputs.catalogue;
  if (catalogue.length !== deps.catalogue.length || catalogue.some((module, index) =>
    JSON.stringify(module) !== JSON.stringify(deps.catalogue[index]))) throw new Error("The exact agreed Host catalogue is required.");
  const findings = [];
  const add = (code, path, line = 1, column = 1) => {
    if (!findings.some(finding => finding.code === code && finding.path === path && finding.line === line && finding.column === column))
      findings.push(({ code, path, line, column }));
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
  const componentDeps = new Set();
  for (const file of source.sourceFiles) {
    if (file === undefined) continue;
    const path = source.ast.getFileName(file).slice("/host-gate/".length);
    const module = sourceOwner(catalogue, path);
    if (module?.kind !== "component" || ![module.contract, module.contract.replace(/\.ts$/u, ".d.ts")].includes(path)) continue;
    for (const declaration of source.ast.statements(file)) {
      const type = source.ast.typeNode(declaration);
      if (type === undefined || !source.ast.is.IsFunctionTypeNode(type)) continue;
      const parameter = source.ast.parameters(type)[0];
      const annotation = source.ast.typeNode(parameter);
      if (source.ast.text(source.ast.name(parameter)) === "deps" && annotation !== undefined && source.ast.is.IsTypeReferenceNode(annotation)) {
        const selected = sourceSymbol(source, source.ast.as.AsTypeReferenceNode(annotation).TypeName);
        if (selected !== undefined) componentDeps.add(selected);
      }
    }
  }
  const compositionPort = (edge, from, to) => {
    if (![from.contract, from.contract.replace(/\.ts$/u, ".d.ts")].includes(edge.source) ||
      ![to.contract, to.contract.replace(/\.ts$/u, ".d.ts")].includes(edge.target)) return false;
    const { ast } = source;
    const file = source.sourceFiles.find(node => node !== undefined && ast.getFileName(node) === `/host-gate/${edge.source}`);
    const statement = ast.statements(file).find(node => ast.authoredRange(node).start === edge.start);
    if (statement === undefined) return false;
    const imported = ast.is.IsImportDeclaration(statement);
    const exported = ast.is.IsExportDeclaration(statement);
    if (!imported && !exported) return false;
    const typeOnly = imported ? ast.isTypeOnlyImportDeclaration(statement) : ast.as.AsExportDeclaration(statement).IsTypeOnly;
    const bindings = [];
    let invalid = false;
    const collect = node => {
      if (ast.is.IsImportSpecifier(node) || ast.is.IsExportSpecifier(node)) bindings.push(node);
      if (["KindNamespaceImport", "KindNamespaceExport"].includes(ast.kindName(node)) ||
        ast.is.IsImportClause(node) && ast.name(node) !== undefined) invalid = true;
      ast.forEachChild(node, child => { if (child !== undefined) collect(child); });
    };
    collect(statement);
    const queries = source.getSourceFileQueries(file).checker;
    return !invalid && bindings.length > 0 && bindings.every(binding => {
      const selected = ast.is.IsImportSpecifier(binding) ? ast.as.AsImportSpecifier(binding) : ast.as.AsExportSpecifier(binding);
      if (!typeOnly && !selected.IsTypeOnly) return false;
      const name = ast.text(selected.PropertyName ?? ast.name(binding));
      const identity = sourceSymbol(source, ast.name(binding));
      const declarations = identity === undefined ? [] : queries.getSymbolDeclarations(identity);
      const brand = name === "CheckerExtensions" && declarations.length === 1 && declarations.every(declaration =>
        sourceOwner(catalogue, ast.getFileName(ast.getSourceFile(declaration)).slice("/host-gate/".length))?.name === "front" &&
        ast.is.IsTypeAliasDeclaration(declaration) && ast.text(ast.name(declaration)) === "CheckerExtensions");
      if (brand && (!exported || ast.text(ast.name(binding)) === "CheckerExtensions"))
        return from.kind === "pipeline" && to.name === "front" || from.kind === "orchestration" && to.kind === "pipeline";
      if (from.kind === "orchestration" && ["pipeline", "driver"].includes(to.kind))
        return declarations.length > 0 && declarations.every(declaration =>
          ast.getFileName(ast.getSourceFile(declaration)) === `/host-gate/${edge.target}`);
      return from.kind === "pipeline" && to.kind === "component" && declarations.length > 0 && declarations.every(declaration => {
        const type = ast.typeNode(declaration);
        if (ast.getFileName(ast.getSourceFile(declaration)) !== `/host-gate/${edge.target}`) return false;
        const name = ast.text(ast.name(declaration));
        return type !== undefined && ast.is.IsFunctionTypeNode(type) && ast.text(ast.name(ast.parameters(type)[0])) === "deps" ||
          name.endsWith("Deps") && componentDeps.has(identity) || limitOwners[name] === to.name ||
          name === "AnalysisLimits" && to.name.startsWith("analyses/");
      });
    });
  };
  for (const edge of graph) {
    const ownTest = testOwner(catalogue, edge.source);
    const from = sourceOwner(catalogue, edge.source) ?? ownTest;
    const to = edge.target === null ? undefined : sourceOwner(catalogue, edge.target);
    const effect = from?.effects.find(entry => entry.path === edge.source);
    const pluginLoading = from?.name === "plugins" && effect?.role === "plugin-loading";
    if (pluginLoading && (edge.kind === "loader" || edge.specifier === null)) continue;
    if (edge.specifier === null) { add("unsafe-type-escape", edge.source, edge.line, edge.column); continue; }
    let allowed = false;
    if (from !== undefined) {
      if (quarantineReference(edge.specifier, deps.quarantineRoots)) allowed = false;
      else if (!edge.specifier.startsWith(".")) {
        allowed = edge.specifier === "@tsonic/tsts" && from.name === "front" ||
          isBuiltin(edge.specifier) && (ownTest !== undefined || ["driver", "orchestration"].includes(from.kind) &&
            effect !== undefined && (!["module", "node:module"].includes(edge.specifier) || pluginLoading));
      } else if (to !== undefined && from.name === to.name) allowed = true;
      else if (to !== undefined && from.imports.includes(to.name)) {
        allowed = to.kind === "library" ? publicEntry(to, edge.target)
          : from.kind === "pipeline" && to.kind === "component" ||
            from.kind === "orchestration" && ["pipeline", "driver"].includes(to.kind) || from.kind === "cli" && to.kind === "orchestration";
      }
      if ([from.contract, from.contract.replace(/\.ts$/u, ".d.ts")].includes(edge.source) &&
        to !== undefined && to.kind !== "library" && to.name !== from.name) allowed = compositionPort(edge, from, to);
    }
    if (!allowed) add("forbidden-import", edge.source, edge.line, edge.column);
  }
  const moduleEdges = graph.filter(edge => edge.kind !== "loader" || !sourceOwner(catalogue, edge.source)?.effects.some(effect =>
    sourceOwner(catalogue, edge.source)?.name === "plugins" && effect.path === edge.source && effect.role === "plugin-loading"));
  const cycles = cyclicSources(moduleEdges);
  for (const edge of moduleEdges) if (cycles.has(edge.source) && cycles.get(edge.source) === cycles.get(edge.target)) add("source-cycle", edge.source, edge.line, edge.column);
  for (const finding of sourceFindings(source, files, catalogue, graph, deps.quarantineRoots)) add(finding.code, finding.path, finding.line, finding.column);
  const expected = new Set(inputs.files.map(path => deps.canonical(resolve(root, path))));
  for (const loaded of inputs.loadedFiles) if (!expected.has(deps.canonical(loaded))) add("loaded-source-escape", loaded);
  for (const path of inputs.configurations) {
    const data = JSON.parse(deps.readText(ownedPath(path)));
    const visit = value => {
      if (typeof value === "string" && quarantineReference(value, deps.quarantineRoots)) add("forbidden-import", path);
      else if (Array.isArray(value)) value.forEach(visit);
      else if (value !== null && typeof value === "object") Object.values(value).forEach(visit);
    };
    visit(data);
  }
  return (findings.sort((left, right) => left.path.localeCompare(right.path) || left.line - right.line || left.column - right.column || left.code.localeCompare(right.code)));
}
