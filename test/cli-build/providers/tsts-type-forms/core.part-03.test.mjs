import { assert, cliPath, existsSync, readFile, resolve, run, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";
import { assertBuilds, assertRejected } from './core-fixtures.mjs';

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
