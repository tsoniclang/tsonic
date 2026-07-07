import { assert, cliPath, existsSync, readFile, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "./harness.mjs";

test("CLI emits native .NET array element access and JS-selected length facts", async () => {
  const projectDirectory = resolve(tempRoot, "arrays-native-provider");
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
            assemblyName: "SmokeGeneratedArraysNativeProvider",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int } from \"@tsonic/csharp/types.js\";",
      "import { BinaryReader, MemoryStream } from \"@tsonic/dotnet/System.IO.js\";",
      "",
      "export function readFirstPlusLength(): int {",
      "  const stream = new MemoryStream([65, 66]);",
      "  const reader = new BinaryReader(stream);",
      "  const bytes = reader.ReadBytes(2);",
      "  return bytes[0] + bytes.length;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /new System\.IO\.MemoryStream\(new byte\[\] \{ 65, 66 \}\)/);
  assert.match(generatedSource, /byte\[\] bytes = reader\.ReadBytes\(2\);/);
  assert.match(generatedSource, /return bytes\[0\] \+ bytes\.Length;/);
  assert.doesNotMatch(generatedSource, /__unsupported|InvalidExpression/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedArraysNativeProvider.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI rejects native array length without selected JS or provider facts", async () => {
  const projectDirectory = resolve(tempRoot, "arrays-native-length-requires-facts");
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
            assemblyName: "SmokeGeneratedArraysNativeLengthRequiresFacts",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int } from \"@tsonic/csharp/types.js\";",
      "import { BinaryReader, MemoryStream } from \"@tsonic/dotnet/System.IO.js\";",
      "",
      "export function readLength(): int {",
      "  const stream = new MemoryStream([65, 66]);",
      "  const reader = new BinaryReader(stream);",
      "  const bytes = reader.ReadBytes(2);",
      "  return bytes.length;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /TS2551: Property 'length' does not exist on type 'number\[\]'/);
  assert.match(build.stderr, /Did you mean 'Length'/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedArraysNativeLengthRequiresFacts.csproj")), false);
});
