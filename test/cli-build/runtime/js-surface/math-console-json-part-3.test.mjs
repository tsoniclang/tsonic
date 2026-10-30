import { assert, assertRuntimeProjectReference, assertNoRuntimeReference, assertNoInstalledAssemblyReference, cliPath, existsSync, readFile, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";
import { assertExternalCallNotMapped } from "./math-console-json-fixtures.mjs";

test("CLI emits JSON.stringify from selected JS surface facts", async () => {
  const projectDirectory = resolve(tempRoot, "standard-json-stringify");
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
            assemblyName: "SmokeGeneratedStandardJsonStringify",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function stringifyText(value: string): string {",
      "  return JSON.stringify(value);",
      "}",
      "",
      "export function stringifyNumber(value: number): string {",
      "  return JSON.stringify(value);",
      "}",
      "",
      "export function stringifyBool(value: boolean): string {",
      "  return JSON.stringify(value);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedProject = await readFile(resolve(projectDirectory, "out/csharp/SmokeGeneratedStandardJsonStringify.csproj"), "utf8");
  assertRuntimeProjectReference(generatedProject, "Tsonic.CSharp.Js");
  assertNoInstalledAssemblyReference(generatedProject, "Tsonic.CSharp.Js");

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static string stringifyText\(string value\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.JSON\.stringify\(value\);/);
  assert.match(generatedSource, /public static string stringifyNumber\(double value\)/);
  assert.match(generatedSource, /public static string stringifyBool\(bool value\)/);
  assert.doesNotMatch(generatedSource, /JSON\.stringify\(.*dynamic/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedStandardJsonStringify.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI finalizes interface-backed JSON shapes and dynamic-property typeof checks after all object shapes are known", async () => {
  const projectDirectory = resolve(tempRoot, "json-interface-shape-finalization");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{
        id: "csharp",
        surfaces: ["js"],
        options: {
          namespace: "Smoke.Generated",
          assemblyName: "SmokeGeneratedJsonInterfaceShapeFinalization",
        },
      }],
    }, null, 2),
    "src/index.ts": [
      "export interface Todo {",
      "  id: number;",
      "  title: string;",
      "  completed: boolean;",
      "}",
      "",
      "export function createTodos(): Todo[] {",
      "  const first: Todo = { id: 1, title: \"first\", completed: false };",
      "  const second: Todo = { id: 2, title: \"second\", completed: true };",
      "  return [first, second];",
      "}",
      "",
      "export function serializeTodos(values: Todo[]): string {",
      "  return JSON.stringify(values);",
      "}",
      "",
      "export function readTitle(text: string): string | undefined {",
      "  const value = JSON.parse(text) as { title?: unknown };",
      "  if (typeof value.title !== \"string\") return undefined;",
      "  return value.title;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  const generatedShapes = await readFile(resolve(projectDirectory, "out/csharp/generated/TsonicObjectShapes.cs"), "utf8");
  const generatedShape = generatedShapes.match(/public class (TodoShape_[a-f0-9]{12}) : Todo, Tsonic\.CSharp\.Js\.IJsonValue/u);
  assert.notEqual(generatedShape, null, generatedShapes);
  assert.equal(generatedShapes.match(/public class TodoShape_[a-f0-9]{12} : Todo, Tsonic\.CSharp\.Js\.IJsonValue/gu)?.length, 1);
  assert.equal(generatedSource.match(new RegExp(`new ${generatedShape[1]}`, "gu"))?.length, 2);
  assert.match(generatedSource, /public interface Todo : Tsonic\.CSharp\.Js\.IJsonValue\s*\{\s*double id \{ get; set; \}\s*string title \{ get; set; \}\s*bool completed \{ get; set; \}\s*\}/u);
  assert.equal(generatedShapes.match(/void __tsonicWriteJson\(/gu)?.length, 1);
  assert.match(generatedSource, /TsValue\.ApplyDynamicTypeof\(value\.ReadDynamicSlot\("title"\)\) != "string"/u);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedJsonInterfaceShapeFinalization.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});
