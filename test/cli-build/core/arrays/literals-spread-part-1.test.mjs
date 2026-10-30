import { access } from "node:fs/promises";
import { assert, cliPath, readFile, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";
import { assertArraySpreadCopies } from "./literals-spread-fixtures.mjs";

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
  assert.match(generatedSource, /public static int accepts\(Tsonic\.CSharp\.Js\.JSArray<int> values\)/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.JSArray<int> values = Tsonic\.CSharp\.Js\.JSArray<int>\.of\(\[\]\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.JSArray<int>\.of\(\[\]\);/);
  assert.match(generatedSource, /return global::Smoke\.Generated\.Index\.accepts\(Tsonic\.CSharp\.Js\.JSArray<int>\.of\(\[\]\)\);/);
  assert.match(generatedSource, /public static Tsonic\.CSharp\.Js\.JSArray<Tsonic\.CSharp\.Js\.JSArray<int>> nestedEmptyAndSpread\(\)/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.JSArray<Tsonic\.CSharp\.Js\.JSArray<int>>\.of\(\[Tsonic\.CSharp\.Js\.JSArray<int>\.of\(\[\]\), Tsonic\.CSharp\.Js\.JSArray<int>\.of\(\[1, 2\]\)\]\)/);
  const nestedBody = /nestedSpread\([^\n]+\)\s*\{([\s\S]*?)\n        \}/u.exec(generatedSource)?.[1];
  assert.ok(nestedBody);
  assertArraySpreadCopies(nestedBody, ["left", "right"]);
  assert.equal((nestedBody.match(/new Tsonic\.CSharp\.Js\.JSArray<int>\(\)/gu) ?? []).length, 2);
  assert.match(nestedBody, /new Tsonic\.CSharp\.Js\.JSArray<int>\(\)\.AppendElement\(0\);/u);
  const composeBody = /compose\([^\n]+\)\s*\{([\s\S]*?)\n        \}/u.exec(generatedSource)?.[1];
  assert.ok(composeBody);
  const composeCopies = assertArraySpreadCopies(composeBody, ["left", "right"]);
  assert.equal((composeBody.match(/new Tsonic\.CSharp\.Js\.JSArray<int>\(\)/gu) ?? []).length, 1);
  assert.match(composeBody, new RegExp(`${composeCopies[1]} = ${composeCopies[0]};`));
  assert.match(composeBody, /new Tsonic\.CSharp\.Js\.JSArray<int>\(\)\.AppendElement\(0\);/u);
  assert.match(composeBody, new RegExp(`return ${composeCopies[1]}\\.AppendElement\\(9\\);`));
  assert.doesNotMatch(generatedSource, /\.concat\(|new Tsonic\.CSharp\.Js\.JSArray<int>\((?:left|right)\)/u);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.JSArray<float> values = Tsonic\.CSharp\.Js\.JSArray<float>\.of\(\[1.5F, 2.5F\]\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.JSArray<double> values = Tsonic\.CSharp\.Js\.JSArray<double>\.of\(\[1D, 2D, 3D\]\);/);
  assert.match(generatedSource, /foreach \(double value in values\)/);
  assert.match(generatedSource, /foreach \(int value in values\)/);
  assert.doesNotMatch(generatedSource, /__unsupported|InvalidExpression/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedArraysTypedLiterals.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits readonly source arrays through finalized JSArray carrier facts", async () => {
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
  assert.match(generatedSource, /public static int readonlyIndexed\(Tsonic\.CSharp\.Js\.JSArray<int> values\)/);
  assert.match(generatedSource, /return values\[0D\] \+ values\.length;/);
  assert.match(generatedSource, /public static T genericReadonly<T>\(Tsonic\.CSharp\.Js\.JSArray<T> values\)/);
  assert.match(generatedSource, /public static int nested\(Tsonic\.CSharp\.Js\.JSArray<Tsonic\.CSharp\.Js\.JSArray<int>> values\)/);
  assert.match(generatedSource, /public static Tsonic\.CSharp\.Js\.JSArray<int> readonlySpread\(Tsonic\.CSharp\.Js\.JSArray<int> left, Tsonic\.CSharp\.Js\.JSArray<int> right\)/);
  const copies = assertArraySpreadCopies(generatedSource, ["left", "right"]);
  assert.equal((generatedSource.match(/new Tsonic\.CSharp\.Js\.JSArray<int>\(\)/gu) ?? []).length, 1);
  assert.match(generatedSource, new RegExp(`${copies[1]} = ${copies[0]};`));
  assert.match(generatedSource, /new Tsonic\.CSharp\.Js\.JSArray<int>\(\)\.AppendElement\(0\);/u);
  assert.match(generatedSource, new RegExp(`return ${copies[1]}\\.AppendElement\\(9\\);`));
  assert.doesNotMatch(generatedSource, /\.concat\(/u);
  assert.match(generatedSource, /public static Tsonic\.CSharp\.Js\.JSArray<int> spread/);
  assert.match(generatedSource, /spread\.length/);
  assert.doesNotMatch(generatedSource, /System\.Collections\.Generic\.(?:List|IReadOnlyList|IEnumerable)</);
  assert.doesNotMatch(generatedSource, /__unsupported|InvalidExpression|System\.Reflection|dynamic/);

  assert.equal(runGeneratedProject(projectDirectory, assemblyName), "7|ok|7|5|2\n");
});
