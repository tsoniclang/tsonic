import { assert, cliPath, existsSync, readFile, resolve, run, runNode, tempRoot, test, writeProject } from "./harness.mjs";

function projectConfig(assemblyName) {
  return JSON.stringify({
    entryPoint: "index.ts",
    rootDir: "src",
    outDir: "out",
    targets: [
      {
        id: "csharp",
        options: {
          namespace: "Smoke.Generated",
          assemblyName,
        },
      },
    ],
  }, null, 2);
}

async function writeTypeFormProject(projectName, assemblyName, sourceLines) {
  const projectDirectory = resolve(tempRoot, projectName);
  await writeProject(projectDirectory, {
    "tsonic.json": projectConfig(assemblyName),
    "src/index.ts": `${sourceLines.join("\n")}\n`,
  });
  return projectDirectory;
}

async function assertBuilds(projectName, assemblyName, sourceLines) {
  const projectDirectory = await writeTypeFormProject(projectName, assemblyName, sourceLines);
  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);
  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  const dotnet = run("dotnet", ["build", resolve(projectDirectory, `out/csharp/${assemblyName}.csproj`), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
  return { projectDirectory, generatedSource };
}

async function assertRejected(projectName, assemblyName, sourceLines, expectedDiagnostic) {
  const projectDirectory = await writeTypeFormProject(projectName, assemblyName, sourceLines);
  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1, build.stdout + build.stderr);
  assert.match(build.stderr, expectedDiagnostic);
  assert.equal(existsSync(resolve(projectDirectory, `out/csharp/${assemblyName}.csproj`)), false);
  return build.stderr;
}

test("CLI consumes TSTS template literal type results and rejects incompatible literals", async () => {
  const { generatedSource } = await assertBuilds("template-literal-type-positive", "SmokeGeneratedTemplateLiteralTypes", [
    "type EventKind = \"created\" | \"deleted\";",
    "type EventName<T extends string> = `user:${T}`;",
    "",
    "export function eventName(kind: EventKind): EventName<EventKind> {",
    "  if (kind === \"created\") {",
    "    return \"user:created\";",
    "  }",
    "  return \"user:deleted\";",
    "}",
    "",
  ]);

  assert.match(generatedSource, /public static string eventName\(string kind\)/);
  assert.match(generatedSource, /return "user:created";/);
  assert.match(generatedSource, /return "user:deleted";/);
  assert.doesNotMatch(generatedSource, /EventName/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  await assertRejected("template-literal-type-negative", "SmokeGeneratedTemplateLiteralTypesNegative", [
    "type EventKind = \"created\" | \"deleted\";",
    "type EventName<T extends string> = `user:${T}`;",
    "const bad: EventName<EventKind> = \"user:archived\";",
    "export function value(): string { return bad; }",
    "",
  ], /TS2322: Type '\"user:archived\"' is not assignable to type/);
});

test("CLI consumes TSTS variadic tuple type results and rejects incompatible tuple arity", async () => {
  const { generatedSource } = await assertBuilds("variadic-tuple-positive", "SmokeGeneratedVariadicTuples", [
    "type Append<T extends unknown[], U> = [...T, U];",
    "type Row = Append<[string, number], boolean>;",
    "",
    "export function makeRow(name: string, value: number, active: boolean): Row {",
    "  return [name, value, active];",
    "}",
    "",
    "export function format(row: Row): string {",
    "  return `${row[0]}:${row[1]}:${row[2]}`;",
    "}",
    "",
  ]);

  assert.match(generatedSource, /public static \(string, double, bool\) makeRow\(string name, double value, bool active\)/);
  assert.match(generatedSource, /return \(name, value, active\);/);
  assert.match(generatedSource, /public static string format\(\(string, double, bool\) row\)/);
  assert.match(generatedSource, /row\.Item1/);
  assert.match(generatedSource, /row\.Item2/);
  assert.match(generatedSource, /row\.Item3/);
  assert.doesNotMatch(generatedSource, /row\[[^\]]+\]/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  await assertRejected("variadic-tuple-negative", "SmokeGeneratedVariadicTuplesNegative", [
    "type Append<T extends unknown[], U> = [...T, U];",
    "type Row = Append<[string, number], boolean>;",
    "const bad: Row = [\"name\", 1];",
    "export function value(): Row { return bad; }",
    "",
  ], /TS2322: Type '\[string, number\]' is not assignable to type/);
});

test("CLI lets TSTS validate satisfies and erases it from target emission", async () => {
  const { generatedSource } = await assertBuilds("satisfies-positive", "SmokeGeneratedSatisfiesTypeForm", [
    "export function identity(value: number): number {",
    "  const checkedValue = value satisfies number;",
    "  return checkedValue;",
    "}",
    "",
  ]);

  assert.match(generatedSource, /public static double identity\(double value\)/);
  assert.match(generatedSource, /double checkedValue = value;/);
  assert.doesNotMatch(generatedSource, /satisfies/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  await assertRejected("satisfies-negative", "SmokeGeneratedSatisfiesTypeFormNegative", [
    "const bad = \"value\" satisfies number;",
    "export function value(): string { return bad; }",
    "",
  ], /TS1360: Type 'string' does not satisfy the expected type 'number'/);
});

test("CLI consumes TSTS as-const literal readonly results and rejects readonly writes", async () => {
  const { generatedSource } = await assertBuilds("as-const-positive", "SmokeGeneratedAsConstTypeForm", [
    "export function status(): string {",
    "  const row = [\"ready\", 7] as const;",
    "  return `${row[0]}:${row[1]}`;",
    "}",
    "",
  ]);

  assert.match(generatedSource, /public static string status\(\)/);
  assert.match(generatedSource, /\(string, double\) row = \("ready", 7\);/);
  assert.match(generatedSource, /return \$"\{row\.Item1\}:\{row\.Item2\}";/);
  assert.doesNotMatch(generatedSource, /as const/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  await assertRejected("as-const-negative", "SmokeGeneratedAsConstTypeFormNegative", [
    "const row = [\"ready\", 7] as const;",
    "row[0] = \"done\";",
    "export function value(): string { return row[0]; }",
    "",
  ], /TS2540: Cannot assign to '0' because it is a read-only property/);
});

test("CLI consumes TSTS utility, conditional, infer, keyof, indexed-access, and mapped type results", async () => {
  const { generatedSource } = await assertBuilds("advanced-type-operators-positive", "SmokeGeneratedAdvancedTypeOperators", [
    "type Source = { name: string; count: number };",
    "type Copy<T> = { [K in keyof T]: T[K] };",
    "type Name = Copy<Source>[\"name\"];",
    "type First<T> = T extends readonly [infer Head, ...unknown[]] ? Head : never;",
    "type FirstName = First<[Name, number]>;",
    "type TextOnly = Extract<string | number | boolean, string>;",
    "",
    "export function readName(value: FirstName): TextOnly {",
    "  return value;",
    "}",
    "",
  ]);

  assert.match(generatedSource, /public static string readName\(string value\)/);
  assert.match(generatedSource, /return value;/);
  assert.doesNotMatch(generatedSource, /Extract|keyof|infer|Copy|FirstName/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  await assertRejected("advanced-type-operators-negative", "SmokeGeneratedAdvancedTypeOperatorsNegative", [
    "type Source = { name: string; count: number };",
    "type Copy<T> = { [K in keyof T]: T[K] };",
    "type Name = Copy<Source>[\"name\"];",
    "type First<T> = T extends readonly [infer Head, ...unknown[]] ? Head : never;",
    "type FirstName = First<[Name, number]>;",
    "const bad: FirstName = 123;",
    "export function value(): FirstName { return bad; }",
    "",
  ], /TS2322: Type 'number' is not assignable to type 'string'/);
});

test("CLI consumes TSTS non-null assertion results without backend nullability inference", async () => {
  const { generatedSource } = await assertBuilds("non-null-assertion-positive", "SmokeGeneratedNonNullAssertion", [
    "export function unwrap(value: string | null): string {",
    "  return value!;",
    "}",
    "",
  ]);

  assert.match(generatedSource, /public static string unwrap\(string\? value\)/);
  assert.match(generatedSource, /return value;/);
  assert.doesNotMatch(generatedSource, /!/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  await assertRejected("non-null-assertion-negative", "SmokeGeneratedNonNullAssertionNegative", [
    "const value: string | null = \"x\";",
    "const bad = value!.missing;",
    "export function read(): string { return bad; }",
    "",
  ], /TS2339: Property 'missing' does not exist on type 'string'/);
});
