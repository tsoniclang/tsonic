import { assert, cliPath, dotnetOutputAssemblyPath, existsSync, readFile, repoRoot, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";
import { readGeneratedModuleSource } from "./arrays-collections-fixtures.mjs";

test("CLI emits JS Record dictionaries through provider-owned Dictionary indexers", async () => {
  const assemblyName = "SmokeGeneratedProviderRecordDictionary";
  const projectDirectory = resolve(tempRoot, "provider-record-dictionary");
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
            namespace: "Smoke.Generated",
            assemblyName,
            outputType: "Exe",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int } from \"@tsonic/csharp/types.js\";",
      "import { Console } from \"@tsonic/dotnet/System.js\";",
      "",
      "export function getStringDict(): Record<string, number> {",
      "  return {};",
      "}",
      "",
      "export function getNumberDict(): Record<number, string> {",
      "  return {};",
      "}",
      "",
      "export function mutateStringKey(key: string, value: int): int {",
      "  const values: Record<string, int> = {};",
      "  values[key] = value;",
      "  return values[key];",
      "}",
      "",
      "export function lookupByNumber(dict: Record<number, string>, key: number): string | undefined {",
      "  return dict[key];",
      "}",
      "",
      "export function mutateNumberKey(key: number, value: string): string {",
      "  const values: Record<number, string> = {};",
      "  values[key] = value;",
      "  return values[key];",
      "}",
      "",
      "Console.WriteLine(mutateStringKey(\"one\", 7));",
      "Console.WriteLine(mutateNumberKey(2, \"two\"));",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readGeneratedModuleSource(projectDirectory);
  assert.match(generatedSource, /System\.Collections\.Generic\.Dictionary<string, double> getStringDict\(\)/);
  assert.match(generatedSource, /return new System\.Collections\.Generic\.Dictionary<string, double>\(\);/);
  assert.match(generatedSource, /System\.Collections\.Generic\.Dictionary<double, string> getNumberDict\(\)/);
  assert.match(generatedSource, /return new System\.Collections\.Generic\.Dictionary<double, string>\(\);/);
  assert.match(generatedSource, /System\.Collections\.Generic\.Dictionary<string, int> values = new System\.Collections\.Generic\.Dictionary<string, int>\(\);/);
  assert.match(generatedSource, /values\[key\] = value;/);
  assert.match(generatedSource, /return values\[key\];/);
  assert.match(generatedSource, /System\.Collections\.Generic\.Dictionary<double, string> values = new System\.Collections\.Generic\.Dictionary<double, string>\(\);/);
  assert.match(generatedSource, /return dict\[key\];/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  assert.equal(runGeneratedProject(projectDirectory, assemblyName), [
    "7",
    "two",
    "",
  ].join("\n"));
});

test("CLI emits provider-owned generic byref collection calls from virtual target modules", async () => {
  const projectDirectory = resolve(tempRoot, "provider-generic-dictionary-out");
  const assemblyName = "SmokeGeneratedProviderGenericDictionaryOut";
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          options: {
            namespace: "Smoke.Generated",
            assemblyName,
            outputType: "Exe",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { Console } from \"@tsonic/dotnet/System.js\";",
      "import { out } from \"@tsonic/csharp/lang.js\";",
      "import type { int } from \"@tsonic/csharp/types.js\";",
      "import { Dictionary } from \"@tsonic/dotnet/System.Collections.Generic.js\";",
      "",
      "export function lookup(values: Dictionary<string, int>, key: string): int {",
      "  let value: int = 0;",
      "  if (values.TryGetValue(key, out(value))) {",
      "    return value;",
      "  }",
      "  return -1;",
      "}",
      "",
      "const values = new Dictionary<string, int>();",
      "values.Add(\"hit\", 11);",
      "Console.WriteLine(`${lookup(values, \"hit\")}|${lookup(values, \"miss\")}`);",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readGeneratedModuleSource(projectDirectory);
  assert.match(generatedSource, /System\.Collections\.Generic\.Dictionary<string, int> values/);
  assert.match(generatedSource, /int value = 0;/);
  assert.match(generatedSource, /if \(values\.TryGetValue\(key, out value\)\)/);
  assert.match(generatedSource, /return value;/);
  assert.match(generatedSource, /values\.Add\("hit", 11\);/);
  assert.doesNotMatch(generatedSource, /tryGetValue|out\(value\)|__unsupported/);

  assert.equal(runGeneratedProject(projectDirectory, assemblyName), "11|-1\n");
});
