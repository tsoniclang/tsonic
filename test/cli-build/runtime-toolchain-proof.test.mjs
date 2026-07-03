import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { assert, cliPath, existsSync, readFile, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "./harness.mjs";

const bannedGeneratedRuntimeSemantics = [
  /\bdynamic\b/u,
  /\bSystem\.Reflection\b/u,
  /\bGetProperty\b/u,
  /\bGetProperties\b/u,
  /\bGetMethod\b/u,
  /\bGetMethods\b/u,
  /\bMethodInfo\.Invoke\b/u,
  /\bMakeGenericMethod\b/u,
  /\bActivator\.CreateInstance\b/u,
  /\bAssembly\.Load\b/u,
];

test("C# runtime packages do not contain reflection or dynamic language semantics", async () => {
  const runtimeSourceDirectories = [
    resolve("../csharp-runtime/src"),
    resolve("../csharp-js/src"),
    resolve("../csharp-nodejs/csharp/src"),
  ];
  const files = (await Promise.all(runtimeSourceDirectories.map((directory) =>
    collectFiles(directory, (fileName) => fileName.endsWith(".cs"))
  ))).flat();
  assert.notEqual(files.length, 0);
  for (const file of files) {
    const text = await readFile(file, "utf8");
    for (const pattern of bannedGeneratedRuntimeSemantics) {
      assert.doesNotMatch(text, pattern, `${file} contains banned runtime semantic mechanism ${pattern}`);
    }
  }
});

test("CLI emits configured C# library projects with runtime-only references", async () => {
  const assemblyName = "SmokeGeneratedRuntimeOnlyLibrary";
  const projectDirectory = resolve(tempRoot, "runtime-only-library");
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
            outputType: "Library",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function add(left: number, right: number): number {",
      "  return left + right;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedProjectPath = resolve(projectDirectory, `out/csharp/${assemblyName}.csproj`);
  const generatedProject = await readFile(generatedProjectPath, "utf8");
  assert.match(generatedProject, /<OutputType>Library<\/OutputType>/);
  assertRuntimeReferences(generatedProject, { runtime: true, js: false, nodejs: false });
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/generated/TsonicEntrypoint.cs")), false);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static double add\(double left, double right\)/);
  assert.doesNotMatch(generatedSource, /public static void Main\(/);
  await assertGeneratedOutputHasNoReflectionSemantics(projectDirectory);

  const dotnet = run("dotnet", ["build", generatedProjectPath, "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits JS runtime references without NodeJS runtime when only the JS surface is selected", async () => {
  const assemblyName = "SmokeGeneratedJsRuntimeReferences";
  const projectDirectory = resolve(tempRoot, "js-runtime-references");
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
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function normalize(value: number): number {",
      "  return Math.trunc(Math.abs(value));",
      "}",
      "",
      "export function serialize(value: string): string {",
      "  return JSON.stringify(value);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedProjectPath = resolve(projectDirectory, `out/csharp/${assemblyName}.csproj`);
  const generatedProject = await readFile(generatedProjectPath, "utf8");
  assert.match(generatedProject, /<OutputType>Library<\/OutputType>/);
  assertRuntimeReferences(generatedProject, { runtime: true, js: true, nodejs: false });

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Math\.trunc\(Tsonic\.CSharp\.Js\.Math\.abs\(value\)\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.JSON\.stringify\(value\);/);
  assert.doesNotMatch(generatedSource, /Tsonic\.CSharp\.Node/);
  await assertGeneratedOutputHasNoReflectionSemantics(projectDirectory);

  const dotnet = run("dotnet", ["build", generatedProjectPath, "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI runs generated JS surface executable without NodeJS runtime", async () => {
  const assemblyName = "SmokeGeneratedJsRuntimeExecution";
  const projectDirectory = resolve(tempRoot, "js-runtime-execution");
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
      "console.log(Math.trunc(Math.abs(-42.9)));",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedProjectPath = resolve(projectDirectory, `out/csharp/${assemblyName}.csproj`);
  const generatedProject = await readFile(generatedProjectPath, "utf8");
  assertRuntimeReferences(generatedProject, { runtime: true, js: true, nodejs: false });
  assert.equal(runGeneratedProject(projectDirectory, assemblyName), "42\n");
});

test("CLI emits NodeJS runtime references with transitive JS runtime only when NodeJS is selected", async () => {
  const assemblyName = "SmokeGeneratedNodeRuntimeReferences";
  const projectDirectory = resolve(tempRoot, "nodejs-runtime-references");
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
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { join } from \"node:path\";",
      "",
      "export function tenantPath(tenantId: string): string {",
      "  return join(\"uploads\", tenantId, \"events.json\");",
      "}",
      "",
      "export function positive(value: number): number {",
      "  return Math.abs(value);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedProjectPath = resolve(projectDirectory, `out/csharp/${assemblyName}.csproj`);
  const generatedProject = await readFile(generatedProjectPath, "utf8");
  assert.match(generatedProject, /<OutputType>Library<\/OutputType>/);
  assertRuntimeReferences(generatedProject, { runtime: true, js: true, nodejs: true });

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.path\.join\("uploads", tenantId, "events\.json"\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Math\.abs\(value\);/);
  assert.doesNotMatch(generatedSource, /return join\(/);
  await assertGeneratedOutputHasNoReflectionSemantics(projectDirectory);

  const dotnet = run("dotnet", ["build", generatedProjectPath, "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

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
      "Console.writeLine(\"native-aot-ok\");",
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

function assertRuntimeReferences(projectText, expected) {
  assertReference(projectText, /<Reference Include="Tsonic\.CSharp\.Runtime" HintPath="[^"]*Tsonic\.CSharp\.Runtime\.dll" \/>/u, expected.runtime, "Tsonic.CSharp.Runtime");
  assertReference(projectText, /<Reference Include="Tsonic\.CSharp\.Js" HintPath="[^"]*Tsonic\.CSharp\.Js\.dll" \/>/u, expected.js, "Tsonic.CSharp.Js");
  assertReference(projectText, /<Reference Include="Tsonic\.CSharp\.Node" HintPath="[^"]*Tsonic\.CSharp\.Node\.dll" \/>/u, expected.nodejs, "Tsonic.CSharp.Node");
}

function assertReference(projectText, pattern, shouldExist, label) {
  if (shouldExist) {
    assert.match(projectText, pattern, label);
  } else {
    assert.doesNotMatch(projectText, pattern, label);
  }
}

function targetCsharpNodejsPackageJson(projectDirectory) {
  return JSON.stringify({
    name: `tsonic-test-${projectDirectory.split("/").at(-1)}`,
    type: "module",
    private: true,
    dependencies: {
      "@tsonic/target-csharp": "file:../../../../tsonic-csharp",
      "@tsonic/csharp-nodejs": "file:../../../../csharp-nodejs",
    },
  }, null, 2);
}

function currentDotnetRuntimeIdentifier() {
  if (process.platform === "linux" && process.arch === "x64") {
    return "linux-x64";
  }
  if (process.platform === "linux" && process.arch === "arm64") {
    return "linux-arm64";
  }
  if (process.platform === "darwin" && process.arch === "x64") {
    return "osx-x64";
  }
  if (process.platform === "darwin" && process.arch === "arm64") {
    return "osx-arm64";
  }
  if (process.platform === "win32" && process.arch === "x64") {
    return "win-x64";
  }
  if (process.platform === "win32" && process.arch === "arm64") {
    return "win-arm64";
  }
  return undefined;
}

async function assertGeneratedOutputHasNoReflectionSemantics(projectDirectory) {
  const files = await collectGeneratedFiles(resolve(projectDirectory, "out/csharp"));
  assert.notEqual(files.length, 0);
  for (const file of files) {
    const text = await readFile(file, "utf8");
    for (const pattern of bannedGeneratedRuntimeSemantics) {
      assert.doesNotMatch(text, pattern, `${file} contains banned generated runtime semantic mechanism ${pattern}`);
    }
  }
}

async function collectGeneratedFiles(directory) {
  return collectFiles(directory, (fileName) => fileName.endsWith(".cs") || fileName.endsWith(".csproj"));
}

async function collectFiles(directory, predicate) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(fullPath, predicate));
    } else if (entry.isFile() && predicate(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}
