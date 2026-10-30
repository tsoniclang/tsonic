import { assert, cliPath, dotnetOutputAssemblyPath, existsSync, readFile, repoRoot, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";
import { readGeneratedModuleSource } from "./delegates-attributes-exceptions.split-fixtures.mjs";

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
      "A<Annotated>().add(() => new CLSCompliantAttribute(true));",
      "A<Annotated>().constructor().add(() => new CLSCompliantAttribute(true));",
      "A<Annotated>().constructor().parameter(\"seed\").add(() => new CLSCompliantAttribute(false));",
      "A<Annotated>().property((target) => target.value).target(\"field\").add(() => new CLSCompliantAttribute(false));",
      "A<Annotated>().property((target) => target.computed).target(\"property\").add(() => new CLSCompliantAttribute(true));",
      "A<Annotated>().method((target) => target.run).add(() => new CLSCompliantAttribute(true));",
      "A<Annotated>().method((target) => target.run).target(\"return\").add(() => new CLSCompliantAttribute(false));",
      "A<Annotated>().method((target) => target.run).parameter(\"input\").target(\"param\").add(() => new CLSCompliantAttribute(false));",
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
      "A<Annotated>().method((target) => target.run).target(\"assembly\").add(() => new CLSCompliantAttribute(true));",
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
    // RULINGS 2026-10-23: no redundant (int) cast on an int literal.
    /throw Tsonic\.CSharp\.Runtime\.TsThrownValueException\.from\(Tsonic\.CSharp\.Runtime\.TsValue\.from\(1\)\);/u,
  );
  assert.doesNotMatch(generatedSource, /\bdynamic\b|System\.Reflection/u);
  const project = resolve(projectDirectory, "out/csharp/SmokeGeneratedThrowFacts.csproj");
  const dotnet = run("dotnet", ["build", project, "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});
