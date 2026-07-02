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
      "import type { float32, int32 } from \"@tsonic/core/types.js\";",
      "",
      "function accepts(values: int32[]): int32 {",
      "  return values.length;",
      "}",
      "",
      "export function emptyLocal(): int32[] {",
      "  const values: int32[] = [];",
      "  return values;",
      "}",
      "",
      "export function emptyReturn(): int32[] {",
      "  return [];",
      "}",
      "",
      "export function emptyArgument(): int32 {",
      "  return accepts([]);",
      "}",
      "",
      "export function nestedEmptyAndSpread(): int32[][] {",
      "  return [[], [1, 2]];",
      "}",
      "",
      "export function nestedSpread(left: int32[], right: int32[]): int32[][] {",
      "  return [[...left], [0, ...right]];",
      "}",
      "",
      "export function compose(left: int32[], right: int32[]): int32[] {",
      "  return [0, ...left, ...right, 9];",
      "}",
      "",
      "export function typedFloat(): float32 {",
      "  const values: float32[] = [1.5, 2.5];",
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
      "export function int32ForOf(values: int32[]): int32 {",
      "  let total: int32 = 0;",
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
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "export function readonlyIndexed(values: readonly int32[]): int32 {",
      "  return values[0] + values.length;",
      "}",
      "",
      "export function genericReadonly<T>(values: readonly T[]): T {",
      "  return values[0];",
      "}",
      "",
      "export function nested(values: readonly int32[][]): int32 {",
      "  return values[0][0];",
      "}",
      "",
      "Console.writeLine(`${readonlyIndexed([4, 5, 6])}|${genericReadonly<string>([\"ok\"])}|${nested([[7]])}`);",
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
  assert.doesNotMatch(generatedSource, /public static .*Tsonic\.CSharp\.Js\.JSArray/);
  assert.doesNotMatch(generatedSource, /__unsupported|InvalidExpression|System\.Reflection|dynamic/);

  assert.equal(runGeneratedProject(projectDirectory, assemblyName), "7|ok|7\n");
});

test("CLI runs inferred source-owned array returns through finalized carrier facts", async () => {
  const assemblyName = "SmokeGeneratedInferredArrayReturns";
  const projectDirectory = resolve(tempRoot, "arrays-inferred-return-carrier");
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
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "export function make(value: int32) {",
      "  return [value, value + 1];",
      "}",
      "",
      "export function nested(value: int32) {",
      "  return [[value], [value + 1]];",
      "}",
      "",
      "const values = make(4);",
      "const nestedValues = nested(6);",
      "Console.writeLine(`${values[0]}|${values.length}|${nestedValues[1][0]}`);",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static System\.Collections\.Generic\.List<double> make\(int value\)/);
  assert.match(generatedSource, /return new System\.Collections\.Generic\.List<double>\(new double\[\] \{ value, value \+ 1 \}\);/);
  assert.match(generatedSource, /public static System\.Collections\.Generic\.List<double\[\]> nested\(int value\)/);
  assert.match(generatedSource, /public static readonly System\.Collections\.Generic\.List<double> values;/);
  assert.match(generatedSource, /public static readonly System\.Collections\.Generic\.List<double\[\]> nestedValues;/);
  assert.match(generatedSource, /values\.Count/);
  assert.doesNotMatch(generatedSource, /__unsupported|InvalidExpression|dynamic|System\.Reflection/);

  assert.equal(runGeneratedProject(projectDirectory, assemblyName), "4|2|7\n");
});

test("CLI runs array fixed default rest and nested destructuring from finalized carrier facts", async () => {
  const assemblyName = "SmokeGeneratedArrayBindingFacts";
  const projectDirectory = resolve(tempRoot, "arrays-binding-facts");
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
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "function fixed(values: int32[]): int32 {",
      "  const [first, second] = values;",
      "  return first + second;",
      "}",
      "",
      "function defaults(values: int32[]): int32 {",
      "  const [first = 10, second = 20] = values;",
      "  return first + second;",
      "}",
      "",
      "function rest(values: int32[]): int32 {",
      "  const [first, ...tail] = values;",
      "  return first + tail.length;",
      "}",
      "",
      "function nested(values: int32[][]): int32 {",
      "  const [[first], [, second]] = values;",
      "  return first + second;",
      "}",
      "",
      "const fixedInput: int32[] = [1, 2];",
      "const defaultInput: int32[] = [];",
      "const restInput: int32[] = [4, 5, 6];",
      "const nestedInput: int32[][] = [[7], [0, 8]];",
      "Console.writeLine(`${fixed(fixedInput)}|${defaults(defaultInput)}|${rest(restInput)}|${nested(nestedInput)}`);",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /int first = __tsonic_destructure\d+\[0\];/);
  assert.match(generatedSource, /int second = __tsonic_destructure\d+\[1\];/);
  assert.match(generatedSource, /int first = (__tsonic_destructure\d+)\.Count > 0 \? \1\[0\] : 10;/);
  assert.match(generatedSource, /int second = (__tsonic_destructure\d+)\.Count > 1 \? \1\[1\] : 20;/);
  assert.match(generatedSource, /System\.Collections\.Generic\.List<int> tail = Tsonic\.CSharp\.Js\.Array\.slice\(__tsonic_destructure\d+, 1\);/);
  assert.match(generatedSource, /return first \+ tail\.Count;/);
  assert.doesNotMatch(generatedSource, /__unsupported|InvalidExpression|dynamic|System\.Reflection/);

  assert.equal(runGeneratedProject(projectDirectory, assemblyName), "3|30|6|15\n");
});

test("CLI runs array parameter destructuring from real TSTS binding facts", async () => {
  const assemblyName = "SmokeGeneratedArrayParameterBindingFacts";
  const projectDirectory = resolve(tempRoot, "arrays-parameter-binding-facts");
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
      "",
      "function sum([first = 10, second = 20, ...rest]: number[]): number {",
      "  return first + second + rest.length;",
      "}",
      "",
      "function nested([[first], [, second]]: number[][]): number {",
      "  return first + second;",
      "}",
      "",
      "Console.writeLine(`${sum([1, 2, 3, 4])}|${sum([])}|${nested([[7], [0, 8]])}`);",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static double sum\(System\.Collections\.Generic\.IReadOnlyList<double> __tsonic_param\d+\)/);
  assert.match(generatedSource, /double first = __tsonic_param\d+\.Count > 0 \? __tsonic_param\d+\[0\] : 10;/);
  assert.match(generatedSource, /double second = __tsonic_param\d+\.Count > 1 \? __tsonic_param\d+\[1\] : 20;/);
  assert.match(generatedSource, /System\.Collections\.Generic\.List<double> rest = Tsonic\.CSharp\.Js\.Array\.slice\(__tsonic_param\d+, 2\);/);
  assert.match(generatedSource, /public static double nested\(System\.Collections\.Generic\.IReadOnlyList<double\[\]> __tsonic_param\d+\)/);
  assert.doesNotMatch(generatedSource, /__unsupported|InvalidExpression|dynamic|System\.Reflection/);

  assert.equal(runGeneratedProject(projectDirectory, assemblyName), "5|30|15\n");
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
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "const source: int32[] = [1, 2, 3];",
      "export const withSpread: int32[] = [...source, 4, 5];",
      "",
      "const more: int32[] = [10, 20];",
      "export const multiSpread: int32[] = [...source, ...more, 100];",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static readonly System\.Collections\.Generic\.IEnumerable<int> source;/);
  assert.match(generatedSource, /source = new System\.Collections\.Generic\.List<int>\(new int\[\] \{ 1, 2, 3 \}\);/);
  assert.match(generatedSource, /withSpread = Tsonic\.CSharp\.Js\.Array\.concat\(source, new int\[\] \{ 4, 5 \}\);/);
  assert.match(generatedSource, /public static readonly System\.Collections\.Generic\.IEnumerable<int> more;/);
  assert.match(generatedSource, /more = new System\.Collections\.Generic\.List<int>\(new int\[\] \{ 10, 20 \}\);/);
  assert.match(generatedSource, /multiSpread = Tsonic\.CSharp\.Js\.Array\.concat\(source, more, new int\[\] \{ 100 \}\);/);
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
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "function compose(pair: [int32, int32]): int32[] {",
      "  return [1, ...pair, 4];",
      "}",
      "",
      "const values = compose([2, 3]);",
      "Console.writeLine(`${values.length}:${values[0]}:${values[1]}:${values[2]}:${values[3]}`);",
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

test("CLI emits native .NET array element access and JS-selected length facts", async () => {
  const projectDirectory = resolve(tempRoot, "arrays-native-provider");
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
            assemblyName: "SmokeGeneratedArraysNativeProvider",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "import { BinaryReader, MemoryStream } from \"@tsonic/dotnet/System.IO.js\";",
      "",
      "export function readFirstPlusLength(): int32 {",
      "  const stream = new MemoryStream([65, 66]);",
      "  const reader = new BinaryReader(stream);",
      "  const bytes = reader.readBytes(2);",
      "  return bytes[0] + bytes.length;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /new System\.IO\.MemoryStream\(new byte\[\] \{ 65, 66 \}\)/);
  assert.match(generatedSource, /byte\[\] bytes = reader\.ReadBytes\(2\);/);
  assert.match(generatedSource, /return bytes\[0\] \+ bytes\.Length;/);
  assert.doesNotMatch(generatedSource, /__unsupported|InvalidExpression/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedArraysNativeProvider.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI rejects native array length without selected JS or provider facts", async () => {
  const projectDirectory = resolve(tempRoot, "arrays-native-length-requires-facts");
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
            assemblyName: "SmokeGeneratedArraysNativeLengthRequiresFacts",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "import { BinaryReader, MemoryStream } from \"@tsonic/dotnet/System.IO.js\";",
      "",
      "export function readLength(): int32 {",
      "  const stream = new MemoryStream([65, 66]);",
      "  const reader = new BinaryReader(stream);",
      "  const bytes = reader.readBytes(2);",
      "  return bytes.length;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /C# native array source contract has no target-backed property 'length'/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedArraysNativeLengthRequiresFacts.csproj")), false);
});
