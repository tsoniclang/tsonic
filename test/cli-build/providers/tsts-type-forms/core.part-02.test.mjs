import { assert, cliPath, existsSync, readFile, resolve, run, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";
import { assertBuilds, assertRejected } from './core-fixtures.mjs';

test("CLI consumes TSTS as-const literal readonly results and rejects readonly writes", async () => {
  const { generatedSource } = await assertBuilds("as-const-positive", "SmokeGeneratedAsConstTypeForm", [
    "export function status(): string {",
    "  const row = [\"ready\", 7] as const;",
    "  return `${row[0]}:${row[1]}`;",
    "}",
    "",
  ]);

  assert.match(generatedSource, /public static string status\(\)/);
  assert.match(generatedSource, /\(string, int\) row = \("ready", 7\);/);
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
