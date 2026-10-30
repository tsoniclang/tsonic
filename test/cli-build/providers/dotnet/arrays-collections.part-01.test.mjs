import { assert, cliPath, dotnetOutputAssemblyPath, existsSync, readFile, repoRoot, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";
import { readGeneratedModuleSource } from "./arrays-collections.split-fixtures.mjs";

test("CLI emits provider-owned generic collection constructors from virtual target modules", async () => {
  const projectDirectory = resolve(tempRoot, "provider-generic-list-constructor");
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
            assemblyName: "SmokeGeneratedProviderGenericList",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int } from \"@tsonic/csharp/types.js\";",
      "import { List } from \"@tsonic/dotnet/System.Collections.Generic.js\";",
      "",
      "export function makeInts(): List<int> {",
      "  return new List<int>([1, 2, 3]);",
      "}",
      "",
      "export function countInts(): int {",
      "  const values = new List<int>([1, 2, 3]);",
      "  return values.Count;",
      "}",
      "",
      "export function mutateInts(): int {",
      "  const values = new List<int>();",
      "  values.Add(1);",
      "  values.Add(2);",
      "  return values[0] + values.Count;",
      "}",
      "",
      "export function replaceFirst(value: int): int {",
      "  const values = new List<int>([1, 2, 3]);",
      "  values[0] = value;",
      "  return values[0];",
      "}",
      "",
      "export function searchInts(): boolean {",
      "  const values = new List<int>([1, 2, 3]);",
      "  return values.Contains(2) && values.IndexOf(1) === 0;",
      "}",
      "",
      "export function removeInts(): int[] {",
      "  const values = new List<int>([1, 2, 3]);",
      "  values.Remove(2);",
      "  values.RemoveAt(0);",
      "  return values.ToArray();",
      "}",
      "",
      "export function clearInts(): int {",
      "  const values = new List<int>([1, 2, 3]);",
      "  values.Clear();",
      "  return values.Count;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readGeneratedModuleSource(projectDirectory);
  assert.match(generatedSource, /System\.Collections\.Generic\.List<int> makeInts\(\)/);
  assert.match(generatedSource, /return new System\.Collections\.Generic\.List<int>\(new int\[\] \{ 1, 2, 3 \}\);/);
  assert.match(generatedSource, /System\.Collections\.Generic\.List<int> values = new System\.Collections\.Generic\.List<int>\(new int\[\] \{ 1, 2, 3 \}\);/);
  assert.match(generatedSource, /return values\.Count;/);
  assert.match(generatedSource, /public static int mutateInts\(\)/);
  assert.match(generatedSource, /values\.Add\(1\);/);
  assert.match(generatedSource, /values\.Add\(2\);/);
  assert.match(generatedSource, /return values\[0\] \+ values\.Count;/);
  assert.match(generatedSource, /public static int replaceFirst\(int value\)/);
  assert.match(generatedSource, /values\[0\] = value;/);
  assert.match(generatedSource, /return values\[0\];/);
  assert.match(generatedSource, /public static bool searchInts\(\)/);
  assert.match(generatedSource, /return values\.Contains\(2\) && values\.IndexOf\(1\) == 0;/);
  assert.match(generatedSource, /public static int\[\] removeInts\(\)/);
  assert.match(generatedSource, /values\.Remove\(2\);/);
  assert.match(generatedSource, /values\.RemoveAt\(0\);/);
  assert.match(generatedSource, /return values\.ToArray\(\);/);
  assert.match(generatedSource, /public static int clearInts\(\)/);
  assert.match(generatedSource, /values\.Clear\(\);/);
  assert.doesNotMatch(generatedSource, /bindings\.json/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedProviderGenericList.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

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
