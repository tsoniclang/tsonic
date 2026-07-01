import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { assert, cliPath, readFile, resolve, runGeneratedProject, runNode, tempRoot, test, writeProject } from "./harness.mjs";

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
  ];

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
