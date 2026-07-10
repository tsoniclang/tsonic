import { assert, cliPath, readFile, resolve, runGeneratedProject, runNode, tempRoot, test, writeProject } from "./harness.mjs";

test("CLI pure C# source profile accepts CLR names and emits those names", async () => {
  const projectDirectory = resolve(tempRoot, "csharp-source-profile-clr-names");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "App.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{
        id: "csharp",
        options: {
          namespace: "Smoke.Generated",
          assemblyName: "SmokeGeneratedSourceProfile",
          outputType: "Exe",
          targetFramework: "net10.0",
        },
      }],
    }, null, 2),
    "src/App.ts": [
      "import { Console } from \"@tsonic/dotnet/System.js\";",
      "",
      "const path = \"/todos/42\";",
      "const parts = path.Split(\"/\");",
      "const ok = path.StartsWith(\"/\");",
      "const first = parts[1];",
      "Console.WriteLine(`${parts.Length}:${ok}:${first}`);",
      "",
    ].join("\n"),
  });
  const result = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const output = runGeneratedProject(projectDirectory, "SmokeGeneratedSourceProfile");
  assert.equal(output.trim(), "3:True:todos");
  const generated = await readFile(resolve(projectDirectory, "out/csharp/src/App.cs"), "utf8");
  assert.match(generated, /path\.Split\("\/"\)/u);
  assert.match(generated, /path\.StartsWith\("\/"\)/u);
  assert.match(generated, /parts\.Length/u);
  assert.match(generated, /parts\[1\]/u);
});

test("CLI pure C# source profile rejects JS names without JS surface", async () => {
  const projectDirectory = resolve(tempRoot, "csharp-source-profile-rejects-js-names");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "App.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/App.ts": [
      "const path = \"/todos/42\";",
      "const parts = path.split(\"/\");",
      "const count = [1, 2, 3].length;",
      "export const result = `${parts}:${count}`;",
      "",
    ].join("\n"),
  });
  const result = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.notEqual(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout + result.stderr, /Property 'split' does not exist on type '"\/todos\/42"'\. Did you mean 'Split'\?/u);
  assert.match(result.stdout + result.stderr, /Property 'length' does not exist on type 'number\[\]'\. Did you mean 'Length'\?/u);
});

test("CLI explicit JS surface accepts JS source-profile names without bundled TypeScript libs", async () => {
  const projectDirectory = resolve(tempRoot, "js-source-profile-names");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "App.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{
        id: "csharp",
        surfaces: ["js"],
        options: {
          namespace: "Smoke.Generated",
          assemblyName: "SmokeGeneratedJsSourceProfile",
          outputType: "Exe",
          targetFramework: "net10.0",
        },
      }],
    }, null, 2),
    "src/App.ts": [
      "const path = \"/todos/42\";",
      "const parts = path.split(\"/\");",
      "console.log(`${parts.length}:${path.startsWith(\"/\")}`);",
      "",
    ].join("\n"),
  });
  const result = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const output = runGeneratedProject(projectDirectory, "SmokeGeneratedJsSourceProfile");
  assert.equal(output.trim(), "3:True");
});

test("CLI explicit JS surface rejects CLR source-profile names", async () => {
  const projectDirectory = resolve(tempRoot, "js-source-profile-rejects-clr-names");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "App.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{
        id: "csharp",
        surfaces: ["js"],
      }],
    }, null, 2),
    "src/App.ts": [
      "const path = \"/todos/42\";",
      "const parts = path.Split(\"/\");",
      "const count = [1, 2, 3].Length;",
      "export const result = `${parts}:${count}`;",
      "",
    ].join("\n"),
  });
  const result = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.notEqual(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout + result.stderr, /Property 'Split' does not exist on type '"\/todos\/42"'\. Did you mean 'split'\?/u);
  assert.match(result.stdout + result.stderr, /Property 'Length' does not exist on type 'number\[\]'\. Did you mean 'length'\?/u);
});
