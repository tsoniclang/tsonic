import { assert, assertRuntimeProjectReference, assertNoInstalledAssemblyReference, cliPath, existsSync, readFile, repoRoot, resolve, run, runGeneratedCsharpRunner, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";

test("CLI executes Record dictionary object spread as an independent native dictionary copy", async () => {
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
  assert.equal(build.status, 0, build.stdout + build.stderr);
  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static System\.Collections\.Generic\.Dictionary<string, double> clone\(System\.Collections\.Generic\.Dictionary<string, double> input\)\s*\{\s*return new System\.Collections\.Generic\.Dictionary<string, double>\(input\);\s*\}/u);
  assert.doesNotMatch(generatedSource, /__unsupported|InvalidExpression|dynamic|System\.Reflection|JSRecord/u);
  assert.equal(await runGeneratedCsharpRunner(projectDirectory, "TsonicGenerated", [
    "using System;",
    "using System.Collections.Generic;",
    "public static class Program",
    "{",
    "    public static void Main()",
    "    {",
    "        var input = new Dictionary<string, double> { [\"value\"] = 3, [\"other\"] = 5 };",
    "        var copy = Tsonic.Generated.Index.clone(input);",
    "        copy[\"value\"] = 8;",
    "        input[\"later\"] = 9;",
    "        Console.WriteLine($\"{input[\"value\"]}:{copy[\"value\"]}:{copy.Count}:{input.Count}:{ReferenceEquals(input, copy)}\");",
    "        Console.WriteLine(Tsonic.Generated.Index.clone(new Dictionary<string, double>()).Count);",
    "    }",
    "}",
  ]), "3:8:2:3:False\n0\n");
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
  assert.match(generatedSource, /public static string rewrite\(ObjectShape_[a-f0-9]{12}<ObjectShape_[a-f0-9]{12}<double, double>, double, double, string\?, string> __tsonic_param\d+, double value\)/);
  assert.match(generatedSource, /string label = __tsonic_param\d+\.label is string (?<label>__tsonic_value\d+) \? \k<label> : "missing";/);
  assert.match(generatedSource, /[A-Za-z][A-Za-z0-9_]*Shape_[a-f0-9]{12}<double, double> child = __tsonic_param\d+\.child;/);
  assert.match(generatedSource, /[A-Za-z][A-Za-z0-9_]*Shape_[a-f0-9]{12} rest = new [A-Za-z][A-Za-z0-9_]*Shape_[a-f0-9]{12}\s*\{\s*note = __tsonic_param\d+\.note,\s*extra = __tsonic_param\d+\.extra,\s*\};/);
  assert.match(generatedSource, /(?<shape>[A-Za-z][A-Za-z0-9_]*Shape_[a-f0-9]{12}<double, double>) (?<child>__tsonic_value_\d+) = child;\s*double (?<id>_*tsonic_value_\d+) = \k<child>\.id;\s*double (?<value>_*tsonic_value_\d+) = \k<child>\.value;\s*\k<value> = value;\s*\k<shape> updatedChild = new [A-Za-z][A-Za-z0-9_]*Shape_[a-f0-9]{12}\s*\{\s*id = \k<id>,\s*value = \k<value>,\s*\};/);
  assert.match(generatedSource, new RegExp([
    "ObjectShape_[a-f0-9]{12} (?<rest>__tsonic_value_\\d+) = rest;",
    "string (?<note>_*tsonic_value_\\d+) = \\k<rest>\\.note;",
    "double (?<extra>_*tsonic_value_\\d+) = \\k<rest>\\.extra;",
    "string (?<label>_*tsonic_value_\\d+) = label;",
    "(?<shape>ObjectShape_[a-f0-9]{12}<double, double>) (?<child>__tsonic_value_\\d+) = updatedChild;",
    "double (?<id>_*tsonic_value_\\d+) = \\k<child>\\.id;",
    "double (?<value>_*tsonic_value_\\d+) = \\k<child>\\.value;",
    "\\k<shape> (?<copy>_*tsonic_value_\\d+) = new ObjectShape_[a-f0-9]{12}",
    "\\{\\s*id = \\k<id>,\\s*value = \\k<value>,\\s*\\};",
    "double (?<count>_*tsonic_value_\\d+) = count;",
    "ObjectShape_[a-f0-9]{12}<\\k<shape>, double, double, string, string> output = new ObjectShape_[a-f0-9]{12}",
    "\\{\\s*note = \\k<note>,\\s*extra = \\k<extra>,\\s*label = \\k<label>,\\s*child = \\k<copy>,\\s*count = \\k<count>,\\s*\\};",
  ].join("\\s*"), "u"));
  assert.doesNotMatch(generatedSource, /__unsupported|InvalidExpression|dynamic|System\.Reflection|GetProperty|GetMethod|MethodInfo\.Invoke|MakeGenericMethod|Activator\.CreateInstance|Assembly\.Load/);

  assert.equal(runGeneratedProject(projectDirectory, assemblyName), [
    "missing:2:9:10:n:4",
    "ready:5:8:11:m:7",
    "",
  ].join("\n"));
});

test("CLI executes non-identifier object spread with one exact selected source evaluation", async () => {
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
  assert.equal(build.status, 0, build.stdout + build.stderr);
  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.equal((generatedSource.match(/create\(\)/gu) ?? []).length, 1);
  const constructed = /return new (?<shape>ObjectShape_[a-f0-9]{12})\s*\{\s*value = create\(\)\.value,\s*\};/u.exec(generatedSource);
  assert.equal(constructed !== null, true, "single checked object-spread construction");
  assert.doesNotMatch(generatedSource, /__unsupported|InvalidExpression|dynamic|System\.Reflection/u);
  assert.equal(await runGeneratedCsharpRunner(projectDirectory, "TsonicGenerated", [
    "using System;",
    "public static class Program",
    "{",
    "    public static void Main()",
    "    {",
    `        var input = new Tsonic.Generated.${constructed.groups.shape} { value = 11 };`,
    "        var evaluations = 0;",
    "        var copy = Tsonic.Generated.Index.clone(() => { evaluations++; return input; });",
    "        input.value = 13;",
    "        Console.WriteLine($\"{evaluations}:{copy.value}:{input.value}:{ReferenceEquals(input, copy)}\");",
    "    }",
    "}",
  ]), "1:11:13:False\n");
});

test("CLI rejects object spread without a checked object operand before artifact publication", async () => {
  const projectDirectory = resolve(tempRoot, "object-spread-unchecked-operand");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/index.ts": [
      "export function clone(input: unknown) {",
      "  return { ...input };",
      "}",
      "",
    ].join("\n"),
  });
  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /TS2698: Spread types may only be created from object types/u);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/src/Index.cs")), false);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
});
