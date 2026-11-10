import { assert, cliPath, dotnetOutputAssemblyPath, existsSync, readFile, repoRoot, resolve, run, runGeneratedProject, runNode, runNodeInDirectory, tempRoot, test, writeProject } from "../../helpers/harness.mjs";

test("CLI clean rebuild removes stale target artifacts before writing current outputs", async () => {
  const projectDirectory = resolve(tempRoot, "clean-rebuild-stale-output");
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
            assemblyName: "SmokeGeneratedCleanRebuild",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": "export function value(): number { return 1; }\n",
    "out/csharp/src/Stale.cs": "public static class Stale {}\n",
    "out/csharp/runtime/stale.txt": "stale\n",
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/src/Index.cs")), true);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/src/Stale.cs")), false);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/runtime/stale.txt")), false);
});

test("CLI diagnostics preserve the last successfully published target output", async () => {
  const projectDirectory = resolve(tempRoot, "clean-rebuild-diagnostic-only-target");
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
            assemblyName: "SmokeGeneratedCleanDiagnostic",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function* values(): Generator<number, string, unknown> {",
      "  try { yield 1; } catch { return \"caught\"; }",
      "  return \"done\";",
      "}",
      "",
    ].join("\n"),
    "out/csharp/SmokeGeneratedCleanDiagnostic.csproj": "<Project />\n",
    "out/csharp/src/Stale.cs": "public static class Stale {}\n",
    "out/csharp/runtime/stale.txt": "stale\n",
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /CSHARP_UNSUPPORTED_GENERATOR_SUSPENSION_REGION/);
  assert.equal(await readFile(resolve(projectDirectory, "out/csharp/SmokeGeneratedCleanDiagnostic.csproj"), "utf8"), "<Project />\n");
  assert.equal(await readFile(resolve(projectDirectory, "out/csharp/src/Stale.cs"), "utf8"), "public static class Stale {}\n");
  assert.equal(await readFile(resolve(projectDirectory, "out/csharp/runtime/stale.txt"), "utf8"), "stale\n");
});

test("CLI clean rebuild removes prior target toolchain artifacts before writing current outputs", async () => {
  const assemblyName = "SmokeGeneratedCleanToolchainArtifacts";
  const projectDirectory = resolve(tempRoot, "clean-rebuild-toolchain-artifacts");
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
          },
        },
      ],
    }, null, 2),
    "src/index.ts": "export function value(): number { return 1; }\n",
  });

  const firstBuild = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(firstBuild.status, 0, firstBuild.stdout + firstBuild.stderr);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, `out/csharp/${assemblyName}.csproj`), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
  const csharpOutputRoot = resolve(projectDirectory, "out/csharp");
  assert.equal(existsSync(dotnetOutputAssemblyPath(csharpOutputRoot, assemblyName)), true);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/obj")), true);

  await writeProject(projectDirectory, {
    "src/index.ts": "export function value(): number { return 2; }\n",
  });

  const secondBuild = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(secondBuild.status, 0, secondBuild.stdout + secondBuild.stderr);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/src/Index.cs")), true);
  assert.equal(existsSync(dotnetOutputAssemblyPath(csharpOutputRoot, assemblyName)), false);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/obj")), false);
});
