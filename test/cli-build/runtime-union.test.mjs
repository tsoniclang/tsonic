import { assert, cliPath, csharpProjectPath, readFile, resolve, run, runNode, tempRoot, test, writeProject } from "./harness.mjs";

async function readGeneratedModuleSource(projectDirectory) {
  return readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
}

test("CLI emits runtime-union arm tests and projections from finalized facts", async () => {
  const projectDirectory = resolve(tempRoot, "runtime-union-arm-projection");
  const assemblyName = "SmokeGeneratedRuntimeUnionArmProjection";
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
      "export function choose(flag: boolean): number | string {",
      "  const value: number | string = flag ? 1 : \"ready\";",
      "  return value;",
      "}",
      "",
      "export function read(value: number | string): string {",
      "  if (typeof value === \"string\") {",
      "    return value;",
      "  }",
      "  return \"fallback\";",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readGeneratedModuleSource(projectDirectory);
  assert.match(generatedSource, /Tsonic\.CSharp\.Runtime\.Union<double, string> value = flag \? 1 : "ready";/);
  assert.match(generatedSource, /if \(value\.Is2\(\)\)/);
  assert.match(generatedSource, /return value\.As2\(\);/);
  assert.doesNotMatch(generatedSource, /value is string|return value;\s*}\s*return "fallback"/);
  assert.doesNotMatch(generatedSource, /dynamic|System\.Reflection|GetProperty|GetMethod|MethodInfo\.Invoke|Activator\.CreateInstance|Assembly\.Load|__unsupported/);

  const dotnet = run("dotnet", ["build", csharpProjectPath(projectDirectory, assemblyName), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});
