import { assert, assertInstalledAssemblyReference, assertNoInstalledAssemblyReference, assertNoRuntimeProjectReference, cliPath, existsSync, readFile, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "./harness.mjs";

function assertExternalCallNotMapped(stderr, memberName) {
  assert.match(stderr, /tsts:TSTS_DIAGNOSTIC/);
  const sourceContractPatterns = {
    "<anonymous>": /'Array' only refers to a type, but is being used as a value here/u,
    isFinite: /Cannot find name 'Number'|'Number' only refers to a type|Property 'isFinite' does not exist/u,
    log: /Cannot find name 'console'|Property 'log' does not exist/u,
    toString: /Property 'toString' does not exist/u,
    trunc: /Cannot find name 'Math'|Property 'trunc' does not exist/u,
  };
  const pattern = sourceContractPatterns[memberName];
  assert.notEqual(pattern, undefined, `missing exact source-contract diagnostic expectation for ${memberName}`);
  assert.match(stderr, pattern);
}

test("CLI emits string for-of from provider code-point iteration facts", async () => {
  const projectDirectory = resolve(tempRoot, "string-for-of");
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
            assemblyName: "SmokeGeneratedStringForOf",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function totalLength(value: string): number {",
      "  let total = 0;",
      "  for (const ch of value) {",
      "    total = total + ch.length;",
      "  }",
      "  return total;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /string __tsonic_forOfString\d+ = value;/);
  assert.match(generatedSource, /for \(int __tsonic_forOfIndex\d+ = 0; __tsonic_forOfIndex\d+ < __tsonic_forOfString\d+\.Length; \)/);
  assert.match(generatedSource, /char\.IsHighSurrogate\(__tsonic_forOfString\d+\[__tsonic_forOfIndex\d+\]\)/);
  assert.match(generatedSource, /char\.IsLowSurrogate\(__tsonic_forOfString\d+\[__tsonic_forOfIndex\d+ \+ 1\]\)/);
  assert.match(generatedSource, /ch = __tsonic_forOfString\d+\.Substring\(__tsonic_forOfIndex\d+, 2\);/);
  assert.match(generatedSource, /ch = __tsonic_forOfString\d+\.Substring\(__tsonic_forOfIndex\d+, 1\);/);
  assert.match(generatedSource, /total = total \+ ch\.Length;/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedStringForOf.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits Record for-in from provider Dictionary key facts", async () => {
  const projectDirectory = resolve(tempRoot, "record-for-in");
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
            assemblyName: "SmokeGeneratedRecordForIn",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function countKeys(values: Record<string, number>): number {",
      "  let total = 0;",
      "  for (const key in values) {",
      "    total = total + key.length;",
      "  }",
      "  return total;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /System\.Collections\.Generic\.Dictionary<string, double> __tsonic_forInTarget\d+ = values;/);
  assert.match(generatedSource, /foreach \(string key in __tsonic_forInTarget\d+\.Keys\)/);
  assert.match(generatedSource, /total = total \+ key\.Length;/);
  assert.doesNotMatch(generatedSource, /unsupported|invalid/i);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedRecordForIn.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits Object helpers for closed Record dictionaries from selected JS surface facts", async () => {
  const projectDirectory = resolve(tempRoot, "record-object-helpers");
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
            assemblyName: "SmokeGeneratedRecordObjectHelpers",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "export function recordKeys(values: Record<string, int32>): string[] {",
      "  return Object.keys(values);",
      "}",
      "",
      "export function recordValues(values: Record<string, int32>): int32[] {",
      "  return Object.values(values);",
      "}",
      "",
      "export function recordEntries(values: Record<string, int32>): [string, int32][] {",
      "  return Object.entries(values);",
      "}",
      "",
      "export function recordHasOwn(values: Record<string, int32>): boolean {",
      "  return Object.hasOwn(values, \"answer\");",
      "}",
      "",
      "export function assignRecord(target: Record<string, int32>, source: Record<string, int32>): Record<string, int32> {",
      "  return Object.assign(target, source);",
      "}",
      "",
      "export function sameValue(left: number, right: number): boolean {",
      "  return Object.is(left, right);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static Tsonic\.CSharp\.Js\.JSArray<string> recordKeys\(System\.Collections\.Generic\.Dictionary<string, int> values\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Object\.keys\(values\);/);
  assert.match(generatedSource, /public static Tsonic\.CSharp\.Js\.JSArray<int> recordValues\(System\.Collections\.Generic\.Dictionary<string, int> values\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Object\.values\(values\);/);
  assert.match(generatedSource, /public static Tsonic\.CSharp\.Js\.JSArray<\(string, int\)> recordEntries\(System\.Collections\.Generic\.Dictionary<string, int> values\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Object\.entries\(values\);/);
  assert.match(generatedSource, /public static bool recordHasOwn\(System\.Collections\.Generic\.Dictionary<string, int> values\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Object\.hasOwn\(values, "answer"\);/);
  assert.match(generatedSource, /public static System\.Collections\.Generic\.Dictionary<string, int> assignRecord\(System\.Collections\.Generic\.Dictionary<string, int> target, System\.Collections\.Generic\.Dictionary<string, int> source\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Object\.assign\(target, source\);/);
  assert.match(generatedSource, /public static bool sameValue\(double left, double right\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Object\.@is\(left, right\);/);
  assert.doesNotMatch(generatedSource, /Object\.keys\(object/);
  assert.doesNotMatch(generatedSource, /Object\.assign\(object/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedRecordObjectHelpers.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI hard-rejects unsupported Object descriptor and prototype operations", async () => {
  const projectDirectory = resolve(tempRoot, "object-descriptor-prototype-rejections");
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
            assemblyName: "SmokeGeneratedObjectDescriptorPrototypeRejections",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function createFrom(proto: object): object {",
      "  return Object.create(proto);",
      "}",
      "",
      "export function define(value: object): object {",
      "  return Object.defineProperty(value, \"x\", { value: 1 });",
      "}",
      "",
      "export function setProto(value: object, proto: object): object {",
      "  return Object.setPrototypeOf(value, proto);",
      "}",
      "",
      "export function getProto(value: object): object | null {",
      "  return Object.getPrototypeOf(value);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /TS9101002 index\.ts:2:10: Object\.create requires closed descriptor\/prototype\/extensibility semantics that are not represented by the selected C# runtime policy\./);
  assert.match(build.stderr, /Selected source identity: js\.ObjectConstructor\.create\.member/);
  assert.match(build.stderr, /TS9101002 index\.ts:6:10: Object\.defineProperty requires closed descriptor\/prototype\/extensibility semantics that are not represented by the selected C# runtime policy\./);
  assert.match(build.stderr, /Selected source identity: js\.ObjectConstructor\.defineProperty\.member/);
  assert.match(build.stderr, /TS9101002 index\.ts:10:10: Object\.setPrototypeOf requires closed descriptor\/prototype\/extensibility semantics that are not represented by the selected C# runtime policy\./);
  assert.match(build.stderr, /Selected source identity: js\.ObjectConstructor\.setPrototypeOf\.member/);
  assert.match(build.stderr, /TS9101002 index\.ts:14:10: Object\.getPrototypeOf requires closed descriptor\/prototype\/extensibility semantics that are not represented by the selected C# runtime policy\./);
  assert.match(build.stderr, /Selected source identity: js\.ObjectConstructor\.getPrototypeOf\.member/);
  assert.match(build.stderr, /No target fallback, name recovery, or dynamic invocation is permitted/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedObjectDescriptorPrototypeRejections.csproj")), false);
});
