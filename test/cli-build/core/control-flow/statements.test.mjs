import { performance } from "node:perf_hooks";
import { assert, cliPath, readFile, repoRoot, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";

test("CLI emits C# switch defaults and literal fallthrough labels", async () => {
  const projectDirectory = resolve(tempRoot, "literal-switch-fallthrough");
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
            assemblyName: "SmokeGeneratedLiteralSwitchFallthrough",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function classify(value: string): string {",
      "  switch (value) {",
      "    case \"alpha\":",
      "    case \"beta\":",
      "      return \"known\";",
      "    default:",
      "      return \"other\";",
      "  }",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /switch \(value\)/);
  assert.match(generatedSource, /case "alpha":\s+goto case "beta";/);
  assert.match(generatedSource, /case "beta":\s+return "known";/);
  assert.match(generatedSource, /default:\s+return "other";/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedLiteralSwitchFallthrough.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI executes dynamic switch cases in source order with default and fallthrough", async () => {
  const projectDirectory = resolve(tempRoot, "dynamic-switch-case-expression");
  const assemblyName = "SmokeGeneratedDynamicSwitchCase";
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
      "let trace = \"\";",
      "function record(value: string, label: string): string { trace += label; return value; }",
      "export function classify(value: string, dynamicCase: string): string {",
      "  trace = \"\";",
      "  let result = \"\";",
      "  switch (record(value, \"input;\")) {",
      "    case record(dynamicCase, \"first;\"):",
      "      result = \"dynamic\";",
      "      break;",
      "    default:",
      "      result = \"default\";",
      "    case record(\"last\", \"last;\"):",
      "      result += \"last\";",
      "  }",
      "  return result + \"|\" + trace;",
      "}",
      "Console.WriteLine(classify(\"first\", \"first\"));",
      "Console.WriteLine(classify(\"last\", \"first\"));",
      "Console.WriteLine(classify(\"missing\", \"first\"));",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);
  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.doesNotMatch(generatedSource, /__unsupported|InvalidExpression|System\.Reflection/u);
  assert.equal(runGeneratedProject(projectDirectory, assemblyName),
    "dynamic|input;first;\nlast|input;first;last;\ndefaultlast|input;first;last;\n");
});

test("CLI rewrites mixed-type for initializers into C# prelude locals", async () => {
  const projectDirectory = resolve(tempRoot, "mixed-for-initializers");
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
            assemblyName: "SmokeGeneratedMixedForInitializers",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function mixed(limit: number): number {",
      "  let total = 0;",
      "  for (let index = 0, active = true; index < limit; index++) {",
      "    if (active) {",
      "      total = total + index;",
      "    }",
      "  }",
      "  return total;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /double index = 0;/);
  assert.match(generatedSource, /bool active = true;/);
  assert.match(generatedSource, /for \(; index < limit; index\+\+\)/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedMixedForInitializers.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI lowers labeled break and continue into deterministic C# labels", async () => {
  const projectDirectory = resolve(tempRoot, "labeled-control-flow");
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
            assemblyName: "SmokeGeneratedLabeledControlFlow",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function count(limit: number): number {",
      "  let total = 0;",
      "  outer: for (let row = 0; row < limit; row++) {",
      "    for (let column = 0; column < limit; column++) {",
      "      if (column === 1) {",
      "        continue outer;",
      "      }",
      "      if (row === 2) {",
      "        break outer;",
      "      }",
      "      total = total + 1;",
      "    }",
      "  }",
      "  return total;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /goto __tsonic_label_outer_continue\d+;/);
  assert.match(generatedSource, /goto __tsonic_label_outer_break\d+;/);
  assert.match(generatedSource, /__tsonic_label_outer_continue\d+:/);
  assert.match(generatedSource, /__tsonic_label_outer_break\d+:/);
  assert.doesNotMatch(generatedSource, /Labeled break requires/);
  assert.doesNotMatch(generatedSource, /Labeled continue requires/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedLabeledControlFlow.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI lowers switch fallthrough into explicit C# switch gotos", async () => {
  const projectDirectory = resolve(tempRoot, "switch-fallthrough");
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
            assemblyName: "SmokeGeneratedSwitchFallthrough",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function choose(value: number): number {",
      "  let result = 0;",
      "  switch (value) {",
      "    case 0:",
      "      result = 1;",
      "    case 1:",
      "      result = result + 2;",
      "      break;",
      "    case 2:",
      "      result = 4;",
      "    default:",
      "      result = result + 8;",
      "  }",
      "  return result;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /goto case 1;/);
  assert.match(generatedSource, /goto default;/);
  assert.doesNotMatch(generatedSource, /Switch case fallthrough requires/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedSwitchFallthrough.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI routes top-level for-of statements through the C# module entrypoint", async () => {
  const projectDirectory = resolve(tempRoot, "top-level-for-of");
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
            assemblyName: "SmokeGeneratedTopLevelForOf",
            outputType: "Exe",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "let total = 0;",
      "",
      "for (const value of [1, 2, 3]) {",
      "  total = total + value;",
      "}",
      "",
      "export function read(): number {",
      "  return total;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  const generatedEntrypoint = await readFile(resolve(projectDirectory, "out/csharp/generated/TsonicEntrypoint.cs"), "utf8");
  assert.match(generatedSource, /public static double total\s*\{\s*get;\s*internal set;\s*\} = default\(double\)!;/);
  assert.match(generatedSource, /private static object\? __tsonic_module_init_core\(\)/);
  assert.match(generatedSource, /total = 0;/);
  assert.match(generatedEntrypoint, /public static void Main\(\)/);
  assert.match(generatedEntrypoint, /Index\.__tsonic_module_init\(\);/);
  assert.match(generatedSource, /foreach \(int value in new int\[\] \{ 1, 2, 3 \}\)/);
  assert.match(generatedSource, /total = total \+ value;/);
  assert.doesNotMatch(generatedSource, /Top-level statement is outside/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedTopLevelForOf.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits source-owned parameter and for-initializer object destructuring", async () => {
  const projectDirectory = resolve(tempRoot, "parameter-forof-destructuring");
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
            assemblyName: "SmokeGeneratedParameterForOfDestructuring",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export class Point {",
      "  x: number = 1;",
      "  y: number = 2;",
      "}",
      "",
      "export function fromObjectParameter({ x }: Point): number {",
      "  return x;",
      "}",
      "",
      "export function fromForInitializer(point: Point): number {",
      "  for (const { x } = point; x < 2;) {",
      "    return x;",
      "  }",
      "  return 0;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static double fromObjectParameter\(Point __tsonic_param0\)/);
  assert.match(generatedSource, /double x = __tsonic_param0\.x;/);
  assert.match(generatedSource, /Point __tsonic_destructure0 = point;/);
  assert.match(generatedSource, /double x = __tsonic_destructure0\.x;/);
  assert.match(generatedSource, /for \(; x < 2; \)/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedParameterForOfDestructuring.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});
