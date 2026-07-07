import { assert, cliPath, existsSync, readFile, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "./harness.mjs";

test("CLI runs array fixed default rest and nested destructuring from finalized carrier facts", async () => {
  const assemblyName = "SmokeGeneratedArrayBindingFacts";
  const projectDirectory = resolve(tempRoot, "arrays-binding-facts");
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
      "function fixed(values: int[]): int {",
      "  const [first, second] = values;",
      "  return first + second;",
      "}",
      "",
      "function defaults(values: int[]): int {",
      "  const [first = 10, second = 20] = values;",
      "  return first + second;",
      "}",
      "",
      "function rest(values: int[]): int {",
      "  const [first, ...tail] = values;",
      "  return first + tail.length;",
      "}",
      "",
      "function nested(values: int[][]): int {",
      "  const [[first], [, second]] = values;",
      "  return first + second;",
      "}",
      "",
      "const fixedInput: int[] = [1, 2];",
      "const defaultInput: int[] = [];",
      "const restInput: int[] = [4, 5, 6];",
      "const nestedInput: int[][] = [[7], [0, 8]];",
      "Console.WriteLine(`${fixed(fixedInput)}|${defaults(defaultInput)}|${rest(restInput)}|${nested(nestedInput)}`);",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /int first = __tsonic_destructure\d+\[0\];/);
  assert.match(generatedSource, /int second = __tsonic_destructure\d+\[1\];/);
  assert.match(generatedSource, /int first = (__tsonic_destructure\d+)\.Count > 0 \? \1\[0\] : 10;/);
  assert.match(generatedSource, /int second = (__tsonic_destructure\d+)\.Count > 1 \? \1\[1\] : 20;/);
  assert.match(generatedSource, /System\.Collections\.Generic\.List<int> tail = Tsonic\.CSharp\.Js\.Array\.slice\(__tsonic_destructure\d+, 1\);/);
  assert.match(generatedSource, /return first \+ tail\.Count;/);
  assert.doesNotMatch(generatedSource, /__unsupported|InvalidExpression|dynamic|System\.Reflection/);

  assert.equal(runGeneratedProject(projectDirectory, assemblyName), "3|30|6|15\n");
});

test("CLI runs array parameter destructuring from real TSTS binding facts", async () => {
  const assemblyName = "SmokeGeneratedArrayParameterBindingFacts";
  const projectDirectory = resolve(tempRoot, "arrays-parameter-binding-facts");
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
      "",
      "function sum([first = 10, second = 20, ...rest]: number[]): number {",
      "  return first + second + rest.length;",
      "}",
      "",
      "function nested([[first], [, second]]: number[][]): number {",
      "  return first + second;",
      "}",
      "",
      "Console.WriteLine(`${sum([1, 2, 3, 4])}|${sum([])}|${nested([[7], [0, 8]])}`);",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static double sum\(System\.Collections\.Generic\.IReadOnlyList<double> __tsonic_param\d+\)/);
  assert.match(generatedSource, /double first = __tsonic_param\d+\.Count > 0 \? __tsonic_param\d+\[0\] : 10;/);
  assert.match(generatedSource, /double second = __tsonic_param\d+\.Count > 1 \? __tsonic_param\d+\[1\] : 20;/);
  assert.match(generatedSource, /System\.Collections\.Generic\.List<double> rest = Tsonic\.CSharp\.Js\.Array\.slice\(__tsonic_param\d+, 2\);/);
  assert.match(generatedSource, /public static double nested\(System\.Collections\.Generic\.IReadOnlyList<double\[\]> __tsonic_param\d+\)/);
  assert.doesNotMatch(generatedSource, /__unsupported|InvalidExpression|dynamic|System\.Reflection/);

  assert.equal(runGeneratedProject(projectDirectory, assemblyName), "5|30|15\n");
});

