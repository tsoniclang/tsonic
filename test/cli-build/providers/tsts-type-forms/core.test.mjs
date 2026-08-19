import { assert, cliPath, existsSync, readFile, resolve, run, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";

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












test("CLI consumes TSTS source meaning for narrowing, contextual typing, generic inference, and overloads", async () => {
  const { generatedSource } = await assertBuilds("tsts-source-meaning-positive", "SmokeGeneratedTstsSourceMeaning", [
    "function id<T>(value: T): T {",
    "  return value;",
    "}",
    "",
    "function choose(value: \"left\"): \"L\";",
    "function choose(value: \"right\"): \"R\";",
    "function choose(value: \"left\" | \"right\"): \"L\" | \"R\" {",
    "  if (value === \"left\") {",
    "    return \"L\";",
    "  }",
    "  return \"R\";",
    "}",
    "",
    "export function describe(kind: \"left\" | \"right\"): string {",
    "  const rounded: number = 2;",
    "  if (kind === \"left\") {",
    "    const transform: (input: \"left\") => string = (input) => `L:${input}:${rounded}`;",
    "    const selected = transform(kind);",
    "    return `${selected}:${choose(kind)}`;",
    "  }",
    "  return \"R\";",
    "}",
    "",
    "export function present(value: string | null): string {",
    "  if (value === null) {",
    "    return \"none\";",
    "  }",
    "  return value;",
    "}",
    "",
    "export function formatWithContext(value: number): string {",
    "  const format: (input: number, label: string) => string = (input, label) => `${label}:${id(input)}`;",
    "  return format(value, \"value\");",
    "}",
    "",
  ]);

  assert.match(generatedSource, /public static T id<T>\(T value\)/);
  assert.match(generatedSource, /public static string choose\(string value\)/);
  assert.match(generatedSource, /public static string describe\(string kind\)/);
  assert.match(generatedSource, /double rounded = 2;/);
  assert.match(generatedSource, /if \(kind == "left"\)/);
  assert.match(generatedSource, /Func<string, string> transform = \(string input\) => \$"L:\{input\}:\{rounded\}";/);
  assert.match(generatedSource, /string selected = transform\(kind\);/);
  assert.match(generatedSource, /return \$"\{selected\}:\{choose\(kind\)\}";/);
  assert.match(generatedSource, /return "R";/);
  assert.match(generatedSource, /public static string present\(string\? value\)/);
  assert.match(generatedSource, /return value;/);
  assert.match(generatedSource, /Func<double, string, string> format = \(double input, string label\) => \$"\{label\}:\{id<double>\(input\)\}";/);
  assert.match(generatedSource, /return format\(value, "value"\);/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  await assertRejected("tsts-flow-narrowing-negative", "SmokeGeneratedTstsFlowNarrowingNegative", [
    "function requireText(value: string): string {",
    "  return value;",
    "}",
    "",
    "export function value(input: string | null): string {",
    "  if (input === null) {",
    "    return requireText(input);",
    "  }",
    "  return input;",
    "}",
    "",
  ], /TS2345: Argument of type 'null' is not assignable to parameter of type 'string'/);

  await assertRejected("tsts-contextual-typing-negative", "SmokeGeneratedTstsContextualTypingNegative", [
    "const bad: (value: number) => string = (value) => value;",
    "export function value(input: number): string { return bad(input); }",
    "",
  ], /TS2322: Type 'number' is not assignable to type 'string'/);

  await assertRejected("tsts-source-meaning-negative", "SmokeGeneratedTstsSourceMeaningNegative", [
    "function choose(value: \"left\"): \"L\";",
    "function choose(value: \"right\"): \"R\";",
    "function choose(value: \"left\" | \"right\"): \"L\" | \"R\" {",
    "  if (value === \"left\") {",
    "    return \"L\";",
    "  }",
    "  return \"R\";",
    "}",
    "const bad: \"R\" = choose(\"left\");",
    "export function value(): string { return bad; }",
    "",
  ], /TS2322: Type '"L"' is not assignable to type '"R"'/);

  await assertRejected("tsts-generic-inference-negative", "SmokeGeneratedTstsGenericInferenceNegative", [
    "function pair<T>(left: T, right: T): T {",
    "  return left;",
    "}",
    "const bad: string = pair(1, 2);",
    "export function value(): string { return bad; }",
    "",
  ], /TS2322: Type 'number' is not assignable to type 'string'/);

  await assertRejected("tsts-bind-diagnostic-negative", "SmokeGeneratedTstsBindDiagnosticNegative", [
    "export function value(): number {",
    "  return missingValue;",
    "}",
    "",
  ], /TS2304: Cannot find name 'missingValue'/);
});
test("CLI consumes expanded TSTS source meaning across flow, contextual callbacks, generics, and overloads", async () => {
  const { generatedSource } = await assertBuilds("tsts-source-meaning-matrix-positive", "SmokeGeneratedTstsSourceMeaningMatrix", [
    "class BaseValue {",
    "  name: string;",
    "  constructor(name: string) {",
    "    this.name = name;",
    "  }",
    "}",
    "",
    "class DerivedValue extends BaseValue {",
    "  score: number;",
    "  constructor(name: string, score: number) {",
    "    super(name);",
    "    this.score = score;",
    "  }",
    "}",
    "",
    "function apply<T, U>(value: T, callback: (value: T) => U): U {",
    "  return callback(value);",
    "}",
    "",
    "export function readBase(value: BaseValue | null): string {",
    "  if (value === null) {",
    "    return \"none\";",
    "  }",
    "  if (value instanceof DerivedValue) {",
    "    return `${value.name}:${value.score}`;",
    "  }",
    "  return value.name;",
    "}",
    "",
    "export function runContext(value: number): string {",
    "  const render: (input: number) => string = (input) => `${input}`;",
    "  const direct = apply(value, (input) => `${input + 1}`);",
    "  return `${render(value)}:${direct}`;",
    "}",
    "",
  ]);

  assert.match(generatedSource, /public class BaseValue/);
  assert.match(generatedSource, /public class DerivedValue : BaseValue/);
  assert.match(generatedSource, /public static string readBase\(BaseValue\? value\)/);
  assert.match(generatedSource, /if \(value is null\)/);
  assert.match(generatedSource, /if \(value is DerivedValue\)/);
  assert.match(generatedSource, /return \$"\{\(\(DerivedValue\)value\)\.name\}:\{\(\(DerivedValue\)value\)\.score\}";/);
  assert.match(generatedSource, /public static U apply<T, U>\(T value, Func<T, U> callback\)/);
  assert.match(generatedSource, /Func<double, string> render = \(double input\) => \$"\{input\}";/);
  assert.match(generatedSource, /string direct = apply<double, string>\(value, \(double input\) => \$"\{input \+ 1\}"\);/);
  assert.match(generatedSource, /return \$"\{render\(value\)\}:\{direct\}";/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  await assertRejected("tsts-contextual-generic-negative", "SmokeGeneratedTstsContextualGenericNegative", [
    "function apply<T, U>(value: T, callback: (value: T) => U): U {",
    "  return callback(value);",
    "}",
    "const bad: string = apply(1, (input) => input + 1);",
    "export function value(): string { return bad; }",
    "",
  ], /TS2322: Type 'number' is not assignable to type 'string'/);

  const invalidSourceDiagnostics = await assertRejected("tsts-invalid-narrowing-no-target-fallout", "SmokeGeneratedTstsInvalidNarrowingNoTargetFallout", [
    "class BaseValue {",
    "  name: string;",
    "  constructor(name: string) {",
    "    this.name = name;",
    "  }",
    "}",
    "",
    "class DerivedValue extends BaseValue {",
    "  score: number;",
    "  constructor(name: string, score: number) {",
    "    super(name);",
    "    this.score = score;",
    "  }",
    "}",
    "",
    "export function readBase(value: BaseValue | null): number {",
    "  if (value === null) {",
    "    return 0;",
    "  }",
    "  return value.score;",
    "}",
    "",
  ], /TS2339: Property 'score' does not exist on type 'BaseValue'/);
  assert.doesNotMatch(invalidSourceDiagnostics, /tsonic-csharp|C# property access/);
});
test("CLI consumes TSTS template literal type results and rejects incompatible literals", async () => {
  const { generatedSource } = await assertBuilds("template-literal-type-positive", "SmokeGeneratedTemplateLiteralTypes", [
    "type EventKind = \"created\" | \"deleted\";",
    "type EventName<T extends string> = `user:${T}`;",
    "type UpperEventName<T extends string> = `USER:${Uppercase<T>}`;",
    "",
    "export function eventName(kind: EventKind): EventName<EventKind> {",
    "  if (kind === \"created\") {",
    "    return \"user:created\";",
    "  }",
    "  return \"user:deleted\";",
    "}",
    "",
    "export function upperName(): UpperEventName<\"created\"> {",
    "  return \"USER:CREATED\";",
    "}",
    "",
  ]);

  assert.match(generatedSource, /public static string eventName\(string kind\)/);
  assert.match(generatedSource, /public static string upperName\(\)/);
  assert.match(generatedSource, /return "user:created";/);
  assert.match(generatedSource, /return "user:deleted";/);
  assert.match(generatedSource, /return "USER:CREATED";/);
  assert.doesNotMatch(generatedSource, /EventName/);
  assert.doesNotMatch(generatedSource, /UpperEventName|Uppercase/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  await assertRejected("template-literal-type-negative", "SmokeGeneratedTemplateLiteralTypesNegative", [
    "type EventKind = \"created\" | \"deleted\";",
    "type EventName<T extends string> = `user:${T}`;",
    "const bad: EventName<EventKind> = \"user:archived\";",
    "export function value(): string { return bad; }",
    "",
  ], /TS2322: Type '\"user:archived\"' is not assignable to type/);

  await assertRejected("template-literal-intrinsic-negative", "SmokeGeneratedTemplateLiteralIntrinsicNegative", [
    "type UpperEventName<T extends string> = `USER:${Uppercase<T>}`;",
    "const bad: UpperEventName<\"created\"> = \"USER:created\";",
    "export function value(): string { return bad; }",
    "",
  ], /TS2322: Type '\"USER:created\"' is not assignable to type/);
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

  await assertRejected("satisfies-object-freshness-negative", "SmokeGeneratedSatisfiesObjectFreshnessNegative", [
    "const bad = { name: \"value\", extra: 1 } satisfies { name: string };",
    "export function value(): string { return bad.name; }",
    "",
  ], /TS2353: Object literal may only specify known properties, and 'extra' does not exist in type '\{ name: string; \}'/);
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

  await assertRejected("as-const-nested-negative", "SmokeGeneratedAsConstNestedNegative", [
    "const config = { mode: \"ready\", nested: { count: 7 } } as const;",
    "config.nested.count = 8;",
    "export function value(): number { return config.nested.count; }",
    "",
  ], /TS2540: Cannot assign to 'count' because it is a read-only property/);
});
test("CLI consumes TSTS utility, conditional, infer, keyof, indexed-access, and mapped type results", async () => {
  const { generatedSource } = await assertBuilds("advanced-type-operators-positive", "SmokeGeneratedAdvancedTypeOperators", [
    "type Source = { name?: string; count: number; active: boolean };",
    "type Complete = Required<Source>;",
    "type Copy<T> = { [K in keyof T]: T[K] };",
    "type Flagged<T> = { [K in keyof T as `${K & string}Flag`]-?: boolean };",
    "type Name = Copy<Complete>[\"name\"];",
    "type Count = Pick<Complete, \"count\">[\"count\"];",
    "type HiddenName = NonNullable<Omit<Complete, \"count\" | \"active\">[\"name\"]>;",
    "type ReadonlyCount = Readonly<Complete>[\"count\"];",
    "type OptionalName = NonNullable<Partial<Complete>[\"name\"]>;",
    "type NameFlag = Flagged<Complete>[\"nameFlag\"];",
    "type First<T> = T extends readonly [infer Head, ...unknown[]] ? Head : never;",
    "type FirstName = First<[Name, number]>;",
    "type NumericOnly = Exclude<string | number | boolean, string | boolean>;",
    "type TextOnly = Extract<string | number | boolean, string>;",
    "type Primary = Record<\"primary\" | \"fallback\", TextOnly>[\"primary\"];",
    "type Formatter = (name: Name, count: NumericOnly) => TextOnly;",
    "type PairArgs = Parameters<Formatter>;",
    "type PairResult = Awaited<Promise<ReturnType<Formatter>>>;",
    "class UtilityBox {",
    "  name: Name;",
    "  count: Count;",
    "  constructor(name: Name, count: Count) {",
    "    this.name = name;",
    "    this.count = count;",
    "  }",
    "}",
    "type BoxArgs = ConstructorParameters<typeof UtilityBox>;",
    "type BoxInstance = InstanceType<typeof UtilityBox>;",
    "",
    "export function readName(value: FirstName, count: Count, label: OptionalName): PairResult {",
    "  const args: PairArgs = [value, count];",
    "  const primary: Primary = label;",
    "  const hidden: HiddenName = args[0];",
    "  const readonlyCount: ReadonlyCount = args[1];",
    "  const flag: NameFlag = true;",
    "  if (flag) {",
    "    return `${primary}:${hidden}:${readonlyCount}`;",
    "  }",
    "  return value;",
    "}",
    "",
    "export function describeBox(args: BoxArgs): PairResult {",
    "  const box: BoxInstance = new UtilityBox(args[0], args[1]);",
    "  const name: Name = args[0];",
    "  const count: Count = args[1];",
    "  return `${box.name}:${box.count}:${name}:${count}`;",
    "}",
    "",
  ]);

  assert.match(generatedSource, /public static string readName\(string value, double count, string label\)/);
  assert.match(generatedSource, /\(string, double\) args = \(value, count\);/);
  assert.match(generatedSource, /string primary = label;/);
  assert.match(generatedSource, /string hidden = args\.Item1;/);
  assert.match(generatedSource, /double readonlyCount = args\.Item2;/);
  assert.match(generatedSource, /bool flag = true;/);
  assert.match(generatedSource, /return value;/);
  assert.match(generatedSource, /public class UtilityBox/);
  assert.match(generatedSource, /public UtilityBox\(string name, double count\)/);
  assert.match(generatedSource, /public static string describeBox\(\(string, double\) args\)/);
  assert.match(generatedSource, /UtilityBox box = new UtilityBox\(args\.Item1, args\.Item2\);/);
  assert.match(generatedSource, /string name = args\.Item1;/);
  assert.match(generatedSource, /double count = args\.Item2;/);
  assert.match(generatedSource, /return \$"\{box\.name\}:\{box\.count\}:\{name\}:\{count\}";/);
  assert.doesNotMatch(generatedSource, /Required|Partial|Readonly|Pick|Omit|Record|Exclude|Extract|NonNullable|ReturnType|Parameters|ConstructorParameters|InstanceType|Awaited|keyof|infer|Copy|FirstName|Flagged|BoxArgs|BoxInstance/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  await assertRejected("advanced-type-operators-negative", "SmokeGeneratedAdvancedTypeOperatorsNegative", [
    "type Source = { name?: string; count: number; active: boolean };",
    "type Complete = Required<Source>;",
    "type Copy<T> = { [K in keyof T]: T[K] };",
    "type Name = Copy<Complete>[\"name\"];",
    "type First<T> = T extends readonly [infer Head, ...unknown[]] ? Head : never;",
    "type FirstName = First<[Name, number]>;",
    "const bad: FirstName = 123;",
    "export function value(): FirstName { return bad; }",
    "",
  ], /TS2322: Type 'number' is not assignable to type 'string'/);

  await assertRejected("mapped-key-remap-negative", "SmokeGeneratedMappedKeyRemapNegative", [
    "type Source = { name?: string; count: number; active: boolean };",
    "type Complete = Required<Source>;",
    "type Flagged<T> = { [K in keyof T as `${K & string}Flag`]-?: boolean };",
    "type NameFlag = Flagged<Complete>[\"nameFlag\"];",
    "const bad: NameFlag = \"yes\";",
    "export function value(): boolean { return bad; }",
    "",
  ], /TS2322: Type 'string' is not assignable to type 'boolean'/);

  await assertRejected("constructor-utility-negative", "SmokeGeneratedConstructorUtilityNegative", [
    "class UtilityBox {",
    "  name: string;",
    "  count: number;",
    "  constructor(name: string, count: number) {",
    "    this.name = name;",
    "    this.count = count;",
    "  }",
    "}",
    "type BoxArgs = ConstructorParameters<typeof UtilityBox>;",
    "type BoxInstance = InstanceType<typeof UtilityBox>;",
    "const args: BoxArgs = [\"Ada\"];",
    "const box: BoxInstance = new UtilityBox(\"Ada\", \"seven\");",
    "export function value(): string { return `${args[0]}:${box.name}`; }",
    "",
  ], /TS2322: Type '\[string\]' is not assignable to type '\[name: string, count: number\]'|TS2345: Argument of type 'string' is not assignable to parameter of type 'number'/);
});
test("CLI maps TSTS-resolved type-form arguments into provider generic target arguments", async () => {
  const { generatedSource } = await assertBuilds("provider-generic-type-form-arguments-positive", "SmokeGeneratedProviderGenericTypeFormArguments", [
    "import type { int } from \"@tsonic/csharp/types.js\";",
    "import { List } from \"@tsonic/dotnet/System.Collections.Generic.js\";",
    "",
    "type Element = int;",
    "type Text = NonNullable<string | null>;",
    "type ValueList = List<Element>;",
    "",
    "export function makeValues(first: Element, second: Element): ValueList {",
    "  const values = new List<Element>();",
    "  values.Add(first);",
    "  values.Add(second);",
    "  return values;",
    "}",
    "",
    "export function readFirst(values: ValueList): Element {",
    "  return values[0];",
    "}",
    "",
    "export function describe(label: Text, values: ValueList): string {",
    "  return `${label}:${values.Count}`;",
    "}",
    "",
  ]);

  assert.match(generatedSource, /public static System\.Collections\.Generic\.List<int> makeValues\(int first, int second\)/);
  assert.match(generatedSource, /System\.Collections\.Generic\.List<int> values = new System\.Collections\.Generic\.List<int>\(\);/);
  assert.match(generatedSource, /values\.Add\(first\);/);
  assert.match(generatedSource, /values\.Add\(second\);/);
  assert.match(generatedSource, /return values;/);
  assert.match(generatedSource, /public static int readFirst\(System\.Collections\.Generic\.List<int> values\)/);
  assert.match(generatedSource, /return values\[0\];/);
  assert.match(generatedSource, /public static string describe\(string label, System\.Collections\.Generic\.List<int> values\)/);
  assert.match(generatedSource, /return \$"\{label\}:\{values\.Count\}";/);
  assert.doesNotMatch(generatedSource, /NonNullable|Element|ValueList/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  await assertRejected("provider-generic-type-form-arguments-negative", "SmokeGeneratedProviderGenericTypeFormArgumentsNegative", [
    "import type { int } from \"@tsonic/csharp/types.js\";",
    "import { List } from \"@tsonic/dotnet/System.Collections.Generic.js\";",
    "",
    "type Element = int;",
    "type ValueList = List<Element>;",
    "const bad: ValueList = new List<string>([\"not-int\"]);",
    "export function value(): ValueList { return bad; }",
    "",
  ], /TS2322:/);
});
test("CLI consumes advanced type forms across source-core primitives and provider declarations", async () => {
  const { generatedSource } = await assertBuilds("advanced-type-provider-source-core-positive", "SmokeGeneratedAdvancedTypeProviderSourceCore", [
    "import type { int } from \"@tsonic/csharp/types.js\";",
    "import { List } from \"@tsonic/dotnet/System.Collections.Generic.js\";",
    "",
    "type UserShape = { id: number; name: string; flags?: boolean };",
    "type RequiredUser = Required<UserShape>;",
    "type GetterRows<T> = { [K in keyof T as `get${Capitalize<K & string>}`]-?: () => T[K] };",
    "type UserGetters = GetterRows<RequiredUser>; ",
    "type IdType = RequiredUser[\"id\"];",
    "type SourceId = int;",
    "type NameKey = keyof Pick<RequiredUser, \"name\">;",
    "type ProviderElement<T> = T extends List<infer Element> ? Element : never;",
    "type NestedProvider<T> = T extends List<infer Element> ? Element extends number ? ProviderElement<List<Element>> : never : never;",
    "type TextElement = string[][number];",
    "type Tail<T extends readonly unknown[]> = readonly [prefix: string, ...T];",
    "type Routed = Tail<readonly [number, boolean]>;",
    "",
    "export function describe(values: List<number>, id: int, nameText: string): string {",
    "  const getter: UserGetters[\"getName\"] = () => nameText;",
    "  const getId: UserGetters[\"getId\"] = () => id;",
    "  const checkedId = id satisfies SourceId;",
    "  const listElement: ProviderElement<List<number>> = values[0];",
    "  const nested: NestedProvider<List<number>> = listElement;",
    "  const key: NameKey = \"name\";",
    "  const routed: Routed = [\"route\", nested, true] as const;",
    "  const text: TextElement = \"ok\";",
    "  const checkedValues = values satisfies List<number>;",
    "  return `${key}:${getter()}:${getId()}:${text}:${routed[0]}:${routed[1]}:${routed[2]}:${checkedValues.Count}`;",
    "}",
    "",
  ]);

  assert.match(generatedSource, /public static string describe\(System\.Collections\.Generic\.List<double> values, int id, string nameText\)/);
  assert.match(generatedSource, /Func<string> getter = \(\) => nameText;/);
  assert.match(generatedSource, /Func<double> getId = \(\) => id;/);
  assert.match(generatedSource, /int checkedId = id;/);
  assert.match(generatedSource, /double listElement = values\[0\];/);
  assert.match(generatedSource, /double nested = listElement;/);
  assert.match(generatedSource, /string key = "name";/);
  assert.match(generatedSource, /\(string, double, bool\) routed = \("route", nested, true\);/);
  assert.match(generatedSource, /string text = "ok";/);
  assert.match(generatedSource, /System\.Collections\.Generic\.List<double> checkedValues = values;/);
  assert.match(generatedSource, /checkedValues\.Count/);
  assert.doesNotMatch(generatedSource, /Required|GetterRows|keyof|Capitalize|infer|satisfies|as const|ProviderElement|NestedProvider|Routed|TextElement/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  await assertRejected("advanced-type-provider-infer-negative", "SmokeGeneratedAdvancedTypeProviderInferNegative", [
    "import { List } from \"@tsonic/dotnet/System.Collections.Generic.js\";",
    "type ProviderElement<T> = T extends List<infer Element> ? Element : never;",
    "const bad: ProviderElement<List<number>> = \"not-number\";",
    "export function value(): ProviderElement<List<number>> { return bad; }",
    "",
  ], /TS2322: Type 'string' is not assignable to type 'number'/);

  await assertRejected("advanced-type-keyof-negative", "SmokeGeneratedAdvancedTypeKeyofNegative", [
    "import type { int } from \"@tsonic/csharp/types.js\";",
    "type UserShape = { id: int; name: string; flags?: boolean };",
    "type RequiredUser = Required<UserShape>;",
    "const bad: keyof Pick<RequiredUser, \"name\"> = \"id\";",
    "export function value(): string { return bad; }",
    "",
  ], /TS2322: Type '\"id\"' is not assignable to type '\"name\"'/);

  await assertRejected("advanced-type-provider-satisfies-negative", "SmokeGeneratedAdvancedTypeProviderSatisfiesNegative", [
    "import type { int } from \"@tsonic/csharp/types.js\";",
    "import { List } from \"@tsonic/dotnet/System.Collections.Generic.js\";",
    "const values = new List<string>();",
    "const checkedValues = values satisfies List<int>;",
    "export function value(): List<string> { return checkedValues; }",
    "",
  ], /TS1360: Type 'List<string>' does not satisfy the expected type 'List<int>'|TS1360:/);

  await assertRejected("advanced-type-indexed-access-negative", "SmokeGeneratedAdvancedTypeIndexedAccessNegative", [
    "import type { int } from \"@tsonic/csharp/types.js\";",
    "type UserShape = { id: int; name: string; flags?: boolean };",
    "type Missing = Required<UserShape>[\"missing\"];",
    "export function value(input: Missing): Missing { return input; }",
    "",
  ], /TS2339: Property 'missing' does not exist on type 'Required<UserShape>'/);

  const transformedSource = (await assertBuilds(
    "advanced-type-source-primitive-erasure",
    "SmokeGeneratedAdvancedTypeSourcePrimitiveErasure",
    [
    "import type { int } from \"@tsonic/csharp/types.js\";",
    "import { List } from \"@tsonic/dotnet/System.Collections.Generic.js\";",
    "",
    "type ProviderElement<T> = T extends List<infer Element> ? Element : never;",
    "type TupleHead<T> = T extends readonly [infer Head, ...readonly unknown[]] ? Head : never;",
    "",
    "export function fromProvider(values: List<int>): ProviderElement<List<int>> {",
    "  return values[0];",
    "}",
    "",
    "export function fromTuple(value: TupleHead<readonly [int, string]>): TupleHead<readonly [int, string]> {",
    "  return value;",
    "}",
    "",
    ],
  )).generatedSource;
  assert.match(
    transformedSource,
    /public static int fromProvider\(System\.Collections\.Generic\.List<int> values\)/u,
  );
  assert.match(transformedSource, /public static int fromTuple\(int value\)/u);
  assert.doesNotMatch(
    transformedSource,
    /source-fact-dependent-type-transform|__unsupported/u,
  );
});
