import { assert, cliPath, existsSync, readFile, resolve, run, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";
import { assertBuilds, assertRejected } from './core-fixtures.mjs';

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
  assert.match(generatedSource, /return \$"\{selected\}:\{\(global::Smoke\.Generated\.Index\.choose\(kind\)\)\}";/);
  assert.match(generatedSource, /return "R";/);
  assert.match(generatedSource, /public static string present\(string\? value\)/);
  assert.match(generatedSource, /return value;/);
  assert.match(generatedSource, /Func<double, string, string> format = \(double input, string label\) => \$"\{label\}:\{\(global::Smoke\.Generated\.Index\.id<double>\(input\)\)\}";/);
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
  assert.match(generatedSource, /if \(\(object\?\)value! is DerivedValue\)/);
  assert.match(generatedSource, /return \$"\{\(\(DerivedValue\)value!\)\.name\}:\{\(\(DerivedValue\)value!\)\.score\}";/);
  assert.match(generatedSource, /public static U apply<T, U>\(T value, Func<T, U> callback\)/);
  assert.match(generatedSource, /Func<double, string> render = \(double input\) => \$"\{input\}";/);
  assert.match(generatedSource, /string direct = global::Smoke\.Generated\.Index\.apply<double, string>\(value, \(double input\) => \$"\{input \+ 1\}"\);/);
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
