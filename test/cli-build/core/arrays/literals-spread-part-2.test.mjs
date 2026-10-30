import { access } from "node:fs/promises";
import { assert, cliPath, readFile, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";
import { assertArraySpreadCopies } from "./literals-spread-fixtures.mjs";

test("CLI emits module-scope array spread constants from finalized expected array facts", async () => {
  const projectDirectory = resolve(tempRoot, "arrays-module-spread-constants");
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
            assemblyName: "SmokeGeneratedArraysModuleSpreadConstants",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int } from \"@tsonic/csharp/types.js\";",
      "",
      "const source: int[] = [1, 2, 3];",
      "export const withSpread: int[] = [...source, 4, 5];",
      "",
      "const more: int[] = [10, 20];",
      "export const multiSpread: int[] = [...source, ...more, 100];",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static Tsonic\.CSharp\.Js\.JSArray<int> source/);
  assert.match(generatedSource, /source = Tsonic\.CSharp\.Js\.JSArray<int>\.of\(\[1, 2, 3\]\);/);
  const copies = assertArraySpreadCopies(generatedSource, [
    "global::Smoke.Generated.Index.source",
    "global::Smoke.Generated.Index.source",
    "global::Smoke.Generated.Index.more",
  ]);
  assert.match(generatedSource, new RegExp(`withSpread = ${copies[0]}\\.AppendElement\\(4\\)\\.AppendElement\\(5\\);`));
  assert.match(generatedSource, /public static Tsonic\.CSharp\.Js\.JSArray<int> more/);
  assert.match(generatedSource, /more = Tsonic\.CSharp\.Js\.JSArray<int>\.of\(\[10, 20\]\);/);
  assert.match(generatedSource, new RegExp(`${copies[2]} = ${copies[1]};`));
  assert.match(generatedSource, new RegExp(`multiSpread = ${copies[2]}\\.AppendElement\\(100\\);`));
  assert.equal((generatedSource.match(/new Tsonic\.CSharp\.Js\.JSArray<int>\(\)/gu) ?? []).length, 2);
  assert.doesNotMatch(generatedSource, /\.concat\(/u);
  assert.doesNotMatch(generatedSource, /__unsupported|InvalidExpression/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedArraysModuleSpreadConstants.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI runs tuple spread into arrays from finalized tuple carrier facts", async () => {
  const assemblyName = "SmokeGeneratedTupleArraySpread";
  const projectDirectory = resolve(tempRoot, "arrays-tuple-spread");
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
      "import { Console } from \"@tsonic/dotnet/System.js\";",
      "import type { int } from \"@tsonic/csharp/types.js\";",
      "",
      "function compose(pair: [int, int]): int[] {",
      "  return [1, ...pair, 4];",
      "}",
      "",
      "const values = compose([2, 3]);",
      "Console.WriteLine(`${values.length}:${values[0]}:${values[1]}:${values[2]}:${values[3]}`);",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.JSArray<int> (?<destination>_*tsonic_sequence_destination) = new Tsonic\.CSharp\.Js\.JSArray<int>\(\)\.AppendElement\(1\);\s*\(int, int\) (?<pair>_*tsonic_sequence_[0-9]+) = pair;\s*\k<destination>\.EnsureCapacity\(checked\(\k<destination>\.Count \+ 2\)\);\s*\k<destination>\.Add\(\k<pair>\.Item1\);\s*\k<destination>\.Add\(\k<pair>\.Item2\);\s*return \k<destination>\.AppendElement\(4\);/u);
  assert.doesNotMatch(generatedSource, /\.concat\(|new int\[\]/u);
  assert.match(generatedSource, /public static Tsonic\.CSharp\.Js\.JSArray<int> values/);
  assert.match(generatedSource, /values = global::Smoke\.Generated\.Index\.compose\(\(2, 3\)\);/);
  assert.doesNotMatch(generatedSource, /__unsupported|InvalidExpression|dynamic|System\.Reflection/);

  assert.equal(runGeneratedProject(projectDirectory, assemblyName), "4:1:2:3:4\n");
});
