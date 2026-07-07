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












test("CLI consumes broad TSTS type-form matrix without backend type-system reimplementation", async () => {
  const { generatedSource } = await assertBuilds("advanced-type-closure-matrix-positive", "SmokeGeneratedAdvancedTypeClosureMatrix", [
    "import { Exception } from \"@tsonic/dotnet/System.js\";",
    "import { List } from \"@tsonic/dotnet/System.Collections.Generic.js\";",
    "",
    "type Source = { readonly id?: number; name: string; active: boolean };",
    "type Normalized<T> = { -readonly [K in keyof T]-?: T[K] };",
    "type Accessor<T> = { [K in keyof T as `read${Capitalize<K & string>}`]: () => NonNullable<T[K]> };",
    "type Shape = Normalized<Source>;",
    "type ShapeReaders = Accessor<Source>; ",
    "type NumericTuple = readonly [first: string, second?: number, ...rest: boolean[]];",
    "type TupleFirst = NumericTuple[0];",
    "type TupleRest<T> = T extends readonly [unknown, ...infer Rest] ? Rest : never;",
    "type TupleSecond = TupleRest<NumericTuple>[0];",
    "type CallableParts<T> = T extends (first: infer First, second: infer Second) => infer Result ? readonly [First, Second, Result] : never;",
    "type Formatter = (name: TupleFirst, count: NonNullable<TupleSecond>) => `user:${string}`;",
    "type FormatterParts = CallableParts<Formatter>;",
    "type Distribute<T> = T extends string ? `text:${T}` : T extends number ? \"numeric\" : \"other\";",
    "type Distributed = Distribute<\"name\" | 1 | boolean>;",
    "type NonDistributed<T> = [T] extends [string] ? \"string\" : \"mixed\";",
    "type Mixed = NonDistributed<\"name\" | 1>; ",
    "",
    "function buildReader(value: string): ShapeReaders[\"readName\"] {",
    "  return () => value;",
    "}",
    "",
    "export function describe(name: string, count: number, maybeException: Exception | null): string {",
    "  const shape = { id: count, name, active: true } satisfies Shape;",
    "  const reader = buildReader(shape.name);",
    "  const tuple: NumericTuple = [reader(), shape.id, true] as const;",
    "  const first: TupleFirst = tuple[0];",
    "  const second: NonNullable<TupleSecond> = tuple[1] ?? 0;",
    "  const parts: FormatterParts = [first, second, \"user:ok\"];",
    "  const distributed: Distributed = \"text:name\";",
    "  const mixed: Mixed = \"mixed\";",
    "  const values = new List<string>([parts[0], distributed, mixed]);",
    "  const providerText: string = values[0];",
    "  const message = maybeException!.Message;",
    "  return `${providerText}:${parts[1]}:${parts[2]}:${values.Count}:${message}`;",
    "}",
    "",
  ]);

  assert.match(generatedSource, /public static string describe\(string name, double count, System\.Exception\? maybeException\)/);
  assert.match(generatedSource, /Func<string> reader = buildReader\(shape\.name\);/);
  assert.match(generatedSource, /\(string, double\?, bool\) tuple = \(reader\(\), shape\.id, true\);/);
  assert.match(generatedSource, /string first = tuple\.Item1;/);
  assert.match(generatedSource, /double second = tuple\.Item2 \?\? 0;/);
  assert.match(generatedSource, /\(string, double, string\) parts = \(first, second, "user:ok"\);/);
  assert.match(generatedSource, /System\.Collections\.Generic\.List<string> values = new System\.Collections\.Generic\.List<string>\(new string\[\] \{ parts\.Item1, distributed, mixed \}\);/);
  assert.match(generatedSource, /string providerText = values\[0\];/);
  assert.match(generatedSource, /string message = maybeException\.Message;/);
  assert.match(generatedSource, /values\.Count/);
  assert.doesNotMatch(generatedSource, /Normalized|Accessor|keyof|Capitalize|NonNullable|TupleRest|CallableParts|Distribute|NonDistributed|satisfies|as const|!/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  await assertRejected("advanced-type-distributive-negative", "SmokeGeneratedAdvancedTypeDistributiveNegative", [
    "type Distribute<T> = T extends string ? `text:${T}` : T extends number ? \"numeric\" : \"other\";",
    "const bad: Distribute<\"name\" | 1> = \"other\";",
    "export function value(): string { return bad; }",
    "",
  ], /TS2322: Type '\"other\"' is not assignable to type/);

  await assertRejected("advanced-type-nondistributive-negative", "SmokeGeneratedAdvancedTypeNonDistributiveNegative", [
    "type NonDistributed<T> = [T] extends [string] ? \"string\" : \"mixed\";",
    "const bad: NonDistributed<\"name\" | 1> = \"string\";",
    "export function value(): string { return bad; }",
    "",
  ], /TS2322: Type '\"string\"' is not assignable to type '\"mixed\"'/);

  await assertRejected("advanced-type-callable-infer-negative", "SmokeGeneratedAdvancedTypeCallableInferNegative", [
    "type CallableParts<T> = T extends (first: infer First, second: infer Second) => infer Result ? readonly [First, Second, Result] : never;",
    "type Formatter = (name: string, count: number) => `user:${string}`;",
    "const bad: CallableParts<Formatter> = [\"Ada\", \"not-number\", \"user:ok\"];",
    "export function value(): CallableParts<Formatter> { return bad; }",
    "",
  ], /TS2322: Type 'string' is not assignable to type 'number'/);
});
test("CLI consumes TSTS non-null assertion results without backend nullability inference", async () => {
  const { generatedSource } = await assertBuilds("non-null-assertion-positive", "SmokeGeneratedNonNullAssertion", [
    "export class Box {",
    "  name: string = \"\";",
    "}",
    "",
    "export function unwrap(value: string | null): string {",
    "  return value!;",
    "}",
    "",
    "export function readName(value: Box | null): string {",
    "  return value!.name;",
    "}",
    "",
    "export function invoke(value: (() => string) | null): string {",
    "  return value!();",
    "}",
    "",
  ]);

  assert.match(generatedSource, /public static string unwrap\(string\? value\)/);
  assert.match(generatedSource, /return value;/);
  assert.match(generatedSource, /public class Box/);
  assert.match(generatedSource, /public static string readName\(Box\? value\)/);
  assert.match(generatedSource, /return value\.name;/);
  assert.match(generatedSource, /public static string invoke\(Func<string>\? value\)/);
  assert.match(generatedSource, /return value\(\);/);
  assert.doesNotMatch(generatedSource, /!/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  await assertRejected("non-null-assertion-negative", "SmokeGeneratedNonNullAssertionNegative", [
    "const value: string | null = \"x\";",
    "const bad = value!.missing;",
    "export function read(): string { return bad; }",
    "",
  ], /TS2339: Property 'missing' does not exist on type 'string'/);
});