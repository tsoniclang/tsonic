import { performance } from "node:perf_hooks";
import { assert, cliPath, existsSync, readFile, repoRoot, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "./harness.mjs";

test("CLI emits C# null-conditional access from TSTS optional-chain AST", async () => {
  const projectDirectory = resolve(tempRoot, "optional-chain");
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
            assemblyName: "SmokeGeneratedOptionalChain",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int } from \"@tsonic/csharp/types.js\";",
      "",
      "export class Box {",
      "  value: number = 1;",
      "  read(): number {",
      "    return this.value;",
      "  }",
      "}",
      "",
      "export function readValue(box: Box, defaultValue: number): number {",
      "  return box?.value ?? defaultValue;",
      "}",
      "",
      "export function readCall(box: Box, defaultValue: number): number {",
      "  return box?.read() ?? defaultValue;",
      "}",
      "",
      "export function readElement(values: number[] | null, index: int, defaultValue: number): number {",
      "  return values?.[index] ?? defaultValue;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /return box\?\.value \?\? defaultValue;/);
  assert.match(generatedSource, /return box\?\.read\(\) \?\? defaultValue;/);
  assert.match(generatedSource, /public static double readElement\(double\[\]\? values, int index, double defaultValue\)/);
  assert.match(generatedSource, /return values\?\[index\] \?\? defaultValue;/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedOptionalChain.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits nullable C# storage for nullish unions from provider runtime-carrier facts", async () => {
  const projectDirectory = resolve(tempRoot, "nullable-unions");
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
            assemblyName: "SmokeGeneratedNullableUnions",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export class Box {",
      "  value: number = 1;",
      "}",
      "",
      "export function maybeNumber(flag: boolean): number | null {",
      "  return flag ? 1.5 : null;",
      "}",
      "",
      "export function maybeNumberUndefined(flag: boolean): number | undefined {",
      "  return flag ? 2.5 : undefined;",
      "}",
      "",
      "export function maybeBoolean(flag: boolean): boolean | null {",
      "  return flag ? true : null;",
      "}",
      "",
      "export function maybeBox(flag: boolean, box: Box): Box | null {",
      "  return flag ? box : null;",
      "}",
      "",
      "export function readBoolean(value: boolean | null, alternate: boolean): boolean {",
      "  return value ?? alternate;",
      "}",
      "",
      "export function readUndefined(value: number | undefined, alternate: number): number {",
      "  return value ?? alternate;",
      "}",
      "",
      "export function read(box: Box | null, defaultValue: number): number {",
      "  return box?.value ?? defaultValue;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static double\? maybeNumber\(bool flag\)/);
  assert.match(generatedSource, /return flag \? 1\.5 : null;/);
  assert.match(generatedSource, /public static double\? maybeNumberUndefined\(bool flag\)/);
  assert.match(generatedSource, /return flag \? 2\.5 : null;/);
  assert.match(generatedSource, /public static bool\? maybeBoolean\(bool flag\)/);
  assert.match(generatedSource, /return flag \? true : null;/);
  assert.match(generatedSource, /public static Box\? maybeBox\(bool flag, Box box\)/);
  assert.match(generatedSource, /public static bool readBoolean\(bool\? value, bool alternate\)/);
  assert.match(generatedSource, /return value \?\? alternate;/);
  assert.match(generatedSource, /public static double readUndefined\(double\? value, double alternate\)/);
  assert.match(generatedSource, /public static double read\(Box\? box, double defaultValue\)/);
  assert.match(generatedSource, /return box\?\.value \?\? defaultValue;/);
  assert.doesNotMatch(generatedSource, /\bundefined\b/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedNullableUnions.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI rejects invalid nullish coalescing fallback literals before C# emission", async () => {
  const projectDirectory = resolve(tempRoot, "nullish-char-invalid-expected-type");
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
            assemblyName: "SmokeGeneratedNullishCharInvalidExpectedType",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { char } from \"@tsonic/csharp/types.js\";",
      "",
      "export function fallback(value: char | null): char {",
      "  return value ?? \"xy\";",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /char literals require exactly one UTF-16 code unit/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedNullishCharInvalidExpectedType.csproj")), false);
});

test("CLI emits explicit tuple types and tuple literals as C# value tuples", async () => {
  const projectDirectory = resolve(tempRoot, "value-tuples");
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
            assemblyName: "SmokeGeneratedTuples",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function makePair(name: string, value: number): [string, number] {",
      "  const pair: [string, number] = [name, value];",
      "  return pair;",
      "}",
      "",
      "export function returnPair(name: string, value: number): [string, number] {",
      "  return [name, value];",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static \(string, double\) makePair\(string name, double value\)/);
  assert.match(generatedSource, /\(string, double\) pair = \(name, value\);/);
  assert.match(generatedSource, /public static \(string, double\) returnPair\(string name, double value\)/);
  assert.match(generatedSource, /return \(name, value\);/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedTuples.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI runs tuple numeric index access through value-tuple members", async () => {
  const assemblyName = "SmokeGeneratedTupleElementAccess";
  const projectDirectory = resolve(tempRoot, "tuple-element-access");
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
            assemblyName,
            outputType: "Exe",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { Console } from \"@tsonic/dotnet/System.js\";",
      "",
      "type Row = [string, number];",
      "",
      "function format(row: Row): string {",
      "  const zero = 0 as const;",
      "  return `${row[zero]}:${row[1]}`;",
      "}",
      "",
      "const row: Row = [\"tuple\", 4];",
      "Console.WriteLine(format(row));",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static string format\(\(string, double\) row\)/);
  assert.match(generatedSource, /return \$"\{row\.Item1\}:\{row\.Item2\}";/);
  assert.doesNotMatch(generatedSource, /row\[[^\]]+\]/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const projectPath = resolve(projectDirectory, `out/csharp/${assemblyName}.csproj`);
  const dotnet = run("dotnet", ["build", projectPath, "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);

  const executed = run("dotnet", ["run", "--project", projectPath, "--no-build", "--no-restore"]);
  assert.equal(executed.status, 0, executed.stdout + executed.stderr);
  assert.equal(executed.stdout.replace(/\r\n/g, "\n"), "tuple:4\n");
});

test("CLI rejects tuple rest/default forms that still lack explicit carrier facts", async () => {
  const projectDirectory = resolve(tempRoot, "tuple-rest-default-fail-closed");
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
            assemblyName: "SmokeGeneratedTupleRestDefaultsRejected",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function optionalDefault(input: [string | undefined, number]): string {",
      "  const [name = \"fallback\"] = input;",
      "  return name;",
      "}",
      "",
      "export function singleRest(input: [string, number]): string {",
      "  const [name, ...rest] = input;",
      "  return name;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /Tuple destructuring defaults for optional\/nullish tuple elements require finalized tuple optional-element facts before C# emission/);
  assert.doesNotMatch(build.stderr, /Tuple rest destructuring requires at least two finalized tuple slice elements before C# emission/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedTupleRestDefaultsRejected.csproj")), false);
});

test("CLI rejects tuple dynamic indexes without finalized element facts", async () => {
  const projectDirectory = resolve(tempRoot, "tuple-dynamic-index-fail-closed");
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
            assemblyName: "SmokeGeneratedTupleDynamicIndex",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function dynamicIndex(row: [string, number], index: number): string | number {",
      "  return row[index];",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /C# source tuple element access requires a statically proven non-negative integer tuple index from TSTS literal or constant facts/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedTupleDynamicIndex.csproj")), false);
});

test("CLI rejects tuple out-of-range indexes through TSTS before C# emission", async () => {
  const projectDirectory = resolve(tempRoot, "tuple-out-of-range-fail-closed");
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
            assemblyName: "SmokeGeneratedTupleOutOfRangeIndex",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function outOfRangeIndex(row: [string, number]): boolean {",
      "  return row[2];",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /TS2493: Tuple type '\[string, number\]' of length '2' has no element at index '2'/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedTupleOutOfRangeIndex.csproj")), false);
});

