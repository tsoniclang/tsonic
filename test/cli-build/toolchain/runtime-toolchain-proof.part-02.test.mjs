import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { assert, assertRuntimeProjectReference, assertNoRuntimeReference, assertNoInstalledAssemblyReference, cliPath, existsSync, readFile, resolve, run, runGeneratedProject, runNode, tempRoot, test, testRepositoryRoots, writeProject } from "../helpers/harness.mjs";
import { assertCsharpSourceClosure } from "../helpers/csharp-source-guard.mjs";
import { assertRuntimeReferences, targetCsharpNodejsPackageJson, currentDotnetRuntimeIdentifier, assertGeneratedOutputHasNoReflectionSemantics, collectGeneratedFiles, collectFiles } from "./runtime-toolchain-proof.split-fixtures.mjs";

test("CLI runs generated JS and NodeJS provider package executable through runtime references", async () => {
  const assemblyName = "SmokeGeneratedJsNodeRuntimeExecution";
  const projectDirectory = resolve(tempRoot, "js-node-runtime-execution");
  await writeProject(projectDirectory, {
    "package.json": targetCsharpNodejsPackageJson(projectDirectory),
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
      "import { join } from \"node:path\";",
      "",
      "console.log(join(\"uploads\", \"tenant\", \"events.json\"));",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedProjectPath = resolve(projectDirectory, `out/csharp/${assemblyName}.csproj`);
  const generatedProject = await readFile(generatedProjectPath, "utf8");
  assertRuntimeReferences(generatedProject, { runtime: true, js: true, nodejs: true });
  assert.equal(runGeneratedProject(projectDirectory, assemblyName), "uploads/tenant/events.json\n");
});

test("CLI generated C# executable publishes and runs through NativeAOT", async () => {
  const runtimeIdentifier = currentDotnetRuntimeIdentifier();
  assert.notEqual(runtimeIdentifier, undefined, `unsupported NativeAOT test platform ${process.platform}/${process.arch}`);

  const assemblyName = "SmokeGeneratedNativeAot";
  const projectDirectory = resolve(tempRoot, "nativeaot-publish-run");
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
            publishAot: true,
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { Console } from \"@tsonic/dotnet/System.js\";",
      "",
      "Console.WriteLine(\"native-aot-ok\");",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedProjectPath = resolve(projectDirectory, `out/csharp/${assemblyName}.csproj`);
  const generatedProject = await readFile(generatedProjectPath, "utf8");
  assert.match(generatedProject, /<OutputType>Exe<\/OutputType>/);
  assert.match(generatedProject, /<PublishAot>true<\/PublishAot>/);
  assertRuntimeReferences(generatedProject, { runtime: true, js: false, nodejs: false });
  await assertGeneratedOutputHasNoReflectionSemantics(projectDirectory);

  const publishDirectory = resolve(projectDirectory, "nativeaot-publish");
  const publish = run("dotnet", [
    "publish",
    generatedProjectPath,
    "--configuration",
    "Release",
    "--runtime",
    runtimeIdentifier,
    "--self-contained",
    "true",
    "--nologo",
    "--v:minimal",
    `-p:PublishDir=${publishDirectory}/`,
  ]);
  assert.equal(publish.status, 0, publish.stdout + publish.stderr);

  const executablePath = resolve(publishDirectory, process.platform === "win32" ? `${assemblyName}.exe` : assemblyName);
  assert.equal(existsSync(executablePath), true);
  const executed = run(executablePath, []);
  assert.equal(executed.status, 0, executed.stdout + executed.stderr);
  assert.equal(executed.stdout.replace(/\r\n/g, "\n"), "native-aot-ok\n");
});
