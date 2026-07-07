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
  assert.match(build.stderr, /Property 'trim' does not exist on type 'string'\. Did you mean 'Trim'\?/);
  assert.match(build.stderr, /C# property access 'toUpperCase' must be selected by TSTS\/provider facts before emission/);
  assert.match(build.stderr, /C# property access 'slice' must be selected by TSTS\/provider facts before emission/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedExistingTypescriptJsBuiltinsWithoutJsSurface.csproj")), false);
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
  assert.match(build.stderr, /TS7053: Element implicitly has an 'any' type because expression of type 'number' can't be used to index type 'String'\./u);
  assert.match(build.stderr, /TS9100103: C# provider could not map checked element access on target 'System\.Private\.CoreLib, Version=10\.0\.0\.0, Culture=neutral, PublicKeyToken=7cec85d7bea7798e::System\.String' from selected TSTS provider index declaration identity\./u);
  assert.match(build.stderr, /TS9100109: C# native array element access requires an integral TSTS\/provider-backed index type\./u);
  assert.doesNotMatch(build.stderr, /TS9100111|TS9100112/u);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedNonIntegralIndexes.csproj")), false);
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

test("CLI hard-rejects dynamic eval, Function, and Proxy APIs", async () => {
  const projectDirectory = resolve(tempRoot, "dynamic-code-proxy-rejections");
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
            assemblyName: "SmokeGeneratedDynamicCodeProxyRejections",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function evaluate(): unknown {",
      "  return eval(\"1 + 1\");",
      "}",
      "",
      "export function makeFunction(): Function {",
      "  return Function(\"return 1\");",
      "}",
      "",
      "export function constructFunction(): Function {",
      "  return new Function(\"return 1\");",
      "}",
      "",
      "export function makeProxy(target: object): object {",
      "  return new Proxy(target, {});",
      "}",
      "",
      "export function makeRevocable(target: object): object {",
      "  return Proxy.revocable(target, {});",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /C# emission cannot support JavaScript eval/);
  assert.match(build.stderr, /C# emission cannot support JavaScript dynamic Function construction/);
  assert.match(build.stderr, /C# emission cannot support JavaScript Proxy/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedDynamicCodeProxyRejections.csproj")), false);
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
  assert.match(build.stderr, /Cannot find name 'Date'/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
});

