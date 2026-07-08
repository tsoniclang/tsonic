import { assert, assertInstalledAssemblyReference, assertNoInstalledAssemblyReference, assertNoRuntimeProjectReference, cliPath, existsSync, readFile, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "./harness.mjs";

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
            outputType: "Exe",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { Console } from \"@tsonic/dotnet/System.js\";",
      "",
      "export function matches(input: string): boolean {",
      "  const expression = /abc/i;",
      "  const constructed = new RegExp(\"xyz\", \"g\");",
      "  return expression.test(input) || constructed.test(input);",
      "}",
      "",
      "const expression = /a.b/s;",
      "Console.WriteLine(`${matches(\"ABC\")}:${matches(\"xyz\")}:${expression.test(\"a\\nb\")}:${expression.source}:${expression.flags}`);",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.RegExp expression = new Tsonic\.CSharp\.Js\.RegExp\("abc", "i"\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.RegExp constructed = new Tsonic\.CSharp\.Js\.RegExp\("xyz", "g"\);/);
  assert.match(generatedSource, /return expression\.test\(input\) \|\| constructed\.test\(input\);/);
  assert.match(generatedSource, /new Tsonic\.CSharp\.Js\.RegExp\("a\.b", "s"\)/);
  assert.doesNotMatch(generatedSource, /unsupported|invalid/i);

  assert.equal(runGeneratedProject(projectDirectory, "SmokeGeneratedRegExpLiteralCarrier"), "True:True:True:a.b:s\n");
});

test("CLI rejects statically unsupported RegExp literals before C# artifact emission", async () => {
  const projectDirectory = resolve(tempRoot, "regexp-literal-unsupported-static");
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
            assemblyName: "SmokeGeneratedUnsupportedRegExpLiteral",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function unsupported(value: string): boolean {",
      "  return /(?<name>a)/.test(value) || /abc/u.test(value);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.notEqual(build.status, 0, build.stdout + build.stderr);
  assert.match(build.stderr, /TS9100180/);
  assert.match(build.stderr, /Named capture groups are not in the proven RegExp subset|Unicode-mode pattern semantics/);
  assert.match(build.stderr, /pattern="abc" flags="u"/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedUnsupportedRegExpLiteral.csproj")), false);
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
  assertInstalledAssemblyReference(generatedProject, "Tsonic.CSharp.Runtime");
  assertNoRuntimeProjectReference(generatedProject, "Tsonic.CSharp.Runtime");
  assertInstalledAssemblyReference(generatedProject, "Tsonic.CSharp.Js");
  assertNoRuntimeProjectReference(generatedProject, "Tsonic.CSharp.Js");

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
  assert.match(build.stderr, /index\.ts:2:10: C# JS surface hard-rejected selected TypeScript standard-library call 'String\.match'/);
  assert.match(build.stderr, /index\.ts:6:10: C# JS surface hard-rejected selected TypeScript standard-library call 'String\.raw'/);
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
  assert.match(build.stderr, /Property 'replace' does not exist on type 'string'/);
  assert.match(build.stderr, /Property 'replaceAll' does not exist on type 'string'/);
  assert.match(build.stderr, /Property 'at' does not exist on type 'string'/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
});
