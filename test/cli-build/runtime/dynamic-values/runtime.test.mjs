import { assert, assertRuntimeProjectReference, assertNoRuntimeReference, assertNoInstalledAssemblyReference, cliPath, csharpProjectPath, existsSync, readFile, resolve, run, runGeneratedCsharpRunner, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";

async function readGeneratedModuleSource(projectDirectory) {
  return readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
}

async function readGeneratedProject(projectDirectory, assemblyName) {
  return readFile(csharpProjectPath(projectDirectory, assemblyName), "utf8");
}

test("CLI emits closed dynamic-value operations for explicit TypeScript any without selecting the JS surface", async () => {
  const projectDirectory = resolve(tempRoot, "dynamic-values-any-operations");
  const assemblyName = "SmokeGeneratedDynamicValuesAnyOperations";
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
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function readName(value: any): any {",
      "  return value.name;",
      "}",
      "",
      "export function writeName(value: any): any {",
      "  value.name = \"Ada\";",
      "  return value.name;",
      "}",
      "",
      "export function readElement(value: any, key: string): any {",
      "  return value[key];",
      "}",
      "",
      "export function writeElement(value: any, key: string): any {",
      "  value[key] = \"Grace\";",
      "  return value[key];",
      "}",
      "",
      "export function callValue(value: any): any {",
      "  return value(\"Ada\", 1);",
      "}",
      "",
      "export function callMember(value: any): any {",
      "  return value.create(\"Ada\");",
      "}",
      "",
      "export function constructValue(value: any): any {",
      "  return new value(\"Ada\");",
      "}",
      "",
      "export function addValue(value: any): any {",
      "  return value + 2;",
      "}",
      "",
      "export function equalValue(value: any): boolean {",
      "  return value === 2;",
      "}",
      "",
      "class Marker {}",
      "",
      "export function instanceOfMarker(value: any): boolean {",
      "  return value instanceof Marker;",
      "}",
      "",
      "export function notValue(value: any): boolean {",
      "  return !value;",
      "}",
      "",
      "export function typeOfValue(value: any): string {",
      "  return typeof value;",
      "}",
      "",
      "export function voidValue(value: any): any {",
      "  return void value.name;",
      "}",
      "",
      "export function typedReturn(value: any): number {",
      "  return value;",
      "}",
      "",
      "export function typedInitializer(value: any): number {",
      "  const result: number = value;",
      "  return result;",
      "}",
      "",
      "export function typedAssignment(value: any): number {",
      "  let result: number = 0;",
      "  result = value;",
      "  return result;",
      "}",
      "",
      "export function boxedReturn(value: number): any {",
      "  return value;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedProject = await readGeneratedProject(projectDirectory, assemblyName);
  assertRuntimeProjectReference(generatedProject, "Tsonic.CSharp.Runtime");
  assertNoInstalledAssemblyReference(generatedProject, "Tsonic.CSharp.Runtime");
  assertNoRuntimeReference(generatedProject, "Tsonic.CSharp.Js");

  const generatedSource = await readGeneratedModuleSource(projectDirectory);
  assert.match(generatedSource, /public static Tsonic\.CSharp\.Runtime\.TsValue readName\(Tsonic\.CSharp\.Runtime\.TsValue value\)/);
  assert.match(generatedSource, /return value\.ReadDynamicSlot\("name"\);/);
  assert.match(generatedSource, /value\.WriteDynamicSlot\("name", "Ada"\);/);
  assert.match(generatedSource, /return value\.ReadDynamicElement\(key\);/);
  assert.match(generatedSource, /value\.WriteDynamicElement\(key, "Grace"\);/);
  assert.match(generatedSource, /return value\.InvokeDynamic\("Ada", 1\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Runtime\.TsValue (?<receiver>__tsonic_value_\d+) = value;\s*return \k<receiver>\.ReadDynamicSlot\("create"\)\.InvokeDynamicWithThis\(\k<receiver>, "Ada"\);/);
  assert.doesNotMatch(generatedSource, /InvokeDynamicSlot|new object\?\[\]/);
  assert.match(generatedSource, /return value\.ConstructDynamic\("Ada"\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Runtime\.TsValue\.ApplyDynamicBinary\(value, "\+", 2\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Runtime\.TsValue\.ApplyDynamicBinaryBoolean\(value, "===", 2\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Runtime\.TsValue\.IsDynamicInstanceOf<Marker>\(value\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Runtime\.TsValue\.ApplyDynamicUnaryBoolean\(value, "!"\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Runtime\.TsValue\.ApplyDynamicTypeof\(value\);/);
  assert.match(generatedSource, /public static Tsonic\.CSharp\.Runtime\.TsValue voidValue\(Tsonic\.CSharp\.Runtime\.TsValue value\)\s*\{\s*value\.ReadDynamicSlot\("name"\);\s*return default\(Tsonic\.CSharp\.Runtime\.TsValue\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Runtime\.TsValue\.CastDynamic<double>\(value\);/);
  assert.match(generatedSource, /double result = Tsonic\.CSharp\.Runtime\.TsValue\.CastDynamic<double>\(value\);/);
  assert.match(generatedSource, /result = Tsonic\.CSharp\.Runtime\.TsValue\.CastDynamic<double>\(value\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Runtime\.TsValue\.from\(value\);/);
  assert.doesNotMatch(generatedSource, /dynamic|System\.Reflection|GetProperty|GetMethod|MethodInfo\.Invoke|Activator\.CreateInstance|Assembly\.Load|__unsupported/);

  const dotnet = run("dotnet", ["build", csharpProjectPath(projectDirectory, assemblyName), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI hard-rejects explicit any object destructuring without closed extraction facts ", async () => {
  const projectDirectory = resolve(tempRoot, "dynamic-values-any-object-destructuring-reject");
  const assemblyName = "SmokeGeneratedDynamicValuesAnyObjectDestructuringReject";
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
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function pick(value: any): any {",
      "  const { name, ...rest } = value;",
      "  return rest;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  const output = build.stdout + build.stderr;
  assert.notEqual(build.status, 0);
  assert.match(output, /index\.ts:2:9: Object destructuring requires an exact source-owned declaration or target object-shape policy/u);
  assert.equal(existsSync(csharpProjectPath(projectDirectory, assemblyName)), false);
});

test("CLI hard-rejects explicit any object spread without closed object-shape facts ", async () => {
  const projectDirectory = resolve(tempRoot, "dynamic-values-any-object-spread-reject");
  const assemblyName = "SmokeGeneratedDynamicValuesAnyObjectSpreadReject";
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
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "type Output = { name: string };",
      "",
      "export function clone(value: any): Output {",
      "  return { ...value };",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  const output = build.stdout + build.stderr;
  assert.notEqual(build.status, 0);
  assert.match(output, /Object literal spread requires finalized provider object-shape facts/u);
  assert.equal(existsSync(csharpProjectPath(projectDirectory, assemblyName)), false);
});

test("CLI hard-rejects explicit any array spread without closed array carrier facts ", async () => {
  const projectDirectory = resolve(tempRoot, "dynamic-values-any-array-spread-reject");
  const assemblyName = "SmokeGeneratedDynamicValuesAnyArraySpreadReject";
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
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function clone(value: any): any[] {",
      "  return [...value];",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  const output = build.stdout + build.stderr;
  assert.notEqual(build.status, 0);
  assert.match(output, /Array spread requires an exact native sequence and sealed destination element conversions/u);
  assert.match(output, /Artifacts: 0/u);
  assert.match(output, /index\.ts:2:11/u);
  assert.equal(existsSync(csharpProjectPath(projectDirectory, assemblyName)), false);
});

test("CLI hard-rejects unsupported explicit any operators ", async () => {
  const projectDirectory = resolve(tempRoot, "dynamic-values-any-operator-reject");
  const assemblyName = "SmokeGeneratedDynamicValuesAnyOperatorReject";
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
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function shift(value: any): any {",
      "  return value << 1;",
      "}",
      "",
      "export function has(value: any): boolean {",
      "  return \"name\" in value;",
      "}",
      "",
      "export function addAssign(value: any): any {",
      "  return value += 1;",
      "}",
      "",
      "export function exponent(value: any): any {",
      "  return value ** 2;",
      "}",
      "",
      "export function exponentAssign(value: any): any {",
      "  return value **= 2;",
      "}",
      "",
      "function consume(value: any): void {",
      "  void value;",
      "}",
      "",
      "export function sequence(value: any): number {",
      "  return (consume(value), 1);",
      "}",
      "",
      "export function deleteName(value: any): boolean {",
      "  return delete value.name;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.notEqual(build.status, 0);
  assert.match(build.stdout + build.stderr, /operator '<<'/u);
  assert.match(build.stdout + build.stderr, /operator 'in'/u);
  assert.match(build.stdout + build.stderr, /operator '\+='/u);
  assert.match(build.stdout + build.stderr, /operator '\*\*'/u);
  assert.match(build.stdout + build.stderr, /operator '\*\*='/u);
  assert.doesNotMatch(build.stdout + build.stderr, /operator ','/u);
  assert.match(build.stdout + build.stderr, /Deletion requires one exact checked element access/u);
  assert.equal(existsSync(csharpProjectPath(projectDirectory, assemblyName)), false);
});

test("CLI emits and executes explicit any comma sequences through native statements", async () => {
  const projectDirectory = resolve(tempRoot, "dynamic-values-any-comma-sequence");
  const assemblyName = "SmokeGeneratedDynamicValuesAnyCommaSequence";
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp", options: { namespace: "Smoke.Generated", assemblyName } }],
    }, null, 2),
    "src/index.ts": [
      "function consume(value: any): void {",
      "  void value;",
      "}",
      "",
      "export function sequence(value: any): number {",
      "  return (consume(value), 1);",
      "}",
      "",
    ].join("\n"),
  });
  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);
  const generatedSource = await readGeneratedModuleSource(projectDirectory);
  assert.match(generatedSource, /public static double sequence\(Tsonic\.CSharp\.Runtime\.TsValue value\)\s*\{\s*consume\(value\);\s*return \(1\);\s*\}/u);
  assert.doesNotMatch(generatedSource, /System\.Func|\(\(\) =>|System\.Reflection|\bdynamic\b|__unsupported/u);
  const stdout = await runGeneratedCsharpRunner(projectDirectory, assemblyName, [
    "using System;",
    "public static class Program",
    "{",
    "    public static void Main()",
    "    {",
    "        Console.WriteLine(Smoke.Generated.Index.sequence(Tsonic.CSharp.Runtime.TsValue.from(7.0)));",
    "    }",
    "}",
    "",
  ]);
  assert.equal(stdout, "1\n");
});

test("CLI wraps non-exception thrown values with closed runtime carriers", async () => {
  const projectDirectory = resolve(tempRoot, "dynamic-values-throw-catch");
  const assemblyName = "SmokeGeneratedDynamicValuesThrowCatch";
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
      "let cleanup = 0;",
      "",
      "function guarded(): number {",
      "  try {",
      "    throw \"boom\";",
      "  } catch (error) {",
      "    cleanup += 1;",
      "  } finally {",
      "    cleanup += 10;",
      "  }",
      "  return cleanup;",
      "}",
      "",
      "Console.WriteLine(`thrown value: ${guarded()}`);",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedProject = await readGeneratedProject(projectDirectory, assemblyName);
  assertRuntimeProjectReference(generatedProject, "Tsonic.CSharp.Runtime");
  assertNoInstalledAssemblyReference(generatedProject, "Tsonic.CSharp.Runtime");
  assertNoRuntimeReference(generatedProject, "Tsonic.CSharp.Js");

  const generatedSource = await readGeneratedModuleSource(projectDirectory);
  assert.match(generatedSource, /throw Tsonic\.CSharp\.Runtime\.TsThrownValueException\.from\(Tsonic\.CSharp\.Runtime\.TsValue\.from\("boom"\)\);/);
  assert.match(generatedSource, /catch\s*\{/);
  assert.doesNotMatch(generatedSource, /TsThrownValueException\.toValue/);
  assert.doesNotMatch(generatedSource, /dynamic|System\.Reflection|GetProperty|GetMethod|MethodInfo\.Invoke|Activator\.CreateInstance|Assembly\.Load|__unsupported/);

  assert.equal(runGeneratedProject(projectDirectory, assemblyName), [
    "thrown value: 11",
    "",
  ].join("\n"));
});
