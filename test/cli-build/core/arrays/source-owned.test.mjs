import { assert, cliPath, existsSync, readFile, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";

test("CLI runs inferred source-owned array returns through finalized carrier facts", async () => {
  const assemblyName = "SmokeGeneratedInferredArrayReturns";
  const projectDirectory = resolve(tempRoot, "arrays-inferred-return-carrier");
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
      "export function make(value: int) {",
      "  return [value, value + 1];",
      "}",
      "",
      "export function nested(value: int) {",
      "  return [[value], [value + 1]];",
      "}",
      "",
      "const values = make(4);",
      "const nestedValues = nested(6);",
      "Console.WriteLine(`${values[0]}|${values.length}|${nestedValues[1][0]}`);",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static Tsonic\.CSharp\.Js\.JSArray<double> make\(int value\)/);
  assert.match(generatedSource, /return new Tsonic\.CSharp\.Js\.JSArray<double>\(new double\[\] \{ value, value \+ 1 \}\);/);
  assert.match(generatedSource, /public static Tsonic\.CSharp\.Js\.JSArray<Tsonic\.CSharp\.Js\.JSArray<double>> nested\(int value\)/);
  assert.match(generatedSource, /public static Tsonic\.CSharp\.Js\.JSArray<double> values/);
  assert.match(generatedSource, /public static Tsonic\.CSharp\.Js\.JSArray<Tsonic\.CSharp\.Js\.JSArray<double>> nestedValues/);
  assert.match(generatedSource, /values\.length/);
  assert.doesNotMatch(generatedSource, /__unsupported|InvalidExpression|dynamic|System\.Reflection/);

  assert.equal(runGeneratedProject(projectDirectory, assemblyName), "4|2|7\n");
});
