import { assert, assertRuntimeProjectReference, cliPath, existsSync, readFile, resolve, run, runGeneratedCsharpRunner, runGeneratedProject, runNode, targetCsharpNodejsPackageJson, targetCsharpOnlyPackageJson, tempRoot, test, writeProject } from "../../helpers/harness.mjs";

test("CLI emits supported Node fs watchers and read streams from selected provider facts", async () => {
  const projectDirectory = resolve(tempRoot, "nodejs-supported-fs-watch-stream-operations");
  const assemblyName = "SmokeGeneratedNodeFsWatchStreams";
  await writeProject(projectDirectory, {
    "package.json": targetCsharpNodejsPackageJson(projectDirectory),
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{
        id: "csharp",
        surfaces: ["js"],
        options: {
          namespace: "Smoke.Generated",
          assemblyName,
        },
      }],
    }, null, 2),
    "src/index.ts": [
      "import { createReadStream, unwatchFile, watch, watchFile } from \"node:fs\";",
      "",
      "export function observe(path: string): void {",
      "  const watcher = watch(path, () => {});",
      "  watcher.close();",
      "  const statWatcher = watchFile(path, () => {});",
      "  statWatcher.close();",
      "  unwatchFile(path);",
      "  createReadStream(path);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /string (?<path>__tsonic_value_\d+) = path;\s*static void (?<listener>__tsonic_callable_\d+)\(\)\s*\{\s*\}\s*Tsonic\.CSharp\.Node\.FsWatcher watcher = Tsonic\.CSharp\.Node\.fs\.watch\(\k<path>, \(\(Action\)new Action\(\k<listener>\)\) switch \{ var (?<callable>_*tsonic_callable) => \(Action<string, string\?>\)\(\(string __tsonic_arg0, string\? __tsonic_arg1\) =>\s*\{\s*\k<callable>\(\);\s*return;\s*\}\) \}\);\s*watcher\.close\(\);/u);
  assert.match(generatedSource, /string (?<path>__tsonic_value_\d+) = path;\s*static void (?<listener>__tsonic_callable_\d+)\(\)\s*\{\s*\}\s*Tsonic\.CSharp\.Node\.StatWatcher statWatcher = Tsonic\.CSharp\.Node\.fs\.watchFile\(\k<path>, \(\(Action\)new Action\(\k<listener>\)\) switch \{ var (?<callable>_*tsonic_callable) => \(Action<Tsonic\.CSharp\.Node\.Stats, Tsonic\.CSharp\.Node\.Stats>\)\(\(Tsonic\.CSharp\.Node\.Stats _*tsonic_arg0, Tsonic\.CSharp\.Node\.Stats _*tsonic_arg1\) =>\s*\{\s*\k<callable>\(\);\s*return;\s*\}\) \}\);\s*statWatcher\.close\(\);/u);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.fs\.unwatchFile\(path\);/u);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.fs\.createReadStream\(path\);/u);
  assert.doesNotMatch(generatedSource, /__unsupported|System\.Reflection|\bdynamic\b/u);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, `out/csharp/${assemblyName}.csproj`), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});
