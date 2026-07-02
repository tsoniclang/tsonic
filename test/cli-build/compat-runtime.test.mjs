import { assert, cliPath, csharpProjectPath, existsSync, readFile, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "./harness.mjs";

async function readGeneratedModuleSource(projectDirectory) {
  return readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
}

async function readGeneratedProject(projectDirectory, assemblyName) {
  return readFile(csharpProjectPath(projectDirectory, assemblyName), "utf8");
}

test("CLI emits closed compat runtime operations for explicit TypeScript any without selecting the JS surface", async () => {
  const projectDirectory = resolve(tempRoot, "compat-runtime-any-operations");
  const assemblyName = "SmokeGeneratedCompatRuntimeAnyOperations";
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
            typescriptCompatibility: "compat",
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
  assert.match(generatedProject, /Tsonic\.CSharp\.Js\.csproj/);

  const generatedSource = await readGeneratedModuleSource(projectDirectory);
  assert.match(generatedSource, /public static Tsonic\.CSharp\.Js\.TsValue readName\(Tsonic\.CSharp\.Js\.TsValue value\)/);
  assert.match(generatedSource, /return value\.ReadCompatSlot\("name"\);/);
  assert.match(generatedSource, /value\.WriteCompatSlot\("name", "Ada"\);/);
  assert.match(generatedSource, /return value\.ReadCompatElement\(key\);/);
  assert.match(generatedSource, /value\.WriteCompatElement\(key, "Grace"\);/);
  assert.match(generatedSource, /return value\.InvokeCompat\("Ada", 1\);/);
  assert.match(generatedSource, /return value\.ReadCompatSlot\("create"\)\.InvokeCompat\("Ada"\);/);
  assert.match(generatedSource, /return value\.ConstructCompat\("Ada"\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.TsValue\.ApplyCompatBinary\(value, "\+", 2\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.TsValue\.ApplyCompatBinaryBoolean\(value, "===", 2\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.TsValue\.ApplyCompatUnaryBoolean\(value, "!"\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.TsValue\.ApplyCompatTypeof\(value\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.TsValue\.ApplyCompatVoid\(value\.ReadCompatSlot\("name"\)\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.TsValue\.CastCompat<double>\(value\);/);
  assert.match(generatedSource, /double result = Tsonic\.CSharp\.Js\.TsValue\.CastCompat<double>\(value\);/);
  assert.match(generatedSource, /result = Tsonic\.CSharp\.Js\.TsValue\.CastCompat<double>\(value\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.TsValue\.from\(value\);/);
  assert.doesNotMatch(generatedSource, /dynamic|System\.Reflection|GetProperty|GetMethod|MethodInfo\.Invoke|Activator\.CreateInstance|Assembly\.Load|__unsupported/);

  const dotnet = run("dotnet", ["build", csharpProjectPath(projectDirectory, assemblyName), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI hard-rejects explicit any object destructuring without closed extraction facts in compat mode", async () => {
  const projectDirectory = resolve(tempRoot, "compat-runtime-any-object-destructuring-reject");
  const assemblyName = "SmokeGeneratedCompatRuntimeAnyObjectDestructuringReject";
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
            typescriptCompatibility: "compat",
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
  assert.match(output, /index\.ts:2:8: Destructuring source expression requires a finalized runtime carrier fact/u);
  assert.match(output, /index\.ts:2:8: Object destructuring requires a source-owned declaration or finalized provider object-shape facts/u);
  assert.equal(existsSync(csharpProjectPath(projectDirectory, assemblyName)), false);
});

test("CLI hard-rejects unsupported explicit any operators in compat mode", async () => {
  const projectDirectory = resolve(tempRoot, "compat-runtime-any-operator-reject");
  const assemblyName = "SmokeGeneratedCompatRuntimeAnyOperatorReject";
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
            typescriptCompatibility: "compat",
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
      "export function instance(value: any): boolean {",
      "  return value instanceof Object;",
      "}",
      "",
      "export function sequence(value: any): number {",
      "  return (value, 1);",
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
  assert.match(build.stdout + build.stderr, /operator 'instanceof'/u);
  assert.match(build.stdout + build.stderr, /operator ','/u);
  assert.match(build.stdout + build.stderr, /operator 'delete'/u);
  assert.equal(existsSync(csharpProjectPath(projectDirectory, assemblyName)), false);
});

test("CLI strict-native rejects explicit TypeScript any operations before C# artifact emission", async () => {
  const projectDirectory = resolve(tempRoot, "compat-runtime-any-strict-reject");
  const assemblyName = "SmokeGeneratedCompatRuntimeAnyStrictReject";
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
      "export function callValue(value: any): any {",
      "  return value();",
      "}",
      "",
      "export function typeOfValue(value: any): string {",
      "  return typeof value;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.notEqual(build.status, 0);
  assert.match(build.stdout + build.stderr, /strict-native mode|any cannot trickle|CSHARP_OPAQUE_ANY_UNSUPPORTED/u);
  assert.equal(existsSync(csharpProjectPath(projectDirectory, assemblyName)), false);
});

test("CLI strict-native rejects TypeScript any typed-boundary returns before C# artifact emission", async () => {
  const projectDirectory = resolve(tempRoot, "compat-runtime-any-typed-boundary-strict-reject");
  const assemblyName = "SmokeGeneratedCompatRuntimeAnyTypedBoundaryStrictReject";
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
      "export function typedReturn(value: any): number {",
      "  return value;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.notEqual(build.status, 0);
  assert.match(build.stdout + build.stderr, /TypeScript any boundary|opaque any runtime carrier|any cannot trickle/u);
  assert.equal(existsSync(csharpProjectPath(projectDirectory, assemblyName)), false);
});

test("CLI compat mode wraps non-exception thrown values with closed runtime carriers", async () => {
  const projectDirectory = resolve(tempRoot, "compat-runtime-throw-catch");
  const assemblyName = "SmokeGeneratedCompatRuntimeThrowCatch";
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
            typescriptCompatibility: "compat",
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
      "Console.writeLine(`compat throw: ${guarded()}`);",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedProject = await readGeneratedProject(projectDirectory, assemblyName);
  assert.match(generatedProject, /Tsonic\.CSharp\.Js\.csproj/);

  const generatedSource = await readGeneratedModuleSource(projectDirectory);
  assert.match(generatedSource, /throw Tsonic\.CSharp\.Js\.TsThrownValueException\.from\("boom"\);/);
  assert.match(generatedSource, /catch \(System\.Exception __tsonic_catch0\)/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.TsValue error = Tsonic\.CSharp\.Js\.TsThrownValueException\.toValue\(__tsonic_catch0\);/);
  assert.doesNotMatch(generatedSource, /dynamic|System\.Reflection|GetProperty|GetMethod|MethodInfo\.Invoke|Activator\.CreateInstance|Assembly\.Load|__unsupported/);

  assert.equal(runGeneratedProject(projectDirectory, assemblyName), [
    "compat throw: 11",
    "",
  ].join("\n"));
});
