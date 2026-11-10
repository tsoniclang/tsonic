import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { assert, cliPath, existsSync, readFile, resolve, run, runGeneratedProject, runNode, tempRoot, test, testRepositoryRoots, writeProject } from "../helpers/harness.mjs";
import { assertCsharpSourceClosure } from "../helpers/csharp-source-guard.mjs";
import { assertGeneratedOutputHasNoReflectionSemantics, assertRuntimePackagesHaveNoReflectionSemantics, targetCsharpNodejsPackageJson, collectFiles } from "./downstream-smoke-fixtures.mjs";

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
          "Console.WriteLine(greeting(\"Ada\"));",
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
      packageJson: targetCsharpNodejsPackageJson("downstream-node-provider-package-app"),
      target: {
        id: "csharp",
        surfaces: ["js"],
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
      ...(scenario.packageJson === undefined ? {} : { "package.json": scenario.packageJson }),
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
