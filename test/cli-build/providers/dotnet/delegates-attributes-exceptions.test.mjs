import { assert, cliPath, dotnetOutputAssemblyPath, existsSync, readFile, repoRoot, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";

async function readGeneratedModuleSource(projectDirectory) {
  return readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
}

test("CLI emits provider constructor parameter modes and delegate invocation from selected facts", async () => {
  const libraryDirectory = resolve(tempRoot, "provider-constructor-parameter-mode-library");
  await writeProject(libraryDirectory, {
    "Provider.ParameterModes.csproj": [
      "<Project Sdk=\"Microsoft.NET.Sdk\">",
      "  <PropertyGroup>",
      "    <TargetFramework>net10.0</TargetFramework>",
      "    <ImplicitUsings>disable</ImplicitUsings>",
      "    <Nullable>enable</Nullable>",
      "  </PropertyGroup>",
      "</Project>",
      "",
    ].join("\n"),
    "ParameterModes.cs": [
      "namespace Provider.ParameterModes;",
      "",
      "public sealed class ConstructorTarget",
      "{",
      "    public ConstructorTarget()",
      "    {",
      "    }",
      "",
      "    public ConstructorTarget(int value, string label = \"default\")",
      "    {",
      "        Value = value;",
      "        Label = label;",
      "    }",
      "",
      "    public ConstructorTarget(params int[] values)",
      "    {",
      "        Value = values.Length;",
      "    }",
      "",
      "    public ConstructorTarget(ref long value)",
      "    {",
      "        Value = (int)value;",
      "        value += 1;",
      "    }",
      "",
      "    public ConstructorTarget(out short value)",
      "    {",
      "        value = 3;",
      "        Value = value;",
      "    }",
      "",
      "    public ConstructorTarget(in bool flag, char marker = 'x')",
      "    {",
      "        Value = flag ? marker : 0;",
      "    }",
      "",
      "    public int Value { get; }",
      "    public string Label { get; } = \"\";",
      "}",
      "",
      "public sealed class RefOnlyTarget",
      "{",
      "    public RefOnlyTarget(ref long value)",
      "    {",
      "        Value = (int)value;",
      "        value += 1;",
      "    }",
      "",
      "    public int Value { get; }",
      "}",
      "",
      "public sealed class OutOnlyTarget",
      "{",
      "    public OutOnlyTarget(out short value)",
      "    {",
      "        value = 3;",
      "        Value = value;",
      "    }",
      "",
      "    public int Value { get; }",
      "}",
      "",
      "public sealed class InOnlyTarget",
      "{",
      "    public InOnlyTarget(in bool flag, char marker = 'x')",
      "    {",
      "        Value = flag ? marker : 0;",
      "    }",
      "",
      "    public int Value { get; }",
      "}",
      "",
      "public delegate int IntTransform(int value);",
      "",
      "public static class DelegateTarget",
      "{",
      "    public static int Invoke(IntTransform transform, int value)",
      "    {",
      "        return transform(value);",
      "    }",
      "}",
      "",
    ].join("\n"),
  });
  const libraryBuild = run("dotnet", ["build", resolve(libraryDirectory, "Provider.ParameterModes.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(libraryBuild.status, 0, libraryBuild.stdout + libraryBuild.stderr);
  const libraryAssembly = dotnetOutputAssemblyPath(libraryDirectory, "Provider.ParameterModes");

  const projectDirectory = resolve(tempRoot, "provider-constructor-parameter-modes");
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
            assemblyName: "SmokeGeneratedProviderConstructorParameterModes",
            references: {
              assemblies: [{ include: "Provider.ParameterModes", hintPath: libraryAssembly }],
            },
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { out, ref, inref } from \"@tsonic/csharp/lang.js\";",
      "import type { bool, int, long, short } from \"@tsonic/csharp/types.js\";",
      "import { ConstructorTarget, DelegateTarget, InOnlyTarget, OutOnlyTarget, RefOnlyTarget } from \"@tsonic/dotnet/Provider.ParameterModes.js\";",
      "",
      "export function constructDefaults(): int {",
      "  const target = new ConstructorTarget(7);",
      "  return target.Value;",
      "}",
      "",
      "export function constructParams(): int {",
      "  const target = new ConstructorTarget(1, 2, 3);",
      "  return target.Value;",
      "}",
      "",
      "export function constructRef(current: long): int {",
      "  const target = new RefOnlyTarget(ref(current));",
      "  return target.Value;",
      "}",
      "",
      "export function constructRefOnly(current: long): int {",
      "  const target = new RefOnlyTarget(ref(current));",
      "  return target.Value;",
      "}",
      "",
      "export function constructOut(): short {",
      "  let value: short = 0;",
      "  const target = new OutOnlyTarget(out(value));",
      "  return value;",
      "}",
      "",
      "export function constructIn(flag: bool): int {",
      "  const target = new InOnlyTarget(inref(flag), \"z\");",
      "  return target.Value;",
      "}",
      "",
      "export function invokeDelegate(value: int): int {",
      "  return DelegateTarget.Invoke((current: int): int => current, value);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readGeneratedModuleSource(projectDirectory);
  assert.match(generatedSource, /new Provider\.ParameterModes\.ConstructorTarget\(7\);/);
  assert.match(generatedSource, /new Provider\.ParameterModes\.ConstructorTarget\(1, 2, 3\);/);
  assert.match(generatedSource, /new Provider\.ParameterModes\.RefOnlyTarget\(ref current\);/);
  assert.match(generatedSource, /new Provider\.ParameterModes\.OutOnlyTarget\(out value\);/);
  assert.match(generatedSource, /new Provider\.ParameterModes\.InOnlyTarget\(in flag, 'z'\);/);
  assert.match(generatedSource, /Provider\.ParameterModes\.DelegateTarget\.Invoke\(\(int current\) => current, value\);/);
  assert.doesNotMatch(generatedSource, /__unsupported|ConstructorTarget\(current\)|bindings\.json/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedProviderConstructorParameterModes.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);

  const invalidProjectDirectory = resolve(tempRoot, "provider-constructor-parameter-modes-invalid");
  await writeProject(invalidProjectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          options: {
            namespace: "Smoke.Generated",
            assemblyName: "SmokeGeneratedProviderConstructorParameterModesInvalid",
            references: {
              assemblies: [{ include: "Provider.ParameterModes", hintPath: libraryAssembly }],
            },
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { long } from \"@tsonic/csharp/types.js\";",
      "import { RefOnlyTarget } from \"@tsonic/dotnet/Provider.ParameterModes.js\";",
      "",
      "export function invalid(current: long): RefOnlyTarget {",
      "  return new RefOnlyTarget(current);",
      "}",
      "",
    ].join("\n"),
  });
  const invalidBuild = runNode([cliPath, "build", "--project", resolve(invalidProjectDirectory, "tsonic.json")]);
  assert.notEqual(invalidBuild.status, 0);
  assert.match(invalidBuild.stdout + invalidBuild.stderr, /RefOnlyTarget|ref|passing|CSHARP_TARGET_MEMBER_NOT_FOUND|No overload/u);
  assert.equal(existsSync(resolve(invalidProjectDirectory, "out/csharp/SmokeGeneratedProviderConstructorParameterModesInvalid.csproj")), false);
});

test("CLI emits provider-owned delegate type annotations from .NET reflection", async () => {
  const projectDirectory = resolve(tempRoot, "provider-delegate-type-annotations");
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
            assemblyName: "SmokeGeneratedProviderDelegateTypes",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int } from \"@tsonic/csharp/types.js\";",
      "import type { Predicate } from \"@tsonic/dotnet/System.js\";",
      "",
      "export function identityPredicate(predicate: Predicate<int>): Predicate<int> {",
      "  return predicate;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readGeneratedModuleSource(projectDirectory);
  assert.match(generatedSource, /public static System\.Predicate<int> identityPredicate\(System\.Predicate<int> predicate\)/);
  assert.match(generatedSource, /return predicate;/);
  assert.doesNotMatch(generatedSource, /bool identityPredicate\(bool predicate\)/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedProviderDelegateTypes.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI rejects attribute builder targets without provider target facts", async () => {
  const projectDirectory = resolve(tempRoot, "attribute-builder");
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
            assemblyName: "SmokeGeneratedAttributeBuilder",
          },
        },
      ],
    }, null, 2),
    "src/system-attributes.ts": [
      "export const CLSCompliantAttribute: object = {};",
      "",
    ].join("\n"),
    "src/index.ts": [
      "import { attribute as A } from \"@tsonic/csharp/lang.js\";",
      "import { CLSCompliantAttribute } from \"./system-attributes.js\";",
      "",
      "export class Annotated {",
      "  value: number = 1;",
      "",
      "  constructor(seed: number) {}",
      "",
      "  run(input: number): number {",
      "    return input;",
      "  }",
      "}",
      "",
      "A<Annotated>().add(CLSCompliantAttribute, true);",
      "A<Annotated>().constructor().add(CLSCompliantAttribute, true);",
      "A<Annotated>().constructor().parameter(\"seed\").add(CLSCompliantAttribute, false);",
      "A<Annotated>().property((target) => target.value).add(CLSCompliantAttribute, false);",
      "A<Annotated>().method((target) => target.run).add(CLSCompliantAttribute, true);",
      "A<Annotated>().method((target) => target.run).parameter(\"input\").add(CLSCompliantAttribute, false);",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /CSHARP_UNSUPPORTED_AST system-attributes\.ts:1:37: C# type policy could not resolve source node kind 'KindObjectKeyword' to a closed target type\./u);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedAttributeBuilder.csproj")), false);
});

test("CLI emits C# attributes from provider target identity facts", async () => {
  const projectDirectory = resolve(tempRoot, "provider-attribute-targets");
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
            assemblyName: "SmokeGeneratedProviderAttributes",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { attribute as A } from \"@tsonic/csharp/lang.js\";",
      "import { CLSCompliantAttribute } from \"@tsonic/dotnet/System.js\";",
      "",
      "export class Annotated {",
      "  value: number = 1;",
      "  get computed(): number {",
      "    return this.value;",
      "  }",
      "",
      "  constructor(seed: number) {}",
      "",
      "  run(input: number): number {",
      "    return input;",
      "  }",
      "}",
      "",
      "A<Annotated>().add(CLSCompliantAttribute, true);",
      "A<Annotated>().constructor().add(CLSCompliantAttribute, true);",
      "A<Annotated>().constructor().parameter(\"seed\").add(CLSCompliantAttribute, false);",
      "A<Annotated>().property((target) => target.value).target(\"field\").add(CLSCompliantAttribute, false);",
      "A<Annotated>().property((target) => target.computed).target(\"property\").add(CLSCompliantAttribute, true);",
      "A<Annotated>().method((target) => target.run).add(CLSCompliantAttribute, true);",
      "A<Annotated>().method((target) => target.run).target(\"return\").add(CLSCompliantAttribute, false);",
      "A<Annotated>().method((target) => target.run).parameter(\"input\").target(\"param\").add(CLSCompliantAttribute, false);",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readGeneratedModuleSource(projectDirectory);
  assert.match(generatedSource, /\[System\.CLSCompliantAttribute\(true\)\]\s+public class Annotated/);
  assert.match(generatedSource, /\[System\.CLSCompliantAttribute\(true\)\]\s+public Annotated\(\[System\.CLSCompliantAttribute\(false\)\] double seed\)/);
  assert.match(generatedSource, /\[field: System\.CLSCompliantAttribute\(false\)\]\s+public double value = 1;/);
  assert.match(generatedSource, /\[property: System\.CLSCompliantAttribute\(true\)\]\s+public double computed/);
  assert.match(generatedSource, /\[System\.CLSCompliantAttribute\(true\)\]\s+\[return: System\.CLSCompliantAttribute\(false\)\]\s+public double run\(\[param: System\.CLSCompliantAttribute\(false\)\] double input\)/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedProviderAttributes.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI rejects unsupported explicit attribute target specifiers from finalized facts", async () => {
  const projectDirectory = resolve(tempRoot, "provider-attribute-target-specifier-unsupported");
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
            assemblyName: "SmokeGeneratedProviderAttributeTargetSpecifierUnsupported",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { attribute as A } from \"@tsonic/csharp/lang.js\";",
      "import { CLSCompliantAttribute } from \"@tsonic/dotnet/System.js\";",
      "",
      "export class Annotated {",
      "  run(input: number): number {",
      "    return input;",
      "  }",
      "}",
      "",
      "A<Annotated>().method((target) => target.run).target(\"assembly\").add(CLSCompliantAttribute, true);",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /unsupported explicit target specifier 'assembly'/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/src/Index.cs")), false);
});

test("CLI emits arbitrary TypeScript throw values through the closed thrown-value carrier", async () => {
  const projectDirectory = resolve(tempRoot, "throw-requires-provider-facts");
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
            assemblyName: "SmokeGeneratedThrowFacts",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function fail(): never {",
      "  throw 1;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);
  const generatedSource = await readGeneratedModuleSource(projectDirectory);
  assert.match(
    generatedSource,
    /throw Tsonic\.CSharp\.Js\.TsThrownValueException\.from\(Tsonic\.CSharp\.Js\.TsValue\.from\(\(int\)1\)\);/u,
  );
  assert.doesNotMatch(generatedSource, /\bdynamic\b|System\.Reflection/u);
  const project = resolve(projectDirectory, "out/csharp/SmokeGeneratedThrowFacts.csproj");
  const dotnet = run("dotnet", ["build", project, "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits provider-backed C# exception throws", async () => {
  const projectDirectory = resolve(tempRoot, "provider-backed-exception-throw");
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
            assemblyName: "SmokeGeneratedProviderExceptionThrow",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { Exception } from \"@tsonic/dotnet/System.js\";",
      "",
      "export function fail(): never {",
      "  throw new Exception(\"failed\");",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readGeneratedModuleSource(projectDirectory);
  assert.match(generatedSource, /throw new System\.Exception\("failed"\);/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedProviderExceptionThrow.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits provider-backed C# catch variables", async () => {
  const projectDirectory = resolve(tempRoot, "provider-backed-catch-variable");
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
            assemblyName: "SmokeGeneratedCatchVariable",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function guarded(): number {",
      "  try {",
      "    return 1;",
      "  } catch (error) {",
      "    void error;",
      "    return 2;",
      "  }",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readGeneratedModuleSource(projectDirectory);
  assert.match(
    generatedSource,
    /catch \(System\.Exception __tsonic_catch\d+\)[\s\S]*Tsonic\.CSharp\.Js\.TsValue error = Tsonic\.CSharp\.Js\.TsThrownValueException\.toValue\(__tsonic_catch\d+\);/u,
  );
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedCatchVariable.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI rejects catch destructuring until thrown-value extraction facts are finalized", async () => {
  const projectDirectory = resolve(tempRoot, "catch-destructuring-requires-facts");
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
            assemblyName: "SmokeGeneratedCatchDestructuringReject",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function guarded(): number {",
      "  try {",
      "    return 1;",
      "  } catch ({ message }: any) {",
      "    return 2;",
      "  }",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stdout + build.stderr, /Catch destructuring requires a closed thrown-value carrier/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedCatchDestructuringReject.csproj")), false);
});

test("CLI runs provider-backed exception throw, catch, and finally semantics", async () => {
  const assemblyName = "SmokeGeneratedProviderExceptionRuntime";
  const projectDirectory = resolve(tempRoot, "provider-backed-exception-runtime");
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
      "import { Console, Exception } from \"@tsonic/dotnet/System.js\";",
      "",
      "let cleanup = 0;",
      "",
      "function guarded(shouldThrow: boolean): string {",
      "  try {",
      "    if (shouldThrow) {",
      "      throw new Exception(\"boom\");",
      "    }",
      "    return \"ok\";",
      "  } catch (error) {",
      "    void error;",
      "    return \"boom\";",
      "  } finally {",
      "    cleanup++;",
      "  }",
      "}",
      "",
      "Console.WriteLine(`throw: ${guarded(true)}`);",
      "Console.WriteLine(`pass: ${guarded(false)}`);",
      "Console.WriteLine(`cleanup: ${cleanup}`);",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readGeneratedModuleSource(projectDirectory);
  assert.match(generatedSource, /throw new System\.Exception\("boom"\);/);
  assert.match(
    generatedSource,
    /catch \(System\.Exception __tsonic_catch\d+\)[\s\S]*Tsonic\.CSharp\.Js\.TsValue error = Tsonic\.CSharp\.Js\.TsThrownValueException\.toValue\(__tsonic_catch\d+\);/u,
  );
  assert.match(generatedSource, /return "boom";/);
  assert.match(generatedSource, /finally/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  assert.equal(runGeneratedProject(projectDirectory, assemblyName), [
    "throw: boom",
    "pass: ok",
    "cleanup: 2",
    "",
  ].join("\n"));
});
