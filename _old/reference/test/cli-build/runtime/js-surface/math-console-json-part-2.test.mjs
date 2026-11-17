import { assert, assertRuntimeProjectReference, assertNoRuntimeReference, assertNoInstalledAssemblyReference, cliPath, existsSync, readFile, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";
import { assertExternalCallNotMapped } from "./math-console-json-fixtures.mjs";

test("CLI emits selected JS console calls through the C# JS runtime", async () => {
  const projectDirectory = resolve(tempRoot, "standard-console-calls");
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
            assemblyName: "SmokeGeneratedConsoleCalls",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function write(label: string, count: number, ok: boolean): void {",
      "  console.log(label, count, ok);",
      "  console.error(label);",
      "  console.warn(label);",
      "  console.info(label);",
      "  console.debug(label);",
      "  console.trace(label);",
      "  console.assert(ok, label);",
      "  console.assert();",
      "  console.assert(ok, label, count);",
      "  console.time(label);",
      "  console.timeLog(label, count);",
      "  console.timeEnd(label);",
      "  console.timeStamp(label);",
      "  console.count(label);",
      "  console.countReset(label);",
      "  console.group(label);",
      "  console.groupCollapsed(label);",
      "  console.groupEnd();",
      "  console.clear();",
      "  console.dir(label, \"depth=1\");",
      "  console.dirxml(label, count);",
      "  console.table(label, [\"length\"]);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static void write\(string label, double count, bool ok\)/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.console\.log\(label, count, ok\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.console\.error\(label\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.console\.warn\(label\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.console\.info\(label\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.console\.debug\(label\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.console\.trace\(label\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.console\.assert\(ok, label\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.console\.assert\(\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.console\.assert\(ok, label, count\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.console\.time\(label\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.console\.timeLog\(label, count\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.console\.timeEnd\(label\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.console\.timeStamp\(label\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.console\.count\(label\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.console\.countReset\(label\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.console\.group\(label\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.console\.groupCollapsed\(label\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.console\.groupEnd\(\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.console\.clear\(\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.console\.dir\(label, "depth=1"\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.console\.dirxml\(label, count\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.console\.table\(label, .*length.*\);/s);
  assert.doesNotMatch(generatedSource, /__unsupported|InvalidExpression/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedConsoleCalls.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI rejects console.log without selected JS surface facts", async () => {
  const projectDirectory = resolve(tempRoot, "console-log-without-js-surface");
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
            assemblyName: "SmokeGeneratedConsoleLogWithoutJsSurface",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function write(value: string): void {",
      "  console.log(value);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assertExternalCallNotMapped(build.stderr, "log");
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedConsoleLogWithoutJsSurface.csproj")), false);
});
