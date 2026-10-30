import { assert, assertRuntimeProjectReference, assertNoRuntimeReference, assertNoInstalledAssemblyReference, cliPath, existsSync, readFile, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";
import { assertExternalCallNotMapped } from "./collections-fixtures.mjs";

test("CLI emits extended Map and Set operations from selected JS surface facts", async () => {
  const projectDirectory = resolve(tempRoot, "map-set-extended-surface-operations");
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
            assemblyName: "SmokeGeneratedMapSetExtendedSurfaceOperations",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "export function mapExtended(seed: int32): int32 {",
      "  const source = new Map<string, int32>();",
      "  source.set(\"alpha\", 1);",
      "  source.set(\"beta\", 2);",
      "  const copy = new Map<string, int32>(source.entries());",
      "  copy.set(\"gamma\", seed);",
      "  let total = copy.size;",
      "  if (copy.delete(\"beta\")) {",
      "    total = total + 10;",
      "  }",
      "  copy.forEach((value, key) => {",
      "    total = total + value;",
      "    if (key === \"alpha\") {",
      "      total = total + 100;",
      "    }",
      "  });",
      "  const values = Array.from(copy.values());",
      "  const entries = Array.from(copy.entries());",
      "  copy.clear();",
      "  return total + values.length + entries.length + copy.size;",
      "}",
      "",
      "export function setExtended(value: string): int32 {",
      "  const source = new Set<string>();",
      "  source.add(\"alpha\");",
      "  source.add(\"beta\");",
      "  const copy = new Set<string>(source.values());",
      "  copy.add(value);",
      "  let total = copy.size;",
      "  if (copy.delete(\"beta\")) {",
      "    total = total + 10;",
      "  }",
      "  copy.forEach((item) => {",
      "    if (copy.has(item)) {",
      "      total = total + 1;",
      "    }",
      "  });",
      "  const keys = Array.from(copy.keys());",
      "  const values = Array.from(copy.values());",
      "  const entries = Array.from(copy.entries());",
      "  copy.clear();",
      "  return total + keys.length + values.length + entries.length + copy.size;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /new Tsonic\.CSharp\.Js\.Map<string, int>\(source\.entries\(\)\)/);
  assert.match(generatedSource, /copy\.forEach\(\(int value, string key, Tsonic\.CSharp\.Js\.Map<string, int> __tsonic_param\d+\) =>\s*\{\s*total = total \+ value;\s*if \(key == "alpha"\)\s*\{\s*total = total \+ 100;\s*\}\s*\}\);/u);
  assert.match(generatedSource, /copy\.forEach\(\(string item, string __tsonic_param\d+, Tsonic\.CSharp\.Js\.Set<string> __tsonic_param\d+\) =>\s*\{\s*if \(copy\.has\(item\)\)\s*\{\s*total = total \+ 1;\s*\}\s*\}\);/u);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.JSArrayStatics\.from<int>\(copy\.values\(\)\)/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.JSArrayStatics\.from<\(string, int\)>\(copy\.entries\(\)\)/);
  assert.match(generatedSource, /copy\.clear\(\);/);
  assert.match(generatedSource, /new Tsonic\.CSharp\.Js\.Set<string>\(source\.values\(\)\)/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.JSArrayStatics\.from<string>\(copy\.keys\(\)\)/);
  assert.doesNotMatch(generatedSource, /InvalidExpression|__unsupported|Reflection|GetProperty|GetMethod|dynamic/);
  assert.doesNotMatch(generatedSource, /System\.Collections\.Generic\.Dictionary|System\.Collections\.Generic\.HashSet/);
  assert.doesNotMatch(generatedSource, /new Map|new Set|MapConstructor|SetConstructor/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedMapSetExtendedSurfaceOperations.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});
