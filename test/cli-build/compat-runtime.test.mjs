import { assert, cliPath, csharpProjectPath, existsSync, readFile, resolve, run, runNode, tempRoot, test, writeProject } from "./harness.mjs";

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
  assert.doesNotMatch(generatedSource, /dynamic|System\.Reflection|GetProperty|GetMethod|MethodInfo\.Invoke|Activator\.CreateInstance|Assembly\.Load|__unsupported/);

  const dotnet = run("dotnet", ["build", csharpProjectPath(projectDirectory, assemblyName), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
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
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.notEqual(build.status, 0);
  assert.match(build.stdout + build.stderr, /strict-native mode|any cannot trickle|CSHARP_OPAQUE_ANY_UNSUPPORTED/u);
  assert.equal(existsSync(csharpProjectPath(projectDirectory, assemblyName)), false);
});
