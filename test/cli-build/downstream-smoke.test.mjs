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

test("downstream smoke simple apps compile and run without old runtime reflection paths", async () => {
  const scenarios = [
    {
      name: "provider-console-app",
      assemblyName: "SmokeGeneratedDownstreamConsole",
      target: {
        id: "csharp",
        options: {
          namespace: "Smoke.Generated",
          assemblyName: "SmokeGeneratedDownstreamConsole",
          outputType: "Exe",
        },
      },
      files: {
        "src/index.ts": [
          "import { Console } from \"@tsonic/dotnet/System.js\";",
          "",
          "function greeting(name: string): string {",
          "  return `Hello ${name}`;",
          "}",
          "",
          "Console.writeLine(greeting(\"Ada\"));",
          "",
        ].join("\n"),
      },
      expectedOutput: "Hello Ada\n",
    },
    {
      name: "js-surface-app",
      assemblyName: "SmokeGeneratedDownstreamJs",
      target: {
        id: "csharp",
        surfaces: ["js"],
        options: {
          namespace: "Smoke.Generated",
          assemblyName: "SmokeGeneratedDownstreamJs",
          outputType: "Exe",
        },
      },
      files: {
        "src/index.ts": [
          "console.log(Math.trunc(Math.abs(-7.8)));",
          "",
        ].join("\n"),
      },
      expectedOutput: "7\n",
    },
    {
      name: "node-provider-package-app",
      assemblyName: "SmokeGeneratedDownstreamNode",
      target: {
        id: "csharp",
        surfaces: ["js"],
        packages: ["nodejs"],
        options: {
          namespace: "Smoke.Generated",
          assemblyName: "SmokeGeneratedDownstreamNode",
          outputType: "Exe",
        },
      },
      files: {
        "src/index.ts": [
          "import { Buffer } from \"node:buffer\";",
          "import path from \"node:path\";",
          "",
          "console.log(path.posix.join(\"logs\", Buffer.from(\"ok\").toString()));",
          "",
        ].join("\n"),
      },
      expectedOutput: "logs/ok\n",
    },
  ];

  await assertRuntimePackagesHaveNoReflectionSemantics();

  for (const scenario of scenarios) {
    const projectDirectory = resolve(tempRoot, `downstream-smoke-${scenario.name}`);
    await writeProject(projectDirectory, {
      "tsonic.json": JSON.stringify({
        entryPoint: "index.ts",
        rootDir: "src",
        outDir: "out",
        targets: [scenario.target],
      }, null, 2),
      ...scenario.files,
    });

    const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
    assert.equal(build.status, 0, build.stdout + build.stderr);
    await assertGeneratedOutputHasNoReflectionSemantics(projectDirectory);
    assert.equal(runGeneratedProject(projectDirectory, scenario.assemblyName), scenario.expectedOutput, scenario.name);
  }
});

test("downstream generated C# library is consumable by an external SDK project", async () => {
  const assemblyName = "SmokeGeneratedDownstreamLibrary";
  const projectDirectory = resolve(tempRoot, "downstream-generated-library-consumer");
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
      "export function greeting(name: string): string {",
      "  return `Hello ${name}`;",
      "}",
      "",
      "export function twice(value: number): number {",
      "  return value + value;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);
  await assertGeneratedOutputHasNoReflectionSemantics(projectDirectory);

  const generatedProjectPath = resolve(projectDirectory, `out/csharp/${assemblyName}.csproj`);
  const generatedBuild = run("dotnet", ["build", generatedProjectPath, "--nologo", "--v:minimal"]);
  assert.equal(generatedBuild.status, 0, generatedBuild.stdout + generatedBuild.stderr);

  const consumerDirectory = resolve(projectDirectory, "consumer");
  await writeProject(consumerDirectory, {
    "Consumer.csproj": [
      "<Project Sdk=\"Microsoft.NET.Sdk\">",
      "  <PropertyGroup>",
      "    <OutputType>Exe</OutputType>",
      "    <TargetFramework>net10.0</TargetFramework>",
      "    <ImplicitUsings>enable</ImplicitUsings>",
      "    <Nullable>enable</Nullable>",
      "  </PropertyGroup>",
      "  <ItemGroup>",
      `    <ProjectReference Include="${generatedProjectPath}" />`,
      "  </ItemGroup>",
      "</Project>",
      "",
    ].join("\n"),
    "Program.cs": [
      "Console.WriteLine(global::Smoke.Generated.Index.greeting(\"Grace\") + \":\" + global::Smoke.Generated.Index.twice(2));",
      "",
    ].join("\n"),
  });

  const consumerProjectPath = resolve(consumerDirectory, "Consumer.csproj");
  const consumerBuild = run("dotnet", ["build", consumerProjectPath, "--nologo", "--v:minimal"]);
  assert.equal(consumerBuild.status, 0, consumerBuild.stdout + consumerBuild.stderr);

  const consumerRun = run("dotnet", ["run", "--project", consumerProjectPath, "--no-build", "--no-restore"]);
  assert.equal(consumerRun.status, 0, consumerRun.stdout + consumerRun.stderr);
  assert.equal(consumerRun.stdout.replace(/\r\n/g, "\n"), "Hello Grace:4\n");
});

test("downstream provider package imports fail closed when the package is not selected", async () => {
  const assemblyName = "SmokeGeneratedDownstreamUnselectedPackage";
  const projectDirectory = resolve(tempRoot, "downstream-unselected-provider-package");
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
      "import { join } from \"node:path\";",
      "",
      "console.log(join(\"a\", \"b\"));",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.notEqual(build.status, 0);
  assert.match(build.stderr, /Cannot find module 'node:path'|node:path/);
  assert.equal(existsSync(resolve(projectDirectory, `out/csharp/${assemblyName}.csproj`)), false);
});

async function assertGeneratedOutputHasNoReflectionSemantics(projectDirectory) {
  const files = await collectFiles(resolve(projectDirectory, "out/csharp"), (fileName) => fileName.endsWith(".cs"));
  assert.notEqual(files.length, 0);
  for (const file of files) {
    const text = await readFile(file, "utf8");
    for (const pattern of bannedGeneratedRuntimeSemantics) {
      assert.doesNotMatch(text, pattern, `${file} contains banned runtime semantic ${pattern}`);
    }
  }
}

async function assertRuntimePackagesHaveNoReflectionSemantics() {
  const runtimeSourceDirectories = [
    resolve("../csharp-runtime/src"),
    resolve("../csharp-js/src"),
    resolve("../csharp-nodejs/src"),
  ];
  const files = (await Promise.all(runtimeSourceDirectories.map((directory) =>
    collectFiles(directory, (fileName) => fileName.endsWith(".cs"))
  ))).flat();
  assert.notEqual(files.length, 0);
  for (const file of files) {
    const text = await readFile(file, "utf8");
    for (const pattern of bannedGeneratedRuntimeSemantics) {
      assert.doesNotMatch(text, pattern, `${file} contains banned runtime semantic ${pattern}`);
    }
  }
}

async function collectFiles(directory, includeFile, result = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await collectFiles(path, includeFile, result);
    } else if (entry.isFile() && includeFile(path)) {
      result.push(path);
    }
  }
  return result;
}
