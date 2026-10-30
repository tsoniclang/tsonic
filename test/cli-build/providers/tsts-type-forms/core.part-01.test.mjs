import { assert, cliPath, existsSync, readFile, resolve, run, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";
import { assertBuilds, assertRejected } from './core-fixtures.mjs';

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
