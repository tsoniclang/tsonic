import { assert, assertRuntimeProjectReference, assertNoRuntimeReference, assertNoInstalledAssemblyReference, cliPath, existsSync, readFile, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";
import { assertExternalCallNotMapped } from "./strings-regexp-date-fixtures.mjs";

test("CLI emits RegExp literals through provider-backed JS runtime carriers", async () => {
  const projectDirectory = resolve(tempRoot, "regexp-literal-carrier");
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
            assemblyName: "SmokeGeneratedRegExpLiteralCarrier",
            outputType: "Exe",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { Console } from \"@tsonic/dotnet/System.js\";",
      "",
      "export function matches(input: string): boolean {",
      "  const expression = /abc/i;",
      "  const constructed = new RegExp(\"xyz\", \"g\");",
      "  return expression.test(input) || constructed.test(input);",
      "}",
      "",
      "const expression = /a.b/s;",
      "Console.WriteLine(`${matches(\"ABC\")}:${matches(\"xyz\")}:${expression.test(\"a\\nb\")}:${expression.source}:${expression.flags}`);",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.RegExp expression = new Tsonic\.CSharp\.Js\.RegExp\("abc", "i"\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.RegExp constructed = new Tsonic\.CSharp\.Js\.RegExp\("xyz", "g"\);/);
  assert.match(generatedSource, /return expression\.testNative\(input\) \|\| constructed\.testNative\(input\);/);
  assert.match(generatedSource, /new Tsonic\.CSharp\.Js\.RegExp\("a\.b", "s"\)/);
  assert.doesNotMatch(generatedSource, /unsupported|invalid/i);

  assert.equal(runGeneratedProject(projectDirectory, "SmokeGeneratedRegExpLiteralCarrier"), "True:True:True:a.b:s\n");
});

test("CLI emits modern RegExp grammar and result metadata", async () => {
  const projectDirectory = resolve(tempRoot, "regexp-modern-result-metadata");
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
            assemblyName: "SmokeGeneratedModernRegExp",
            outputType: "Exe",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { Console } from \"@tsonic/dotnet/System.js\";",
      "",
      "export function describe(value: string): string {",
      "  const result = /(?<name>a)/du.exec(value);",
      "  const name = result?.groups?.name ?? \"\";",
      "  const start = result?.indices?.[0]?.[0] ?? -1;",
      "  const astral = /./u.test(\"😀\");",
      "  return `${name}:${start}:${astral}`;",
      "}",
      "",
      "Console.WriteLine(describe(\"a\"));",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);
  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /new Tsonic\.CSharp\.Js\.RegExp\("\(\?<name>a\)", "du"\)/u);
  assert.doesNotMatch(generatedSource, /unsupported|invalid/i);
  assert.equal(runGeneratedProject(projectDirectory, "SmokeGeneratedModernRegExp"), "a:0:True\n");
});
