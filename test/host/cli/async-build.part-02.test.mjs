import { assert, cliPath, existsSync, readFile, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../cli-build/helpers/harness.mjs";
import { readGeneratedModuleSource, runGeneratedCsharpRunner } from './async-build-fixtures.mjs';

test("CLI emits and executes async functions using selected JS Map carrier facts", async () => {
  const assemblyName = "SmokeGeneratedAsyncMapOps";
  const projectDirectory = resolve(tempRoot, "async-map-ops");
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
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "export async function total(): Promise<int32> {",
      "  const values = new Map<string, int32>();",
      "  values.set(\"a\", 1);",
      "  values.set(\"b\", 2);",
      "  return (values.get(\"a\") ?? 0) + (values.get(\"b\") ?? 0);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readGeneratedModuleSource(projectDirectory);
  assert.match(generatedSource, /public static async System\.Threading\.Tasks\.Task<int> total\(\)/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.Map<string, int> values = new Tsonic\.CSharp\.Js\.Map<string, int>\(\);/);
  assert.match(generatedSource, /values\.set\("a", 1\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.Map\.getValue<string, int>\(values, "a"\)/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const stdout = await runGeneratedCsharpRunner(projectDirectory, assemblyName, [
    "using System;",
    "using System.Threading.Tasks;",
    "",
    "public static class Program",
    "{",
    "    public static async Task Main()",
    "    {",
    "        Console.WriteLine(await Smoke.Generated.Index.total());",
    "    }",
    "}",
    "",
  ]);
  assert.equal(stdout, "3\n");
});

test("CLI emits and executes inferred async lambda statements", async () => {
  const assemblyName = "SmokeGeneratedAsyncLambdaRejected";
  const projectDirectory = resolve(tempRoot, "async-lambda-missing-delegate");
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
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function bare(): void {",
      "  (async () => 1);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);
  const generatedSource = await readGeneratedModuleSource(projectDirectory);
  assert.match(generatedSource, /public static void bare\(\)\s*\{\s*\}/u);
  assert.doesNotMatch(generatedSource, /__unsupported|System\.Reflection|\bdynamic\b/u);
  const stdout = await runGeneratedCsharpRunner(projectDirectory, assemblyName, [
    "using System;",
    "public static class Program",
    "{",
    "    public static void Main()",
    "    {",
    "        Smoke.Generated.Index.bare();",
    "        Console.WriteLine(\"completed\");",
    "    }",
    "}",
    "",
  ]);
  assert.equal(stdout, "completed\n");
});
