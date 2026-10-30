import { assert, cliPath, existsSync, readFile, resolve, run, runGeneratedCsharpRunner, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";
import { targetCsharpOnlyPackageJson, targetCsharpNodejsPackageJson } from "./process-buffer-crypto-os-fixtures.mjs";

test("CLI emits expanded process operations from selected Node provider-package facts", async () => {
  const projectDirectory = resolve(tempRoot, "nodejs-process-expanded-provider-package");
  await writeProject(projectDirectory, {
    "package.json": targetCsharpNodejsPackageJson(projectDirectory),
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
            assemblyName: "SmokeGeneratedNodeProcessExpanded",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import * as process from \"node:process\";",
      "",
      "export function processInfo(): string {",
      "  const pathValue = process.env[\"PATH\"] ?? \"\";",
      "  const usage = process.memoryUsage();",
      "  const identity = process.arch + process.argv0 + process.execPath + process.platform + process.version;",
      "  const versionInfo = process.versions.node + process.versions.dotnet + pathValue;",
      "  const processIds = process.pid + process.ppid + process.uptime();",
      "  const memoryInfo = usage.rss + usage.heapUsed;",
      "  return identity + versionInfo + processIds + memoryInfo;",
      "}",
      "",
      "export function currentExitCode(): number | null {",
      "  return process.exitCode;",
      "}",
      "",
      "export function changeDirectory(directory: string): void {",
      "  process.chdir(directory);",
      "}",
      "",
      "export function terminate(code?: number): void {",
      "  process.exit(code);",
      "}",
      "",
      "export function signalSelf(): boolean {",
      "  return process.kill(process.pid, 0);",
      "}",
      "",
      "export function memoryCeiling(): number {",
      "  return process.availableMemory() + process.constrainedMemory();",
      "}",
      "",
      "export function timingParts(): number {",
      "  const parts = process.hrtime();",
      "  return parts[0] + parts[1];",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.process\.env\["PATH"\] \?\? ""/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.process\.arch/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.process\.argv0/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.process\.execPath/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.process\.platform/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.process\.version/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.process\.versions\.node/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.process\.versions\.dotnet/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.process\.pid/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.process\.ppid/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.MemoryUsage usage = Tsonic\.CSharp\.Node\.process\.memoryUsage\(\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.process\.uptime\(\)/);
  assert.match(generatedSource, /usage\.rss/);
  assert.match(generatedSource, /usage\.heapUsed/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.process\.exitCode;/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.process\.chdir\(directory\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.process\.exit\(Tsonic\.CSharp\.Generated\.__TsonicConversions\.LiftNullable<double, int>\(code, System\.Convert\.ToInt32\)\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.process\.killNumber<int, double>\(Tsonic\.CSharp\.Node\.process\.pid, 0D\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.process\.availableMemory\(\) \+ Tsonic\.CSharp\.Node\.process\.constrainedMemory\(\);/);
  assert.match(generatedSource, /long\[\] parts = Tsonic\.CSharp\.Node\.process\.hrtime\(\);/);
  assert.match(generatedSource, /return parts\[0\] \+ parts\[1\];/);
  assert.doesNotMatch(generatedSource, /return process\./);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const generatedConversions = await readFile(
    resolve(projectDirectory, "out/csharp/generated/TsonicConversions.cs"),
    "utf8",
  );
  assert.equal(generatedConversions, `namespace Tsonic.CSharp.Generated
{
    internal static class __TsonicConversions
    {
        internal static TResult? LiftNullable<TSource, TResult>(TSource? value, System.Func<TSource, TResult> conversion)
        where TSource : struct
        where TResult : struct
        {
            return value.HasValue ? conversion(value.Value) : default(TResult?);
        }
    }
}
`);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedNodeProcessExpanded.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI rejects unsupported process stream properties without fallback", async () => {
  const projectDirectory = resolve(tempRoot, "nodejs-process-streams-unsupported");
  await writeProject(projectDirectory, {
    "package.json": targetCsharpNodejsPackageJson(projectDirectory),
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          surfaces: ["js"],
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import process from \"node:process\";",
      "",
      "export function streams(): void {",
      "  void process.stdin;",
      "  void process.stdout;",
      "  void process.stderr;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  for (const memberName of ["stdin", "stdout", "stderr"]) {
    assert.match(
      build.stderr,
      new RegExp(`hard-rejected selected property 'node:process' export 'default' member 'node:process\\.default\\.${memberName}'`),
    );
    assert.match(build.stderr, new RegExp(`unsupported:Tsonic\\.CSharp\\.Node\\.process\\.${memberName}`));
  }
  assert.match(build.stderr, /TS9100203/u);
  assert.doesNotMatch(build.stderr, /Reflection|dynamic|GetMethod|GetProperty|MethodInfo\.Invoke/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
});

test("CLI rejects unsupported process nextTick without fallback", async () => {
  const projectDirectory = resolve(tempRoot, "nodejs-process-nexttick-unsupported");
  await writeProject(projectDirectory, {
    "package.json": targetCsharpNodejsPackageJson(projectDirectory),
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          surfaces: ["js"],
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import process from \"node:process\";",
      "",
      "export function tick(): void {",
      "  process.nextTick(() => {});",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /hard-rejected selected call 'node:process' export 'default' member 'node:process\.default\.nextTick'/u);
  assert.match(build.stderr, /unsupported:Tsonic\.CSharp\.Node\.process\.nextTick\(Function,System\.Object\[\]\)/);
  assert.match(build.stderr, /TS9100203/u);
  assert.doesNotMatch(build.stderr, /CSHARP_NODEJS_PROPERTY_NOT_MAPPED|could not map checked .* to a target property/);
  assert.doesNotMatch(build.stderr, /Reflection|dynamic|GetMethod|GetProperty|MethodInfo\.Invoke/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
});
