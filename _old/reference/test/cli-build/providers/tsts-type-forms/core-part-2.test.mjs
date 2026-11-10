import { assert, cliPath, existsSync, readFile, resolve, run, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";
import { assertBuilds, assertRejected } from './core-fixtures.mjs';

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
