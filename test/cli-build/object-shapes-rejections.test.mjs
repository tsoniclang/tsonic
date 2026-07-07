import { assert, assertInstalledAssemblyReference, assertNoRuntimeProjectReference, cliPath, existsSync, readFile, repoRoot, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "./harness.mjs";

test("CLI rejects unknown and object dynamic member access before target planning", async () => {
  const projectDirectory = resolve(tempRoot, "unknown-object-dynamic-access-rejected");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/index.ts": [
      "export function readUnknown(value: unknown): unknown {",
      "  return value.foo;",
      "}",
      "",
      "export function readObject(value: object): unknown {",
      "  return value.foo;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /TS18046: 'value' is of type 'unknown'/);
  assert.match(build.stderr, /TS2339: Property 'foo' does not exist on type 'object'/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
});

test("CLI rejects structural binary operators without selected target facts", async () => {
  const projectDirectory = resolve(tempRoot, "structural-binary-operator");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/index.ts": [
      "export function compare<T>(left: T, right: T): boolean {",
      "  return left == right;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /C# operator '==' requires finalized provider operator facts for type-parameter operands/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
});
