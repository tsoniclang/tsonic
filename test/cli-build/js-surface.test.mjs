import { assert, cliPath, existsSync, readFile, resolve, run, runNode, tempRoot, test, writeProject } from "./harness.mjs";

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
      "export function normalize(value: number): number {",
      "  return Math.trunc(Math.abs(value));",
      "}",
      "",
      "export function clamp(value: number, low: number, high: number): number {",
      "  return Math.max(low, Math.min(high, value));",
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
  assert.match(generatedSource, /public static double curve\(double value\)/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.Math\.sin\(value\) \+ Tsonic\.CSharp\.Js\.Math\.cos\(value\) \+ Tsonic\.CSharp\.Js\.Math\.sqrt\(Tsonic\.CSharp\.Js\.Math\.pow\(value, 2\)\)/);
  assert.match(generatedSource, /public static double inverse\(double value\)/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.Math\.acos\(value\) \+ Tsonic\.CSharp\.Js\.Math\.asin\(value\) \+ Tsonic\.CSharp\.Js\.Math\.atan\(value\) \+ Tsonic\.CSharp\.Js\.Math\.atan2\(value, 2\)/);
  assert.match(generatedSource, /public static double logs\(double value\)/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.Math\.exp\(value\) \+ Tsonic\.CSharp\.Js\.Math\.log\(value\) \+ Tsonic\.CSharp\.Js\.Math\.log10\(value\) \+ Tsonic\.CSharp\.Js\.Math\.log2\(value\)/);
  assert.match(generatedSource, /public static double hyperbolic\(double value\)/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.Math\.sinh\(value\) \+ Tsonic\.CSharp\.Js\.Math\.cosh\(value\) \+ Tsonic\.CSharp\.Js\.Math\.tanh\(value\)/);
  assert.doesNotMatch(generatedSource, /return Math\./);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedStandardMathCalls.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
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
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static int first\(int\[\] values\)/);
  assert.match(generatedSource, /return values\[0\];/);
  assert.match(generatedSource, /public static int pick\(int\[\] values, int index\)/);
  assert.match(generatedSource, /return values\[index\];/);
  assert.match(generatedSource, /public static int assign\(int\[\] values, int index, int value\)/);
  assert.match(generatedSource, /values\[index\] = value;/);
  assert.match(generatedSource, /return values\[index\];/);
  assert.match(generatedSource, /public static int count\(int\[\] values\)/);
  assert.match(generatedSource, /return values\.Length;/);
  assert.match(generatedSource, /public static string join\(int\[\] values\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Runtime\.ArrayHelpers\.Join\(values, "\|"\);/);
  assert.match(generatedSource, /public static bool has\(int\[\] values, int value\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Runtime\.ArrayHelpers\.Includes\(values, value\);/);
  assert.match(generatedSource, /public static bool hasFrom\(int\[\] values, int value, int start\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Runtime\.ArrayHelpers\.Includes\(values, value, start\);/);
  assert.match(generatedSource, /public static int positionOf\(int\[\] values, int value\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Runtime\.ArrayHelpers\.IndexOf\(values, value\);/);
  assert.match(generatedSource, /public static int positionOfFrom\(int\[\] values, int value, int start\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Runtime\.ArrayHelpers\.IndexOf\(values, value, start\);/);
  assert.match(generatedSource, /public static int lastPositionOf\(int\[\] values, int value\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Runtime\.ArrayHelpers\.LastIndexOf\(values, value\);/);
  assert.match(generatedSource, /public static int lastPositionOfFrom\(int\[\] values, int value, int start\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Runtime\.ArrayHelpers\.LastIndexOf\(values, value, start\);/);
  assert.match(generatedSource, /public static int sumEach\(int\[\] values\)/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Runtime\.ArrayHelpers\.ForEach\(values, \(int value, int index, int\[\] source\) =>/);
  assert.match(generatedSource, /total \+= value \+ index \+ source\.Length;/);
  assert.match(generatedSource, /public static bool hasPositive\(int\[\] values\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Runtime\.ArrayHelpers\.Some\(values, \(int value, int index\) => value > 0 && index > 0\);/);
  assert.match(generatedSource, /public static bool allPositive\(int\[\] values\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Runtime\.ArrayHelpers\.Every\(values, \(int value, int index, int\[\] source\) => source\.Length > index && value > 0\);/);
  assert.match(generatedSource, /public static int firstPositiveIndex\(int\[\] values\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Runtime\.ArrayHelpers\.FindIndex\(values, \(int value, int index\) => value > 0 && index > 0\);/);
  assert.match(generatedSource, /public static int lastPositiveIndex\(int\[\] values\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Runtime\.ArrayHelpers\.FindLastIndex\(values, \(int value, int index, int\[\] source\) => source\.Length > index && value > 0\);/);
  assert.match(generatedSource, /public static int\[\] sliceAll\(int\[\] values\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Runtime\.ArrayHelpers\.Slice\(values\);/);
  assert.match(generatedSource, /public static int\[\] sliceFrom\(int\[\] values, int start\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Runtime\.ArrayHelpers\.Slice\(values, start\);/);
  assert.match(generatedSource, /public static int\[\] sliceRange\(int\[\] values, int start, int end\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Runtime\.ArrayHelpers\.Slice\(values, start, end\);/);
  assert.match(generatedSource, /public static int destruct\(int\[\] values\)/);
  assert.match(generatedSource, /int first = __tsonic_destructure\d+\[0\];/);
  assert.match(generatedSource, /int second = __tsonic_destructure\d+\[1\];/);
  assert.match(generatedSource, /return first \+ second;/);
  assert.match(generatedSource, /public static int destructDefault\(int\[\] values\)/);
  assert.match(generatedSource, /int first = (__tsonic_destructure\d+)\.Length > 0 \? \1\[0\] : 1;/);
  assert.match(generatedSource, /int second = (__tsonic_destructure\d+)\.Length > 1 \? \1\[1\] : 2;/);
  assert.match(generatedSource, /public static int\[\] destructRest\(int\[\] values\)/);
  assert.match(generatedSource, /int\[\] rest = Tsonic\.CSharp\.Runtime\.ArrayHelpers\.Slice\((__tsonic_destructure\d+), 1\);/);
  assert.match(generatedSource, /return rest;/);
  assert.match(generatedSource, /public static int\[\] append\(int\[\] values, int value\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Runtime\.ArrayHelpers\.Concat\(values, new int\[\] \{ value \}\);/);
  assert.match(generatedSource, /public static int\[\] prepend\(int\[\] values, int value\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Runtime\.ArrayHelpers\.Concat\(new int\[\] \{ value \}, values\);/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedArraySurfaceOperations.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
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
  assert.match(build.stderr, /C# call emission requires a source-owned callable or a selected target signature fact/);
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
  assert.match(generatedSource, /return Tsonic\.CSharp\.Runtime\.ArrayHelpers\.Some\(values, \(int value, int index\) => value > 0 && index > 0\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Runtime\.ArrayHelpers\.Every\(values, \(int value, int index, int\[\] source\) => source\[index\] == value\);/);

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


test("CLI emits array for-in from provider enumeration facts", async () => {
  const projectDirectory = resolve(tempRoot, "array-for-in");
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
            assemblyName: "SmokeGeneratedArrayForIn",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function countKeys(values: number[]): number {",
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
  assert.match(generatedSource, /double\[\] __tsonic_forInTarget\d+ = values;/);
  assert.match(generatedSource, /for \(int __tsonic_forInIndex\d+ = 0; __tsonic_forInIndex\d+ < __tsonic_forInTarget\d+\.Length; __tsonic_forInIndex\d+\+\+\)/);
  assert.match(generatedSource, /string key = __tsonic_forInIndex\d+\.ToString\(System\.Globalization\.CultureInfo\.InvariantCulture\);/);
  assert.match(generatedSource, /total = total \+ key\.Length;/);
  assert.doesNotMatch(generatedSource, /unsupported|invalid/i);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedArrayForIn.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

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
      "export function trimEdges(value: string): string {",
      "  return value.trimStart().trimEnd();",
      "}",
      "",
      "export function trimAliases(value: string): string {",
      "  return value.trimLeft().trimRight();",
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
  assert.match(generatedSource, /return value\.Trim\(\)\.ToLower\(\)\.ToUpper\(\);/);
  assert.match(generatedSource, /public static string trimEdges\(string value\)/);
  assert.match(generatedSource, /return value\.TrimStart\(\)\.TrimEnd\(\);/);
  assert.match(generatedSource, /public static string trimAliases\(string value\)/);
  assert.match(generatedSource, /return value\.TrimStart\(\)\.TrimEnd\(\);/);
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
  assert.match(generatedSource, /public static string\[\] splitParts\(string value, string separator, int limit\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.String\.split\(value, separator, limit\);/);
  assert.match(generatedSource, /public static string primitive\(string value\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.String\.valueOf\(value\);/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedStringCalls.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
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
  assert.match(build.stderr, /C# call emission requires a source-owned callable or a selected target signature fact/);
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
