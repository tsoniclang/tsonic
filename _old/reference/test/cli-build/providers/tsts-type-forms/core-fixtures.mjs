import { assert, cliPath, existsSync, readFile, resolve, run, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";

export function projectConfig(assemblyName) {
  return JSON.stringify({
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
  }, null, 2);
}

export async function writeTypeFormProject(projectName, assemblyName, sourceLines) {
  const projectDirectory = resolve(tempRoot, projectName);
  await writeProject(projectDirectory, {
    "tsonic.json": projectConfig(assemblyName),
    "src/index.ts": `${sourceLines.join("\n")}\n`,
  });
  return projectDirectory;
}

export async function assertBuilds(projectName, assemblyName, sourceLines) {
  const projectDirectory = await writeTypeFormProject(projectName, assemblyName, sourceLines);
  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);
  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  const dotnet = run("dotnet", ["build", resolve(projectDirectory, `out/csharp/${assemblyName}.csproj`), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
  return { projectDirectory, generatedSource };
}

export async function assertRejected(projectName, assemblyName, sourceLines, expectedDiagnostic) {
  const projectDirectory = await writeTypeFormProject(projectName, assemblyName, sourceLines);
  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1, build.stdout + build.stderr);
  assert.match(build.stderr, expectedDiagnostic);
  assert.equal(existsSync(resolve(projectDirectory, `out/csharp/${assemblyName}.csproj`)), false);
  return build.stderr;
}
