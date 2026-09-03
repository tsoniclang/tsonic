import { assert, assertInstalledAssemblyReference, assertNoInstalledAssemblyReference, assertNoRuntimeProjectReference, cliPath, existsSync, readFile, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";

function assertExternalCallNotMapped(stderr, memberName) {
  assert.match(stderr, /tsts:TSTS_DIAGNOSTIC/);
  const sourceContractPatterns = {
    "<anonymous>": /'Array' only refers to a type, but is being used as a value here/u,
    isFinite: /Cannot find name 'Number'|'Number' only refers to a type|Property 'isFinite' does not exist/u,
    log: /Cannot find name 'console'|Property 'log' does not exist/u,
    toString: /Property 'toString' does not exist/u,
    trunc: /Cannot find name 'Math'|Property 'trunc' does not exist/u,
  };
  const pattern = sourceContractPatterns[memberName];
  assert.notEqual(pattern, undefined, `missing exact source-contract diagnostic expectation for ${memberName}`);
  assert.match(stderr, pattern);
}

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
  assertInstalledAssemblyReference(generatedProject, "Tsonic.CSharp.Runtime");
  assertNoRuntimeProjectReference(generatedProject, "Tsonic.CSharp.Runtime");
  assertInstalledAssemblyReference(generatedProject, "Tsonic.CSharp.Js");
  assertNoRuntimeProjectReference(generatedProject, "Tsonic.CSharp.Js");
  assertNoInstalledAssemblyReference(generatedProject, "Tsonic.CSharp.Node");
  assertNoRuntimeProjectReference(generatedProject, "Tsonic.CSharp.Node");

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
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.Math\.sin\(value\) \+ Tsonic\.CSharp\.Js\.Math\.cos\(value\) \+ Tsonic\.CSharp\.Js\.Math\.sqrt\(Tsonic\.CSharp\.Js\.Math\.pow\(value, 2\)\)/);
  assert.match(generatedSource, /public static double inverse\(double value\)/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.Math\.acos\(value\) \+ Tsonic\.CSharp\.Js\.Math\.asin\(value\) \+ Tsonic\.CSharp\.Js\.Math\.atan\(value\) \+ Tsonic\.CSharp\.Js\.Math\.atan2\(value, 2\)/);
  assert.match(generatedSource, /public static double logs\(double value\)/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.Math\.exp\(value\) \+ Tsonic\.CSharp\.Js\.Math\.log\(value\) \+ Tsonic\.CSharp\.Js\.Math\.log10\(value\) \+ Tsonic\.CSharp\.Js\.Math\.log2\(value\)/);
  assert.match(generatedSource, /public static double hyperbolic\(double value\)/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.Math\.sinh\(value\) \+ Tsonic\.CSharp\.Js\.Math\.cosh\(value\) \+ Tsonic\.CSharp\.Js\.Math\.tanh\(value\)/);
  assert.match(generatedSource, /public static double inverseHyperbolic\(double value\)/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.Math\.asinh\(value\) \+ Tsonic\.CSharp\.Js\.Math\.acosh\(value \+ 1\) \+ Tsonic\.CSharp\.Js\.Math\.atanh\(value \/ 2\)/);
  assert.match(generatedSource, /public static double rootsAndDeltas\(double value\)/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.Math\.cbrt\(value\) \+ Tsonic\.CSharp\.Js\.Math\.expm1\(value\) \+ Tsonic\.CSharp\.Js\.Math\.log1p\(value\) \+ Tsonic\.CSharp\.Js\.Math\.hypot\(value, 3\)/);
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

test("CLI emits JSON.stringify from selected JS surface facts", async () => {
  const projectDirectory = resolve(tempRoot, "standard-json-stringify");
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
            assemblyName: "SmokeGeneratedStandardJsonStringify",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function stringifyText(value: string): string {",
      "  return JSON.stringify(value);",
      "}",
      "",
      "export function stringifyNumber(value: number): string {",
      "  return JSON.stringify(value);",
      "}",
      "",
      "export function stringifyBool(value: boolean): string {",
      "  return JSON.stringify(value);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedProject = await readFile(resolve(projectDirectory, "out/csharp/SmokeGeneratedStandardJsonStringify.csproj"), "utf8");
  assertInstalledAssemblyReference(generatedProject, "Tsonic.CSharp.Js");
  assertNoRuntimeProjectReference(generatedProject, "Tsonic.CSharp.Js");

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static string stringifyText\(string value\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.JSON\.stringify\(value\);/);
  assert.match(generatedSource, /public static string stringifyNumber\(double value\)/);
  assert.match(generatedSource, /public static string stringifyBool\(bool value\)/);
  assert.doesNotMatch(generatedSource, /JSON\.stringify\(.*dynamic/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedStandardJsonStringify.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI finalizes interface-backed JSON shapes and dynamic-property typeof checks after all object shapes are known", async () => {
  const projectDirectory = resolve(tempRoot, "json-interface-shape-finalization");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{
        id: "csharp",
        surfaces: ["js"],
        options: {
          namespace: "Smoke.Generated",
          assemblyName: "SmokeGeneratedJsonInterfaceShapeFinalization",
        },
      }],
    }, null, 2),
    "src/index.ts": [
      "export interface Todo {",
      "  id: number;",
      "  title: string;",
      "  completed: boolean;",
      "}",
      "",
      "export function createTodos(): Todo[] {",
      "  const first: Todo = { id: 1, title: \"first\", completed: false };",
      "  const second: Todo = { id: 2, title: \"second\", completed: true };",
      "  return [first, second];",
      "}",
      "",
      "export function serializeTodos(values: Todo[]): string {",
      "  return JSON.stringify(values);",
      "}",
      "",
      "export function readTitle(text: string): string | undefined {",
      "  const value = JSON.parse(text) as { title?: unknown };",
      "  if (typeof value.title !== \"string\") return undefined;",
      "  return value.title;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  const generatedShapes = await readFile(resolve(projectDirectory, "out/csharp/generated/TsonicObjectShapes.cs"), "utf8");
  const generatedShape = generatedShapes.match(/public class (TodoShape_[a-f0-9]{12}) : Todo, Tsonic\.CSharp\.Js\.IJsonValue/u);
  assert.notEqual(generatedShape, null, generatedShapes);
  assert.equal(generatedShapes.match(/public class TodoShape_[a-f0-9]{12} : Todo, Tsonic\.CSharp\.Js\.IJsonValue/gu)?.length, 1);
  assert.equal(generatedSource.match(new RegExp(`new ${generatedShape[1]}`, "gu"))?.length, 2);
  assert.match(generatedSource, /public interface Todo : Tsonic\.CSharp\.Js\.IJsonValue\s*\{\s*double id \{ get; set; \}\s*string title \{ get; set; \}\s*bool completed \{ get; set; \}\s*\}/u);
  assert.equal(generatedShapes.match(/void __tsonicWriteJson\(/gu)?.length, 1);
  assert.match(generatedSource, /TsValue\.ApplyDynamicTypeof\(value\.ReadDynamicSlot\("title"\)\) != "string"/u);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedJsonInterfaceShapeFinalization.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI compiles existing TypeScript JS-surface utility code when JS surface is selected", async () => {
  const projectDirectory = resolve(tempRoot, "existing-typescript-js-surface-utility-code");
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
            assemblyName: "SmokeGeneratedExistingTypescriptJsSurfaceUtilityCode",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function appendTag(tags: string[], tag: string): string[] {",
      "  tags.push(tag);",
      "  return tags;",
      "}",
      "",
      "export function summarize(values: number[]): number {",
      "  const first = values.at(0) ?? 0;",
      "  const last = values.at(values.length - 1) ?? 0;",
      "  return Math.trunc(Math.max(first, last));",
      "}",
      "",
      "export function stringifyCount(count: number): string {",
      "  return JSON.stringify(count);",
      "}",
      "",
      "export function normalizeName(name: string): string {",
      "  return name.trim().toUpperCase().slice(0, 8);",
      "}",
      "",
      "export function renderRecord(values: Record<string, number>): string {",
      "  return Object.keys(values).join(\",\");",
      "}",
      "",
      "export function splitAndJoin(input: string): string {",
      "  return input.split(\":\").join(\"|\");",
      "}",
      "",
      "export function acceptsUser(input: string): boolean {",
      "  return /^user:/i.test(input);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedProject = await readFile(resolve(projectDirectory, "out/csharp/SmokeGeneratedExistingTypescriptJsSurfaceUtilityCode.csproj"), "utf8");
  assertInstalledAssemblyReference(generatedProject, "Tsonic.CSharp.Runtime");
  assertNoRuntimeProjectReference(generatedProject, "Tsonic.CSharp.Runtime");
  assertInstalledAssemblyReference(generatedProject, "Tsonic.CSharp.Js");
  assertNoRuntimeProjectReference(generatedProject, "Tsonic.CSharp.Js");
  assertNoInstalledAssemblyReference(generatedProject, "Tsonic.CSharp.Node");
  assertNoRuntimeProjectReference(generatedProject, "Tsonic.CSharp.Node");

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static Tsonic\.CSharp\.Js\.JSArray<string> appendTag\(Tsonic\.CSharp\.Js\.JSArray<string> tags, string tag\)/);
  assert.match(generatedSource, /tags\.push\(tag\);/);
  assert.match(generatedSource, /public static double summarize\(Tsonic\.CSharp\.Js\.JSArray<double> values\)/);
  assert.match(generatedSource, /double first = Tsonic\.CSharp\.Js\.Array\.atValue\(values, 0\) \?\? 0;/);
  assert.match(generatedSource, /double last = Tsonic\.CSharp\.Js\.Array\.atValue\(values, values\.length - 1\) \?\? 0;/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Math\.trunc\(Tsonic\.CSharp\.Js\.Math\.max\(first, last\)\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.JSON\.stringify\(count\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.String\.slice\(Tsonic\.CSharp\.Js\.String\.toUpperCase\(Tsonic\.CSharp\.Js\.String\.trim\(name\)\), 0, 8\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Array\.join\(Tsonic\.CSharp\.Js\.Object\.keys\(values\), ","\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Array\.join\(Tsonic\.CSharp\.Js\.String\.split\(input, ":"\), "\|"\);/);
  assert.match(generatedSource, /return new Tsonic\.CSharp\.Js\.RegExp\("\^user:", "i"\)\.test\(input\);/);
  assert.doesNotMatch(generatedSource, /return Math\./);
  assert.doesNotMatch(generatedSource, /return Object\./);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedExistingTypescriptJsSurfaceUtilityCode.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI rejects Math without selected JS surface facts", async () => {
  const projectDirectory = resolve(tempRoot, "math-without-js-surface");
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
            assemblyName: "SmokeGeneratedMathWithoutJsSurface",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function roundDown(value: number): number {",
      "  return Math.trunc(value);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assertExternalCallNotMapped(build.stderr, "trunc");
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedMathWithoutJsSurface.csproj")), false);
});

test("CLI rejects Math.f16round because the current TSTS default library does not expose it", async () => {
  const projectDirectory = resolve(tempRoot, "math-f16round-current-lib-exclusion");
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
            assemblyName: "SmokeGeneratedMathF16RoundCurrentLibExclusion",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function rounded(value: number): number {",
      "  return Math.f16round(value);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stdout + build.stderr, /Property 'f16round' does not exist on type 'Math'/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedMathF16RoundCurrentLibExclusion.csproj")), false);
});
