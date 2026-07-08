import { assert, cliPath, existsSync, readFile, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "./harness.mjs";

test("CLI emits typed, empty, nested, and spread array literals from finalized array facts", async () => {
  const projectDirectory = resolve(tempRoot, "arrays-typed-literals");
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
            assemblyName: "SmokeGeneratedArraysTypedLiterals",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { float, int } from \"@tsonic/csharp/types.js\";",
      "",
      "function accepts(values: int[]): int {",
      "  return values.length;",
      "}",
      "",
      "export function emptyLocal(): int[] {",
      "  const values: int[] = [];",
      "  return values;",
      "}",
      "",
      "export function emptyReturn(): int[] {",
      "  return [];",
      "}",
      "",
      "export function emptyArgument(): int {",
      "  return accepts([]);",
      "}",
      "",
      "export function nestedEmptyAndSpread(): int[][] {",
      "  return [[], [1, 2]];",
      "}",
      "",
      "export function nestedSpread(left: int[], right: int[]): int[][] {",
      "  return [[...left], [0, ...right]];",
      "}",
      "",
      "export function compose(left: int[], right: int[]): int[] {",
      "  return [0, ...left, ...right, 9];",
      "}",
      "",
      "export function typedFloat(): float {",
      "  const values: float[] = [1.5, 2.5];",
      "  return values[0] + values[1];",
      "}",
      "",
      "export function numberForOf(): number {",
      "  let total = 0;",
      "  const values: number[] = [1, 2, 3];",
      "  for (const value of values) {",
      "    total += value;",
      "  }",
      "  return total;",
      "}",
      "",
      "export function int32ForOf(values: int[]): int {",
      "  let total: int = 0;",
      "  for (const value of values) {",
      "    total += value;",
      "  }",
      "  return total;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static int accepts\(System\.Collections\.Generic\.IReadOnlyList<int> values\)/);
  assert.match(generatedSource, /System\.Collections\.Generic\.List<int> values = new System\.Collections\.Generic\.List<int>\(new int\[\] \{ \}\);/);
  assert.match(generatedSource, /return new System\.Collections\.Generic\.List<int>\(new int\[\] \{ \}\);/);
  assert.match(generatedSource, /return accepts\(new System\.Collections\.Generic\.List<int>\(new int\[\] \{ \}\)\);/);
  assert.match(generatedSource, /return new System\.Collections\.Generic\.List<int\[\]>\(new int\[\]\[\] \{ new int\[\] \{ \}, new int\[\] \{ 1, 2 \} \}\);/);
  assert.match(generatedSource, /return new System\.Collections\.Generic\.List<int\[\]>\(new int\[\]\[\] \{ Tsonic\.CSharp\.Runtime\.ArrayHelpers\.Concat\(left\), Tsonic\.CSharp\.Runtime\.ArrayHelpers\.Concat\(new int\[\] \{ 0 \}, right\) \}\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Array\.concat\(new int\[\] \{ 0 \}, left, right, new int\[\] \{ 9 \}\);/);
  assert.match(generatedSource, /System\.Collections\.Generic\.IReadOnlyList<float> values = new System\.Collections\.Generic\.List<float>\(new float\[\] \{ 1.5F, 2.5F \}\);/);
  assert.match(generatedSource, /System\.Collections\.Generic\.IEnumerable<double> values = new System\.Collections\.Generic\.List<double>\(new double\[\] \{ 1, 2, 3 \}\);/);
  assert.match(generatedSource, /foreach \(double value in values\)/);
  assert.match(generatedSource, /foreach \(int value in values\)/);
  assert.doesNotMatch(generatedSource, /__unsupported|InvalidExpression/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedArraysTypedLiterals.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits readonly array syntax through finalized array ABI facts", async () => {
  const assemblyName = "SmokeGeneratedReadonlyArrayAbi";
  const projectDirectory = resolve(tempRoot, "arrays-readonly-abi");
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
      "import { Console } from \"@tsonic/dotnet/System.js\";",
      "import type { int } from \"@tsonic/csharp/types.js\";",
      "",
      "export function readonlyIndexed(values: readonly int[]): int {",
      "  return values[0] + values.length;",
      "}",
      "",
      "export function genericReadonly<T>(values: readonly T[]): T {",
      "  return values[0];",
      "}",
      "",
      "export function nested(values: readonly int[][]): int {",
      "  return values[0][0];",
      "}",
      "",
      "export function readonlySpread(left: readonly int[], right: readonly int[]): readonly int[] {",
      "  return [0, ...left, ...right, 9];",
      "}",
      "",
      "const spread = readonlySpread([1, 2], [3]);",
      "Console.WriteLine(`${readonlyIndexed([4, 5, 6])}|${genericReadonly<string>([\"ok\"])}|${nested([[7]])}|${spread.length}|${spread[2]}`);",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static int readonlyIndexed\(System\.Collections\.Generic\.IReadOnlyList<int> values\)/);
  assert.match(generatedSource, /return values\[0\] \+ values\.Count;/);
  assert.match(generatedSource, /public static T genericReadonly<T>\(System\.Collections\.Generic\.IReadOnlyList<T> values\)/);
  assert.match(generatedSource, /public static int nested\(System\.Collections\.Generic\.IReadOnlyList<int\[\]> values\)/);
  assert.match(generatedSource, /public static System\.Collections\.Generic\.IReadOnlyList<int> readonlySpread\(System\.Collections\.Generic\.IEnumerable<int> left, System\.Collections\.Generic\.IEnumerable<int> right\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Array\.concat\(new int\[\] \{ 0 \}, left, right, new int\[\] \{ 9 \}\);/);
  assert.match(generatedSource, /public static readonly System\.Collections\.Generic\.IReadOnlyList<int> spread;/);
  assert.match(generatedSource, /spread\.Count/);
  assert.doesNotMatch(generatedSource, /public static .*Tsonic\.CSharp\.Js\.JSArray/);
  assert.doesNotMatch(generatedSource, /__unsupported|InvalidExpression|System\.Reflection|dynamic/);

  assert.equal(runGeneratedProject(projectDirectory, assemblyName), "7|ok|7|5|2\n");
});

test("CLI emits module-scope array spread constants from finalized expected array facts", async () => {
  const projectDirectory = resolve(tempRoot, "arrays-module-spread-constants");
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
            assemblyName: "SmokeGeneratedArraysModuleSpreadConstants",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int } from \"@tsonic/csharp/types.js\";",
      "",
      "const source: int[] = [1, 2, 3];",
      "export const withSpread: int[] = [...source, 4, 5];",
      "",
      "const more: int[] = [10, 20];",
      "export const multiSpread: int[] = [...source, ...more, 100];",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static readonly System\.Collections\.Generic\.IEnumerable<int> source;/);
  assert.match(generatedSource, /source = new System\.Collections\.Generic\.List<int>\(new int\[\] \{ 1, 2, 3 \}\);/);
  assert.match(generatedSource, /withSpread = Tsonic\.CSharp\.Runtime\.ArrayHelpers\.Concat\(source, new int\[\] \{ 4, 5 \}\);/);
  assert.match(generatedSource, /public static readonly System\.Collections\.Generic\.IEnumerable<int> more;/);
  assert.match(generatedSource, /more = new System\.Collections\.Generic\.List<int>\(new int\[\] \{ 10, 20 \}\);/);
  assert.match(generatedSource, /multiSpread = Tsonic\.CSharp\.Runtime\.ArrayHelpers\.Concat\(source, more, new int\[\] \{ 100 \}\);/);
  assert.doesNotMatch(generatedSource, /__unsupported|InvalidExpression/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedArraysModuleSpreadConstants.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI runs tuple spread into arrays from finalized tuple carrier facts", async () => {
  const assemblyName = "SmokeGeneratedTupleArraySpread";
  const projectDirectory = resolve(tempRoot, "arrays-tuple-spread");
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
      "import { Console } from \"@tsonic/dotnet/System.js\";",
      "import type { int } from \"@tsonic/csharp/types.js\";",
      "",
      "function compose(pair: [int, int]): int[] {",
      "  return [1, ...pair, 4];",
      "}",
      "",
      "const values = compose([2, 3]);",
      "Console.WriteLine(`${values.length}:${values[0]}:${values[1]}:${values[2]}:${values[3]}`);",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.Array\.concat\(new int\[\] \{ 1 \}, new int\[\] \{ pair\.Item1, pair\.Item2 \}, new int\[\] \{ 4 \}\)/);
  assert.match(generatedSource, /public static readonly System\.Collections\.Generic\.List<int> values;/);
  assert.match(generatedSource, /values = compose\(\(2, 3\)\);/);
  assert.doesNotMatch(generatedSource, /__unsupported|InvalidExpression|dynamic|System\.Reflection/);

  assert.equal(runGeneratedProject(projectDirectory, assemblyName), "4:1:2:3:4\n");
});

test("CLI rejects untyped empty array returns with a target diagnostic", async () => {
  const projectDirectory = resolve(tempRoot, "arrays-empty-return-requires-element-evidence");
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
            assemblyName: "SmokeGeneratedArraysEmptyReturnRequiresElementEvidence",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function f() {",
      "  return [];",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /array element type evidence/);
  assert.doesNotMatch(build.stderr, /resolvedTypeArguments|TypeError|Cannot read properties/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedArraysEmptyReturnRequiresElementEvidence.csproj")), false);
});
