import { performance } from "node:perf_hooks";
import { assert, cliPath, existsSync, readFile, repoRoot, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "./harness.mjs";

test("CLI emits source-owned local object destructuring", async () => {
  const projectDirectory = resolve(tempRoot, "local-destructuring");
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
            assemblyName: "SmokeGeneratedDestructuring",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export class Point {",
      "  x: number = 1;",
      "  y: number = 2;",
      "}",
      "",
      "export class Box {",
      "  child: Point = new Point();",
      "}",
      "",
      "export function local(point: Point, box: Box): number {",
      "  const { x } = point;",
      "  const { x: aliasX, \"y\": stringY } = point;",
      "  const { child: { x: nestedX } } = box;",
      "  return x + aliasX + stringY + nestedX;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /Point __tsonic_destructure0 = point;/);
  assert.match(generatedSource, /double x = __tsonic_destructure0\.x;/);
  assert.match(generatedSource, /double aliasX = __tsonic_destructure\d+\.x;/);
  assert.match(generatedSource, /double stringY = __tsonic_destructure\d+\.y;/);
  assert.match(generatedSource, /Point __tsonic_destructure\d+ = __tsonic_destructure\d+\.child;/);
  assert.match(generatedSource, /double nestedX = __tsonic_destructure\d+\.x;/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedDestructuring.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI runs array and object-shape destructuring assignment from finalized facts", async () => {
  const projectDirectory = resolve(tempRoot, "destructuring-assignment-runtime");
  const assemblyName = "SmokeGeneratedDestructuringAssignment";
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
      "import type { int } from \"@tsonic/csharp/types.js\";",
      "",
      "type Shape = { value: int; label: string };",
      "type Address = { city: string; zip: string; country: string };",
      "type User = { name: string; address: Address };",
      "",
      "function assignArray(values: int[]): int {",
      "  let first: int = 0;",
      "  let second: int = 0;",
      "  [first, second] = values;",
      "  return first + second;",
      "}",
      "",
      "function assignArrayExpression(values: int[]): string {",
      "  let first: int = 0;",
      "  const returned = ([first] = values);",
      "  return `${first}:${returned[1]}`;",
      "}",
      "",
      "function assignObject(input: Shape): string {",
      "  let value: int = 0;",
      "  let label: string = \"\";",
      "  ({ value, label } = input);",
      "  return `${label}:${value}`;",
      "}",
      "",
      "function assignObjectExpression(input: Shape): string {",
      "  let value: int = 0;",
      "  let label: string = \"\";",
      "  const returned = ({ value, label } = input);",
      "  return `${label}:${returned.value}:${value}`;",
      "}",
      "",
      "function assignObjectRest(input: Shape): string {",
      "  let value: int = 0;",
      "  let rest: { label: string } = { label: \"\" };",
      "  ({ value, ...rest } = input);",
      "  return `${rest.label}:${value}`;",
      "}",
      "",
      "function assignNestedObjectRest(input: User): string {",
      "  let city: string = \"\";",
      "  let restAddress: { zip: string; country: string } = { zip: \"\", country: \"\" };",
      "  ({ address: { city, ...restAddress } } = input);",
      "  return `${city}:${restAddress.zip}:${restAddress.country}`;",
      "}",
      "",
      "Console.WriteLine(`${assignArray([2, 3])}|${assignArrayExpression([4, 5])}|${assignObject({ value: 7, label: \"ok\" })}|${assignObjectExpression({ value: 9, label: \"expr\" })}|${assignObjectRest({ value: 11, label: \"rest\" })}|${assignNestedObjectRest({ name: \"Ada\", address: { city: \"Paris\", zip: \"75001\", country: \"FR\" } })}`);",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /int\[\] __tsonic_destructure\d+ = values;/);
  assert.match(generatedSource, /first = __tsonic_destructure\d+\[0\];/);
  assert.match(generatedSource, /second = __tsonic_destructure\d+\[1\];/);
  assert.match(generatedSource, /__TsonicShape_[A-Za-z0-9_]+ __tsonic_destructure\d+ = input;/);
  assert.match(generatedSource, /value = __tsonic_destructure\d+\.value;/);
  assert.match(generatedSource, /label = __tsonic_destructure\d+\.label;/);
  assert.match(generatedSource, /\(\(System\.Func<int\[\]>\)\(\(\) =>/);
  assert.match(generatedSource, /\(\(System\.Func<__TsonicShape_[A-Za-z0-9_]+>\)\(\(\) =>/);
  assert.match(generatedSource, /rest = new __TsonicShape_[A-Za-z0-9_]+\s*\{\s*label = __tsonic_destructure\d+\.label,\s*\};/);
  assert.match(generatedSource, /restAddress = new __TsonicShape_[A-Za-z0-9_]+\s*\{\s*zip = __tsonic_destructure\d+\.zip,\s*country = __tsonic_destructure\d+\.country,\s*\};/);
  assert.doesNotMatch(generatedSource, /__unsupported|invalid/i);

  assert.equal(runGeneratedProject(projectDirectory, assemblyName), "5|4:5|ok:7|expr:9:9|rest:11|Paris:75001:FR\n");
});

test("CLI runs non-Node carrier binding spread nullish and exception flow", async () => {
  const assemblyName = "SmokeGeneratedSlice8CarrierBindingRuntime";
  const projectDirectory = resolve(tempRoot, "slice8-carrier-binding-runtime");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          surfaces: ["js"],
          options: {
            namespace: "Smoke.Generated",
            assemblyName,
            outputType: "Exe",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { Console, Exception } from \"@tsonic/dotnet/System.js\";",
      "",
      "type Child = { value: number };",
      "type Source = { label?: string; count: number; child: Child };",
      "type Spread = { label: string; total: number };",
      "",
      "function summarize({ label = \"fallback\", child: { value }, ...rest }: Source, numbers: number[]): string {",
      "  const spread: Spread = { label, total: value + rest.count };",
      "  const composed: number[] = [spread.total, ...numbers, rest.count];",
      "  const [first = 1, second = 2, ...tail] = composed;",
      "  return `${spread.label}|${first + second + tail.length}|${value}`;",
      "}",
      "",
      "function checked(input: Source, numbers: number[] | null): string {",
      "  try {",
      "    if (numbers === null) {",
      "      throw new Exception(\"missing numbers\");",
      "    }",
      "    return summarize(input, numbers);",
      "  } catch (error) {",
      "    const empty: number[] = [];",
      "    return summarize(input, empty);",
      "  }",
      "}",
      "",
      "const input: Source = { label: \"slice8\", count: 3, child: { value: 4 } };",
      "const fallbackInput: Source = { count: 3, child: { value: 4 } };",
      "Console.WriteLine(checked(input, [5, 6]));",
      "Console.WriteLine(checked(fallbackInput, null));",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static string summarize\(__TsonicShape_[A-Za-z0-9_]+ __tsonic_param\d+, Tsonic\.CSharp\.Js\.JSArray<double> numbers\)/);
  assert.match(generatedSource, /__TsonicShape_[A-Za-z0-9_]+ __tsonic_destructure\d+ = __tsonic_param\d+\.child;/);
  assert.match(generatedSource, /string label = __tsonic_param\d+\.label \?\? "fallback";/);
  assert.match(generatedSource, /double value = __tsonic_destructure\d+\.value;/);
  assert.match(generatedSource, /__TsonicShape_[A-Za-z0-9_]+ rest = new __TsonicShape_[A-Za-z0-9_]+/);
  assert.match(generatedSource, /__TsonicShape_[A-Za-z0-9_]+ spread = new __TsonicShape_[A-Za-z0-9_]+/);
  assert.match(generatedSource, /label = label,/);
  assert.match(generatedSource, /total = value \+ rest\.count,/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.JSArray<double> composed = new Tsonic\.CSharp\.Js\.JSArray<double>\(new double\[\] \{ spread\.total \}\)\.concat\(new Tsonic\.CSharp\.Js\.JSArray<double>\(numbers\), new Tsonic\.CSharp\.Js\.JSArray<double>\(new double\[\] \{ rest\.count \}\)\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.JSArray<double> tail = __tsonic_destructure\d+\.slice\(2\);/);
  assert.match(generatedSource, /throw new System\.Exception\("missing numbers"\);/);
  assert.match(generatedSource, /catch\s*\{/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.JSArray<double> empty = new Tsonic\.CSharp\.Js\.JSArray<double>\(new double\[\] \{ \}\);/);
  assert.doesNotMatch(generatedSource, /__unsupported|InvalidExpression|dynamic|System\.Reflection/);

  assert.equal(runGeneratedProject(projectDirectory, assemblyName), [
    "slice8|14|4",
    "fallback|10|4",
    "",
  ].join("\n"));
});

test("CLI runs utility-projected object shapes and Parameters tuple destructuring", async () => {
  const assemblyName = "SmokeGeneratedUtilityProjectedTuples";
  const projectDirectory = resolve(tempRoot, "utility-projected-tuples");
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
      "import type { int } from \"@tsonic/csharp/types.js\";",
      "",
      "type Point = { x: int; y: int; label: string; active: boolean };",
      "type PointSummary = Pick<Point, \"x\" | \"label\">;",
      "type PointHidden = Omit<Point, \"active\" | \"y\">;",
      "type PointReadonly = Readonly<PointSummary>;",
      "type PairFn = (name: string, value: number) => string;",
      "type PairArgs = Parameters<PairFn>;",
      "",
      "function summarize(value: PointSummary): string {",
      "  return `${value.label}:${value.x}`;",
      "}",
      "",
      "function summarizeHidden(value: PointHidden): string {",
      "  return `${value.label}:${value.x}`;",
      "}",
      "",
      "function summarizeReadonly(value: PointReadonly): string {",
      "  return `${value.label}:${value.x}`;",
      "}",
      "",
      "function formatPair(args: PairArgs): string {",
      "  const [name, value] = args;",
      "  return `${name}:${value}`;",
      "}",
      "",
      "const summary: PointSummary = { x: 7, label: \"p\" };",
      "const hidden: PointHidden = { x: 5, label: \"q\" };",
      "const readonlySummary: PointReadonly = { x: 9, label: \"r\" };",
      "const args: PairArgs = [\"tuple\", 4];",
      "Console.WriteLine(summarize(summary));",
      "Console.WriteLine(summarizeHidden(hidden));",
      "Console.WriteLine(summarizeReadonly(readonlySummary));",
      "Console.WriteLine(formatPair(args));",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  const generatedShapes = await readFile(
    resolve(projectDirectory, "out/csharp/generated/TsonicObjectShapes.cs"),
    "utf8",
  );
  assert.match(generatedShapes, /public class __TsonicShape_/);
  assert.match(generatedShapes, /public required int x;/);
  assert.match(generatedShapes, /public required string label;/);
  assert.doesNotMatch(generatedShapes, /public required int y;/);
  assert.doesNotMatch(generatedShapes, /public required bool active;/);
  assert.match(generatedSource, /public static string formatPair\(\(string, double\) args\)/);
  assert.match(generatedSource, /string name = __tsonic_destructure\d+\.Item1;/);
  assert.match(generatedSource, /double value = __tsonic_destructure\d+\.Item2;/);
  assert.doesNotMatch(generatedSource, /__tsonic_destructure\d+\[\d+\]/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const projectPath = resolve(projectDirectory, `out/csharp/${assemblyName}.csproj`);
  const dotnet = run("dotnet", ["build", projectPath, "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);

  const executed = run("dotnet", ["run", "--project", projectPath, "--no-build", "--no-restore"]);
  assert.equal(executed.status, 0, executed.stdout + executed.stderr);
  assert.equal(executed.stdout.replace(/\r\n/g, "\n"), [
    "p:7",
    "q:5",
    "r:9",
    "tuple:4",
    "",
  ].join("\n"));
});

test("CLI runs required tuple defaults and tuple rest destructuring", async () => {
  const assemblyName = "SmokeGeneratedTupleRestDefaults";
  const projectDirectory = resolve(tempRoot, "tuple-rest-defaults");
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
      "function tupleDefault(input: [string, number]): string {",
      "  const [name = \"fallback\"] = input;",
      "  return name;",
      "}",
      "",
      "function tupleRest(input: [string, number, boolean]): string {",
      "  const [name, ...rest] = input;",
      "  return `${name}:${rest[0]}:${rest[1]}`;",
      "}",
      "",
      "function singleTupleRest(input: [string, number]): string {",
      "  const [name, ...rest] = input;",
      "  return `${name}:${rest[0]}`;",
      "}",
      "",
      "function emptyTupleRest(input: [string]): string {",
      "  const [name, ...rest] = input;",
      "  return name;",
      "}",
      "",
      "Console.WriteLine(tupleDefault([\"ready\", 4]));",
      "Console.WriteLine(tupleRest([\"tuple\", 7, true]));",
      "Console.WriteLine(singleTupleRest([\"single\", 8]));",
      "Console.WriteLine(emptyTupleRest([\"empty\"]));",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /string name = __tsonic_destructure\d+\.Item1;/);
  assert.match(generatedSource, /\(double, bool\) rest = \(__tsonic_destructure\d+\.Item2, __tsonic_destructure\d+\.Item3\);/);
  assert.match(generatedSource, /System\.ValueTuple<double> rest = new System\.ValueTuple<double>\(__tsonic_destructure\d+\.Item2\);/);
  assert.match(generatedSource, /System\.ValueTuple rest = new System\.ValueTuple\(\);/);
  assert.match(generatedSource, /return \$"\{name\}:\{rest\.Item1\}:\{rest\.Item2\}";/);
  assert.match(generatedSource, /return \$"\{name\}:\{rest\.Item1\}";/);
  assert.doesNotMatch(generatedSource, /Tuple destructuring defaults require/);
  assert.doesNotMatch(generatedSource, /Tuple rest destructuring requires finalized tuple slice facts/);
  assert.doesNotMatch(generatedSource, /Tuple rest destructuring requires at least two finalized tuple slice elements/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const projectPath = resolve(projectDirectory, `out/csharp/${assemblyName}.csproj`);
  const dotnet = run("dotnet", ["build", projectPath, "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);

  const executed = run("dotnet", ["run", "--project", projectPath, "--no-build", "--no-restore"]);
  assert.equal(executed.status, 0, executed.stdout + executed.stderr);
  assert.equal(executed.stdout.replace(/\r\n/g, "\n"), "ready\ntuple:7:True\nsingle:8\nempty\n");
});
