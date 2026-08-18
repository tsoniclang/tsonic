import { assert, cliPath, readFile, resolve, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";

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
      "import { Console, Span } from \"@tsonic/dotnet/System.js\";",
      "import type { int, long } from \"@tsonic/csharp/types.js\";",
      "",
      "const path = \"/todos/42\";",
      "const parts = path.Split(\"/\");",
      "const ok = path.StartsWith(\"/\");",
      "const first = parts[1];",
      "const wideValues: long[] = [1n, 2n];",
      "const wideValue: long = wideValues[1];",
      "function chunkLength(): int {",
      "  const values: int[] = [1, 2, 3];",
      "  const span = new Span<int>(values);",
      "  const offset: int = 0;",
      "  const chunkSize: int = 2;",
      "  const remaining = span.Length - offset;",
      "  const selectedChunkSize = remaining < chunkSize ? remaining : chunkSize;",
      "  const chunk = span.Slice(offset, selectedChunkSize);",
      "  return chunk.Length;",
      "}",
      "Console.WriteLine(`${parts.Length}:${ok}:${first}:${wideValue}:${chunkLength()}`);",
      "",
    ].join("\n"),
  });
  const result = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const output = runGeneratedProject(projectDirectory, "SmokeGeneratedSourceProfile");
  assert.equal(output.trim(), "3:True:todos:2:2");
  const generated = await readFile(resolve(projectDirectory, "out/csharp/src/App.cs"), "utf8");
  assert.match(generated, /path\.Split\("\/"\)/u);
  assert.match(generated, /path\.StartsWith\("\/"\)/u);
  assert.match(generated, /parts\.Length/u);
  assert.match(generated, /parts\[1\]/u);
  assert.match(generated, /public static long wideValue\s*\{\s*get;\s*private set;\s*\} = default\(long\)!;/u);
  assert.match(generated, /wideValue = wideValues\[1\];/u);
  assert.match(generated, /span\.Slice\(offset, selectedChunkSize\)/u);
});

test("CLI pure C# profile infers integral literal local storage for CLR array indexes", async () => {
  const projectDirectory = resolve(tempRoot, "csharp-source-profile-inferred-array-index");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "App.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{
        id: "csharp",
        options: {
          namespace: "Smoke.Generated",
          assemblyName: "SmokeGeneratedInferredArrayIndex",
          outputType: "Exe",
          targetFramework: "net10.0",
        },
      }],
    }, null, 2),
    "src/App.ts": [
      "import { Console } from \"@tsonic/dotnet/System.js\";",
      "",
      "function sum(values: number[]): number {",
      "  let result: number = 0;",
      "  for (let index = 0; index < values.Length; index++) {",
      "    result += values[index];",
      "  }",
      "  return result;",
      "}",
      "",
      "Console.WriteLine(`${sum([1, 2, 3])}`);",
      "",
    ].join("\n"),
  });

  const result = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const generated = await readFile(resolve(projectDirectory, "out/csharp/src/App.cs"), "utf8");
  assert.match(generated, /for \(int index = 0; index < values\.Length; index\+\+\)/u);
  assert.match(generated, /result \+= values\[index\]/u);
  assert.equal(runGeneratedProject(projectDirectory, "SmokeGeneratedInferredArrayIndex").trim(), "6");
});

test("CLI pure C# profile rejects non-integral inferred CLR array indexes", async () => {
  const projectDirectory = resolve(tempRoot, "csharp-source-profile-non-integral-array-index");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "App.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/App.ts": [
      "export function invalid(values: number[]): number {",
      "  const index = 0.5;",
      "  return values[index];",
      "}",
      "",
    ].join("\n"),
  });

  const result = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.notEqual(result.status, 0, result.stdout + result.stderr);
  const output = result.stdout + result.stderr;
  assert.match(output, /ERROR tsonic-csharp:CSHARP_UNSUPPORTED_AST App\.ts:3:17:/u);
  assert.match(output, /No exact C# implicit conversion relates 'source:float64' to 'source:int32'\./u);
  assert.match(output, /Artifacts: 0/u);
});

test("CLI exact provider calls reject conditional arguments with incompatible target carriers", async () => {
  const projectDirectory = resolve(tempRoot, "csharp-source-profile-provider-conditional-reject");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "App.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/App.ts": [
      "import { Span } from \"@tsonic/dotnet/System.js\";",
      "import type { bool, double, int } from \"@tsonic/csharp/types.js\";",
      "",
      "export function invalid(flag: bool, left: int, right: double, span: Span<int>): Span<int> {",
      "  const offset: int = 0;",
      "  const selected = flag ? left : right;",
      "  return span.Slice(offset, selected);",
      "}",
      "",
    ].join("\n"),
  });
  const result = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.notEqual(result.status, 0, result.stdout + result.stderr);
  const output = result.stdout + result.stderr;
  assert.match(output, /ERROR tsonic-csharp:CSHARP_TARGET_CALL_NOT_CLOSED App\.ts:7:10:/u);
  assert.match(output, /Source argument 1 with C# representation 'source:float64' cannot satisfy exact target parameter 'length' with passing mode 'by-value' and representation 'source:int32'\./u);
  assert.match(output, /No exact C# implicit conversion relates 'source:float64' to 'source:int32'\./u);
  assert.match(output, /Artifacts: 0/u);
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
