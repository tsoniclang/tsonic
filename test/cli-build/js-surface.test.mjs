import { assert, cliPath, existsSync, readFile, resolve, run, runNode, tempRoot, test, writeProject } from "./harness.mjs";

function assertExternalCallNotMapped(stderr, memberName) {
  assert.match(stderr, new RegExp(`C# target requires selected target facts for external TypeScript declaration call '${memberName}'`));
  assert.match(stderr, /Missing selected target mapping/);
  assert.doesNotMatch(stderr, /TS9000011/);
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
  assert.match(generatedProject, /Tsonic\.CSharp\.Runtime\.csproj/);
  assert.match(generatedProject, /Tsonic\.CSharp\.Js\.csproj/);
  assert.doesNotMatch(generatedProject, /Tsonic\.CSharp\.Node\.csproj/);

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
  assert.match(generatedProject, /Tsonic\.CSharp\.Js\.csproj/);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static string stringifyText\(string value\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.JSON\.stringify\(value\);/);
  assert.match(generatedSource, /public static string stringifyNumber\(double value\)/);
  assert.match(generatedSource, /public static string stringifyBool\(bool value\)/);
  assert.doesNotMatch(generatedSource, /JSON\.stringify\(.*dynamic/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedStandardJsonStringify.csproj"), "--nologo", "--v:minimal"]);
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
  assert.match(generatedProject, /Tsonic\.CSharp\.Runtime\.csproj/);
  assert.match(generatedProject, /Tsonic\.CSharp\.Js\.csproj/);
  assert.doesNotMatch(generatedProject, /Tsonic\.CSharp\.Node\.csproj/);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static System\.Collections\.Generic\.List<string> appendTag\(System\.Collections\.Generic\.List<string> tags, string tag\)/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.Array\.push\(tags, tag\);/);
  assert.match(generatedSource, /public static double summarize\(System\.Collections\.Generic\.IReadOnlyList<double> values\)/);
  assert.match(generatedSource, /double first = Tsonic\.CSharp\.Js\.Array\.atValue\(values, 0\) \?\? 0;/);
  assert.match(generatedSource, /double last = Tsonic\.CSharp\.Js\.Array\.atValue\(values, values\.Count - 1\) \?\? 0;/);
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

test("CLI emits Map and Set operations from selected JS surface facts", async () => {
  const projectDirectory = resolve(tempRoot, "map-set-surface-operations");
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
            assemblyName: "SmokeGeneratedMapSetSurfaceOperations",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "export function countHas(key: string): boolean {",
      "  const counts = new Map<string, int32>();",
      "  counts.set(\"alpha\", 1);",
      "  counts.set(key, 2);",
      "  return counts.has(key);",
      "}",
      "",
      "export function countGet(key: string): int32 | undefined {",
      "  const counts = new Map<string, int32>();",
      "  counts.set(\"alpha\", 1);",
      "  return counts.get(key);",
      "}",
      "",
      "export function countGetOr(key: string, fallback: int32): int32 {",
      "  const counts = new Map<string, int32>();",
      "  counts.set(\"alpha\", 1);",
      "  return counts.get(key) ?? fallback;",
      "}",
      "",
      "export function namesHas(value: string): boolean {",
      "  const names = new Set<string>();",
      "  names.add(\"alpha\");",
      "  names.add(value);",
      "  return names.has(value);",
      "}",
      "",
      "export function mapKeys(): string[] {",
      "  const counts = new Map<string, int32>();",
      "  counts.set(\"alpha\", 1);",
      "  counts.set(\"beta\", 2);",
      "  return Array.from(counts.keys());",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedProject = await readFile(resolve(projectDirectory, "out/csharp/SmokeGeneratedMapSetSurfaceOperations.csproj"), "utf8");
  assert.match(generatedProject, /Tsonic\.CSharp\.Runtime\.csproj/);
  assert.match(generatedProject, /Tsonic\.CSharp\.Js\.csproj/);
  assert.doesNotMatch(generatedProject, /Tsonic\.CSharp\.Node\.csproj/);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static bool countHas\(string key\)/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.Map<string, int> counts = new Tsonic\.CSharp\.Js\.Map<string, int>\(\);/);
  assert.match(generatedSource, /counts\.set\("alpha", 1\);/);
  assert.match(generatedSource, /counts\.set\(key, 2\);/);
  assert.match(generatedSource, /return counts\.has\(key\);/);
  assert.match(generatedSource, /public static int\? countGet\(string key\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Map\.getValue\(counts, key\);/);
  assert.match(generatedSource, /public static int countGetOr\(string key, int fallback\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Map\.getValue\(counts, key\) \?\? fallback;/);
  assert.match(generatedSource, /public static bool namesHas\(string value\)/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.Set<string> names = new Tsonic\.CSharp\.Js\.Set<string>\(\);/);
  assert.match(generatedSource, /names\.add\("alpha"\);/);
  assert.match(generatedSource, /names\.add\(value\);/);
  assert.match(generatedSource, /return names\.has\(value\);/);
  assert.match(generatedSource, /public static System\.Collections\.Generic\.List<string> mapKeys\(\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Array\.from\(counts\.keys\(\)\);/);
  assert.doesNotMatch(generatedSource, /InvalidExpression|__unsupported|Reflection|GetProperty|GetMethod|dynamic/);
  assert.doesNotMatch(generatedSource, /System\.Collections\.Generic\.Dictionary|System\.Collections\.Generic\.HashSet/);
  assert.doesNotMatch(generatedSource, /new Map|new Set|MapConstructor|SetConstructor/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedMapSetSurfaceOperations.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

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
  assert.match(generatedSource, /copy\.forEach\(/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.Array\.from\(copy\.values\(\)\)/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.Array\.from\(copy\.entries\(\)\)/);
  assert.match(generatedSource, /copy\.clear\(\);/);
  assert.match(generatedSource, /new Tsonic\.CSharp\.Js\.Set<string>\(source\.values\(\)\)/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.Array\.from\(copy\.keys\(\)\)/);
  assert.doesNotMatch(generatedSource, /InvalidExpression|__unsupported|Reflection|GetProperty|GetMethod|dynamic/);
  assert.doesNotMatch(generatedSource, /System\.Collections\.Generic\.Dictionary|System\.Collections\.Generic\.HashSet/);
  assert.doesNotMatch(generatedSource, /new Map|new Set|MapConstructor|SetConstructor/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedMapSetExtendedSurfaceOperations.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI rejects Map and Set without selected JS surface declarations", async () => {
  const projectDirectory = resolve(tempRoot, "map-set-without-js-surface");
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
            assemblyName: "SmokeGeneratedMapSetWithoutJsSurface",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function count(key: string): number {",
      "  const counts = new Map<string, number>();",
      "  const names = new Set<string>();",
      "  counts.set(key, 1);",
      "  names.add(key);",
      "  return counts.size + names.size;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /C# property access 'size' must be selected by TSTS\/provider facts before emission/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedMapSetWithoutJsSurface.csproj")), false);
});

test("CLI rejects existing TypeScript JS built-ins without selected JS surface facts", async () => {
  const projectDirectory = resolve(tempRoot, "existing-typescript-js-builtins-without-js-surface");
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
            assemblyName: "SmokeGeneratedExistingTypescriptJsBuiltinsWithoutJsSurface",
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
      "export function normalizeName(name: string): string {",
      "  return name.trim().toUpperCase().slice(0, 8);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /C# native array source contract has no target-backed property 'push'/);
  assert.match(build.stderr, /C# property access 'trim' must be selected by TSTS\/provider facts before emission/);
  assert.match(build.stderr, /C# property access 'toUpperCase' must be selected by TSTS\/provider facts before emission/);
  assert.match(build.stderr, /C# property access 'slice' must be selected by TSTS\/provider facts before emission/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedExistingTypescriptJsBuiltinsWithoutJsSurface.csproj")), false);
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

test("CLI rejects Boolean methods without selected JS surface facts", async () => {
  const projectDirectory = resolve(tempRoot, "boolean-without-js-surface");
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
            assemblyName: "SmokeGeneratedBooleanWithoutJsSurface",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function asText(value: boolean): string {",
      "  return value.toString();",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assertExternalCallNotMapped(build.stderr, "toString");
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedBooleanWithoutJsSurface.csproj")), false);
});

test("CLI rejects Number methods without selected JS surface facts", async () => {
  const projectDirectory = resolve(tempRoot, "number-without-js-surface");
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
            assemblyName: "SmokeGeneratedNumberWithoutJsSurface",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function finite(value: number): boolean {",
      "  return Number.isFinite(value);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assertExternalCallNotMapped(build.stderr, "isFinite");
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedNumberWithoutJsSurface.csproj")), false);
});

test("CLI rejects unsupported JS expression carriers even when JS surface is selected", async () => {
  const projectDirectory = resolve(tempRoot, "unsupported-js-expression-carrier");
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
            assemblyName: "SmokeGeneratedUnsupportedJsExpressionCarrier",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function stringifyMap(value: number): string {",
      "  const entries = new Map<string, number>();",
      "  entries.set(\"value\", value);",
      "  return JSON.stringify(entries);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /C# JS surface could not map checked TypeScript library call 'JSON\.stringify' because the selected receiver lacks finalized target runtime facts/);
  assert.doesNotMatch(build.stderr, /Reflection|GetMethod|GetProperty/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedUnsupportedJsExpressionCarrier.csproj")), false);
});

test("CLI emits typeof narrowing through selected TSTS target facts", async () => {
  const projectDirectory = resolve(tempRoot, "typeof-narrowing");
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
            assemblyName: "SmokeGeneratedTypeofNarrowing",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "export function lengthOrZero(value: string | null): number {",
      "  if (typeof value === \"string\") {",
      "    return value.length;",
      "  }",
      "  return 0;",
      "}",
      "",
      "export function isMissing(value: string | null): boolean {",
      "  return typeof value !== \"string\";",
      "}",
      "",
      "export function isNumber(value: number | null): boolean {",
      "  return typeof value === \"number\";",
      "}",
      "",
      "export function isBoolean(value: boolean | null): boolean {",
      "  return typeof value === \"boolean\";",
      "}",
      "",
      "export function kindOfString(value: string): string {",
      "  return typeof value;",
      "}",
      "",
      "export function kindOfNumber(value: number): string {",
      "  return typeof value;",
      "}",
      "",
      "export function kindOfBoolean(value: boolean): string {",
      "  return typeof value;",
      "}",
      "",
      "export function kindOfInt32(value: int32): string {",
      "  return typeof value;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static double lengthOrZero\(string\? value\)/);
  assert.match(generatedSource, /if \(value is string\)/);
  assert.match(generatedSource, /return value\.Length;/);
  assert.match(generatedSource, /public static bool isMissing\(string\? value\)/);
  assert.match(generatedSource, /return value is not string;/);
  assert.match(generatedSource, /public static bool isNumber\(double\? value\)/);
  assert.match(generatedSource, /return value is double;/);
  assert.match(generatedSource, /public static bool isBoolean\(bool\? value\)/);
  assert.match(generatedSource, /return value is bool;/);
  assert.match(generatedSource, /public static string kindOfString\(string value\)/);
  assert.match(generatedSource, /return "string";/);
  assert.match(generatedSource, /public static string kindOfNumber\(double value\)/);
  assert.match(generatedSource, /return "number";/);
  assert.match(generatedSource, /public static string kindOfBoolean\(bool value\)/);
  assert.match(generatedSource, /return "boolean";/);
  assert.match(generatedSource, /public static string kindOfInt32\(int value\)/);
  assert.match(generatedSource, /return "number";/);
  assert.doesNotMatch(generatedSource, /typeof/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedTypeofNarrowing.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});


test("CLI rejects standalone typeof without selected exact provider runtime-kind facts", async () => {
  const projectDirectory = resolve(tempRoot, "unsupported-standalone-typeof");
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
            assemblyName: "SmokeGeneratedUnsupportedStandaloneTypeof",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function kindOfMaybeString(value: string | null): string {",
      "  return typeof value;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);

  assert.notEqual(build.status, 0);
  assert.match(build.stderr, /C# typeof expression emission requires a selected provider typeof operator fact/);
});


test("CLI emits array length and indexer access from TSTS provider facts", async () => {
  const projectDirectory = resolve(tempRoot, "array-surface-operations");
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
            assemblyName: "SmokeGeneratedArraySurfaceOperations",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "export function first(values: int32[]): int32 {",
      "  return values[0];",
      "}",
      "",
      "export function pick(values: int32[], index: int32): int32 {",
      "  return values[index];",
      "}",
      "",
      "export function assign(values: int32[], index: int32, value: int32): int32 {",
      "  values[index] = value;",
      "  return values[index];",
      "}",
      "",
      "export function count(values: int32[]): int32 {",
      "  return values.length;",
      "}",
      "",
      "export function join(values: int32[]): string {",
      "  return values.join(\"|\");",
      "}",
      "",
      "export function has(values: int32[], value: int32): boolean {",
      "  return values.includes(value);",
      "}",
      "",
      "export function atOr(values: int32[], index: int32): int32 {",
      "  return values.at(index) ?? -1;",
      "}",
      "",
      "export function popOr(values: int32[]): int32 {",
      "  return values.pop() ?? -1;",
      "}",
      "",
      "export function shiftOr(values: int32[]): int32 {",
      "  return values.shift() ?? -1;",
      "}",
      "",
      "export function firstPositive(values: int32[]): int32 {",
      "  return values.find((value: int32, index: int32) => value > 0 && index > 0) ?? -1;",
      "}",
      "",
      "export function lastPositive(values: int32[]): int32 {",
      "  return values.findLast((value: int32, index: int32, source: int32[]) => source.length > index && value > 0) ?? -1;",
      "}",
      "",
      "export function hasFrom(values: int32[], value: int32, start: int32): boolean {",
      "  return values.includes(value, start);",
      "}",
      "",
      "export function positionOf(values: int32[], value: int32): int32 {",
      "  return values.indexOf(value);",
      "}",
      "",
      "export function positionOfFrom(values: int32[], value: int32, start: int32): int32 {",
      "  return values.indexOf(value, start);",
      "}",
      "",
      "export function lastPositionOf(values: int32[], value: int32): int32 {",
      "  return values.lastIndexOf(value);",
      "}",
      "",
      "export function lastPositionOfFrom(values: int32[], value: int32, start: int32): int32 {",
      "  return values.lastIndexOf(value, start);",
      "}",
      "",
      "export function sumEach(values: int32[]): int32 {",
      "  let total: int32 = 0;",
      "  values.forEach((value: int32, index: int32, source: int32[]) => {",
      "    total += value + index + source.length;",
      "  });",
      "  return total;",
      "}",
      "",
      "export function hasPositive(values: int32[]): boolean {",
      "  return values.some((value: int32, index: int32) => value > 0 && index > 0);",
      "}",
      "",
      "export function allPositive(values: int32[]): boolean {",
      "  return values.every((value: int32, index: int32, source: int32[]) => source.length > index && value > 0);",
      "}",
      "",
      "export function firstPositiveIndex(values: int32[]): int32 {",
      "  return values.findIndex((value: int32, index: int32) => value > 0 && index > 0);",
      "}",
      "",
      "export function lastPositiveIndex(values: int32[]): int32 {",
      "  return values.findLastIndex((value: int32, index: int32, source: int32[]) => source.length > index && value > 0);",
      "}",
      "",
      "export function sliceAll(values: int32[]): int32[] {",
      "  return values.slice();",
      "}",
      "",
      "export function sliceFrom(values: int32[], start: int32): int32[] {",
      "  return values.slice(start);",
      "}",
      "",
      "export function sliceRange(values: int32[], start: int32, end: int32): int32[] {",
      "  return values.slice(start, end);",
      "}",
      "",
      "export function destruct(values: int32[]): int32 {",
      "  const [first, second] = values;",
      "  return first + second;",
      "}",
      "",
      "export function destructDefault(values: int32[]): int32 {",
      "  const [first = 1, second = 2] = values;",
      "  return first + second;",
      "}",
      "",
      "export function destructRest(values: int32[]): int32[] {",
      "  const [first, ...rest] = values;",
      "  return rest;",
      "}",
      "",
      "export function append(values: int32[], value: int32): int32[] {",
      "  return [...values, value];",
      "}",
      "",
      "export function prepend(values: int32[], value: int32): int32[] {",
      "  return [value, ...values];",
      "}",
      "",
      "export function copy(values: int32[]): int32[] {",
      "  return Array.from(values);",
      "}",
      "",
      "export function chars(value: string): string[] {",
      "  return Array.from(value);",
      "}",
      "",
      "export function make(left: int32, right: int32): int32[] {",
      "  return Array.of(left, right);",
      "}",
      "",
      "export function isActuallyArray(values: int32[]): boolean {",
      "  return Array.isArray(values);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static int first\(System\.Collections\.Generic\.IReadOnlyList<int> values\)/);
  assert.match(generatedSource, /return values\[0\];/);
  assert.match(generatedSource, /public static int pick\(System\.Collections\.Generic\.IReadOnlyList<int> values, int index\)/);
  assert.match(generatedSource, /return values\[index\];/);
  assert.match(generatedSource, /public static int assign\(System\.Collections\.Generic\.List<int> values, int index, int value\)/);
  assert.match(generatedSource, /values\[index\] = value;/);
  assert.match(generatedSource, /return values\[index\];/);
  assert.match(generatedSource, /public static int count\(System\.Collections\.Generic\.IReadOnlyList<int> values\)/);
  assert.match(generatedSource, /return values\.Count;/);
  assert.match(generatedSource, /public static string join\(System\.Collections\.Generic\.IReadOnlyList<int> values\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Array\.join\(values, "\|"\);/);
  assert.match(generatedSource, /public static bool has\(System\.Collections\.Generic\.IReadOnlyList<int> values, int value\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Array\.includes\(values, value\);/);
  assert.match(generatedSource, /public static int atOr\(System\.Collections\.Generic\.IReadOnlyList<int> values, int index\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Array\.atValue\(values, index\) \?\? -1;/);
  assert.match(generatedSource, /public static int popOr\(System\.Collections\.Generic\.List<int> values\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Array\.popValue\(values\) \?\? -1;/);
  assert.match(generatedSource, /public static int shiftOr\(System\.Collections\.Generic\.List<int> values\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Array\.shiftValue\(values\) \?\? -1;/);
  assert.match(generatedSource, /public static int firstPositive\(System\.Collections\.Generic\.IReadOnlyList<int> values\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Array\.findValue\(values, \(int value, int index\) => value > 0 && index > 0\) \?\? -1;/);
  assert.match(generatedSource, /public static int lastPositive\(System\.Collections\.Generic\.IReadOnlyList<int> values\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Array\.findLastValue\(values, \(int value, int index, System\.Collections\.Generic\.IReadOnlyList<int> source\) => source\.Count > index && value > 0\) \?\? -1;/);
  assert.match(generatedSource, /public static bool hasFrom\(System\.Collections\.Generic\.IReadOnlyList<int> values, int value, int start\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Array\.includes\(values, value, start\);/);
  assert.match(generatedSource, /public static int positionOf\(System\.Collections\.Generic\.IReadOnlyList<int> values, int value\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Array\.indexOf\(values, value\);/);
  assert.match(generatedSource, /public static int positionOfFrom\(System\.Collections\.Generic\.IReadOnlyList<int> values, int value, int start\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Array\.indexOf\(values, value, start\);/);
  assert.match(generatedSource, /public static int lastPositionOf\(System\.Collections\.Generic\.IReadOnlyList<int> values, int value\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Array\.lastIndexOf\(values, value\);/);
  assert.match(generatedSource, /public static int lastPositionOfFrom\(System\.Collections\.Generic\.IReadOnlyList<int> values, int value, int start\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Array\.lastIndexOf\(values, value, start\);/);
  assert.match(generatedSource, /public static int sumEach\(System\.Collections\.Generic\.IReadOnlyList<int> values\)/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.Array\.forEach\(values, \(int value, int index, System\.Collections\.Generic\.IReadOnlyList<int> source\) =>/);
  assert.match(generatedSource, /total \+= value \+ index \+ source\.Count;/);
  assert.match(generatedSource, /public static bool hasPositive\(System\.Collections\.Generic\.IReadOnlyList<int> values\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Array\.some\(values, \(int value, int index\) => value > 0 && index > 0\);/);
  assert.match(generatedSource, /public static bool allPositive\(System\.Collections\.Generic\.IReadOnlyList<int> values\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Array\.every\(values, \(int value, int index, System\.Collections\.Generic\.IReadOnlyList<int> source\) => source\.Count > index && value > 0\);/);
  assert.match(generatedSource, /public static int firstPositiveIndex\(System\.Collections\.Generic\.IReadOnlyList<int> values\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Array\.findIndex\(values, \(int value, int index\) => value > 0 && index > 0\);/);
  assert.match(generatedSource, /public static int lastPositiveIndex\(System\.Collections\.Generic\.IReadOnlyList<int> values\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Array\.findLastIndex\(values, \(int value, int index, System\.Collections\.Generic\.IReadOnlyList<int> source\) => source\.Count > index && value > 0\);/);
  assert.match(generatedSource, /public static System\.Collections\.Generic\.List<int> sliceAll\(System\.Collections\.Generic\.IReadOnlyList<int> values\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Array\.slice\(values\);/);
  assert.match(generatedSource, /public static System\.Collections\.Generic\.List<int> sliceFrom\(System\.Collections\.Generic\.IReadOnlyList<int> values, int start\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Array\.slice\(values, start\);/);
  assert.match(generatedSource, /public static System\.Collections\.Generic\.List<int> sliceRange\(System\.Collections\.Generic\.IReadOnlyList<int> values, int start, int end\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Array\.slice\(values, start, end\);/);
  assert.match(generatedSource, /public static int destruct\(System\.Collections\.Generic\.IReadOnlyList<int> values\)/);
  assert.match(generatedSource, /int first = __tsonic_destructure\d+\[0\];/);
  assert.match(generatedSource, /int second = __tsonic_destructure\d+\[1\];/);
  assert.match(generatedSource, /return first \+ second;/);
  assert.match(generatedSource, /public static int destructDefault\(System\.Collections\.Generic\.IReadOnlyList<int> values\)/);
  assert.match(generatedSource, /int first = (__tsonic_destructure\d+)\.Count > 0 \? \1\[0\] : 1;/);
  assert.match(generatedSource, /int second = (__tsonic_destructure\d+)\.Count > 1 \? \1\[1\] : 2;/);
  assert.match(generatedSource, /public static System\.Collections\.Generic\.List<int> destructRest\(System\.Collections\.Generic\.IReadOnlyList<int> values\)/);
  assert.match(generatedSource, /System\.Collections\.Generic\.List<int> rest = Tsonic\.CSharp\.Js\.Array\.slice\((__tsonic_destructure\d+), 1\);/);
  assert.match(generatedSource, /return rest;/);
  assert.match(generatedSource, /public static System\.Collections\.Generic\.List<int> append\(System\.Collections\.Generic\.IEnumerable<int> values, int value\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Array\.concat\(values, new int\[\] \{ value \}\);/);
  assert.match(generatedSource, /public static System\.Collections\.Generic\.List<int> prepend\(System\.Collections\.Generic\.IEnumerable<int> values, int value\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Array\.concat\(new int\[\] \{ value \}, values\);/);
  assert.match(generatedSource, /public static System\.Collections\.Generic\.List<int> copy\(System\.Collections\.Generic\.IEnumerable<int> __tsonic_param\d+\)/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.JSArray<int> values = new Tsonic\.CSharp\.Js\.JSArray<int>\(__tsonic_param\d+\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Array\.from\(values\);/);
  assert.match(generatedSource, /public static System\.Collections\.Generic\.List<string> chars\(string value\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Array\.from\(value\);/);
  assert.match(generatedSource, /public static System\.Collections\.Generic\.List<int> make\(int left, int right\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Array\.of\(left, right\);/);
  assert.match(generatedSource, /public static bool isActuallyArray\(System\.Collections\.Generic\.IEnumerable<int> __tsonic_param\d+\)/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.JSArray<int> values = new Tsonic\.CSharp\.Js\.JSArray<int>\(__tsonic_param\d+\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Array\.isArray\(values\);/);
  assert.doesNotMatch(generatedSource, /ArrayHelpers/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedArraySurfaceOperations.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits Array construction only from selected JS surface carrier facts", async () => {
  const projectDirectory = resolve(tempRoot, "array-constructor-selected-js-surface");
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
            assemblyName: "SmokeGeneratedArrayConstructorSelectedJsSurface",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "export function make(size: int32): int32 {",
      "  const values = new Array<int32>(size);",
      "  values[0] = 7;",
      "  return values.length;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static int make\(int size\)/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.JSArray<int> values = new Tsonic\.CSharp\.Js\.JSArray<int>\(System\.Convert\.ToDouble\(size\)\);/);
  assert.match(generatedSource, /values\[0\] = 7;/);
  assert.match(generatedSource, /return values\.length;/);
  assert.doesNotMatch(generatedSource, /Tsonic\.CSharp\.Js\.JSArray<double>/);
  assert.doesNotMatch(generatedSource, /new int\[/);
  assert.doesNotMatch(generatedSource, /System\.Collections\.Generic\.List<int>/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedArrayConstructorSelectedJsSurface.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);

  const withoutSurfaceDirectory = resolve(tempRoot, "array-constructor-without-js-surface");
  await writeProject(withoutSurfaceDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          options: {
            namespace: "Smoke.Generated",
            assemblyName: "SmokeGeneratedArrayConstructorWithoutJsSurface",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "export function make(size: int32): int32[] {",
      "  return new Array<int32>(size);",
      "}",
      "",
    ].join("\n"),
  });

  const rejected = runNode([cliPath, "build", "--project", resolve(withoutSurfaceDirectory, "tsonic.json")]);
  assert.equal(rejected.status, 1);
  assertExternalCallNotMapped(rejected.stderr, "<anonymous>");
  assert.equal(existsSync(resolve(withoutSurfaceDirectory, "out/csharp/SmokeGeneratedArrayConstructorWithoutJsSurface.csproj")), false);
});

test("CLI selects ordinary TypeScript array public ABI lanes from finalized JS surface facts", async () => {
  const projectDirectory = resolve(tempRoot, "array-public-abi-lanes");
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
            assemblyName: "SmokeGeneratedArrayPublicAbiLanes",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "export function unused(values: int32[]): int32 {",
      "  return 1;",
      "}",
      "",
      "export function sequence(values: int32[]): int32 {",
      "  let total: int32 = 0;",
      "  for (const value of values) {",
      "    total += value;",
      "  }",
      "  return total;",
      "}",
      "",
      "export function indexed(values: int32[]): int32 {",
      "  return values[0] + values.length;",
      "}",
      "",
      "export function dense(values: int32[], index: int32, value: int32): int32 {",
      "  values[index] = value;",
      "  return values.length;",
      "}",
      "",
      "export function make(value: int32): int32[] {",
      "  return [value, value + 1];",
      "}",
      "",
      "export function sparse(values: int32[], index: int32): int32 {",
      "  delete values[index];",
      "  return values.length;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static int unused\(int\[\] values\)/);
  assert.match(generatedSource, /public static int sequence\(System\.Collections\.Generic\.IEnumerable<int> values\)/);
  assert.match(generatedSource, /foreach \(int value in values\)/);
  assert.match(generatedSource, /public static int indexed\(System\.Collections\.Generic\.IReadOnlyList<int> values\)/);
  assert.match(generatedSource, /return values\[0\] \+ values\.Count;/);
  assert.match(generatedSource, /public static int dense\(System\.Collections\.Generic\.List<int> values, int index, int value\)/);
  assert.match(generatedSource, /values\[index\] = value;/);
  assert.match(generatedSource, /return values\.Count;/);
  assert.match(generatedSource, /public static System\.Collections\.Generic\.List<int> make\(int value\)/);
  assert.match(generatedSource, /return new System\.Collections\.Generic\.List<int>\(new int\[\] \{ value, value \+ 1 \}\);/);
  assert.match(generatedSource, /public static int sparse\(System\.Collections\.Generic\.IEnumerable<int> __tsonic_param\d+, int index\)/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.JSArray<int> values = new Tsonic\.CSharp\.Js\.JSArray<int>\(__tsonic_param\d+\);/);
  assert.match(generatedSource, /values\.deleteAt\(index\);/);
  assert.doesNotMatch(generatedSource, /public static .*Tsonic\.CSharp\.Js\.JSArray<int>/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedArrayPublicAbiLanes.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits sparse JS array delete and length mutation only through JSArray carrier facts", async () => {
  const projectDirectory = resolve(tempRoot, "array-sparse-delete-length");
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
            assemblyName: "SmokeGeneratedArraySparseDeleteLength",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "export function mutate(values: int32[], index: int32): int32 {",
      "  delete values[index];",
      "  values.length = 4;",
      "  values[3] = 7;",
      "  return values.length;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static int mutate\(System\.Collections\.Generic\.IEnumerable<int> __tsonic_param\d+, int index\)/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.JSArray<int> values = new Tsonic\.CSharp\.Js\.JSArray<int>\(__tsonic_param\d+\);/);
  assert.match(generatedSource, /values\.deleteAt\(index\);/);
  assert.match(generatedSource, /values\.setLength\(4\);/);
  assert.match(generatedSource, /values\[3\] = 7;/);
  assert.match(generatedSource, /return values\.length;/);
  assert.doesNotMatch(generatedSource, /values\.Count =/);
  assert.doesNotMatch(generatedSource, /values\.Length =/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedArraySparseDeleteLength.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI rejects sparse JS array operations without selected JS surface facts", async () => {
  const deleteProjectDirectory = resolve(tempRoot, "array-sparse-delete-without-js-surface");
  await writeProject(deleteProjectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          options: {
            namespace: "Smoke.Generated",
            assemblyName: "SmokeGeneratedArraySparseDeleteWithoutJsSurface",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "export function mutate(values: int32[], index: int32): int32 {",
      "  delete values[index];",
      "  return 0;",
      "}",
      "",
    ].join("\n"),
  });

  const deleteBuild = runNode([cliPath, "build", "--project", resolve(deleteProjectDirectory, "tsonic.json")]);
  assert.equal(deleteBuild.status, 1);
  assert.match(deleteBuild.stderr, /C# JS surface delete emission requires a finalized JSArray\.deleteAt mutation operation fact/);
  assert.equal(existsSync(resolve(deleteProjectDirectory, "out/csharp/SmokeGeneratedArraySparseDeleteWithoutJsSurface.csproj")), false);

  const lengthProjectDirectory = resolve(tempRoot, "array-sparse-length-without-js-surface");
  await writeProject(lengthProjectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          options: {
            namespace: "Smoke.Generated",
            assemblyName: "SmokeGeneratedArraySparseLengthWithoutJsSurface",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "export function grow(values: int32[]): int32 {",
      "  values.length = 4;",
      "  return 4;",
      "}",
      "",
    ].join("\n"),
  });

  const lengthBuild = runNode([cliPath, "build", "--project", resolve(lengthProjectDirectory, "tsonic.json")]);
  assert.equal(lengthBuild.status, 1);
  assert.match(lengthBuild.stderr, /C# native array source contract has no target-backed property 'length'/);
  assert.equal(existsSync(resolve(lengthProjectDirectory, "out/csharp/SmokeGeneratedArraySparseLengthWithoutJsSurface.csproj")), false);
});


test("CLI rejects fixed CLR array mutators without JSArray carrier facts", async () => {
  const projectDirectory = resolve(tempRoot, "array-fixed-mutator-rejections");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/index.ts": [
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "export function append(values: int32[], value: int32): int32 {",
      "  return values.push(value);",
      "}",
      "",
      "export function removeLast(values: int32[]): int32 | undefined {",
      "  return values.pop();",
      "}",
      "",
      "export function splice(values: int32[]): int32[] {",
      "  return values.splice(1, 1);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /C# native array source contract has no target-backed property 'push'/);
  assert.match(build.stderr, /C# native array source contract has no target-backed property 'pop'/);
  assert.match(build.stderr, /C# native array source contract has no target-backed property 'splice'/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
});


test("CLI emits array callbacks with JS callback arities from provider facts", async () => {
  const projectDirectory = resolve(tempRoot, "array-callback-arity-helpers");
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
            assemblyName: "SmokeGeneratedArrayCallbacks",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "export function hasIndexedPositive(values: int32[]): boolean {",
      "  return values.some((value: int32, index: int32) => value > 0 && index > 0);",
      "}",
      "",
      "export function allFromSource(values: int32[]): boolean {",
      "  return values.every((value: int32, index: int32, source: int32[]) => source[index] === value);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static bool hasIndexedPositive\(System\.Collections\.Generic\.IReadOnlyList<int> values\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Array\.some\(values, \(int value, int index\) => value > 0 && index > 0\);/);
  assert.match(generatedSource, /public static bool allFromSource\(System\.Collections\.Generic\.IReadOnlyList<int> values\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Array\.every\(values, \(int value, int index, System\.Collections\.Generic\.IReadOnlyList<int> source\) => source\[index\] == value\);/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedArrayCallbacks.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});


test("CLI emits RegExp literals through provider-backed JS runtime carriers", async () => {
  const projectDirectory = resolve(tempRoot, "regexp-literal-carrier");
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
            assemblyName: "SmokeGeneratedRegExpLiteralCarrier",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function matches(input: string): boolean {",
      "  const expression = /abc/i;",
      "  const constructed = new RegExp(\"xyz\", \"g\");",
      "  return expression.test(input) || constructed.test(input);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.RegExp expression = new Tsonic\.CSharp\.Js\.RegExp\("abc", "i"\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.RegExp constructed = new Tsonic\.CSharp\.Js\.RegExp\("xyz", "g"\);/);
  assert.match(generatedSource, /return expression\.test\(input\) \|\| constructed\.test\(input\);/);
  assert.doesNotMatch(generatedSource, /unsupported|invalid/i);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedRegExpLiteralCarrier.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits Date calls through provider-backed JS runtime carriers", async () => {
  const projectDirectory = resolve(tempRoot, "date-runtime-carrier");
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
            assemblyName: "SmokeGeneratedDateRuntimeCarrier",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function iso(): string {",
      "  const date = new Date(Date.UTC(2023, 5, 15, 12, 30, 45, 123));",
      "  return date.toISOString();",
      "}",
      "",
      "export function epoch(value: number): number {",
      "  const date = new Date(value);",
      "  return date.getTime();",
      "}",
      "",
      "export function currentDateString(): string {",
      "  return Date();",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedProject = await readFile(resolve(projectDirectory, "out/csharp/SmokeGeneratedDateRuntimeCarrier.csproj"), "utf8");
  assert.match(generatedProject, /Tsonic\.CSharp\.Runtime\.csproj/);
  assert.match(generatedProject, /Tsonic\.CSharp\.Js\.csproj/);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.Date date = new Tsonic\.CSharp\.Js\.Date\(Tsonic\.CSharp\.Js\.Date\.UTC\(2023, 5, 15, 12, 30, 45, 123\)\);/);
  assert.match(generatedSource, /return date\.toISOString\(\);/);
  assert.match(generatedSource, /return date\.getTime\(\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Date\.call\(\);/);
  assert.doesNotMatch(generatedSource, /return Date\./);
  assert.doesNotMatch(generatedSource, /new Date/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedDateRuntimeCarrier.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});


test("CLI emits string element access from selected provider index facts", async () => {
  const projectDirectory = resolve(tempRoot, "string-element-access");
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
            assemblyName: "SmokeGeneratedStringElementAccess",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "export function at(value: string, index: int32): string {",
      "  return value[index];",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static string at\(string value, int index\)/);
  assert.match(generatedSource, /return value\.Substring\(index, 1\);/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedStringElementAccess.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});


test("CLI rejects element access with non-integral indexes until conversion facts are finalized", async () => {
  const projectDirectory = resolve(tempRoot, "non-integral-element-index");
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
            assemblyName: "SmokeGeneratedNonIntegralIndexes",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function stringAt(value: string, index: number): string {",
      "  return value[index];",
      "}",
      "",
      "export function arrayAt(value: string[], index: number): string {",
      "  return value[index];",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /C# element access must be selected by TSTS\/provider facts/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedNonIntegralIndexes.csproj")), false);
});


test("CLI emits string for-of from provider code-point iteration facts", async () => {
  const projectDirectory = resolve(tempRoot, "string-for-of");
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
            assemblyName: "SmokeGeneratedStringForOf",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function totalLength(value: string): number {",
      "  let total = 0;",
      "  for (const ch of value) {",
      "    total = total + ch.length;",
      "  }",
      "  return total;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /string __tsonic_forOfString\d+ = value;/);
  assert.match(generatedSource, /for \(int __tsonic_forOfIndex\d+ = 0; __tsonic_forOfIndex\d+ < __tsonic_forOfString\d+\.Length; \)/);
  assert.match(generatedSource, /char\.IsHighSurrogate\(__tsonic_forOfString\d+\[__tsonic_forOfIndex\d+\]\)/);
  assert.match(generatedSource, /char\.IsLowSurrogate\(__tsonic_forOfString\d+\[__tsonic_forOfIndex\d+ \+ 1\]\)/);
  assert.match(generatedSource, /ch = __tsonic_forOfString\d+\.Substring\(__tsonic_forOfIndex\d+, 2\);/);
  assert.match(generatedSource, /ch = __tsonic_forOfString\d+\.Substring\(__tsonic_forOfIndex\d+, 1\);/);
  assert.match(generatedSource, /total = total \+ ch\.Length;/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedStringForOf.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});


test("CLI emits primitive generic constraints from provider facts", async () => {
  const projectDirectory = resolve(tempRoot, "primitive-generic-constraints");
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
            assemblyName: "SmokeGeneratedPrimitiveGenericConstraints",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function constrained<T extends number>(value: T): T {",
      "  return value;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static T constrained<T>\(T value\)/);
  assert.match(generatedSource, /where T : System\.Numerics\.INumber<T>/);
  assert.match(generatedSource, /return value;/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedPrimitiveGenericConstraints.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});


test("CLI rejects unsupported primitive generic constraints without provider facts", async () => {
  const projectDirectory = resolve(tempRoot, "unsupported-primitive-generic-constraints");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/index.ts": [
      "export function constrained<T extends string>(value: T): T {",
      "  return value;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /Generic constraints require finalized target constraint facts/);
});


test.todo("CLI emits array for-in from provider enumeration facts - operation.iteration.for-in.keys remains partial until TSTS for-in key typing and C# key binding facts are finalized.");

test("CLI emits Record for-in from provider Dictionary key facts", async () => {
  const projectDirectory = resolve(tempRoot, "record-for-in");
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
            assemblyName: "SmokeGeneratedRecordForIn",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function countKeys(values: Record<string, number>): number {",
      "  let total = 0;",
      "  for (const key in values) {",
      "    total = total + key.length;",
      "  }",
      "  return total;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /System\.Collections\.Generic\.Dictionary<string, double> __tsonic_forInTarget\d+ = values;/);
  assert.match(generatedSource, /foreach \(string key in __tsonic_forInTarget\d+\.Keys\)/);
  assert.match(generatedSource, /total = total \+ key\.Length;/);
  assert.doesNotMatch(generatedSource, /unsupported|invalid/i);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedRecordForIn.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits Object helpers for closed Record dictionaries from selected JS surface facts", async () => {
  const projectDirectory = resolve(tempRoot, "record-object-helpers");
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
            assemblyName: "SmokeGeneratedRecordObjectHelpers",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "export function recordKeys(values: Record<string, int32>): string[] {",
      "  return Object.keys(values);",
      "}",
      "",
      "export function recordValues(values: Record<string, int32>): int32[] {",
      "  return Object.values(values);",
      "}",
      "",
      "export function recordEntries(values: Record<string, int32>): [string, int32][] {",
      "  return Object.entries(values);",
      "}",
      "",
      "export function recordHasOwn(values: Record<string, int32>): boolean {",
      "  return Object.hasOwn(values, \"answer\");",
      "}",
      "",
      "export function assignRecord(target: Record<string, int32>, source: Record<string, int32>): Record<string, int32> {",
      "  return Object.assign(target, source);",
      "}",
      "",
      "export function sameValue(left: number, right: number): boolean {",
      "  return Object.is(left, right);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static System\.Collections\.Generic\.List<string> recordKeys\(System\.Collections\.Generic\.Dictionary<string, int> values\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Object\.keys\(values\);/);
  assert.match(generatedSource, /public static System\.Collections\.Generic\.List<int> recordValues\(System\.Collections\.Generic\.Dictionary<string, int> values\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Object\.values\(values\);/);
  assert.match(generatedSource, /public static System\.Collections\.Generic\.List<\(string, int\)> recordEntries\(System\.Collections\.Generic\.Dictionary<string, int> values\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Object\.entries\(values\);/);
  assert.match(generatedSource, /public static bool recordHasOwn\(System\.Collections\.Generic\.Dictionary<string, int> values\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Object\.hasOwn\(values, "answer"\);/);
  assert.match(generatedSource, /public static System\.Collections\.Generic\.Dictionary<string, int> assignRecord\(System\.Collections\.Generic\.Dictionary<string, int> target, System\.Collections\.Generic\.Dictionary<string, int> source\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Object\.assign\(target, source\);/);
  assert.match(generatedSource, /public static bool sameValue\(double left, double right\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Object\.@is\(left, right\);/);
  assert.doesNotMatch(generatedSource, /Object\.keys\(object/);
  assert.doesNotMatch(generatedSource, /Object\.assign\(object/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedRecordObjectHelpers.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI hard-rejects unsupported Object descriptor and prototype operations", async () => {
  const projectDirectory = resolve(tempRoot, "object-descriptor-prototype-rejections");
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
            assemblyName: "SmokeGeneratedObjectDescriptorPrototypeRejections",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function createFrom(proto: object): object {",
      "  return Object.create(proto);",
      "}",
      "",
      "export function define(value: object): object {",
      "  return Object.defineProperty(value, \"x\", { value: 1 });",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /C# JS surface hard-rejected selected TypeScript standard-library call 'Object\.create'/);
  assert.match(build.stderr, /C# JS surface hard-rejected selected TypeScript standard-library call 'Object\.defineProperty'/);
  assert.match(build.stderr, /descriptor, prototype, extensibility/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedObjectDescriptorPrototypeRejections.csproj")), false);
});


test("CLI emits string instance calls from selected target signature facts", async () => {
  const projectDirectory = resolve(tempRoot, "string-call-target-facts");
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
            assemblyName: "SmokeGeneratedStringCalls",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "export function text(value: string): string {",
      "  return value.toString();",
      "}",
      "",
      "export function has(value: string, needle: string, start: int32): boolean {",
      "  return value.includes(needle, start);",
      "}",
      "",
      "export function bounds(value: string, prefix: string, suffix: string, start: int32, end: int32): boolean {",
      "  return value.startsWith(prefix, start) && value.endsWith(suffix, end);",
      "}",
      "",
      "export function position(value: string, needle: string, start: int32): int32 {",
      "  return value.indexOf(needle, start);",
      "}",
      "",
      "export function lastPosition(value: string, needle: string, start: int32): int32 {",
      "  return value.lastIndexOf(needle, start);",
      "}",
      "",
      "export function lastPositionDefault(value: string, needle: string): int32 {",
      "  return value.lastIndexOf(needle);",
      "}",
      "",
      "export function normalize(value: string): string {",
      "  return value.trim().toLowerCase().toUpperCase();",
      "}",
      "",
      "export function normalizedForm(value: string): string {",
      "  return value.normalize(\"NFC\");",
      "}",
      "",
      "export function trimEdges(value: string): string {",
      "  return value.trimStart().trimEnd();",
      "}",
      "",
      "export function localeCase(value: string): string {",
      "  return value.toLocaleLowerCase().toLocaleUpperCase();",
      "}",
      "",
      "export function trimAliases(value: string): string {",
      "  return value.trimLeft().trimRight();",
      "}",
      "",
      "export function localeOrder(value: string, other: string): int32 {",
      "  return value.localeCompare(other);",
      "}",
      "",
      "export function patternIndex(value: string, pattern: string): int32 {",
      "  return value.search(pattern);",
      "}",
      "",
      "export function wellFormed(value: string): boolean {",
      "  return value.isWellFormed();",
      "}",
      "",
      "export function wellFormedText(value: string): string {",
      "  return value.toWellFormed();",
      "}",
      "",
      "export function replaced(value: string, search: string, replacement: string): string {",
      "  return value.replace(search, replacement);",
      "}",
      "",
      "export function replacedAll(value: string, search: string, replacement: string): string {",
      "  return value.replaceAll(search, replacement);",
      "}",
      "",
      "export function glue(value: string, left: string, right: string): string {",
      "  return value.concat(left, right);",
      "}",
      "",
      "export function parts(value: string, start: int32, end: int32): string {",
      "  return value.substring(start, end) + value.slice(start, end) + value.substr(start, end);",
      "}",
      "",
      "export function padded(value: string, width: int32): string {",
      "  return value.padStart(width, \"01\").padEnd(width + 1, \"_-\");",
      "}",
      "",
      "export function repeated(value: string, count: int32): string {",
      "  return value.repeat(count);",
      "}",
      "",
      "export function character(value: string, index: int32): string {",
      "  return value.charAt(index);",
      "}",
      "",
      "export function atOrEmpty(value: string, index: int32): string {",
      "  return value.at(index) ?? \"\";",
      "}",
      "",
      "export function code(value: string, index: int32): number {",
      "  return value.charCodeAt(index);",
      "}",
      "",
      "export function codePoint(value: string, index: int32): int32 | undefined {",
      "  return value.codePointAt(index);",
      "}",
      "",
      "export function codePointOrMissing(value: string, index: int32): int32 {",
      "  return value.codePointAt(index) ?? -1;",
      "}",
      "",
      "export function fromChars(a: int32, b: int32, c: int32): string {",
      "  return String.fromCharCode(a, b, c);",
      "}",
      "",
      "export function fromCodePoints(a: int32, b: int32): string {",
      "  return String.fromCodePoint(a, b);",
      "}",
      "",
      "export function splitParts(value: string, separator: string, limit: int32): string[] {",
      "  return value.split(separator, limit);",
      "}",
      "",
      "export function primitive(value: string): string {",
      "  return value.valueOf();",
      "}",
      "",
      "export function converted(value: number): string {",
      "  return String(value) + String();",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static string text\(string value\)/);
  assert.match(generatedSource, /return value\.ToString\(\);/);
  assert.match(generatedSource, /public static bool has\(string value, string needle, int start\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.String\.includes\(value, needle, start\);/);
  assert.match(generatedSource, /public static bool bounds\(string value, string prefix, string suffix, int start, int end\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.String\.startsWith\(value, prefix, start\) && Tsonic\.CSharp\.Js\.String\.endsWith\(value, suffix, end\);/);
  assert.match(generatedSource, /public static int position\(string value, string needle, int start\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.String\.indexOf\(value, needle, start\);/);
  assert.match(generatedSource, /public static int lastPosition\(string value, string needle, int start\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.String\.lastIndexOf\(value, needle, start\);/);
  assert.match(generatedSource, /public static int lastPositionDefault\(string value, string needle\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.String\.lastIndexOf\(value, needle\);/);
  assert.match(generatedSource, /public static string normalize\(string value\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.String\.toUpperCase\(Tsonic\.CSharp\.Js\.String\.toLowerCase\(Tsonic\.CSharp\.Js\.String\.trim\(value\)\)\);/);
  assert.match(generatedSource, /public static string normalizedForm\(string value\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.String\.normalize\(value, "NFC"\);/);
  assert.match(generatedSource, /public static string trimEdges\(string value\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.String\.trimEnd\(Tsonic\.CSharp\.Js\.String\.trimStart\(value\)\);/);
  assert.match(generatedSource, /public static string localeCase\(string value\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.String\.toLocaleUpperCase\(Tsonic\.CSharp\.Js\.String\.toLocaleLowerCase\(value\)\);/);
  assert.match(generatedSource, /public static string trimAliases\(string value\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.String\.trimRight\(Tsonic\.CSharp\.Js\.String\.trimLeft\(value\)\);/);
  assert.doesNotMatch(generatedSource, /\.Trim(Start|End)?\(\)|\.ToLower\(\)|\.ToUpper\(\)/);
  assert.match(generatedSource, /public static int localeOrder\(string value, string other\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.String\.localeCompare\(value, other\);/);
  assert.match(generatedSource, /public static int patternIndex\(string value, string pattern\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.String\.search\(value, pattern\);/);
  assert.match(generatedSource, /public static bool wellFormed\(string value\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.String\.isWellFormed\(value\);/);
  assert.match(generatedSource, /public static string wellFormedText\(string value\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.String\.toWellFormed\(value\);/);
  assert.match(generatedSource, /public static string replaced\(string value, string search, string replacement\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.String\.replace\(value, search, replacement\);/);
  assert.match(generatedSource, /public static string replacedAll\(string value, string search, string replacement\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.String\.replaceAll\(value, search, replacement\);/);
  assert.match(generatedSource, /public static string glue\(string value, string left, string right\)/);
  assert.match(generatedSource, /return string\.Concat\(value, left, right\);/);
  assert.match(generatedSource, /public static string parts\(string value, int start, int end\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.String\.substring\(value, start, end\) \+ Tsonic\.CSharp\.Js\.String\.slice\(value, start, end\) \+ Tsonic\.CSharp\.Js\.String\.substr\(value, start, end\);/);
  assert.match(generatedSource, /public static string padded\(string value, int width\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.String\.padEnd\(Tsonic\.CSharp\.Js\.String\.padStart\(value, width, "01"\), width \+ 1, "_-"\);/);
  assert.match(generatedSource, /public static string repeated\(string value, int count\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.String\.repeat\(value, count\);/);
  assert.match(generatedSource, /public static string character\(string value, int index\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.String\.charAt\(value, index\);/);
  assert.match(generatedSource, /public static string atOrEmpty\(string value, int index\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.String\.at\(value, index\) \?\? "";/);
  assert.match(generatedSource, /public static double code\(string value, int index\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.String\.charCodeAt\(value, index\);/);
  assert.match(generatedSource, /public static int\? codePoint\(string value, int index\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.String\.codePointAt\(value, index\);/);
  assert.match(generatedSource, /public static int codePointOrMissing\(string value, int index\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.String\.codePointAt\(value, index\) \?\? -1;/);
  assert.match(generatedSource, /public static string fromChars\(int a, int b, int c\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.String\.fromCharCode\(a, b, c\);/);
  assert.match(generatedSource, /public static string fromCodePoints\(int a, int b\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.String\.fromCodePoint\(a, b\);/);
  assert.match(generatedSource, /public static System\.Collections\.Generic\.List<string> splitParts\(string value, string separator, int limit\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.String\.split\(value, separator, limit\);/);
  assert.match(generatedSource, /public static string primitive\(string value\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.String\.valueOf\(value\);/);
  assert.match(generatedSource, /public static string converted\(double value\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Globals\.String\(value\) \+ Tsonic\.CSharp\.Js\.Globals\.String\(\);/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedStringCalls.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI hard-rejects selected JS string exactness lanes without closed runtime facts", async () => {
  const projectDirectory = resolve(tempRoot, "js-string-exactness-rejections");
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
            assemblyName: "SmokeGeneratedStringExactnessRejections",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function matched(value: string, pattern: RegExp): RegExpMatchArray | null {",
      "  return value.match(pattern);",
      "}",
      "",
      "export function raw(template: TemplateStringsArray, value: string): string {",
      "  return String.raw(template, value);",
      "}",
      "",
      "export function all(value: string, pattern: RegExp): number {",
      "  let count = 0;",
      "  for (const _match of value.matchAll(pattern)) {",
      "    count++;",
      "  }",
      "  return count;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /C# JS surface hard-rejected selected TypeScript standard-library call 'String\.match'/);
  assert.match(build.stderr, /C# JS surface hard-rejected selected TypeScript standard-library call 'String\.raw'/);
  assert.match(build.stderr, /C# JS surface hard-rejected selected TypeScript standard-library call 'String\.matchAll'/);
  assert.match(build.stderr, /RegExpMatchArray/);
  assert.match(build.stderr, /template-object/);
  assert.match(build.stderr, /iterator/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedStringExactnessRejections.csproj")), false);
});

test("CLI rejects JS String wrapper construction until a closed wrapper carrier exists", async () => {
  const projectDirectory = resolve(tempRoot, "js-string-wrapper-rejected");
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
            assemblyName: "SmokeGeneratedStringWrapperRejected",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function wrapper(value: string): String {",
      "  return new String(value);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.notEqual(build.status, 0);
  assert.match(build.stdout + build.stderr, /String\.constructor|C# construction emission requires a source-owned constructor or a selected target constructor fact/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedStringWrapperRejected.csproj")), false);
});

test("CLI emits selected JS number toString facts through the C# JS runtime", async () => {
  const projectDirectory = resolve(tempRoot, "js-number-tostring");
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
            assemblyName: "SmokeGeneratedNumberToString",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "export function fromNumber(value: number): string {",
      "  return value.toString();",
      "}",
      "",
      "export function numberValue(value: number): number {",
      "  return value.valueOf();",
      "}",
      "",
      "export function fromObjectShape(): string {",
      "  const root: { count: number } = { count: 2 };",
      "  return root.count.toString();",
      "}",
      "",
      "export function fromPrimitive(value: int32): string {",
      "  return value.toString();",
      "}",
      "",
      "export function fromPrimitiveRadix(value: int32, radix: int32): string {",
      "  return value.toString(radix);",
      "}",
      "",
      "export function fromStatic(value: number): boolean {",
      "  return Number.isFinite(value) && Number.isInteger(value) && Number.isSafeInteger(value) && !Number.isNaN(value);",
      "}",
      "",
      "export function fromParsed(value: string): number {",
      "  return Number.parseFloat(value) + Number.parseInt(value, 16) + Number.MAX_SAFE_INTEGER;",
      "}",
      "",
      "export function numberConstants(): number {",
      "  return Number.MAX_VALUE + Number.MIN_VALUE + Number.MIN_SAFE_INTEGER + Number.POSITIVE_INFINITY + Number.NEGATIVE_INFINITY + Number.NaN + Number.EPSILON;",
      "}",
      "",
      "export function formatted(value: number, digits: int32, locale: string): string {",
      "  return value.toFixed(digits) + value.toExponential(digits) + value.toPrecision(digits);",
      "}",
      "",
      "export function converted(text: string, count: int32): number {",
      "  return Number(text) + Number(count) + Number();",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Number\.toString\(value\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Number\.valueOf\(value\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Number\.toString\(root\.count\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Number\.toString\(value, radix\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.Number\.isFinite\(value\)/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.Number\.isInteger\(value\)/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.Number\.isSafeInteger\(value\)/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.Number\.isNaN\(value\)/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.Number\.parseFloat\(value\)/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.Number\.parseInt\(value, 16\)/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.Number\.MAX_SAFE_INTEGER/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.Number\.MAX_VALUE/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.Number\.MIN_VALUE/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.Number\.MIN_SAFE_INTEGER/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.Number\.POSITIVE_INFINITY/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.Number\.NEGATIVE_INFINITY/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.Number\.NaN/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.Number\.EPSILON/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.Number\.toFixed\(value, digits\)/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.Number\.toExponential\(value, digits\)/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.Number\.toPrecision\(value, digits\)/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.Globals\.Number\(text\)/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.Globals\.Number\(count\)/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.Globals\.Number\(\)/);
  assert.doesNotMatch(generatedSource, /__unsupported|InvalidExpression/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedNumberToString.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI hard-rejects selected JS Number locale formatting without Intl facts", async () => {
  const projectDirectory = resolve(tempRoot, "js-number-locale-rejected");
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
            assemblyName: "SmokeGeneratedNumberLocaleRejected",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function locale(value: number, locale: string): string {",
      "  return value.toLocaleString(locale);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.notEqual(build.status, 0);
  assert.match(build.stdout + build.stderr, /Number\.toLocaleString/);
  assert.match(build.stdout + build.stderr, /Intl\.NumberFormat-compatible locale and options semantics/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedNumberLocaleRejected.csproj")), false);
});

test("CLI rejects JS Number wrapper construction until a closed wrapper carrier exists", async () => {
  const projectDirectory = resolve(tempRoot, "js-number-wrapper-rejected");
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
            assemblyName: "SmokeGeneratedNumberWrapperRejected",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function wrapper(value: number): Number {",
      "  return new Number(value);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.notEqual(build.status, 0);
  assert.match(build.stdout + build.stderr, /Number\.constructor|C# construction emission requires a source-owned constructor or a selected target constructor fact/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedNumberWrapperRejected.csproj")), false);
});

test("CLI emits selected JS boolean method facts through the C# JS runtime", async () => {
  const projectDirectory = resolve(tempRoot, "js-boolean-methods");
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
            assemblyName: "SmokeGeneratedBooleanMethods",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function asText(value: boolean): string {",
      "  return value.toString();",
      "}",
      "",
      "export function asValue(value: boolean): boolean {",
      "  return value.valueOf();",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.BooleanOps\.toString\(value\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.BooleanOps\.valueOf\(value\);/);
  assert.doesNotMatch(generatedSource, /__unsupported|InvalidExpression/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedBooleanMethods.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits selected JS Boolean conversion calls through the C# JS runtime", async () => {
  const projectDirectory = resolve(tempRoot, "js-boolean-conversion-call");
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
            assemblyName: "SmokeGeneratedBooleanConversionCall",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "export function converted(flag: boolean, text: string, count: int32): boolean {",
      "  return Boolean(flag) && Boolean(text) && Boolean(count) && !Boolean();",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.Globals\.Boolean\(flag\)/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.Globals\.Boolean\(text\)/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.Globals\.Boolean\(count\)/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.Globals\.Boolean\(\)/);
  assert.doesNotMatch(generatedSource, /__unsupported|InvalidExpression/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedBooleanConversionCall.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI rejects JS Boolean wrapper construction until a closed wrapper carrier exists", async () => {
  const projectDirectory = resolve(tempRoot, "js-boolean-wrapper-rejected");
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
            assemblyName: "SmokeGeneratedBooleanWrapperRejected",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function wrapper(flag: boolean): Boolean {",
      "  return new Boolean(flag);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.notEqual(build.status, 0);
  assert.match(build.stdout + build.stderr, /Boolean\.constructor|C# construction emission requires a source-owned constructor or a selected target constructor fact/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedBooleanWrapperRejected.csproj")), false);
});


test("CLI rejects string methods without exact provider-backed JS semantics", async () => {
  const projectDirectory = resolve(tempRoot, "string-call-target-fact-rejections");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/index.ts": [
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "export function replacedWithPattern(value: string, pattern: RegExp): string {",
      "  return value.replace(pattern, \"b\");",
      "}",
      "",
      "export function replacedAllWithPattern(value: string, pattern: RegExp): string {",
      "  return value.replaceAll(pattern, \"b\");",
      "}",
      "",
      "export function atOrEmpty(value: string, index: int32): string {",
      "  return value.at(index) ?? \"\";",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /C# property access 'replace' must be selected by TSTS\/provider facts before emission/);
  assert.match(build.stderr, /C# property access 'replaceAll' must be selected by TSTS\/provider facts before emission/);
  assert.match(build.stderr, /C# property access 'at' must be selected by TSTS\/provider facts before emission/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
});


test("CLI rejects non-source-owned constructors without selected target signature facts", async () => {
  const projectDirectory = resolve(tempRoot, "builtin-constructor-requires-target-facts");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/index.ts": [
      "export function create(): Date {",
      "  return new Date();",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /C# construction emission requires a source-owned constructor or a selected target constructor fact/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
});
