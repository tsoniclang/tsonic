import { assert, assertInstalledAssemblyReference, assertNoRuntimeProjectReference, cliPath, existsSync, readFile, repoRoot, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";

test("CLI rejects Record dictionary object spread until dictionary-copy facts exist", async () => {
  const projectDirectory = resolve(tempRoot, "record-dictionary-object-spread-reject");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          surfaces: ["js"],
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function clone(input: Record<string, number>): Record<string, number> {",
      "  return { ...input };",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /Record dictionary object literal spread requires finalized provider dictionary-spread semantics/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
});

test("CLI runs object rest defaults with nested object spread from finalized facts", async () => {
  const projectDirectory = resolve(tempRoot, "object-rest-defaults-nested-spread");
  const assemblyName = "SmokeGeneratedObjectRestDefaultsNestedSpread";
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
            assemblyName,
            outputType: "Exe",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { Console } from \"@tsonic/dotnet/System.js\";",
      "",
      "type Child = { id: number; value: number };",
      "type Source = { label?: string; child: Child; count: number; note: string; extra: number };",
      "type Output = { label: string; child: Child; count: number; note: string; extra: number };",
      "",
      "function rewrite({ label = \"missing\", child, count, ...rest }: Source, value: number): string {",
      "  const updatedChild: Child = { ...child, value };",
      "  const output: Output = { ...rest, label, child: { ...updatedChild }, count };",
      "  return `${output.label}:${output.child.id}:${output.child.value}:${output.count}:${output.note}:${output.extra}`;",
      "}",
      "",
      "const first: Source = { child: { id: 2, value: 3 }, count: 10, note: \"n\", extra: 4 };",
      "const second: Source = { label: \"ready\", child: { id: 5, value: 6 }, count: 11, note: \"m\", extra: 7 };",
      "Console.WriteLine(rewrite(first, 9));",
      "Console.WriteLine(rewrite(second, 8));",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static string rewrite\(__TsonicShape_[A-Za-z0-9_]+ __tsonic_param\d+, double value\)/);
  assert.match(generatedSource, /string label = __tsonic_param\d+\.label \?\? "missing";/);
  assert.match(generatedSource, /__TsonicShape_[A-Za-z0-9_]+ child = __tsonic_param\d+\.child;/);
  assert.match(generatedSource, /__TsonicShape_[A-Za-z0-9_]+ rest = new __TsonicShape_[A-Za-z0-9_]+\s*\{\s*note = __tsonic_param\d+\.note,\s*extra = __tsonic_param\d+\.extra,\s*\};/);
  assert.match(generatedSource, /__TsonicShape_[A-Za-z0-9_]+ updatedChild = new __TsonicShape_[A-Za-z0-9_]+\s*\{\s*id = child\.id,\s*value = value,\s*\};/);
  assert.match(generatedSource, /__TsonicShape_[A-Za-z0-9_]+ output = new __TsonicShape_[A-Za-z0-9_]+\s*\{\s*note = rest\.note,\s*extra = rest\.extra,\s*label = label,\s*child = new __TsonicShape_[A-Za-z0-9_]+[\s\S]*id = updatedChild\.id,\s*value = updatedChild\.value,/);
  assert.doesNotMatch(generatedSource, /__unsupported|InvalidExpression|dynamic|System\.Reflection|GetProperty|GetMethod|MethodInfo\.Invoke|MakeGenericMethod|Activator\.CreateInstance|Assembly\.Load/);

  assert.equal(runGeneratedProject(projectDirectory, assemblyName), [
    "missing:2:9:10:n:4",
    "ready:5:8:11:m:7",
    "",
  ].join("\n"));
});

test("CLI rejects non-identifier object spread until single-evaluation provider lowering exists", async () => {
  const projectDirectory = resolve(tempRoot, "object-spread-single-evaluation");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/index.ts": [
      "type Box = { value: number };",
      "",
      "export function clone(create: () => Box): Box {",
      "  return { ...create() };",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /Object literal spread requires a single-evaluation provider lowering/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
});
