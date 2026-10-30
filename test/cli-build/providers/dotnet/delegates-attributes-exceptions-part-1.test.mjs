import { assert, cliPath, dotnetOutputAssemblyPath, existsSync, readFile, repoRoot, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";
import { readGeneratedModuleSource } from "./delegates-attributes-exceptions-fixtures.mjs";

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
  assert.match(generatedSource, /Provider\.ParameterModes\.DelegateTarget\.Invoke\(new Provider\.ParameterModes\.IntTransform\(__tsonic_callable_[0-9]+\), value\);/);
  assert.match(generatedSource, /int __tsonic_callable_[0-9]+\(int current\)\s*\{\s*return current;\s*\}/);
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
