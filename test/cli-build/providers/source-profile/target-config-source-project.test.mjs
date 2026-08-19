import { assert, cliPath, dotnetOutputAssemblyPath, existsSync, readFile, repoRoot, resolve, run, runGeneratedProject, runNode, runNodeInDirectory, tempRoot, test, writeProject } from "../../helpers/harness.mjs";









































test("CLI emits C# source project from TSTS semantics and compiles with dotnet", async () => {
  const projectDirectory = resolve(tempRoot, "wide-csharp");
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
            assemblyName: "SmokeGeneratedWide",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int } from \"@tsonic/csharp/types.js\";",
      "",
      "export class Counter {",
      "  value: int = 0;",
      "  history: int[] = [];",
      "",
      "  constructor(initial: int) {",
      "    this.value = initial;",
      "  }",
      "",
      "  inc(delta: int): int {",
      "    for (let i: int = 0; i < delta; i++) {",
      "      this.value = this.value + i;",
      "    }",
      "    do {",
      "      this.value--;",
      "    } while (this.value > 10);",
      "    return this.value % 2 === 0 ? this.value : this.value + 1;",
      "  }",
      "}",
      "",
      "export function sum(values: number[]): number {",
      "  let total = 0;",
      "  let seen: number[] = [];",
      "  for (const value of values) {",
      "    total = total + value;",
      "  }",
      "  return total;",
      "}",
      "",
      "export function control(value: int): int {",
      "  let result: int = 0;",
      "  while (result < value) {",
      "    result++;",
      "    if (result === 2) continue;",
      "    if (result > 5) break;",
      "  }",
      "  switch (value) {",
      "    case 0:",
      "      result = 10;",
      "      break;",
      "    case 1:",
      "      result = 20;",
      "      break;",
      "    default:",
      "      result = 30;",
      "      break;",
      "  }",
      "  try {",
      "    result = result + 1;",
      "  } catch {",
      "    result = 40;",
      "  } finally {",
      "    result = result + 1;",
      "  }",
      "  done: result = result + 1;",
      "  debugger;",
      "  return result;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSourcePath = resolve(projectDirectory, "out/csharp/src/Index.cs");
  const generatedSource = await readFile(generatedSourcePath, "utf8");
  assert.match(generatedSource, /public static double sum\(double\[\] values\)/);
  assert.match(generatedSource, /public int\[\] history = new int\[\] \{ \};/);
  assert.match(generatedSource, /double\[\] seen = new double\[\] \{ \};/);
  assert.match(generatedSource, /foreach \(double value in values\)/);
  assert.match(generatedSource, /public static int control\(int value\)/);
  assert.match(generatedSource, /public Counter\(int initial\)/);
  assert.match(generatedSource, /for \(int i = 0; i < delta; i\+\+\)/);
  assert.match(generatedSource, /switch \(value\)/);
  assert.match(generatedSource, /case 0:/);
  assert.match(generatedSource, /continue;/);
  assert.match(generatedSource, /break;/);
  assert.match(generatedSource, /try/);
  assert.match(generatedSource, /catch/);
  assert.match(generatedSource, /finally/);
  assert.match(generatedSource, /done:/);
  assert.match(generatedSource, /System\.Diagnostics\.Debugger\.Break\(\);/);
  assert.match(generatedSource, /return this\.value % 2 == 0 \? this\.value : this\.value \+ 1;/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedWide.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});
test("CLI emits explicit C# target .NET references without host inference", async () => {
  const projectDirectory = resolve(tempRoot, "target-references");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          options: {
            assemblyName: "SmokeGeneratedReferences",
            references: {
              projects: ["../csharp-runtime/src/Tsonic.CSharp.Runtime/Tsonic.CSharp.Runtime.csproj"],
              packages: [{ include: "Tsonic.CSharp.Runtime", version: "0.0.1" }],
              frameworks: ["Microsoft.AspNetCore.App"],
              assemblies: [{ include: "Example.Assembly", hintPath: "../lib/Example.Assembly.dll" }],
            },
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function value(): number {",
      "  return 1;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedProject = await readFile(resolve(projectDirectory, "out/csharp/SmokeGeneratedReferences.csproj"), "utf8");
  assert.match(generatedProject, /<ProjectReference Include="\.\.\/csharp-runtime\/src\/Tsonic\.CSharp\.Runtime\/Tsonic\.CSharp\.Runtime\.csproj" \/>/);
  assert.match(generatedProject, /<PackageReference Include="Tsonic\.CSharp\.Runtime" Version="0\.0\.1" \/>/);
  assert.match(generatedProject, /<FrameworkReference Include="Microsoft\.AspNetCore\.App" \/>/);
  assert.match(generatedProject, /<Reference Include="Example\.Assembly" HintPath="\.\.\/lib\/Example\.Assembly\.dll" \/>/);
});
test("CLI user-owned C# project mode emits generated sources without mutating or replacing the project file", async () => {
  const projectDirectory = resolve(tempRoot, "user-owned-csharp-project");
  const userProject = [
    "<Project Sdk=\"Microsoft.NET.Sdk\">",
    "  <PropertyGroup>",
    "    <TargetFramework>net10.0</TargetFramework>",
    "    <EnableDefaultCompileItems>false</EnableDefaultCompileItems>",
    "    <ImplicitUsings>disable</ImplicitUsings>",
    "    <Nullable>enable</Nullable>",
    "  </PropertyGroup>",
    "  <ItemGroup>",
    "    <Compile Include=\"out/csharp/src/**/*.cs\" />",
    "  </ItemGroup>",
    "</Project>",
    "",
  ].join("\n");
  await writeProject(projectDirectory, {
    "App.csproj": userProject,
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          options: {
            namespace: "Smoke.Generated",
            assemblyName: "SmokeGeneratedUserOwnedProject",
            projectFile: "App.csproj",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function value(): number {",
      "  return 42;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedUserOwnedProject.csproj")), false);
  assert.equal(await readFile(resolve(projectDirectory, "App.csproj"), "utf8"), userProject);
  assert.match(await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8"), /public static double value\(\)/u);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "App.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});
test("CLI escapes TypeScript identifiers that are C# reserved words", async () => {
  const projectDirectory = resolve(tempRoot, "csharp-keyword-identifiers");
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
            assemblyName: "SmokeGeneratedCsharpKeywordIdentifiers",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "let event = 1;",
      "",
      "export function read(operator: number): number {",
      "  let params = operator + event;",
      "  return params;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static double @event\s*\{\s*get;\s*internal set;\s*\} = default\(double\)!;/u);
  assert.match(generatedSource, /private static object\? __tsonic_module_init_core\(\)/u);
  assert.match(generatedSource, /@event = 1;/);
  assert.match(generatedSource, /public static double read\(double @operator\)/);
  assert.match(generatedSource, /double @params = @operator \+ @event;/);
  assert.match(generatedSource, /return @params;/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedCsharpKeywordIdentifiers.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});
test("CLI validates and escapes C# target namespace segments", async () => {
  const projectDirectory = resolve(tempRoot, "csharp-keyword-namespace");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          options: {
            namespace: "event.operator",
            assemblyName: "SmokeGeneratedCsharpKeywordNamespace",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function read(): number {",
      "  return 1;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /namespace @event\.@operator/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedCsharpKeywordNamespace.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});
test("CLI rejects invalid C# target namespace segments", async () => {
  const projectDirectory = resolve(tempRoot, "csharp-invalid-namespace");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          options: {
            namespace: "Smoke.Bad-Name",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function read(): number {",
      "  return 1;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /C# target option 'namespace' must be a dot-separated C# identifier path/);
});
test("CLI rejects non-string C# target namespace option", async () => {
  const projectDirectory = resolve(tempRoot, "csharp-invalid-namespace-type");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          options: {
            namespace: 42,
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function read(): number {",
      "  return 1;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /C# target option 'namespace' must be a non-empty string/);
});
test("CLI rejects invalid C# target assembly name", async () => {
  const projectDirectory = resolve(tempRoot, "csharp-invalid-assembly-name");
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
            assemblyName: "../Bad",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function read(): number {",
      "  return 1;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /C# target option 'assemblyName' must be a file-safe \.NET assembly name/);
});
test("CLI does not emit target artifacts when TSTS rejects the source program", async () => {
  const projectDirectory = resolve(tempRoot, "tsts-diagnostic-stop");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/index.ts": [
      "export function invalid(): number {",
      "  return \"not a number\";",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /TSTS_DIAGNOSTIC/);
  assert.doesNotMatch(build.stdout, /Artifacts: [1-9]/);
});
