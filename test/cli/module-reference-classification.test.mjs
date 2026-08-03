import {
  assert,
  compileFakeProject,
  compileProject,
  createFakeTargetPack,
  createFakeVirtualTargetCapability,
  createRegistry,
  parseTsonicProjectConfig,
  resolve,
  tempRoot,
  test,
  writeProject,
} from "./surface-composition.helpers.mjs";
const moduleReferenceCases = [
  row("side-effect-import", true, (specifier) => `import "${specifier}";`),
  row("type-only-named-import", false, (specifier, index) => `import type { named as Type${index} } from "${specifier}";`),
  row("inline-type-named-import", false, (specifier, index) => `import { type named as Type${index} } from "${specifier}";`),
  row("mixed-named-import", true, (specifier, index) => `import { type named as Type${index}, named as value${index} } from "${specifier}";`),
  row("default-plus-inline-type-import", true, (specifier, index) => `import defaultValue${index}, { type named as Type${index} } from "${specifier}";`),
  row("default-import", true, (specifier, index) => `import defaultValue${index} from "${specifier}";`),
  row("namespace-import", true, (specifier, index) => `import * as namespace${index} from "${specifier}";`),
  row("type-only-namespace-import", false, (specifier, index) => `import type * as namespace${index} from "${specifier}";`),
  row("empty-named-import", true, (specifier) => `import {} from "${specifier}";`),
  row("type-only-named-reexport", false, (specifier, index) => `export type { named as Type${index} } from "${specifier}";`),
  row("inline-type-named-reexport", false, (specifier, index) => `export { type named as Type${index} } from "${specifier}";`),
  row("mixed-named-reexport", true, (specifier, index) => `export { type named as Type${index}, named as value${index} } from "${specifier}";`),
  row("named-reexport", true, (specifier, index) => `export { named as value${index} } from "${specifier}";`),
  row("export-star", true, (specifier) => `export * from "${specifier}";`),
  row("namespace-reexport", true, (specifier, index) => `export * as namespace${index} from "${specifier}";`),
  row("type-only-namespace-reexport", false, (specifier, index) => `export type * as namespace${index} from "${specifier}";`),
  row("empty-named-reexport", true, (specifier) => `export {} from "${specifier}";`),
];

test("project dependency analysis uses the shared import and export runtime-classification matrix", async () => {
  const events = [];
  const projectDirectory = resolve(tempRoot, "module-reference-project-dependencies");
  const projectConfig = {
    entryPoint: "index.ts",
    rootDir: "src",
    outDir: "out",
    targets: [{ id: "demo" }],
  };
  let runtimeDependencies = [];
  const targetPack = createFakeTargetPack(events, {
    onBackend(input) {
      const entry = input.source.sourceFiles.find((sourceFile) =>
        sourceFile !== undefined &&
        input.source.ast.getFileName(sourceFile) === resolve(projectDirectory, "src/index.ts"));
      assert.notEqual(entry, undefined);
      runtimeDependencies = input.source.navigation.moduleDependencies(entry)
        .map((dependency) => input.source.ast.getFileName(dependency.sourceFile))
        .map((fileName) => fileName.slice(projectDirectory.length + 1).split("\\").join("/"));
    },
  });
  const files = {
    "tsonic.json": JSON.stringify(projectConfig, null, 2),
    "src/index.ts": moduleReferenceCases
      .map((entry, index) => entry.render(`./${entry.id}.js`, index))
      .join("\n") + "\n",
  };
  for (const entry of moduleReferenceCases) {
    files[`src/${entry.id}.ts`] = "export default 1;\nexport const named = 1;\n";
  }
  await writeProject(projectDirectory, files);

  const result = compileProject({
    project: parseTsonicProjectConfig(projectConfig),
    projectFilePath: resolve(projectDirectory, "tsonic.json"),
    registry: createRegistry(targetPack),
  });

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(runtimeDependencies, moduleReferenceCases
    .filter((entry) => entry.runtime)
    .map((entry) => `src/${entry.id}.ts`));
});

test("capability activation uses the shared import and export runtime-classification matrix", async () => {
  const events = [];
  const capabilities = moduleReferenceCases.map((entry) => createFakeVirtualTargetCapability(entry.id, {
    events,
    moduleOwnership: [{ specifierPrefix: `@${entry.id}/native/` }],
  }));
  const targetPack = createFakeTargetPack(events);
  const source = moduleReferenceCases
    .map((entry, index) => entry.render(`@${entry.id}/native/module.js`, index))
    .join("\n") + "\n";

  const result = await compileFakeProject("module-reference-capability-activation", targetPack, { id: "demo" }, {
    installedCapabilities: capabilities,
    source,
  });

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(
    events.filter((event) => event.startsWith("capability-extension:"))
      .map((event) => event.split(":")[1]),
    moduleReferenceCases.map((entry) => entry.id),
  );
  assert.deepEqual(
    events.filter((event) => event.startsWith("capability-runtime:"))
      .map((event) => event.split(":")[1]),
    moduleReferenceCases.filter((entry) => entry.runtime).map((entry) => entry.id),
  );
});

function row(id, runtime, render) {
  return { id, runtime, render };
}
