import { performance } from "node:perf_hooks";
import { assert, cliPath, existsSync, readFile, repoRoot, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";

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
  assert.match(generatedSource, /public static string summarize\(ObjectShape_[a-f0-9]{12}<ObjectShape_[a-f0-9]{12}<double>, double, string\?> __tsonic_param\d+, Tsonic\.CSharp\.Js\.JSArray<double> numbers\)/);
  assert.match(generatedSource, /[A-Za-z][A-Za-z0-9_]*Shape_[a-f0-9]{12}<double> __tsonic_destructure\d+ = __tsonic_param\d+\.child;/);
  assert.match(generatedSource, /string label = __tsonic_param\d+\.label \?\? "fallback";/);
  assert.doesNotMatch(generatedSource, /\bis string __tsonic_value\d+/);
  assert.match(generatedSource, /double value = __tsonic_destructure\d+\.value;/);
  assert.match(generatedSource, /[A-Za-z][A-Za-z0-9_]*Shape_[a-f0-9]{12} rest = new [A-Za-z][A-Za-z0-9_]*Shape_[a-f0-9]{12}/);
  const spread = generatedSource.match(/(?<carrier>ObjectShape_[a-f0-9]{12}) spread = new \k<carrier>\s*\{\s*label = label,\s*total = value \+ rest\.count,/u);
  assert.equal(spread !== null, true, "the same concrete spread retains the original fields and ordered initialization");
  const shapes = await readFile(resolve(projectDirectory, "out/csharp/generated/TsonicObjectShapes.cs"), "utf8");
  const definition = shapes.match(new RegExp(`public class ${spread.groups.carrier} : ObjectShape_[a-f0-9]{12}<string, double>\\s*\\{(?<body>[\\s\\S]*?)\\n    \\}`, "u"));
  assert.equal(definition !== null, true, "the captured concrete class implements the declared generic native contract");
  assert.match(definition.groups.body, /public required string label\s*\{\s*get;\s*set;\s*\}/u);
  assert.match(definition.groups.body, /public required double total\s*\{\s*get;\s*set;\s*\}/u);
  assert.match(generatedSource, /label = label,/);
  assert.match(generatedSource, /total = value \+ rest\.count,/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.JSArray<double> (?<destination>__tsonic_sequence_destination) = new Tsonic\.CSharp\.Js\.JSArray<double>\(\)\.AppendElement\(spread\.total\);\s*Tsonic\.CSharp\.Js\.JSArray<double> (?<source>__tsonic_sequence_\d+) = numbers;\s*\k<destination>\.EnsureCapacity\(checked\(\k<destination>\.Count \+ \k<source>\.length\)\);\s*for \(int (?<index>__tsonic_sequence_index) = 0; \k<index> < \k<source>\.length; \k<index>\+\+\)\s*\{\s*\k<destination>\.Add\(\k<source>\[\k<index>\]\);\s*\}\s*Tsonic\.CSharp\.Js\.JSArray<double> composed = \k<destination>\.AppendElement\(rest\.count\);/);
  assert.doesNotMatch(generatedSource, /\.concat\(/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.JSArray<double> tail = __tsonic_destructure\d+\.slice\(2\);/);
  assert.match(generatedSource, /throw new System\.Exception\("missing numbers"\);/);
  assert.match(generatedSource, /catch\s*\{/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.JSArray<double> empty = Tsonic\.CSharp\.Js\.JSArray<double>\.of\(\[\]\);/);
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
  assert.match(generatedShapes, /public class [A-Za-z][A-Za-z0-9_]*Shape_[a-f0-9]{12}/);
  assert.match(generatedShapes, /public required int x\s*\{\s*get;\s*set;\s*\}/);
  assert.match(generatedShapes, /public required string label\s*\{\s*get;\s*set;\s*\}/);
  assert.doesNotMatch(generatedShapes, /\bint y\b/);
  assert.doesNotMatch(generatedShapes, /\bbool active\b/);
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
