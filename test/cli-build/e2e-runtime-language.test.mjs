import { assert, cliPath, resolve, runGeneratedProject, runNode, tempRoot, test, writeProject } from "./harness.mjs";

test("CLI runs generated C# executable for module constants and variable declarations", async () => {
  const assemblyName = "SmokeGeneratedE2EVariables";
  const projectDirectory = resolve(tempRoot, "e2e-variables");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp", options: { namespace: "Smoke.Generated", assemblyName, outputType: "Exe" } }],
    }, null, 2),
    "src/index.ts": [
      "import type { int32, uint8, int16, int64, float32 } from \"@tsonic/core/types.js\";",
      "import { Console } from \"@tsonic/dotnet/System.js\";",
      "",
      "const PI = 3.14159;",
      "const MESSAGE = \"Hello, World!\";",
      "const COUNT = 42;",
      "const IS_ENABLED = true;",
      "const explicitInt: int32 = 42;",
      "const explicitByte: uint8 = 255;",
      "const explicitShort: int16 = 1000;",
      "const explicitLong: int64 = 1000000;",
      "const explicitFloat: float32 = 1.5;",
      "const explicitDouble: number = 1.5;",
      "let mutableInt: int32 = 0;",
      "let mutableString: string = \"\";",
      "mutableInt = 100;",
      "mutableString = \"updated\";",
      "",
      "Console.writeLine(`PI: ${PI}`);",
      "Console.writeLine(`MESSAGE: ${MESSAGE}`);",
      "Console.writeLine(`COUNT: ${COUNT}`);",
      "Console.writeLine(`IS_ENABLED: ${IS_ENABLED}`);",
      "Console.writeLine(`Explicit int: ${explicitInt}`);",
      "Console.writeLine(`Explicit byte: ${explicitByte}`);",
      "Console.writeLine(`Explicit short: ${explicitShort}`);",
      "Console.writeLine(`Explicit long: ${explicitLong}`);",
      "Console.writeLine(`Explicit float: ${explicitFloat}`);",
      "Console.writeLine(`Explicit double: ${explicitDouble}`);",
      "Console.writeLine(`Mutable int: ${mutableInt}`);",
      "Console.writeLine(`Mutable string: ${mutableString}`);",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);
  assert.equal(runGeneratedProject(projectDirectory, assemblyName), [
    "PI: 3.14159",
    "MESSAGE: Hello, World!",
    "COUNT: 42",
    "IS_ENABLED: True",
    "Explicit int: 42",
    "Explicit byte: 255",
    "Explicit short: 1000",
    "Explicit long: 1000000",
    "Explicit float: 1.5",
    "Explicit double: 1.5",
    "Mutable int: 100",
    "Mutable string: updated",
    "",
  ].join("\n"));
});

test("CLI runs generated C# executable for functions, switches, and nested scopes", async () => {
  const assemblyName = "SmokeGeneratedE2EControlFlow";
  const projectDirectory = resolve(tempRoot, "e2e-control-flow");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp", options: { namespace: "Smoke.Generated", assemblyName, outputType: "Exe" } }],
    }, null, 2),
    "src/index.ts": [
      "import { Console } from \"@tsonic/dotnet/System.js\";",
      "",
      "function greet(name: string): string {",
      "  return `Hello ${name}`;",
      "}",
      "",
      "function add(a: number, b: number): number {",
      "  return a + b;",
      "}",
      "",
      "function isEven(n: number): boolean {",
      "  return n % 2 === 0;",
      "}",
      "",
      "function getDayType(day: number): string {",
      "  switch (day) {",
      "    case 0:",
      "    case 6:",
      "      return \"weekend\";",
      "    case 1:",
      "    case 2:",
      "    case 3:",
      "    case 4:",
      "    case 5:",
      "      return \"weekday\";",
      "    default:",
      "      return \"invalid\";",
      "  }",
      "}",
      "",
      "function nestedScopes(x: number): number {",
      "  const a = 10;",
      "  {",
      "    const b = 20;",
      "    {",
      "      const c = 30;",
      "      return a + b + c + x;",
      "    }",
      "  }",
      "}",
      "",
      "Console.writeLine(greet(\"World\"));",
      "Console.writeLine(`Add: ${add(3, 7)}`);",
      "Console.writeLine(`Is 4 even: ${isEven(4)}`);",
      "Console.writeLine(`Is 5 even: ${isEven(5)}`);",
      "Console.writeLine(`Day 0: ${getDayType(0)}`);",
      "Console.writeLine(`Day 3: ${getDayType(3)}`);",
      "Console.writeLine(`Day 6: ${getDayType(6)}`);",
      "Console.writeLine(`Day 7: ${getDayType(7)}`);",
      "Console.writeLine(`Nested scopes result: ${nestedScopes(5)}`);",
      "Console.writeLine(`Nested scopes result: ${nestedScopes(0)}`);",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);
  assert.equal(runGeneratedProject(projectDirectory, assemblyName), [
    "Hello World",
    "Add: 10",
    "Is 4 even: True",
    "Is 5 even: False",
    "Day 0: weekend",
    "Day 3: weekday",
    "Day 6: weekend",
    "Day 7: invalid",
    "Nested scopes result: 65",
    "Nested scopes result: 60",
    "",
  ].join("\n"));
});

test("CLI runs generated C# executable preserving shadowed lexical bindings", async () => {
  const assemblyName = "SmokeGeneratedE2EShadowing";
  const projectDirectory = resolve(tempRoot, "e2e-shadowing");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp", options: { namespace: "Smoke.Generated", assemblyName, outputType: "Exe" } }],
    }, null, 2),
    "src/index.ts": [
      "import { Console } from \"@tsonic/dotnet/System.js\";",
      "",
      "function shadowedVariable(): number {",
      "  const x = 10;",
      "  {",
      "    const x = 20;",
      "    return x;",
      "  }",
      "}",
      "",
      "function shadowInFunction(): number {",
      "  const value = 5;",
      "  const inner = (): number => {",
      "    const value = 10;",
      "    return value;",
      "  };",
      "  return value + inner();",
      "}",
      "",
      "Console.writeLine(`Shadowed: ${shadowedVariable()}`);",
      "Console.writeLine(`Shadow in function: ${shadowInFunction()}`);",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);
  assert.equal(runGeneratedProject(projectDirectory, assemblyName), [
    "Shadowed: 20",
    "Shadow in function: 15",
    "",
  ].join("\n"));
});
