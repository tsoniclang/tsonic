import { readFileSync } from "node:fs";

const { currentRoots } = JSON.parse(readFileSync(new URL("../quarantine/areas.json", import.meta.url), "utf8"));
const root = currentRoots.hostSource;

const row = (name, kind, imports, directory = `${root}/${name}`, effects = []) => ({
  name, kind, directory, contract: `${directory}/contract.ts`,
  entry: `${directory}/index.ts`, imports: (imports),
  effects: (effects.map(effect => ({ ...effect }))),
  implementationOwners: (kind === "component" ? [name, "pipeline"] : [name]),
});

const foundations = (["ids", "diag", "ir-types", "ir-hir", "ir-tir", "ir-mir", "ir-facts"]);
const first = count => foundations.slice(0, count);
const analyses = (["liveness", "initialization", "refinements", "origins", "suspension", "errorStorage", "pointerBacking"]);
const decisionReadingAnalyses = (["refinements", "origins", "pointerBacking"]);
const libraries = ([...first(4), "ir-infer", ...foundations.slice(4), "ir-program", "dataflow", "query", "libraries", "snapshot", "step"]);
const components = (["front", "decls", "rules", "infer", "elaborate", "validate", "lower-mir", "evaluate", "metadata",
  ...analyses.map(name => `analyses/${name}`), "summaries"]);
const drivers = (["project", "packages", "plugins", "artifacts"]);

export const hostCatalogue = ([
  row("ids", "library", []),
  row("diag", "library", first(1)),
  row("ir-types", "library", first(2)),
  row("ir-hir", "library", first(3)),
  row("ir-infer", "library", [...first(4), "step"]),
  row("ir-tir", "library", [...first(4), "ir-infer"]),
  row("ir-mir", "library", [...first(5), "ir-infer"]),
  row("ir-facts", "library", [...first(6), "ir-infer", "snapshot"]),
  row("ir-program", "library", [...first(7), "ir-infer"]),
  row("dataflow", "library", ["ids", "diag", "ir-mir"]),
  row("query", "library", [...first(2), "step"]),
  row("libraries", "library", [...first(3), "ir-facts", "ir-tir", "snapshot"]),
  row("snapshot", "library", first(2)),
  row("step", "library", []),
  row("front", "component", [...first(4), "libraries", "snapshot"]),
  row("decls", "component", [...first(4), "libraries", "ir-infer", "step"]),
  row("rules", "component", [...first(4), "libraries", "ir-infer"]),
  row("infer", "component", [...first(4), "dataflow", "ir-infer", "step"]),
  row("elaborate", "component", [...first(5), "ir-infer", "step"]),
  row("validate", "component", [...first(5), "libraries", "ir-infer"]),
  row("lower-mir", "component", [...first(6), "ir-infer"]),
  row("evaluate", "component", [...first(6), "libraries", "ir-infer", "step"]),
  row("metadata", "component", [...first(4), "ir-facts", "step"]),
  ...analyses.map(name => row(`analyses/${name}`, "component", [...first(7), "dataflow", ...(decisionReadingAnalyses.includes(name) ? ["ir-infer"] : [])])),
  row("summaries", "component", [...first(7), "dataflow", "ir-infer", "libraries"]),
  row("pipeline", "pipeline", [...libraries, ...components]),
  ...drivers.map(name => row(name, "driver", ["ids", "diag", "snapshot"], `${root}/${name}`,
    [{ path: `${root}/${name}/effects.ts`, role: name === "plugins" ? "plugin-loading" : "effects" }])),
  row("orchestration", "orchestration", ["ids", "diag", "snapshot", "ir-program", "pipeline", ...drivers], `${root}/orchestration`,
    [{ path: `${root}/orchestration/effects.ts`, role: "effects" }]),
  row("cli", "cli", ["orchestration", "diag", "snapshot"], currentRoots.cliSource),
  row("create-tsonic", "cli", ["orchestration", "diag", "snapshot"], currentRoots.createTsonicSource),
]);

export function sourceOwner(catalogue, path) {
  return catalogue.find(module => path.startsWith(`${module.directory}/`));
}

export function publicEntry(module, path) {
  return [module.contract, module.entry].some(entry => path === entry || path === entry.replace(/\.ts$/u, ".d.ts"));
}

export function testOwner(catalogue, path) {
  return catalogue.find(module => {
    const prefix = `test/host-cases/${module.name}/`;
    if (!path.startsWith(prefix)) return false;
    const parts = path.slice(prefix.length).split("/");
    return parts.length === 2 && ["function", "pass", "verifier", "pipeline", "corpus"].includes(parts[0]) && parts[1].endsWith(".test.mjs");
  });
}
