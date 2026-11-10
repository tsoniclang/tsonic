const root = "packages/host/src";

const row = (name, kind, imports, directory = `${root}/${name}`) => Object.freeze({
  name, kind, directory, contract: `${directory}/contract.ts`,
  entry: `${directory}/index.ts`, imports: Object.freeze(imports),
  implementationOwners: Object.freeze(kind === "component" ? [name, "pipeline"] : [name]),
});

const foundations = Object.freeze(["ids", "diag", "ir-types", "ir-hir", "ir-tir", "ir-mir", "ir-facts"]);
const first = count => foundations.slice(0, count);
const analyses = Object.freeze(["liveness", "initialization", "refinements", "origins", "suspension", "errorStorage", "pointerBacking"]);
const libraries = Object.freeze([...first(4), "ir-infer", ...foundations.slice(4), "ir-program", "dataflow", "query", "libraries", "snapshot"]);
const components = Object.freeze(["front", "decls", "rules", "infer", "elaborate", "validate", "lower-mir", "evaluate", "metadata",
  ...analyses.map(name => `analyses/${name}`), "summaries"]);
const drivers = Object.freeze(["project", "packages", "plugins", "artifacts"]);

export const hostCatalogue = Object.freeze([
  row("ids", "library", []),
  row("diag", "library", first(1)),
  row("ir-types", "library", first(2)),
  row("ir-hir", "library", first(3)),
  row("ir-infer", "library", first(4)),
  row("ir-tir", "library", [...first(4), "ir-infer"]),
  row("ir-mir", "library", [...first(5), "ir-infer"]),
  row("ir-facts", "library", [...first(6), "ir-infer"]),
  row("ir-program", "library", [...first(7), "ir-infer"]),
  row("dataflow", "library", ["ids", "ir-mir"]),
  row("query", "library", first(2)),
  row("libraries", "library", [...first(3), "ir-facts"]),
  row("snapshot", "library", first(2)),
  row("front", "component", [...first(4), "libraries", "snapshot"]),
  row("decls", "component", [...first(4), "libraries"]),
  row("rules", "component", [...first(4), "libraries", "ir-infer"]),
  row("infer", "component", [...first(4), "dataflow", "ir-infer"]),
  row("elaborate", "component", [...first(5), "ir-infer"]),
  row("validate", "component", [...first(5), "libraries", "ir-infer"]),
  row("lower-mir", "component", first(6)),
  row("evaluate", "component", [...first(6), "libraries"]),
  row("metadata", "component", [...first(4), "ir-facts"]),
  ...analyses.map(name => row(`analyses/${name}`, "component", [...first(7), "dataflow"])),
  row("summaries", "component", [...first(7), "dataflow"]),
  row("pipeline", "pipeline", [...libraries, ...components]),
  ...drivers.map(name => row(name, "driver", ["ids", "diag", "snapshot"])),
  row("orchestration", "orchestration", ["ids", "diag", "snapshot", "ir-program", "pipeline", ...drivers]),
  row("cli", "cli", ["orchestration", "diag", "snapshot"], "packages/cli/src"),
  row("create-tsonic", "cli", ["orchestration", "diag", "snapshot"], "packages/create-tsonic/src"),
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
