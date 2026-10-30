import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { assert, cliPath, existsSync, readFile, repoRoot, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";

test("CLI emits only files reachable from the TSTS source module graph", async () => {
  const projectDirectory = resolve(tempRoot, "reachable-source-graph-only");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          surfaces: ["js"],
          options: {
            outputType: "Exe",
            namespace: "Smoke.Generated",
            assemblyName: "SmokeGeneratedReachableSourceGraph",
          },
        },
      ],
    }, null, 2),
    "src/used.ts": [
      "export const value = 1;",
      "",
    ].join("\n"),
    "src/orphan.ts": [
      "console.log(\"orphan\");",
      "export const value = 99;",
      "",
    ].join("\n"),
    "src/index.ts": [
      "import { value } from \"./used.js\";",
      "console.log(value);",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/src/Index.cs")), true);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/src/Used.cs")), true);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/src/Orphan.cs")), false);

  const indexSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(indexSource, /Used\.__tsonic_module_init\(\);/);
  assert.match(indexSource, /Tsonic\.CSharp\.Js\.console\.log\(global::Smoke\.Generated\.Used\.value\);/);
  assert.doesNotMatch(indexSource, /Orphan|__unsupported/);

  const output = runGeneratedProject(projectDirectory, "SmokeGeneratedReachableSourceGraph");
  assert.equal(output, "1\n");
});

test("CLI emits side-effect import initialization before importer top-level statements", async () => {
  const projectDirectory = resolve(tempRoot, "side-effect-import-order");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          surfaces: ["js"],
          options: {
            outputType: "Exe",
            namespace: "Smoke.Generated",
            assemblyName: "SmokeGeneratedSideEffectImportOrder",
          },
        },
      ],
    }, null, 2),
    "src/state.ts": [
      "export let text = \"\";",
      "export function append(value: string): void {",
      "  text = text + value;",
      "}",
      "",
    ].join("\n"),
    "src/side.ts": [
      "import { append } from \"./state.js\";",
      "append(\"side;\");",
      "",
    ].join("\n"),
    "src/index.ts": [
      "import \"./side.js\";",
      "import { append, text } from \"./state.js\";",
      "append(\"index;\");",
      "console.log(text);",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const indexSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(indexSource, /private static object\? __tsonic_module_init_core\(\)/);
  assert.match(indexSource, /Side\.__tsonic_module_init\(\);[\s\S]*State\.__tsonic_module_init\(\);[\s\S]*global::Smoke\.Generated\.State\.append\("index;"\);/);
  assert.doesNotMatch(indexSource, /__unsupported/);

  const sideSource = await readFile(resolve(projectDirectory, "out/csharp/src/Side.cs"), "utf8");
  assert.match(sideSource, /private static object\? __tsonic_module_init_core\(\)/);
  assert.match(sideSource, /State\.__tsonic_module_init\(\);[\s\S]*global::Smoke\.Generated\.State\.append\("side;"\);/);
  assert.doesNotMatch(sideSource, /__unsupported/);

  const stateSource = await readFile(resolve(projectDirectory, "out/csharp/src/State.cs"), "utf8");
  assert.match(stateSource, /public static string text\s*\{\s*get;\s*internal set;\s*\} = default\(string\)!;/);
  assert.match(stateSource, /text = "";/);
  assert.doesNotMatch(stateSource, /__unsupported/);

  const output = runGeneratedProject(projectDirectory, "SmokeGeneratedSideEffectImportOrder");
  assert.equal(output, "side;index;\n");
});
