import { access } from "node:fs/promises";
import { assert, cliPath, readFile, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";

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
  assert.match(generatedSource, /public static Tsonic\.CSharp\.Js\.JSArray<int> source/);
  assert.match(generatedSource, /source = Tsonic\.CSharp\.Js\.JSArray<int>\.of\(\[1, 2, 3\]\);/);
  const copies = assertArraySpreadCopies(generatedSource, [
    "global::Smoke.Generated.Index.source",
    "global::Smoke.Generated.Index.source",
    "global::Smoke.Generated.Index.more",
  ]);
  assert.match(generatedSource, new RegExp(`withSpread = ${copies[0]}\\.AppendElement\\(4\\)\\.AppendElement\\(5\\);`));
  assert.match(generatedSource, /public static Tsonic\.CSharp\.Js\.JSArray<int> more/);
  assert.match(generatedSource, /more = Tsonic\.CSharp\.Js\.JSArray<int>\.of\(\[10, 20\]\);/);
  assert.match(generatedSource, new RegExp(`${copies[2]} = ${copies[1]};`));
  assert.match(generatedSource, new RegExp(`multiSpread = ${copies[2]}\\.AppendElement\\(100\\);`));
  assert.equal((generatedSource.match(/new Tsonic\.CSharp\.Js\.JSArray<int>\(\)/gu) ?? []).length, 2);
  assert.doesNotMatch(generatedSource, /\.concat\(/u);
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
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.JSArray<int> (?<destination>_*tsonic_sequence_destination) = new Tsonic\.CSharp\.Js\.JSArray<int>\(\)\.AppendElement\(1\);\s*\(int, int\) (?<pair>_*tsonic_sequence_[0-9]+) = pair;\s*\k<destination>\.EnsureCapacity\(checked\(\k<destination>\.Count \+ 2\)\);\s*\k<destination>\.Add\(\k<pair>\.Item1\);\s*\k<destination>\.Add\(\k<pair>\.Item2\);\s*return \k<destination>\.AppendElement\(4\);/u);
  assert.doesNotMatch(generatedSource, /\.concat\(|new int\[\]/u);
  assert.match(generatedSource, /public static Tsonic\.CSharp\.Js\.JSArray<int> values/);
  assert.match(generatedSource, /values = global::Smoke\.Generated\.Index\.compose\(\(2, 3\)\);/);
  assert.doesNotMatch(generatedSource, /__unsupported|InvalidExpression|dynamic|System\.Reflection/);

  assert.equal(runGeneratedProject(projectDirectory, assemblyName), "4:1:2:3:4\n");
});

test("CLI rejects an untyped empty-array return without borrowing its element type from callers", async () => {
  const projectDirectory = resolve(tempRoot, "arrays-empty-never-return");
  const assemblyName = "SmokeGeneratedArraysEmptyNeverReturn";
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
      "export function f() {",
      "  return [];",
      "}",
      "Console.WriteLine(f().length);",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  const output = build.stdout + build.stderr;
  assert.notEqual(build.status, 0, "the original unannotated empty-array source remains refused");
  assert.match(output, /TSONIC_UNTYPED_ARRAY_LITERAL index\.ts:3:10/u,
    "the original empty array owns the exact declared-type refusal");
  assert.match(output, /This empty array has no element type\. Declare one, e\.g\. 'function emptyBuffer\(\): number\[\]'\./u,
    "the refusal keeps its exact own-declaration guidance");
  assert.match(output, /Artifacts: 0/u, "the rejected source produces no successful artifacts");
  await assert.rejects(access(resolve(projectDirectory, "out/csharp")), { code: "ENOENT" },
    "no generated native project or partial sources are published");
});

test("CLI executes declared and generic empty arrays with exact native width, alias identity and one evaluation", async () => {
  const projectDirectory = resolve(tempRoot, "arrays-declared-generic-empty-return");
  const assemblyName = "SmokeGeneratedArraysDeclaredGenericEmptyReturn";
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{
        id: "csharp",
        surfaces: ["js"],
        options: { namespace: "Smoke.Generated", assemblyName, outputType: "Exe" },
      }],
    }, null, 2),
    "src/index.ts": [
      "import { Console } from \"@tsonic/dotnet/System.js\";",
      "import type { int } from \"@tsonic/csharp/types.js\";",
      "let evaluations: int = 0;",
      "export function f(): int[] { evaluations += 1; return []; }",
      "export function empty<Value>(): Value[] { return []; }",
      "const values = f();",
      "const alias = values;",
      "const generic = empty<int>();",
      "const maximum: int = 2147483647;",
      "alias.push(maximum);",
      "generic.push(maximum);",
      "Console.WriteLine(`${evaluations}:${values === alias ? 1 : 0}:${values[0]}:${generic[0]}`);",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);
  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static Tsonic\.CSharp\.Js\.JSArray<int> f\(\)/u,
    "the empty array keeps its own declared native int32 element ABI");
  assert.match(generatedSource, /public static Tsonic\.CSharp\.Js\.JSArray<Value> empty<Value>\(\)/u,
    "the generic empty array keeps its declared element binder");
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.JSArray<int>\.of\(\[\]\);/u);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.JSArray<Value>\.of\(\[\]\);/u);
  assert.doesNotMatch(generatedSource, /JSArray<(?:Never|object|dynamic|TsValue|double)>|__unsupported|InvalidExpression|System\.Reflection/u);
  assert.equal(runGeneratedProject(projectDirectory, assemblyName), "1:1:2147483647:2147483647\n",
    "native execution retains one producer evaluation, shared mutation identity and both exact integer values");
});

function assertArraySpreadCopies(source, inputs) {
  const copies = [...source.matchAll(/Tsonic\.CSharp\.Js\.JSArray<int> (?<source>__tsonic_sequence_\d+) = (?<input>[A-Za-z][A-Za-z0-9:.]*);\s*(?<destination>_*tsonic_sequence_destination)\.EnsureCapacity\(checked\(\k<destination>\.Count \+ \k<source>\.length\)\);\s*for \(int (?<index>_*tsonic_sequence_index) = 0; \k<index> < \k<source>\.length; \k<index>\+\+\)\s*\{\s*\k<destination>\.Add\(\k<source>\[\k<index>\]\);\s*\}/gu)];
  assert.deepEqual(copies.map(copy => copy.groups.input), inputs);
  return copies.map(copy => copy.groups.destination);
}
