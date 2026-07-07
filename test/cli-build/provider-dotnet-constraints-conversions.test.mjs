import { assert, cliPath, dotnetOutputAssemblyPath, existsSync, readFile, repoRoot, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "./harness.mjs";

async function readGeneratedModuleSource(projectDirectory) {
  return readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
}

test("CLI enforces provider-backed generic interface constraints through TSTS declarations", async () => {
  const libraryDirectory = resolve(tempRoot, "provider-generic-constraint-library");
  await writeProject(libraryDirectory, {
    "Acme.Constraints.csproj": [
      "<Project Sdk=\"Microsoft.NET.Sdk\">",
      "  <PropertyGroup>",
      "    <TargetFramework>net10.0</TargetFramework>",
      "    <ImplicitUsings>disable</ImplicitUsings>",
      "    <Nullable>enable</Nullable>",
      "  </PropertyGroup>",
      "</Project>",
      "",
    ].join("\n"),
    "Constraints.cs": [
      "namespace Acme.Constraints;",
      "",
      "public interface IMarker",
      "{",
      "    int Marker { get; }",
      "}",
      "",
      "public sealed class Marked : IMarker",
      "{",
      "    public Marked() : this(0) {}",
      "    public Marked(int marker) => Marker = marker;",
      "    public int Marker { get; }",
      "}",
      "",
      "public sealed class Plain",
      "{",
      "    public Plain(int value) => Value = value;",
      "    public int Value { get; }",
      "}",
      "",
      "public sealed class Box<T> where T : IMarker",
      "{",
      "    public Box(T value) => Value = value;",
      "    public T Value { get; }",
      "    public int ReadMarker() => Value.Marker;",
      "}",
      "",
      "public sealed class ReferenceNewTarget<T> where T : class, IMarker, new()",
      "{",
      "    public void Copy<TMethod>(TMethod value) where TMethod : IMarker, new() {}",
      "}",
      "",
      "public sealed class StructTarget<T> where T : struct",
      "{",
      "}",
      "",
      "public sealed class UnmanagedTarget<T> where T : unmanaged",
      "{",
      "}",
      "",
      "public sealed class NotNullTarget<T> where T : notnull",
      "{",
      "}",
      "",
    ].join("\n"),
  });
  const libraryBuild = run("dotnet", ["build", resolve(libraryDirectory, "Acme.Constraints.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(libraryBuild.status, 0, libraryBuild.stdout + libraryBuild.stderr);
  const libraryAssembly = dotnetOutputAssemblyPath(libraryDirectory, "Acme.Constraints");
  assert.equal(existsSync(libraryAssembly), true);

  const validProjectDirectory = resolve(tempRoot, "provider-generic-constraint-valid");
  await writeProject(validProjectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          options: {
            namespace: "Smoke.Generated",
            assemblyName: "SmokeGeneratedProviderGenericConstraintValid",
            references: {
              assemblies: [{ include: "Acme.Constraints", hintPath: libraryAssembly }],
            },
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { Box, Marked, ReferenceNewTarget, StructTarget, UnmanagedTarget, NotNullTarget } from \"@tsonic/dotnet/Acme.Constraints.js\";",
      "import type { int } from \"@tsonic/csharp/types.js\";",
      "",
      "export function passBox(box: Box<Marked>): Box<Marked> {",
      "  return box;",
      "}",
      "",
      "export function passConstraintTargets(",
      "  referenceNew: ReferenceNewTarget<Marked>,",
      "  structTarget: StructTarget<int>,",
      "  unmanagedTarget: UnmanagedTarget<int>,",
      "  notNullTarget: NotNullTarget<string>,",
      "): void {",
      "  referenceNew.Copy(new Marked());",
      "}",
      "",
    ].join("\n"),
  });

  const validBuild = runNode([cliPath, "build", "--project", resolve(validProjectDirectory, "tsonic.json")]);
  assert.equal(validBuild.status, 0, validBuild.stdout + validBuild.stderr);
  const validGeneratedSource = await readGeneratedModuleSource(validProjectDirectory);
  assert.match(validGeneratedSource, /public static Acme\.Constraints\.Box<Acme\.Constraints\.Marked> passBox\(Acme\.Constraints\.Box<Acme\.Constraints\.Marked> box\)/);
  assert.match(validGeneratedSource, /Acme\.Constraints\.ReferenceNewTarget<Acme\.Constraints\.Marked> referenceNew/);
  assert.match(validGeneratedSource, /Acme\.Constraints\.StructTarget<int> structTarget/);
  assert.match(validGeneratedSource, /Acme\.Constraints\.UnmanagedTarget<int> unmanagedTarget/);
  assert.match(validGeneratedSource, /Acme\.Constraints\.NotNullTarget<string> notNullTarget/);
  assert.match(validGeneratedSource, /referenceNew\.Copy\(new Acme\.Constraints\.Marked\(\)\);/);
  assert.match(validGeneratedSource, /return box;/);
  assert.doesNotMatch(validGeneratedSource, /__unsupported/);

  const validDotnet = run("dotnet", ["build", resolve(validProjectDirectory, "out/csharp/SmokeGeneratedProviderGenericConstraintValid.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(validDotnet.status, 0, validDotnet.stdout + validDotnet.stderr);

  const invalidProjectDirectory = resolve(tempRoot, "provider-generic-constraint-invalid");
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
            assemblyName: "SmokeGeneratedProviderGenericConstraintInvalid",
            references: {
              assemblies: [{ include: "Acme.Constraints", hintPath: libraryAssembly }],
            },
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { Box, Plain, ReferenceNewTarget, StructTarget, UnmanagedTarget, NotNullTarget } from \"@tsonic/dotnet/Acme.Constraints.js\";",
      "import type { int } from \"@tsonic/csharp/types.js\";",
      "",
      "export function invalid(value: Plain): void {",
      "  const box: Box<Plain> = new Box(value);",
      "  const referenceNew: ReferenceNewTarget<Plain> = new ReferenceNewTarget();",
      "  referenceNew.Copy(value);",
      "  const structTarget: StructTarget<Plain> = new StructTarget();",
      "  const unmanagedTarget: UnmanagedTarget<Plain> = new UnmanagedTarget();",
      "  const notNullTarget: NotNullTarget<Plain | null> = new NotNullTarget();",
      "  const validStruct: StructTarget<int> = new StructTarget();",
      "}",
      "",
    ].join("\n"),
  });

  const invalidBuild = runNode([cliPath, "build", "--project", resolve(invalidProjectDirectory, "tsonic.json")]);
  assert.notEqual(invalidBuild.status, 0);
  assert.match(invalidBuild.stdout + invalidBuild.stderr, /Plain|IMarker|value type|unmanaged|non-null|constraint/u);
  assert.equal(existsSync(resolve(invalidProjectDirectory, "out/csharp/SmokeGeneratedProviderGenericConstraintInvalid.csproj")), false);
});

