import { access } from "node:fs/promises";
import { assert, cliPath, readFile, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";
import { assertArraySpreadCopies } from "./literals-spread-fixtures.mjs";

test("CLI rejects an untyped empty-array return without borrowing its element type from callers", async () => {
  const projectDirectory = resolve(tempRoot, "arrays-empty-never-return");
  const assemblyName = "SmokeGeneratedArraysEmptyNeverReturn";
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
      "export function f() {",
      "  return [];",
      "}",
      "Console.WriteLine(f().length);",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  const output = build.stdout + build.stderr;
  assert.notEqual(build.status, 0, "the original unannotated empty-array source remains refused");
  assert.match(output, /TSONIC_UNTYPED_ARRAY_LITERAL index\.ts:3:10/u,
    "the original empty array owns the exact declared-type refusal");
  assert.match(output, /This empty array has no element type\. Declare one, e\.g\. 'function emptyBuffer\(\): number\[\]'\./u,
    "the refusal keeps its exact own-declaration guidance");
  assert.match(output, /Artifacts: 0/u, "the rejected source produces no successful artifacts");
  await assert.rejects(access(resolve(projectDirectory, "out/csharp")), { code: "ENOENT" },
    "no generated native project or partial sources are published");
});

test("CLI executes declared and generic empty arrays with exact native width, alias identity and one evaluation", async () => {
  const projectDirectory = resolve(tempRoot, "arrays-declared-generic-empty-return");
  const assemblyName = "SmokeGeneratedArraysDeclaredGenericEmptyReturn";
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{
        id: "csharp",
        surfaces: ["js"],
        options: { namespace: "Smoke.Generated", assemblyName, outputType: "Exe" },
      }],
    }, null, 2),
    "src/index.ts": [
      "import { Console } from \"@tsonic/dotnet/System.js\";",
      "import type { int } from \"@tsonic/csharp/types.js\";",
      "let evaluations: int = 0;",
      "export function f(): int[] { evaluations += 1; return []; }",
      "export function empty<Value>(): Value[] { return []; }",
      "const values = f();",
      "const alias = values;",
      "const generic = empty<int>();",
      "const maximum: int = 2147483647;",
      "alias.push(maximum);",
      "generic.push(maximum);",
      "Console.WriteLine(`${evaluations}:${values === alias ? 1 : 0}:${values[0]}:${generic[0]}`);",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);
  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static Tsonic\.CSharp\.Js\.JSArray<int> f\(\)/u,
    "the empty array keeps its own declared native int32 element ABI");
  assert.match(generatedSource, /public static Tsonic\.CSharp\.Js\.JSArray<Value> empty<Value>\(\)/u,
    "the generic empty array keeps its declared element binder");
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.JSArray<int>\.of\(\[\]\);/u);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.JSArray<Value>\.of\(\[\]\);/u);
  assert.doesNotMatch(generatedSource, /JSArray<(?:Never|object|dynamic|TsValue|double)>|__unsupported|InvalidExpression|System\.Reflection/u);
  assert.equal(runGeneratedProject(projectDirectory, assemblyName), "1:1:2147483647:2147483647\n",
    "native execution retains one producer evaluation, shared mutation identity and both exact integer values");
});
