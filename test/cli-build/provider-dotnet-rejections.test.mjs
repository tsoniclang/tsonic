import { assert, cliPath, dotnetOutputAssemblyPath, existsSync, readFile, repoRoot, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "./harness.mjs";

async function readGeneratedModuleSource(projectDirectory) {
  return readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
}

test("CLI emits provider-owned static C# properties from selected TSTS target facts", async () => {
  const projectDirectory = resolve(tempRoot, "provider-static-properties");
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
            assemblyName: "SmokeGeneratedProviderStaticProperties",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { Environment } from \"@tsonic/dotnet/System.js\";",
      "",
      "export function newline(): string {",
      "  return Environment.NewLine;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readGeneratedModuleSource(projectDirectory);
  assert.match(generatedSource, /public static string newline\(\)/);
  assert.match(generatedSource, /return System\.Environment\.NewLine;/);
  assert.doesNotMatch(generatedSource, /return Environment\.NewLine;/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedProviderStaticProperties.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI rejects provider-owned identifiers outside selected target operations", async () => {
  const projectDirectory = resolve(tempRoot, "provider-identifier-value");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/index.ts": [
      "import { Environment } from \"@tsonic/dotnet/System.js\";",
      "",
      "export const environment = Environment;",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /(Provider-owned|Declaration\/provider) identifier 'Environment' requires a selected target operation or type-position usage before C# emission/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
});

test("CLI emits provider-owned instance C# members from receiver type facts", async () => {
  const projectDirectory = resolve(tempRoot, "provider-instance-members");
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
            assemblyName: "SmokeGeneratedProviderInstanceMembers",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { Exception } from \"@tsonic/dotnet/System.js\";",
      "",
      "export function message(): string {",
      "  const ex = new Exception(\"boom\");",
      "  return ex.Message;",
      "}",
      "",
      "export function describe(): string {",
      "  const ex = new Exception(\"boom\");",
      "  return ex.ToString();",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readGeneratedModuleSource(projectDirectory);
  assert.match(generatedSource, /System\.Exception ex = new System\.Exception\("boom"\);/);
  assert.match(generatedSource, /return ex\.Message;/);
  assert.match(generatedSource, /return ex\.ToString\(\);/);
  assert.doesNotMatch(generatedSource, /ex\.message/);
  assert.doesNotMatch(generatedSource, /ex\.toString/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedProviderInstanceMembers.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});
