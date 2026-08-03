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

test("CLI emits selected zero-argument JS Number locale formatting", async () => {
  const projectDirectory = resolve(tempRoot, "js-number-locale-default");
  const assemblyName = "SmokeGeneratedNumberLocaleDefault";
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{
        id: "csharp",
        surfaces: ["js"],
        options: { namespace: "Smoke.Generated", assemblyName },
      }],
    }, null, 2),
    "src/index.ts": [
      "export function locale(value: number): string {",
      "  return value.toLocaleString();",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);
  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Number\.toLocaleString\(value\);/);
  assert.doesNotMatch(generatedSource, /dynamic|System\.Reflection|__unsupported/);
  const dotnet = run("dotnet", ["build", resolve(projectDirectory, `out/csharp/${assemblyName}.csproj`), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI hard-rejects selected JS Number locale/options formatting without Intl facts", async () => {
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
  assert.match(build.stdout + build.stderr, /Intl\.NumberFormat-compatible source and runtime facts/);
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
  assert.match(build.stdout + build.stderr, /new Number\(\.\.\.\) requires an explicit wrapper-object carrier/);
  assert.match(build.stdout + build.stderr, /Selected source identity: js\.NumberConstructor\.construct/);
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
  assert.match(build.stdout + build.stderr, /new Boolean\(\.\.\.\) requires an explicit wrapper-object carrier/);
  assert.match(build.stdout + build.stderr, /Selected source identity: js\.BooleanConstructor\.construct/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedBooleanWrapperRejected.csproj")), false);
});
