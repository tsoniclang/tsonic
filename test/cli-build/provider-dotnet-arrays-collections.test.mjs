import { assert, cliPath, dotnetOutputAssemblyPath, existsSync, readFile, repoRoot, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "./harness.mjs";

async function readGeneratedModuleSource(projectDirectory) {
  return readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
}

test("CLI emits explicit provider-owned native .NET arrays without JS array surface semantics", async () => {
  const projectDirectory = resolve(tempRoot, "provider-native-dotnet-array");
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
            assemblyName: "SmokeGeneratedProviderNativeDotnetArray",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { Array as DotNetArray } from \"@tsonic/dotnet/System.js\";",
      "import type { int } from \"@tsonic/csharp/types.js\";",
      "",
      "export function makeNativeArray(size: int): DotNetArray<int> {",
      "  const values = DotNetArray.Create<int>(size);",
      "  values[0] = 7;",
      "  return values;",
      "}",
      "",
      "export function nativeArrayLength(values: DotNetArray<int>): int {",
      "  return values.Length;",
      "}",
      "",
      "export function nativeArrayAt(values: DotNetArray<int>, index: int): int {",
      "  return values[index];",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readGeneratedModuleSource(projectDirectory);
  assert.match(generatedSource, /public static int\[\] makeNativeArray\(int size\)/);
  assert.match(generatedSource, /int\[\] values = new int\[size\];/);
  assert.match(generatedSource, /values\[0\] = 7;/);
  assert.match(generatedSource, /public static int nativeArrayLength\(int\[\] values\)/);
  assert.match(generatedSource, /return values\.Length;/);
  assert.match(generatedSource, /public static int nativeArrayAt\(int\[\] values, int index\)/);
  assert.match(generatedSource, /return values\[index\];/);
  assert.doesNotMatch(generatedSource, /JSArray/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedProviderNativeDotnetArray.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI rejects native .NET array destructuring without a provider iterable source contract", async () => {
  const projectDirectory = resolve(tempRoot, "provider-native-dotnet-array-reject-destructure");
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
            assemblyName: "SmokeGeneratedProviderNativeDotnetArrayRejectDestructure",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { Array as DotNetArray } from \"@tsonic/dotnet/System.js\";",
      "import type { int } from \"@tsonic/csharp/types.js\";",
      "",
      "export function invalid(values: DotNetArray<int>): int {",
      "  const [first] = values;",
      "  return first;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /TS2461: Type 'Array<number>' is not an array type\./u);
  assert.doesNotMatch(build.stderr, /TS2488/u);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedProviderNativeDotnetArrayRejectDestructure.csproj")), false);
});

test("CLI rejects native .NET array spread without a provider iterable source contract", async () => {
  const projectDirectory = resolve(tempRoot, "provider-native-dotnet-array-reject-spread");
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
            assemblyName: "SmokeGeneratedProviderNativeDotnetArrayRejectSpread",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { Array as DotNetArray } from \"@tsonic/dotnet/System.js\";",
      "import type { int } from \"@tsonic/csharp/types.js\";",
      "",
      "export function invalid(values: DotNetArray<int>): int[] {",
      "  return [...values];",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /TS2461: Type 'Array<number>' is not an array type\./u);
  assert.doesNotMatch(build.stderr, /TS2488/u);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedProviderNativeDotnetArrayRejectSpread.csproj")), false);
});

test("CLI rejects JS array mutators on explicit provider-owned native .NET arrays", async () => {
  const projectDirectory = resolve(tempRoot, "provider-native-dotnet-array-reject-mutator");
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
            assemblyName: "SmokeGeneratedProviderNativeDotnetArrayRejectMutator",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { Array as DotNetArray } from \"@tsonic/dotnet/System.js\";",
      "import type { int } from \"@tsonic/csharp/types.js\";",
      "",
      "export function invalid(values: DotNetArray<int>): void {",
      "  values.push(1);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.notEqual(build.status, 0);
  assert.match(build.stdout + build.stderr, /push|does not exist|CSHARP_TARGET_MEMBER_NOT_FOUND/u);
});

test("CLI rejects length mutation on explicit provider-owned native .NET arrays", async () => {
  const projectDirectory = resolve(tempRoot, "provider-native-dotnet-array-reject-length-set");
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
            assemblyName: "SmokeGeneratedProviderNativeDotnetArrayRejectLengthSet",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { Array as DotNetArray } from \"@tsonic/dotnet/System.js\";",
      "import type { int } from \"@tsonic/csharp/types.js\";",
      "",
      "export function invalid(values: DotNetArray<int>): void {",
      "  values.Length = 3;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.notEqual(build.status, 0);
  assert.match(build.stdout + build.stderr, /Cannot assign to 'Length' because it is a read-only property/u);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedProviderNativeDotnetArrayRejectLengthSet.csproj")), false);
});

test("CLI emits provider-owned List initializers for primitive, string, and source class elements", async () => {
  const projectDirectory = resolve(tempRoot, "provider-generic-list-initializer");
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
            assemblyName: "SmokeGeneratedProviderGenericListInitializer",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int } from \"@tsonic/csharp/types.js\";",
      "import { List } from \"@tsonic/dotnet/System.Collections.Generic.js\";",
      "",
      "export class User {",
      "  name: string;",
      "",
      "  constructor(name: string) {",
      "    this.name = name;",
      "  }",
      "}",
      "",
      "export function makeInts(): List<int> {",
      "  return new List<int>([1, 2, 3]);",
      "}",
      "",
      "export function makeStrings(): List<string> {",
      "  return new List<string>([\"a\", \"b\"]);",
      "}",
      "",
      "export function makeUsers(): List<User> {",
      "  const ada = new User(\"Ada\");",
      "  const grace = new User(\"Grace\");",
      "  return new List<User>([ada, grace]);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readGeneratedModuleSource(projectDirectory);
  assert.match(generatedSource, /System\.Collections\.Generic\.List<int> makeInts\(\)/);
  assert.match(generatedSource, /return new System\.Collections\.Generic\.List<int>\(new int\[\] \{ 1, 2, 3 \}\);/);
  assert.match(generatedSource, /System\.Collections\.Generic\.List<string> makeStrings\(\)/);
  assert.match(generatedSource, /return new System\.Collections\.Generic\.List<string>\(new string\[\] \{ "a", "b" \}\);/);
  assert.match(generatedSource, /System\.Collections\.Generic\.List<User> makeUsers\(\)/);
  assert.match(generatedSource, /return new System\.Collections\.Generic\.List<User>\(new User\[\] \{ ada, grace \}\);/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedProviderGenericListInitializer.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits provider-owned generic collection constructors from virtual target modules", async () => {
  const projectDirectory = resolve(tempRoot, "provider-generic-list-constructor");
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
            assemblyName: "SmokeGeneratedProviderGenericList",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int } from \"@tsonic/csharp/types.js\";",
      "import { List } from \"@tsonic/dotnet/System.Collections.Generic.js\";",
      "",
      "export function makeInts(): List<int> {",
      "  return new List<int>([1, 2, 3]);",
      "}",
      "",
      "export function countInts(): int {",
      "  const values = new List<int>([1, 2, 3]);",
      "  return values.Count;",
      "}",
      "",
      "export function mutateInts(): int {",
      "  const values = new List<int>();",
      "  values.Add(1);",
      "  values.Add(2);",
      "  return values[0] + values.Count;",
      "}",
      "",
      "export function replaceFirst(value: int): int {",
      "  const values = new List<int>([1, 2, 3]);",
      "  values[0] = value;",
      "  return values[0];",
      "}",
      "",
      "export function searchInts(): boolean {",
      "  const values = new List<int>([1, 2, 3]);",
      "  return values.Contains(2) && values.IndexOf(1) === 0;",
      "}",
      "",
      "export function removeInts(): int[] {",
      "  const values = new List<int>([1, 2, 3]);",
      "  values.Remove(2);",
      "  values.RemoveAt(0);",
      "  return values.ToArray();",
      "}",
      "",
      "export function clearInts(): int {",
      "  const values = new List<int>([1, 2, 3]);",
      "  values.Clear();",
      "  return values.Count;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readGeneratedModuleSource(projectDirectory);
  assert.match(generatedSource, /System\.Collections\.Generic\.List<int> makeInts\(\)/);
  assert.match(generatedSource, /return new System\.Collections\.Generic\.List<int>\(new int\[\] \{ 1, 2, 3 \}\);/);
  assert.match(generatedSource, /System\.Collections\.Generic\.List<int> values = new System\.Collections\.Generic\.List<int>\(new int\[\] \{ 1, 2, 3 \}\);/);
  assert.match(generatedSource, /return values\.Count;/);
  assert.match(generatedSource, /public static int mutateInts\(\)/);
  assert.match(generatedSource, /values\.Add\(1\);/);
  assert.match(generatedSource, /values\.Add\(2\);/);
  assert.match(generatedSource, /return values\[0\] \+ values\.Count;/);
  assert.match(generatedSource, /public static int replaceFirst\(int value\)/);
  assert.match(generatedSource, /values\[0\] = value;/);
  assert.match(generatedSource, /return values\[0\];/);
  assert.match(generatedSource, /public static bool searchInts\(\)/);
  assert.match(generatedSource, /return values\.Contains\(2\) && values\.IndexOf\(1\) == 0;/);
  assert.match(generatedSource, /public static int\[\] removeInts\(\)/);
  assert.match(generatedSource, /values\.Remove\(2\);/);
  assert.match(generatedSource, /values\.RemoveAt\(0\);/);
  assert.match(generatedSource, /return values\.ToArray\(\);/);
  assert.match(generatedSource, /public static int clearInts\(\)/);
  assert.match(generatedSource, /values\.Clear\(\);/);
  assert.doesNotMatch(generatedSource, /bindings\.json/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedProviderGenericList.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits JS Record dictionaries through provider-owned Dictionary indexers", async () => {
  const assemblyName = "SmokeGeneratedProviderRecordDictionary";
  const projectDirectory = resolve(tempRoot, "provider-record-dictionary");
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
      "import type { int } from \"@tsonic/csharp/types.js\";",
      "import { Console } from \"@tsonic/dotnet/System.js\";",
      "",
      "export function getStringDict(): Record<string, number> {",
      "  return {};",
      "}",
      "",
      "export function getNumberDict(): Record<number, string> {",
      "  return {};",
      "}",
      "",
      "export function mutateStringKey(key: string, value: int): int {",
      "  const values: Record<string, int> = {};",
      "  values[key] = value;",
      "  return values[key];",
      "}",
      "",
      "export function lookupByNumber(dict: Record<number, string>, key: number): string | undefined {",
      "  return dict[key];",
      "}",
      "",
      "export function mutateNumberKey(key: number, value: string): string {",
      "  const values: Record<number, string> = {};",
      "  values[key] = value;",
      "  return values[key];",
      "}",
      "",
      "Console.WriteLine(mutateStringKey(\"one\", 7));",
      "Console.WriteLine(mutateNumberKey(2, \"two\"));",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readGeneratedModuleSource(projectDirectory);
  assert.match(generatedSource, /System\.Collections\.Generic\.Dictionary<string, double> getStringDict\(\)/);
  assert.match(generatedSource, /return new System\.Collections\.Generic\.Dictionary<string, double>\(\);/);
  assert.match(generatedSource, /System\.Collections\.Generic\.Dictionary<double, string> getNumberDict\(\)/);
  assert.match(generatedSource, /return new System\.Collections\.Generic\.Dictionary<double, string>\(\);/);
  assert.match(generatedSource, /System\.Collections\.Generic\.Dictionary<string, int> values = new System\.Collections\.Generic\.Dictionary<string, int>\(\);/);
  assert.match(generatedSource, /values\[key\] = value;/);
  assert.match(generatedSource, /return values\[key\];/);
  assert.match(generatedSource, /System\.Collections\.Generic\.Dictionary<double, string> values = new System\.Collections\.Generic\.Dictionary<double, string>\(\);/);
  assert.match(generatedSource, /return dict\[key\];/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  assert.equal(runGeneratedProject(projectDirectory, assemblyName), [
    "7",
    "two",
    "",
  ].join("\n"));
});

test("CLI emits provider-owned generic byref collection calls from virtual target modules", async () => {
  const projectDirectory = resolve(tempRoot, "provider-generic-dictionary-out");
  const assemblyName = "SmokeGeneratedProviderGenericDictionaryOut";
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
      "import { out } from \"@tsonic/csharp/lang.js\";",
      "import type { int } from \"@tsonic/csharp/types.js\";",
      "import { Dictionary } from \"@tsonic/dotnet/System.Collections.Generic.js\";",
      "",
      "export function lookup(values: Dictionary<string, int>, key: string): int {",
      "  let value: int = 0;",
      "  if (values.TryGetValue(key, out(value))) {",
      "    return value;",
      "  }",
      "  return -1;",
      "}",
      "",
      "const values = new Dictionary<string, int>();",
      "values.Add(\"hit\", 11);",
      "Console.WriteLine(`${lookup(values, \"hit\")}|${lookup(values, \"miss\")}`);",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readGeneratedModuleSource(projectDirectory);
  assert.match(generatedSource, /System\.Collections\.Generic\.Dictionary<string, int> values/);
  assert.match(generatedSource, /int value = 0;/);
  assert.match(generatedSource, /if \(values\.TryGetValue\(key, out value\)\)/);
  assert.match(generatedSource, /return value;/);
  assert.match(generatedSource, /values\.Add\("hit", 11\);/);
  assert.doesNotMatch(generatedSource, /tryGetValue|out\(value\)|__unsupported/);

  assert.equal(runGeneratedProject(projectDirectory, assemblyName), "11|-1\n");
});

