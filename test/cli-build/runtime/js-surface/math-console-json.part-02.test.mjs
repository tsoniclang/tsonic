import { assert, assertRuntimeProjectReference, assertNoRuntimeReference, assertNoInstalledAssemblyReference, cliPath, existsSync, readFile, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";
import { assertExternalCallNotMapped } from "./math-console-json.split-fixtures.mjs";

test("CLI compiles existing TypeScript JS-surface utility code when JS surface is selected", async () => {
  const projectDirectory = resolve(tempRoot, "existing-typescript-js-surface-utility-code");
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
            assemblyName: "SmokeGeneratedExistingTypescriptJsSurfaceUtilityCode",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function appendTag(tags: string[], tag: string): string[] {",
      "  tags.push(tag);",
      "  return tags;",
      "}",
      "",
      "export function summarize(values: number[]): number {",
      "  const first = values.at(0) ?? 0;",
      "  const last = values.at(values.length - 1) ?? 0;",
      "  return Math.trunc(Math.max(first, last));",
      "}",
      "",
      "export function stringifyCount(count: number): string {",
      "  return JSON.stringify(count);",
      "}",
      "",
      "export function normalizeName(name: string): string {",
      "  return name.trim().toUpperCase().slice(0, 8);",
      "}",
      "",
      "export function renderRecord(values: Record<string, number>): string {",
      "  return Object.keys(values).join(\",\");",
      "}",
      "",
      "export function splitAndJoin(input: string): string {",
      "  return input.split(\":\").join(\"|\");",
      "}",
      "",
      "export function acceptsUser(input: string): boolean {",
      "  return /^user:/i.test(input);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedProject = await readFile(resolve(projectDirectory, "out/csharp/SmokeGeneratedExistingTypescriptJsSurfaceUtilityCode.csproj"), "utf8");
  assertRuntimeProjectReference(generatedProject, "Tsonic.CSharp.Runtime");
  assertNoInstalledAssemblyReference(generatedProject, "Tsonic.CSharp.Runtime");
  assertRuntimeProjectReference(generatedProject, "Tsonic.CSharp.Js");
  assertNoInstalledAssemblyReference(generatedProject, "Tsonic.CSharp.Js");
  assertNoRuntimeReference(generatedProject, "Tsonic.CSharp.Node");
  assertNoInstalledAssemblyReference(generatedProject, "Tsonic.CSharp.Node");

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static Tsonic\.CSharp\.Js\.JSArray<string> appendTag\(Tsonic\.CSharp\.Js\.JSArray<string> tags, string tag\)/);
  assert.match(generatedSource, /tags\.push\(tag\);/);
  assert.match(generatedSource, /public static double summarize\(Tsonic\.CSharp\.Js\.JSArray<double> values\)/);
  assert.match(generatedSource, /double first = Tsonic\.CSharp\.Js\.Array\.atValue\(values, 0\) \?\? 0D;/);
  assert.match(generatedSource, /double last = Tsonic\.CSharp\.Js\.Array\.atValue\(values, values\.length - 1\) \?\? 0D;/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Math\.trunc\(Tsonic\.CSharp\.Js\.Math\.max\(first, last\)\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.JSON\.stringify\(count\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.String\.slice\(Tsonic\.CSharp\.Js\.String\.toUpperCase\(Tsonic\.CSharp\.Js\.String\.trim\(name\)\), 0, 8\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Array\.join\(Tsonic\.CSharp\.Js\.Object\.keys\(values\), ","\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Array\.join\(Tsonic\.CSharp\.Js\.String\.split\(input, ":"\), "\|"\);/);
  assert.match(generatedSource, /return new Tsonic\.CSharp\.Js\.RegExp\("\^user:", "i"\)\.testNative\(input\);/);
  assert.doesNotMatch(generatedSource, /return Math\./);
  assert.doesNotMatch(generatedSource, /return Object\./);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedExistingTypescriptJsSurfaceUtilityCode.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI rejects Math without selected JS surface facts", async () => {
  const projectDirectory = resolve(tempRoot, "math-without-js-surface");
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
            assemblyName: "SmokeGeneratedMathWithoutJsSurface",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function roundDown(value: number): number {",
      "  return Math.trunc(value);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assertExternalCallNotMapped(build.stderr, "trunc");
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedMathWithoutJsSurface.csproj")), false);
});

test("CLI rejects Math.f16round because the current TSTS default library does not expose it", async () => {
  const projectDirectory = resolve(tempRoot, "math-f16round-current-lib-exclusion");
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
            assemblyName: "SmokeGeneratedMathF16RoundCurrentLibExclusion",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function rounded(value: number): number {",
      "  return Math.f16round(value);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stdout + build.stderr, /Property 'f16round' does not exist on type 'Math'/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedMathF16RoundCurrentLibExclusion.csproj")), false);
});
