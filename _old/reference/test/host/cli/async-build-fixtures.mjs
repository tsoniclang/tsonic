import { assert, cliPath, existsSync, readFile, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../cli-build/helpers/harness.mjs";

export async function readGeneratedModuleSource(projectDirectory) {
  return readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
}

export async function runGeneratedCsharpRunner(projectDirectory, assemblyName, programLines) {
  const runnerDirectory = resolve(projectDirectory, "runner");
  const runnerProjectPath = resolve(runnerDirectory, "Runner.csproj");
  await writeProject(runnerDirectory, {
    "Runner.csproj": [
      "<Project Sdk=\"Microsoft.NET.Sdk\">",
      "  <PropertyGroup>",
      "    <OutputType>Exe</OutputType>",
      "    <TargetFramework>net10.0</TargetFramework>",
      "    <ImplicitUsings>disable</ImplicitUsings>",
      "    <Nullable>enable</Nullable>",
      "  </PropertyGroup>",
      "  <ItemGroup>",
      `    <ProjectReference Include=\"../out/csharp/${assemblyName}.csproj\" />`,
      "  </ItemGroup>",
      "</Project>",
      "",
    ].join("\n"),
    "Program.cs": programLines.join("\n"),
  });

  const build = run("dotnet", ["build", runnerProjectPath, "--nologo", "--v:minimal"]);
  assert.equal(build.status, 0, build.stdout + build.stderr);
  const executed = run("dotnet", ["run", "--project", runnerProjectPath, "--no-build", "--no-restore"]);
  assert.equal(executed.status, 0, executed.stdout + executed.stderr);
  return executed.stdout.replace(/\r\n/g, "\n");
}
