import { assert, cliPath, csharpProjectPath, readFile, resolve, run, runNode, tempRoot, test, writeProject } from "./harness.mjs";

async function readGeneratedModuleSource(projectDirectory) {
  return readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
}

test("CLI emits runtime-union arm tests and projections from finalized facts", async () => {
  const projectDirectory = resolve(tempRoot, "runtime-union-arm-projection");
  const assemblyName = "SmokeGeneratedRuntimeUnionArmProjection";
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
      "export function choose(flag: boolean): number | string {",
      "  const value: number | string = flag ? 1 : \"ready\";",
      "  return value;",
      "}",
      "",
      "export function read(value: number | string): string {",
      "  if (typeof value === \"string\") {",
      "    return value;",
      "  }",
      "  return \"fallback\";",
      "}",
      "",
      "Console.WriteLine(`${read(choose(false))}|${read(choose(true))}`);",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readGeneratedModuleSource(projectDirectory);
  assert.match(generatedSource, /Tsonic\.CSharp\.Runtime\.Union<double, string> value = flag \? 1 : "ready";/);
  assert.match(generatedSource, /if \(value\.Is2\(\)\)/);
  assert.match(generatedSource, /return value\.As2\(\);/);
  assert.doesNotMatch(generatedSource, /value is string|return value;\s*}\s*return "fallback"/);
  assert.doesNotMatch(generatedSource, /dynamic|System\.Reflection|GetProperty|GetMethod|MethodInfo\.Invoke|Activator\.CreateInstance|Assembly\.Load|__unsupported/);

  const dotnet = run("dotnet", ["build", csharpProjectPath(projectDirectory, assemblyName), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);

  const executed = run("dotnet", ["run", "--project", csharpProjectPath(projectDirectory, assemblyName), "--no-build", "--no-restore"]);
  assert.equal(executed.status, 0, executed.stdout + executed.stderr);
  assert.equal(executed.stdout.replace(/\r\n/g, "\n"), "ready|fallback\n");
});

test("CLI emits neutral nullish runtime-union arms from finalized facts", async () => {
  const projectDirectory = resolve(tempRoot, "runtime-union-nullish-arm");
  const assemblyName = "SmokeGeneratedRuntimeUnionNullishArm";
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
      "export function choose(flag: number): number | string | undefined {",
      "  return flag === 0 ? undefined : flag === 1 ? 1 : \"ready\";",
      "}",
      "",
      "Console.WriteLine(`${choose(0)}|${choose(1)}|${choose(2)}`);",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readGeneratedModuleSource(projectDirectory);
  assert.match(generatedSource, /Tsonic\.CSharp\.Runtime\.Union<double, string, Tsonic\.CSharp\.Runtime\.Undefined>/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Runtime\.Undefined\.value/);
  assert.doesNotMatch(generatedSource, /flag == 0 \? null|flag == 0 \? default/);
  assert.doesNotMatch(generatedSource, /dynamic|System\.Reflection|GetProperty|GetMethod|MethodInfo\.Invoke|Activator\.CreateInstance|Assembly\.Load|__unsupported/);

  const dotnet = run("dotnet", ["build", csharpProjectPath(projectDirectory, assemblyName), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);

  const executed = run("dotnet", ["run", "--project", csharpProjectPath(projectDirectory, assemblyName), "--no-build", "--no-restore"]);
  assert.equal(executed.status, 0, executed.stdout + executed.stderr);
  assert.equal(executed.stdout.replace(/\r\n/g, "\n"), "undefined|1|ready\n");
});

test("CLI emits object-shape runtime-union declarations and member projections from finalized facts", async () => {
  const projectDirectory = resolve(tempRoot, "runtime-union-object-shape-projection");
  const assemblyName = "SmokeGeneratedRuntimeUnionObjectShapeProjection";
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
      "type Circle = { kind: \"circle\"; radius: number };",
      "type Square = { kind: \"square\"; size: number };",
      "type Shape = Circle | Square;",
      "",
      "export function describe(shape: Shape): string {",
      "  if (shape.kind === \"circle\") {",
      "    return `circle:${shape.radius}`;",
      "  }",
      "  return `square:${shape.size}`;",
      "}",
      "",
      "Console.WriteLine(describe({ kind: \"circle\", radius: 4 }));",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readGeneratedModuleSource(projectDirectory);
  const shapeDeclarations = generatedSource.match(/public class __TsonicShape_/g) ?? [];
  assert.equal(shapeDeclarations.length, 2);
  assert.match(generatedSource, /Tsonic\.CSharp\.Runtime\.Union<__TsonicShape_[A-Za-z0-9_]+, __TsonicShape_[A-Za-z0-9_]+> shape/);
  assert.match(generatedSource, /if \(shape\.As1\(\)\.kind == "circle"\)/);
  assert.match(generatedSource, /return \$"circle:\{shape\.As1\(\)\.radius\}";/);
  assert.match(generatedSource, /return \$"square:\{shape\.As2\(\)\.size\}";/);
  assert.doesNotMatch(generatedSource, /\(__TsonicShape_[A-Za-z0-9_]+\)shape/);
  assert.doesNotMatch(generatedSource, /shape\.radius|shape\.size|dynamic|System\.Reflection|GetProperty|GetMethod|MethodInfo\.Invoke|Activator\.CreateInstance|Assembly\.Load|__unsupported/);

  const dotnet = run("dotnet", ["build", csharpProjectPath(projectDirectory, assemblyName), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);

  const executed = run("dotnet", ["run", "--project", csharpProjectPath(projectDirectory, assemblyName), "--no-build", "--no-restore"]);
  assert.equal(executed.status, 0, executed.stdout + executed.stderr);
  assert.equal(executed.stdout.replace(/\r\n/g, "\n"), "circle:4\n");
});
