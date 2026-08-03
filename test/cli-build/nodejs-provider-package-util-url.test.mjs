import { assert, cliPath, existsSync, readFile, resolve, run, runGeneratedProject, runNode, targetCsharpNodejsPackageJson, tempRoot, test, writeProject } from "./harness.mjs";

test("CLI rejects open-carrier node:util format operations without fallback", async () => {
  const projectDirectory = resolve(tempRoot, "nodejs-util-format-unsupported");
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
      "import { format } from \"node:util\";",
      "",
      "export function render(value: unknown): string {",
      "  return format(\"%o\", value);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /C# NodeJS provider package hard-rejected selected call 'node:util' export 'format'/);
  assert.match(build.stderr, /System\.Object/);
  assert.doesNotMatch(build.stderr, /Reflection|dynamic|GetMethod|GetProperty/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
});

test("CLI rejects default node:util format operations without fallback", async () => {
  const projectDirectory = resolve(tempRoot, "nodejs-default-util-format-unsupported");
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
      "import util from \"node:util\";",
      "",
      "export function render(value: unknown): string {",
      "  return util.format(\"%o\", value);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /C# NodeJS provider package hard-rejected selected call 'node:util' export 'format' member '<export>'/u);
  assert.match(build.stderr, /node:util\.format\(System\.Object,System\.Object\[\]\)/);
  assert.doesNotMatch(build.stderr, /Reflection|dynamic|GetMethod|GetProperty/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
});

test("CLI rejects other open-carrier node:util operations without fallback", async () => {
  const projectDirectory = resolve(tempRoot, "nodejs-util-open-carrier-unsupported");
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
      "import { debuglog, deprecate, formatWithOptions, inspect, isDeepStrictEqual } from \"node:util\";",
      "",
      "export function render(value: unknown): boolean {",
      "  formatWithOptions({}, \"%o\", value);",
      "  inspect(value);",
      "  isDeepStrictEqual(value, value);",
      "  debuglog(\"demo\");",
      "  deprecate(() => {}, \"deprecated\");",
      "  return true;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /C# NodeJS provider package hard-rejected selected call 'node:util' export '(formatWithOptions|inspect|isDeepStrictEqual|debuglog|deprecate)'/);
  assert.doesNotMatch(build.stderr, /Reflection|dynamic|GetMethod|GetProperty|JsonSerializer|GetType/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
});

test("CLI rejects open-object node:url format operations without fallback", async () => {
  const projectDirectory = resolve(tempRoot, "nodejs-url-format-unsupported");
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
      "import { format } from \"node:url\";",
      "",
      "export function render(input: string): string {",
      "  return format({ href: input });",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /C# NodeJS provider package hard-rejected selected call 'node:url' export 'format'/);
  assert.match(build.stderr, /node:url|format|selected target signature fact|target binding/);
  assert.doesNotMatch(build.stderr, /Reflection|dynamic|GetMethod|GetProperty/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
});

test("CLI rejects unsupported node:url URLPattern operations without fallback", async () => {
  const projectDirectory = resolve(tempRoot, "nodejs-url-pattern-unsupported");
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
      "import { URLPattern } from \"node:url\";",
      "",
      "export function accepts(input: string): boolean {",
      "  const pattern = new URLPattern(\"/books/:id\");",
      "  return pattern.test(input);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /C# NodeJS provider package hard-rejected selected call 'node:url' export 'URLPattern' member 'node:url\.URLPattern\.constructor'/u);
  assert.match(build.stderr, /URLPattern\.constructor/);
  assert.doesNotMatch(build.stderr, /Reflection|dynamic|GetMethod|GetProperty/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
});
