import { assert, assertRuntimeProjectReference, assertNoRuntimeReference, assertNoInstalledAssemblyReference, cliPath, existsSync, readFile, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";
import { assertExternalCallNotMapped } from "./math-console-json.split-fixtures.mjs";

test("CLI emits standard Math calls from selected TSTS provider facts", async () => {
  const projectDirectory = resolve(tempRoot, "standard-math-calls");
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
            assemblyName: "SmokeGeneratedStandardMathCalls",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "export function normalize(value: number): number {",
      "  return Math.trunc(Math.abs(value));",
      "}",
      "",
      "export function clamp(value: number, low: number, high: number): number {",
      "  return Math.max(low, Math.min(high, value));",
      "}",
      "",
      "export function emptyMax(): number {",
      "  return Math.max();",
      "}",
      "",
      "export function emptyMin(): number {",
      "  return Math.min();",
      "}",
      "",
      "export function curve(value: number): number {",
      "  return Math.sin(value) + Math.cos(value) + Math.sqrt(Math.pow(value, 2));",
      "}",
      "",
      "export function inverse(value: number): number {",
      "  return Math.acos(value) + Math.asin(value) + Math.atan(value) + Math.atan2(value, 2);",
      "}",
      "",
      "export function logs(value: number): number {",
      "  return Math.exp(value) + Math.log(value) + Math.log10(value) + Math.log2(value);",
      "}",
      "",
      "export function hyperbolic(value: number): number {",
      "  return Math.sinh(value) + Math.cosh(value) + Math.tanh(value);",
      "}",
      "",
      "export function inverseHyperbolic(value: number): number {",
      "  return Math.asinh(value) + Math.acosh(value + 1) + Math.atanh(value / 2);",
      "}",
      "",
      "export function rootsAndDeltas(value: number): number {",
      "  return Math.cbrt(value) + Math.expm1(value) + Math.log1p(value) + Math.hypot(value, 3);",
      "}",
      "",
      "export function rounding(value: number): number {",
      "  return Math.ceil(value) + Math.floor(value) + Math.round(value) + Math.sign(value) + Math.fround(value);",
      "}",
      "",
      "export function bitOps(left: int32, right: int32): int32 {",
      "  return Math.imul(left, right) + Math.clz32(left);",
      "}",
      "",
      "export function constants(): number {",
      "  return Math.E + Math.PI + Math.LN2 + Math.LN10 + Math.LOG2E + Math.LOG10E + Math.SQRT1_2 + Math.SQRT2;",
      "}",
      "",
      "export function sample(): number {",
      "  return Math.random();",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedProject = await readFile(resolve(projectDirectory, "out/csharp/SmokeGeneratedStandardMathCalls.csproj"), "utf8");
  assertRuntimeProjectReference(generatedProject, "Tsonic.CSharp.Runtime");
  assertNoInstalledAssemblyReference(generatedProject, "Tsonic.CSharp.Runtime");
  assertRuntimeProjectReference(generatedProject, "Tsonic.CSharp.Js");
  assertNoInstalledAssemblyReference(generatedProject, "Tsonic.CSharp.Js");
  assertNoRuntimeReference(generatedProject, "Tsonic.CSharp.Node");
  assertNoInstalledAssemblyReference(generatedProject, "Tsonic.CSharp.Node");

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static double normalize\(double value\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Math\.trunc\(Tsonic\.CSharp\.Js\.Math\.abs\(value\)\);/);
  assert.match(generatedSource, /public static double clamp\(double value, double low, double high\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Math\.max\(low, Tsonic\.CSharp\.Js\.Math\.min\(high, value\)\);/);
  assert.match(generatedSource, /public static double emptyMax\(\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Math\.max\(\);/);
  assert.match(generatedSource, /public static double emptyMin\(\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Math\.min\(\);/);
  assert.match(generatedSource, /public static double curve\(double value\)/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.Math\.sin\(value\) \+ Tsonic\.CSharp\.Js\.Math\.cos\(value\) \+ Tsonic\.CSharp\.Js\.Math\.sqrt\(Tsonic\.CSharp\.Js\.Math\.pow\(value, 2D\)\)/);
  assert.match(generatedSource, /public static double inverse\(double value\)/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.Math\.acos\(value\) \+ Tsonic\.CSharp\.Js\.Math\.asin\(value\) \+ Tsonic\.CSharp\.Js\.Math\.atan\(value\) \+ Tsonic\.CSharp\.Js\.Math\.atan2\(value, 2D\)/);
  assert.match(generatedSource, /public static double logs\(double value\)/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.Math\.exp\(value\) \+ Tsonic\.CSharp\.Js\.Math\.log\(value\) \+ Tsonic\.CSharp\.Js\.Math\.log10\(value\) \+ Tsonic\.CSharp\.Js\.Math\.log2\(value\)/);
  assert.match(generatedSource, /public static double hyperbolic\(double value\)/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.Math\.sinh\(value\) \+ Tsonic\.CSharp\.Js\.Math\.cosh\(value\) \+ Tsonic\.CSharp\.Js\.Math\.tanh\(value\)/);
  assert.match(generatedSource, /public static double inverseHyperbolic\(double value\)/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.Math\.asinh\(value\) \+ Tsonic\.CSharp\.Js\.Math\.acosh\(value \+ 1D\) \+ Tsonic\.CSharp\.Js\.Math\.atanh\(value \/ 2D\)/);
  assert.match(generatedSource, /public static double rootsAndDeltas\(double value\)/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.Math\.cbrt\(value\) \+ Tsonic\.CSharp\.Js\.Math\.expm1\(value\) \+ Tsonic\.CSharp\.Js\.Math\.log1p\(value\) \+ Tsonic\.CSharp\.Js\.Math\.hypot\(value, 3D\)/);
  assert.match(generatedSource, /public static double rounding\(double value\)/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.Math\.ceil\(value\) \+ Tsonic\.CSharp\.Js\.Math\.floor\(value\) \+ Tsonic\.CSharp\.Js\.Math\.round\(value\) \+ Tsonic\.CSharp\.Js\.Math\.sign\(value\) \+ Tsonic\.CSharp\.Js\.Math\.fround\(value\)/);
  assert.match(generatedSource, /public static int bitOps\(int left, int right\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Math\.imul\(left, right\) \+ Tsonic\.CSharp\.Js\.Math\.clz32\(left\);/);
  assert.match(generatedSource, /public static double constants\(\)/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.Math\.E \+ Tsonic\.CSharp\.Js\.Math\.PI \+ Tsonic\.CSharp\.Js\.Math\.LN2 \+ Tsonic\.CSharp\.Js\.Math\.LN10 \+ Tsonic\.CSharp\.Js\.Math\.LOG2E \+ Tsonic\.CSharp\.Js\.Math\.LOG10E \+ Tsonic\.CSharp\.Js\.Math\.SQRT1_2 \+ Tsonic\.CSharp\.Js\.Math\.SQRT2/);
  assert.match(generatedSource, /public static double sample\(\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Math\.random\(\);/);
  assert.doesNotMatch(generatedSource, /return Math\./);
  assert.doesNotMatch(generatedSource, /InvalidExpression|__unsupported|Reflection|GetProperty|GetMethod|dynamic/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedStandardMathCalls.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

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
