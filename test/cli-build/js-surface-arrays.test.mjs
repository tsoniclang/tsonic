import { assert, assertInstalledAssemblyReference, assertNoInstalledAssemblyReference, assertNoRuntimeProjectReference, cliPath, existsSync, readFile, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "./harness.mjs";

function assertExternalCallNotMapped(stderr, memberName) {
  assert.match(stderr, /tsts:TSTS_DIAGNOSTIC/);
  const sourceContractPatterns = {
    "<anonymous>": /'Array' only refers to a type, but is being used as a value here/u,
    isFinite: /Cannot find name 'Number'|'Number' only refers to a type|Property 'isFinite' does not exist/u,
    log: /Cannot find name 'console'|Property 'log' does not exist/u,
    toString: /Property 'toString' does not exist/u,
    trunc: /Cannot find name 'Math'|Property 'trunc' does not exist/u,
  };
  const pattern = sourceContractPatterns[memberName];
  assert.notEqual(pattern, undefined, `missing exact source-contract diagnostic expectation for ${memberName}`);
  assert.match(stderr, pattern);
}

test("CLI emits array length and indexer access from TSTS provider facts", async () => {
  const projectDirectory = resolve(tempRoot, "array-surface-operations");
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
            assemblyName: "SmokeGeneratedArraySurfaceOperations",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "export function first(values: int32[]): int32 {",
      "  return values[0];",
      "}",
      "",
      "export function pick(values: int32[], index: int32): int32 {",
      "  return values[index];",
      "}",
      "",
      "export function assign(values: int32[], index: int32, value: int32): int32 {",
      "  values[index] = value;",
      "  return values[index];",
      "}",
      "",
      "export function count(values: int32[]): int32 {",
      "  return values.length;",
      "}",
      "",
      "export function join(values: int32[]): string {",
      "  return values.join(\"|\");",
      "}",
      "",
      "export function has(values: int32[], value: int32): boolean {",
      "  return values.includes(value);",
      "}",
      "",
      "export function atOr(values: int32[], index: int32): int32 {",
      "  return values.at(index) ?? -1;",
      "}",
      "",
      "export function popOr(values: int32[]): int32 {",
      "  return values.pop() ?? -1;",
      "}",
      "",
      "export function shiftOr(values: int32[]): int32 {",
      "  return values.shift() ?? -1;",
      "}",
      "",
      "export function firstPositive(values: int32[]): int32 {",
      "  return values.find((value: int32, index: int32) => value > 0 && index > 0) ?? -1;",
      "}",
      "",
      "export function lastPositive(values: int32[]): int32 {",
      "  return values.findLast((value: int32, index: int32, source: int32[]) => source.length > index && value > 0) ?? -1;",
      "}",
      "",
      "export function hasFrom(values: int32[], value: int32, start: int32): boolean {",
      "  return values.includes(value, start);",
      "}",
      "",
      "export function positionOf(values: int32[], value: int32): int32 {",
      "  return values.indexOf(value);",
      "}",
      "",
      "export function positionOfFrom(values: int32[], value: int32, start: int32): int32 {",
      "  return values.indexOf(value, start);",
      "}",
      "",
      "export function lastPositionOf(values: int32[], value: int32): int32 {",
      "  return values.lastIndexOf(value);",
      "}",
      "",
      "export function lastPositionOfFrom(values: int32[], value: int32, start: int32): int32 {",
      "  return values.lastIndexOf(value, start);",
      "}",
      "",
      "export function sumEach(values: int32[]): int32 {",
      "  let total: int32 = 0;",
      "  values.forEach((value: int32, index: int32, source: int32[]) => {",
      "    total += value + index + source.length;",
      "  });",
      "  return total;",
      "}",
      "",
      "export function hasPositive(values: int32[]): boolean {",
      "  return values.some((value: int32, index: int32) => value > 0 && index > 0);",
      "}",
      "",
      "export function allPositive(values: int32[]): boolean {",
      "  return values.every((value: int32, index: int32, source: int32[]) => source.length > index && value > 0);",
      "}",
      "",
      "export function firstPositiveIndex(values: int32[]): int32 {",
      "  return values.findIndex((value: int32, index: int32) => value > 0 && index > 0);",
      "}",
      "",
      "export function lastPositiveIndex(values: int32[]): int32 {",
      "  return values.findLastIndex((value: int32, index: int32, source: int32[]) => source.length > index && value > 0);",
      "}",
      "",
      "export function sliceAll(values: int32[]): int32[] {",
      "  return values.slice();",
      "}",
      "",
      "export function sliceFrom(values: int32[], start: int32): int32[] {",
      "  return values.slice(start);",
      "}",
      "",
      "export function sliceRange(values: int32[], start: int32, end: int32): int32[] {",
      "  return values.slice(start, end);",
      "}",
      "",
      "export function destruct(values: int32[]): int32 {",
      "  const [first, second] = values;",
      "  return first + second;",
      "}",
      "",
      "export function destructDefault(values: int32[]): int32 {",
      "  const [first = 1, second = 2] = values;",
      "  return first + second;",
      "}",
      "",
      "export function destructRest(values: int32[]): int32[] {",
      "  const [first, ...rest] = values;",
      "  return rest;",
      "}",
      "",
      "export function append(values: int32[], value: int32): int32[] {",
      "  return [...values, value];",
      "}",
      "",
      "export function prepend(values: int32[], value: int32): int32[] {",
      "  return [value, ...values];",
      "}",
      "",
      "export function copy(values: int32[]): int32[] {",
      "  return Array.from(values);",
      "}",
      "",
      "export function chars(value: string): string[] {",
      "  return Array.from(value);",
      "}",
      "",
      "export function make(left: int32, right: int32): int32[] {",
      "  return Array.of(left, right);",
      "}",
      "",
      "export function isActuallyArray(values: int32[]): boolean {",
      "  return Array.isArray(values);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static int first\(System\.Collections\.Generic\.IReadOnlyList<int> values\)/);
  assert.match(generatedSource, /return values\[0\];/);
  assert.match(generatedSource, /public static int pick\(System\.Collections\.Generic\.IReadOnlyList<int> values, int index\)/);
  assert.match(generatedSource, /return values\[index\];/);
  assert.match(generatedSource, /public static int assign\(System\.Collections\.Generic\.List<int> values, int index, int value\)/);
  assert.match(generatedSource, /values\[index\] = value;/);
  assert.match(generatedSource, /return values\[index\];/);
  assert.match(generatedSource, /public static int count\(System\.Collections\.Generic\.IReadOnlyList<int> values\)/);
  assert.match(generatedSource, /return values\.Count;/);
  assert.match(generatedSource, /public static string join\(System\.Collections\.Generic\.IReadOnlyList<int> values\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Array\.join\(values, "\|"\);/);
  assert.match(generatedSource, /public static bool has\(System\.Collections\.Generic\.IReadOnlyList<int> values, int value\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Array\.includes\(values, value\);/);
  assert.match(generatedSource, /public static int atOr\(System\.Collections\.Generic\.IReadOnlyList<int> values, int index\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Array\.atValue\(values, index\) \?\? -1;/);
  assert.match(generatedSource, /public static int popOr\(System\.Collections\.Generic\.List<int> values\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Array\.popValue\(values\) \?\? -1;/);
  assert.match(generatedSource, /public static int shiftOr\(System\.Collections\.Generic\.List<int> values\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Array\.shiftValue\(values\) \?\? -1;/);
  assert.match(generatedSource, /public static int firstPositive\(System\.Collections\.Generic\.IReadOnlyList<int> values\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Array\.findValue\(values, \(int value, int index\) => value > 0 && index > 0\) \?\? -1;/);
  assert.match(generatedSource, /public static int lastPositive\(System\.Collections\.Generic\.IReadOnlyList<int> values\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Array\.findLastValue\(values, \(int value, int index, System\.Collections\.Generic\.IReadOnlyList<int> source\) => source\.Count > index && value > 0\) \?\? -1;/);
  assert.match(generatedSource, /public static bool hasFrom\(System\.Collections\.Generic\.IReadOnlyList<int> values, int value, int start\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Array\.includes\(values, value, start\);/);
  assert.match(generatedSource, /public static int positionOf\(System\.Collections\.Generic\.IReadOnlyList<int> values, int value\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Array\.indexOf\(values, value\);/);
  assert.match(generatedSource, /public static int positionOfFrom\(System\.Collections\.Generic\.IReadOnlyList<int> values, int value, int start\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Array\.indexOf\(values, value, start\);/);
  assert.match(generatedSource, /public static int lastPositionOf\(System\.Collections\.Generic\.IReadOnlyList<int> values, int value\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Array\.lastIndexOf\(values, value\);/);
  assert.match(generatedSource, /public static int lastPositionOfFrom\(System\.Collections\.Generic\.IReadOnlyList<int> values, int value, int start\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Array\.lastIndexOf\(values, value, start\);/);
  assert.match(generatedSource, /public static int sumEach\(System\.Collections\.Generic\.IReadOnlyList<int> values\)/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.Array\.forEach\(values, \(int value, int index, System\.Collections\.Generic\.IReadOnlyList<int> source\) =>/);
  assert.match(generatedSource, /total \+= value \+ index \+ source\.Count;/);
  assert.match(generatedSource, /public static bool hasPositive\(System\.Collections\.Generic\.IReadOnlyList<int> values\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Array\.some\(values, \(int value, int index\) => value > 0 && index > 0\);/);
  assert.match(generatedSource, /public static bool allPositive\(System\.Collections\.Generic\.IReadOnlyList<int> values\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Array\.every\(values, \(int value, int index, System\.Collections\.Generic\.IReadOnlyList<int> source\) => source\.Count > index && value > 0\);/);
  assert.match(generatedSource, /public static int firstPositiveIndex\(System\.Collections\.Generic\.IReadOnlyList<int> values\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Array\.findIndex\(values, \(int value, int index\) => value > 0 && index > 0\);/);
  assert.match(generatedSource, /public static int lastPositiveIndex\(System\.Collections\.Generic\.IReadOnlyList<int> values\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Array\.findLastIndex\(values, \(int value, int index, System\.Collections\.Generic\.IReadOnlyList<int> source\) => source\.Count > index && value > 0\);/);
  assert.match(generatedSource, /public static System\.Collections\.Generic\.List<int> sliceAll\(System\.Collections\.Generic\.IReadOnlyList<int> values\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Array\.slice\(values\);/);
  assert.match(generatedSource, /public static System\.Collections\.Generic\.List<int> sliceFrom\(System\.Collections\.Generic\.IReadOnlyList<int> values, int start\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Array\.slice\(values, start\);/);
  assert.match(generatedSource, /public static System\.Collections\.Generic\.List<int> sliceRange\(System\.Collections\.Generic\.IReadOnlyList<int> values, int start, int end\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Array\.slice\(values, start, end\);/);
  assert.match(generatedSource, /public static int destruct\(System\.Collections\.Generic\.IReadOnlyList<int> values\)/);
  assert.match(generatedSource, /int first = __tsonic_destructure\d+\[0\];/);
  assert.match(generatedSource, /int second = __tsonic_destructure\d+\[1\];/);
  assert.match(generatedSource, /return first \+ second;/);
  assert.match(generatedSource, /public static int destructDefault\(System\.Collections\.Generic\.IReadOnlyList<int> values\)/);
  assert.match(generatedSource, /int first = (__tsonic_destructure\d+)\.Count > 0 \? \1\[0\] : 1;/);
  assert.match(generatedSource, /int second = (__tsonic_destructure\d+)\.Count > 1 \? \1\[1\] : 2;/);
  assert.match(generatedSource, /public static System\.Collections\.Generic\.List<int> destructRest\(System\.Collections\.Generic\.IReadOnlyList<int> values\)/);
  assert.match(generatedSource, /System\.Collections\.Generic\.List<int> rest = Tsonic\.CSharp\.Js\.Array\.slice\((__tsonic_destructure\d+), 1\);/);
  assert.match(generatedSource, /return rest;/);
  assert.match(generatedSource, /public static System\.Collections\.Generic\.List<int> append\(System\.Collections\.Generic\.IEnumerable<int> values, int value\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Array\.concat\(values, new int\[\] \{ value \}\);/);
  assert.match(generatedSource, /public static System\.Collections\.Generic\.List<int> prepend\(System\.Collections\.Generic\.IEnumerable<int> values, int value\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Array\.concat\(new int\[\] \{ value \}, values\);/);
  assert.match(generatedSource, /public static System\.Collections\.Generic\.List<int> copy\(System\.Collections\.Generic\.IEnumerable<int> __tsonic_param\d+\)/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.JSArray<int> values = new Tsonic\.CSharp\.Js\.JSArray<int>\(__tsonic_param\d+\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Array\.from\(values\);/);
  assert.match(generatedSource, /public static System\.Collections\.Generic\.List<string> chars\(string value\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Array\.from\(value\);/);
  assert.match(generatedSource, /public static System\.Collections\.Generic\.List<int> make\(int left, int right\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Array\.of\(left, right\);/);
  assert.match(generatedSource, /public static bool isActuallyArray\(System\.Collections\.Generic\.IEnumerable<int> __tsonic_param\d+\)/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.JSArray<int> values = new Tsonic\.CSharp\.Js\.JSArray<int>\(__tsonic_param\d+\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Array\.isArray\(values\);/);
  assert.doesNotMatch(generatedSource, /ArrayHelpers/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedArraySurfaceOperations.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits Array construction only from selected JS surface carrier facts", async () => {
  const projectDirectory = resolve(tempRoot, "array-constructor-selected-js-surface");
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
            assemblyName: "SmokeGeneratedArrayConstructorSelectedJsSurface",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "export function make(size: int32): int32 {",
      "  const values = new Array<int32>(size);",
      "  values[0] = 7;",
      "  return values.length;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static int make\(int size\)/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.JSArray<int> values = new Tsonic\.CSharp\.Js\.JSArray<int>\(System\.Convert\.ToDouble\(size\)\);/);
  assert.match(generatedSource, /values\[0\] = 7;/);
  assert.match(generatedSource, /return values\.length;/);
  assert.doesNotMatch(generatedSource, /Tsonic\.CSharp\.Js\.JSArray<double>/);
  assert.doesNotMatch(generatedSource, /new int\[/);
  assert.doesNotMatch(generatedSource, /System\.Collections\.Generic\.List<int>/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedArrayConstructorSelectedJsSurface.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);

  const withoutSurfaceDirectory = resolve(tempRoot, "array-constructor-without-js-surface");
  await writeProject(withoutSurfaceDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          options: {
            namespace: "Smoke.Generated",
            assemblyName: "SmokeGeneratedArrayConstructorWithoutJsSurface",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "export function make(size: int32): int32[] {",
      "  return new Array<int32>(size);",
      "}",
      "",
    ].join("\n"),
  });

  const rejected = runNode([cliPath, "build", "--project", resolve(withoutSurfaceDirectory, "tsonic.json")]);
  assert.equal(rejected.status, 1);
  assertExternalCallNotMapped(rejected.stderr, "<anonymous>");
  assert.equal(existsSync(resolve(withoutSurfaceDirectory, "out/csharp/SmokeGeneratedArrayConstructorWithoutJsSurface.csproj")), false);
});

test("CLI selects ordinary TypeScript array public ABI lanes from finalized JS surface facts", async () => {
  const projectDirectory = resolve(tempRoot, "array-public-abi-lanes");
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
            assemblyName: "SmokeGeneratedArrayPublicAbiLanes",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "export function unused(values: int32[]): int32 {",
      "  return 1;",
      "}",
      "",
      "export function sequence(values: int32[]): int32 {",
      "  let total: int32 = 0;",
      "  for (const value of values) {",
      "    total += value;",
      "  }",
      "  return total;",
      "}",
      "",
      "export function indexed(values: int32[]): int32 {",
      "  return values[0] + values.length;",
      "}",
      "",
      "export function dense(values: int32[], index: int32, value: int32): int32 {",
      "  values[index] = value;",
      "  return values.length;",
      "}",
      "",
      "export function make(value: int32): int32[] {",
      "  return [value, value + 1];",
      "}",
      "",
      "export function sparse(values: int32[], index: int32): int32 {",
      "  delete values[index];",
      "  return values.length;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static int unused\(int\[\] values\)/);
  assert.match(generatedSource, /public static int sequence\(System\.Collections\.Generic\.IEnumerable<int> values\)/);
  assert.match(generatedSource, /foreach \(int value in values\)/);
  assert.match(generatedSource, /public static int indexed\(System\.Collections\.Generic\.IReadOnlyList<int> values\)/);
  assert.match(generatedSource, /return values\[0\] \+ values\.Count;/);
  assert.match(generatedSource, /public static int dense\(System\.Collections\.Generic\.List<int> values, int index, int value\)/);
  assert.match(generatedSource, /values\[index\] = value;/);
  assert.match(generatedSource, /return values\.Count;/);
  assert.match(generatedSource, /public static System\.Collections\.Generic\.List<int> make\(int value\)/);
  assert.match(generatedSource, /return new System\.Collections\.Generic\.List<int>\(new int\[\] \{ value, value \+ 1 \}\);/);
  assert.match(generatedSource, /public static int sparse\(System\.Collections\.Generic\.IEnumerable<int> __tsonic_param\d+, int index\)/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.JSArray<int> values = new Tsonic\.CSharp\.Js\.JSArray<int>\(__tsonic_param\d+\);/);
  assert.match(generatedSource, /values\.deleteAt\(index\);/);
  assert.doesNotMatch(generatedSource, /public static .*Tsonic\.CSharp\.Js\.JSArray<int>/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedArrayPublicAbiLanes.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits sparse JS array delete and length mutation only through JSArray carrier facts", async () => {
  const projectDirectory = resolve(tempRoot, "array-sparse-delete-length");
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
            assemblyName: "SmokeGeneratedArraySparseDeleteLength",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "export function mutate(values: int32[], index: int32): int32 {",
      "  delete values[index];",
      "  values.length = 4;",
      "  values[3] = 7;",
      "  return values.length;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static int mutate\(System\.Collections\.Generic\.IEnumerable<int> __tsonic_param\d+, int index\)/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.JSArray<int> values = new Tsonic\.CSharp\.Js\.JSArray<int>\(__tsonic_param\d+\);/);
  assert.match(generatedSource, /values\.deleteAt\(index\);/);
  assert.match(generatedSource, /values\.setLength\(4\);/);
  assert.match(generatedSource, /values\[3\] = 7;/);
  assert.match(generatedSource, /return values\.length;/);
  assert.doesNotMatch(generatedSource, /values\.Count =/);
  assert.doesNotMatch(generatedSource, /values\.Length =/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedArraySparseDeleteLength.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI runs sparse JS array literal holes through closed JSArray carrier facts", async () => {
  const projectDirectory = resolve(tempRoot, "array-sparse-literal-runtime");
  const assemblyName = "SmokeGeneratedArraySparseLiteralRuntime";
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
      "const values = [, 5, 6];",
      "const [first = 10, second = 20, ...tail] = values;",
      "Console.WriteLine(`${first}:${second}:${tail[0] ?? -1}:${tail.length}:${values[0] ?? -1}`);",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.JSArray<double\?>\.fromSparse\(3, \(1, 5\), \(2, 6\)\)/);
  assert.match(generatedSource, /__tsonic_destructure\d+\.hasIndex\(0\) \? __tsonic_destructure\d+\[0\] : 10/);
  assert.match(generatedSource, /__tsonic_destructure\d+\.slice\(2\)/);
  assert.doesNotMatch(generatedSource, /new double\?\[\] \{ 5, 6 \}/);

  assert.equal(runGeneratedProject(projectDirectory, assemblyName), "10:5:6:1:-1\n");
});

test("CLI rejects sparse JS array operations without selected JS surface facts", async () => {
  const deleteProjectDirectory = resolve(tempRoot, "array-sparse-delete-without-js-surface");
  await writeProject(deleteProjectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          options: {
            namespace: "Smoke.Generated",
            assemblyName: "SmokeGeneratedArraySparseDeleteWithoutJsSurface",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "export function mutate(values: int32[], index: int32): int32 {",
      "  delete values[index];",
      "  return 0;",
      "}",
      "",
    ].join("\n"),
  });

  const deleteBuild = runNode([cliPath, "build", "--project", resolve(deleteProjectDirectory, "tsonic.json")]);
  assert.equal(deleteBuild.status, 1);
  assert.match(deleteBuild.stderr, /C# JS surface delete emission requires a finalized JSArray\.deleteAt mutation operation fact/);
  assert.equal(existsSync(resolve(deleteProjectDirectory, "out/csharp/SmokeGeneratedArraySparseDeleteWithoutJsSurface.csproj")), false);

  const lengthProjectDirectory = resolve(tempRoot, "array-sparse-length-without-js-surface");
  await writeProject(lengthProjectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          options: {
            namespace: "Smoke.Generated",
            assemblyName: "SmokeGeneratedArraySparseLengthWithoutJsSurface",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "export function grow(values: int32[]): int32 {",
      "  values.length = 4;",
      "  return 4;",
      "}",
      "",
    ].join("\n"),
  });

  const lengthBuild = runNode([cliPath, "build", "--project", resolve(lengthProjectDirectory, "tsonic.json")]);
  assert.equal(lengthBuild.status, 1);
  assert.match(lengthBuild.stderr, /Property 'length' does not exist on type 'number\[\]'|Property 'length' does not exist on type 'int32\[\]'/);
  assert.match(lengthBuild.stderr, /C# property access 'length' must be selected by TSTS\/provider facts before emission/);
  assert.equal(existsSync(resolve(lengthProjectDirectory, "out/csharp/SmokeGeneratedArraySparseLengthWithoutJsSurface.csproj")), false);
});

test("CLI rejects fixed CLR array mutators without JSArray carrier facts", async () => {
  const projectDirectory = resolve(tempRoot, "array-fixed-mutator-rejections");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/index.ts": [
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "export function append(values: int32[], value: int32): int32 {",
      "  return values.push(value);",
      "}",
      "",
      "export function removeLast(values: int32[]): int32 | undefined {",
      "  return values.pop();",
      "}",
      "",
      "export function splice(values: int32[]): int32[] {",
      "  return values.splice(1, 1);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /C# native array source contract has no target-backed property 'push'/);
  assert.match(build.stderr, /C# native array source contract has no target-backed property 'pop'/);
  assert.match(build.stderr, /C# native array source contract has no target-backed property 'splice'/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
});

test("CLI emits array callbacks with JS callback arities from provider facts", async () => {
  const projectDirectory = resolve(tempRoot, "array-callback-arity-helpers");
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
            assemblyName: "SmokeGeneratedArrayCallbacks",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "export function hasIndexedPositive(values: int32[]): boolean {",
      "  return values.some((value: int32, index: int32) => value > 0 && index > 0);",
      "}",
      "",
      "export function allFromSource(values: int32[]): boolean {",
      "  return values.every((value: int32, index: int32, source: int32[]) => source[index] === value);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static bool hasIndexedPositive\(System\.Collections\.Generic\.IReadOnlyList<int> values\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Array\.some\(values, \(int value, int index\) => value > 0 && index > 0\);/);
  assert.match(generatedSource, /public static bool allFromSource\(System\.Collections\.Generic\.IReadOnlyList<int> values\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Array\.every\(values, \(int value, int index, System\.Collections\.Generic\.IReadOnlyList<int> source\) => source\[index\] == value\);/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedArrayCallbacks.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

