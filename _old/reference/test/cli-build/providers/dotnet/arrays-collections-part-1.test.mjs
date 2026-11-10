import { assert, cliPath, dotnetOutputAssemblyPath, existsSync, readFile, repoRoot, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";
import { readGeneratedModuleSource } from "./arrays-collections-fixtures.mjs";

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
  assert.match(build.stderr, /TS2488: Type 'Array<number>' must have a '\[Symbol\.iterator\]\(\)' method that returns an iterator\./u);
  assert.doesNotMatch(build.stderr, /TS2461/u);
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
  assert.match(build.stderr, /TS2488: Type 'Array<number>' must have a '\[Symbol\.iterator\]\(\)' method that returns an iterator\./u);
  assert.doesNotMatch(build.stderr, /TS2461/u);
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
