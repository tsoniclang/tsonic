import { assert, cliPath, dotnetOutputAssemblyPath, existsSync, readFile, repoRoot, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";
import { readGeneratedModuleSource } from './core-fixtures.mjs';

test("CLI emits provider-owned params-array arguments from reflected target facts", async () => {
  const libraryDirectory = resolve(tempRoot, "provider-params-array-library");
  await writeProject(libraryDirectory, {
    "Acme.Params.csproj": [
      "<Project Sdk=\"Microsoft.NET.Sdk\">",
      "  <PropertyGroup>",
      "    <TargetFramework>net10.0</TargetFramework>",
      "    <ImplicitUsings>disable</ImplicitUsings>",
      "    <Nullable>enable</Nullable>",
      "  </PropertyGroup>",
      "</Project>",
      "",
    ].join("\n"),
    "ParamsSource.cs": [
      "namespace Acme.Params;",
      "",
      "public static class ParamsSource",
      "{",
      "    public static string Join(string prefix, params int[] values)",
      "        => prefix + \":\" + string.Join(\",\", values);",
      "}",
      "",
    ].join("\n"),
  });
  const libraryBuild = run("dotnet", ["build", resolve(libraryDirectory, "Acme.Params.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(libraryBuild.status, 0, libraryBuild.stdout + libraryBuild.stderr);
  const libraryAssembly = dotnetOutputAssemblyPath(libraryDirectory, "Acme.Params");
  assert.equal(existsSync(libraryAssembly), true);

  const projectDirectory = resolve(tempRoot, "provider-params-array");
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
            assemblyName: "SmokeGeneratedProviderParamsArray",
            references: {
              assemblies: [{ include: "Acme.Params", hintPath: libraryAssembly }],
            },
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { ParamsSource } from \"@tsonic/dotnet/Acme.Params.js\";",
      "import type { int } from \"@tsonic/csharp/types.js\";",
      "",
      "export function joined(first: int, second: int): string {",
      "  return ParamsSource.Join(\"n\", first, second);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readGeneratedModuleSource(projectDirectory);
  assert.match(generatedSource, /return Acme\.Params\.ParamsSource\.Join\("n", first, second\);/);
  assert.doesNotMatch(generatedSource, /ParamsSource\.join|__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedProviderParamsArray.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits unique nested CLR type imports from provider declarations", async () => {
  const projectDirectory = resolve(tempRoot, "provider-system-nested-enum");
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
            assemblyName: "SmokeGeneratedProviderNestedEnum",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { Environment, SpecialFolder } from \"@tsonic/dotnet/System.js\";",
      "",
      "export function desktopPath(): string {",
      "  return Environment.GetFolderPath(SpecialFolder.Desktop);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readGeneratedModuleSource(projectDirectory);
  assert.match(generatedSource, /return System\.Environment\.GetFolderPath\(System\.Environment\.SpecialFolder\.Desktop\);/);
  assert.doesNotMatch(generatedSource, /SpecialFolder\.desktop|__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedProviderNestedEnum.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});
