import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { assert, cliPath, existsSync, readFile, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../helpers/harness.mjs";

const bannedGeneratedRuntimeSemantics = [
  /\bdynamic\b/u,
  /\bSystem\.Reflection\b/u,
  /\bGetProperty\b/u,
  /\bGetProperties\b/u,
  /\bGetMethod\b/u,
  /\bGetMethods\b/u,
  /\bMethodInfo\.Invoke\b/u,
  /\bMakeGenericMethod\b/u,
  /\bActivator\.CreateInstance\b/u,
  /\bAssembly\.Load\b/u,
];

test("CLI builds and runs a whole-program C# module/declaration graph", async () => {
  const assemblyName = "SmokeGeneratedWholeProgramClosure";
  const projectDirectory = resolve(tempRoot, "whole-program-csharp-closure");
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
            outputType: "Exe",
            namespace: "Smoke.Generated",
            assemblyName,
          },
        },
      ],
    }, null, 2),
    "src/startup.ts": [
      "import { append } from \"./state.js\";",
      "append(\"startup;\");",
      "",
    ].join("\n"),
    "src/state.ts": [
      "export let text = \"\";",
      "export function append(value: string): void {",
      "  text = text + value;",
      "}",
      "",
    ].join("\n"),
    "src/model.ts": [
      "export interface Model {",
      "  name: string;",
      "}",
      "",
      "export class Person {",
      "  name: string;",
      "",
      "  constructor(name: string) {",
      "    this.name = name;",
      "  }",
      "",
      "  describe(): string {",
      "    return this.name;",
      "  }",
      "}",
      "",
      "export class User extends Person {",
      "  static create(name: string): User {",
      "    return new User(name);",
      "  }",
      "",
      "  constructor(name: string) {",
      "    super(name);",
      "  }",
      "}",
      "",
      "export class Role {",
      "  static Admin = \"Admin\";",
      "}",
      "",
      "export type UserName = string;",
      "",
    ].join("\n"),
    "src/users.ts": [
      "import type { UserName } from \"./model.js\";",
      "import { User, Role } from \"./model.js\";",
      "import { append } from \"./state.js\";",
      "",
      "export function makeUser(name: UserName): User {",
      "  const user = User.create(name);",
      "  append(\"user:\" + user.name + \":\" + Role.Admin + \";\");",
      "  return user;",
      "}",
      "",
    ].join("\n"),
    "src/barrel.ts": [
      "export { makeUser as createUser } from \"./users.js\";",
      "",
    ].join("\n"),
    "src/greeter.ts": [
      "export default class Greeter {",
      "  message: string;",
      "",
      "  constructor(message: string) {",
      "    this.message = message;",
      "  }",
      "",
      "  greet(): string {",
      "    return this.message;",
      "  }",
      "}",
      "",
    ].join("\n"),
    "src/index.ts": [
      "import \"./startup.js\";",
      "import type { Model } from \"./model.js\";",
      "import { text } from \"./state.js\";",
      "import { createUser } from \"./barrel.js\";",
      "import Greeter from \"./greeter.js\";",
      "",
      "type ReadonlyModel = Readonly<Model>;",
      "const current = createUser(\"Ada\");",
      "const named: ReadonlyModel = { name: current.name };",
      "const greeter = new Greeter(named.name);",
      "console.log(greeter.greet() + \";\" + text);",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const indexSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(indexSource, /Startup\.__tsonic_module_init\(\);[\s\S]*State\.__tsonic_module_init\(\);[\s\S]*Barrel\.__tsonic_module_init\(\);/);
  assert.doesNotMatch(indexSource, /GreeterModule\.__tsonic_module_init\(\);/);
  assert.match(indexSource, /public static User current\s*\{\s*get;\s*private set;\s*\} = default\(User\)!;/u);
  const shapeSource = await readFile(resolve(projectDirectory, "out/csharp/generated/TsonicObjectShapes.cs"), "utf8");
  const shapeName = /public class ([A-Za-z][A-Za-z0-9_]*Shape_[a-f0-9]{12})/u.exec(shapeSource)?.[1];
  assert.ok(shapeName);
  assert.match(shapeSource, new RegExp(`public class ${shapeName}[\\s\\S]*public required string name;`));
  assert.match(indexSource, new RegExp(`public static ${shapeName} named`));
  assert.match(indexSource, /current = Users\.makeUser\("Ada"\);/);
  assert.match(indexSource, /greeter = new Greeter\(named\.name\);/);
  assert.doesNotMatch(indexSource, /Model\.__tsonic_module_init|UserName|__unsupported/);

  const modelSource = await readFile(resolve(projectDirectory, "out/csharp/src/Model.cs"), "utf8");
  assert.match(modelSource, /public interface Model/);
  assert.match(modelSource, /string name \{ get; set; \}/);
  assert.match(modelSource, /public class User : Person/);
  assert.match(modelSource, /public User\(string name\) : base\(name\)/);
  assert.match(modelSource, /public class Role/);
  assert.match(modelSource, /public static (?:readonly )?string Admin/);
  assert.doesNotMatch(modelSource, /UserName|__unsupported/);

  const usersSource = await readFile(resolve(projectDirectory, "out/csharp/src/Users.cs"), "utf8");
  assert.match(usersSource, /User user = User\.create\(name\);/);
  assert.match(usersSource, /State\.append\("user:" \+ user\.name \+ ":" \+ Role\.Admin \+ ";"\);/);
  assert.doesNotMatch(usersSource, /createUser|UserName|__unsupported/);

  const greeterSource = await readFile(resolve(projectDirectory, "out/csharp/src/Greeter.cs"), "utf8");
  assert.match(greeterSource, /public class Greeter/);
  assert.match(greeterSource, /public Greeter\(string message\)/);
  assert.match(greeterSource, /public string greet\(\)/);

  const projectFile = await readFile(resolve(projectDirectory, `out/csharp/${assemblyName}.csproj`), "utf8");
  assert.match(projectFile, /<Project Sdk="Microsoft\.NET\.Sdk">/);
  assert.match(projectFile, /<OutputType>Exe<\/OutputType>/);
  assert.match(projectFile, /<Reference Include="Tsonic\.CSharp\.Runtime" HintPath=".*csharp-runtime.*Tsonic\.CSharp\.Runtime\.dll" \/>/);
  assert.match(projectFile, /<Reference Include="Tsonic\.CSharp\.Js" HintPath=".*csharp-js.*Tsonic\.CSharp\.Js\.dll" \/>/);
  assert.doesNotMatch(projectFile, /Tsonic\.CSharp\.Node/);

  await assertGeneratedOutputHasNoReflectionSemantics(projectDirectory);
  assert.equal(runGeneratedProject(projectDirectory, assemblyName), "Ada;startup;user:Ada:Admin;\n");
});

test("CLI rejects cyclic runtime ESM graphs until live-binding and TDZ facts are implemented", async () => {
  const projectDirectory = resolve(tempRoot, "cyclic-module-closure");
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
            outputType: "Exe",
            namespace: "Smoke.Generated",
            assemblyName: "SmokeGeneratedCyclicModuleClosure",
          },
        },
      ],
    }, null, 2),
    "src/state.ts": [
      "export let text = \"\";",
      "export function append(value: string): void {",
      "  text = text + value;",
      "}",
      "",
    ].join("\n"),
    "src/a.ts": [
      "import { append } from \"./state.js\";",
      "import { bValue } from \"./b.js\";",
      "append(\"a\" + bValue + \";\");",
      "export const aValue = 1;",
      "",
    ].join("\n"),
    "src/b.ts": [
      "import { append } from \"./state.js\";",
      "import { aValue } from \"./a.js\";",
      "append(\"b\" + aValue + \";\");",
      "export const bValue = 2;",
      "",
    ].join("\n"),
    "src/index.ts": [
      "import { append, text } from \"./state.js\";",
      "import { aValue } from \"./a.js\";",
      "import { bValue } from \"./b.js\";",
      "append(\"i\" + aValue + bValue + \";\");",
      "console.log(text);",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1, build.stdout + build.stderr);
  assert.match(build.stderr, /CSHARP_UNSUPPORTED_RUNTIME_MODULE_CYCLE/u);
  assert.match(build.stderr, /Runtime ES module dependency cycle '[^']*a\.ts[^']*b\.ts[^']*'/u);
  assert.match(build.stderr, /live-binding and TDZ support/u);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedCyclicModuleClosure.csproj")), false);
});

test("CLI rejects unsupported whole-program declaration shapes before C# artifacts", async () => {
  const scenarios = [
    {
      name: "abstract-declarations",
      source: [
        "export abstract class Base {",
        "  abstract run(): string;",
        "}",
        "",
      ].join("\n"),
      diagnostic: /TypeScript-only modifier 'abstract'/,
    },
    {
      name: "string-enum",
      source: [
        "export enum Mode {",
        "  Read = \"read\",",
        "}",
        "",
      ].join("\n"),
      diagnostic: /C# enum member initializers must be integer constants evaluated by TSTS/,
    },
  ];

  for (const scenario of scenarios) {
    const projectDirectory = resolve(tempRoot, `whole-program-reject-${scenario.name}`);
    await writeProject(projectDirectory, {
      "tsonic.json": JSON.stringify({
        entryPoint: "index.ts",
        rootDir: "src",
        outDir: "out",
        targets: [{ id: "csharp" }],
      }, null, 2),
      "src/index.ts": scenario.source,
    });

    const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
    assert.equal(build.status, 1, scenario.name);
    assert.match(build.stderr, /CSHARP_UNSUPPORTED_AST/u, scenario.name);
    assert.match(build.stderr, scenario.diagnostic, scenario.name);
    assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false, scenario.name);
  }
});

async function assertGeneratedOutputHasNoReflectionSemantics(projectDirectory) {
  const generatedRoot = resolve(projectDirectory, "out/csharp");
  const files = await collectFiles(generatedRoot, (fileName) => fileName.endsWith(".cs"));
  assert.notEqual(files.length, 0);
  for (const file of files) {
    const text = await readFile(file, "utf8");
    for (const pattern of bannedGeneratedRuntimeSemantics) {
      assert.doesNotMatch(text, pattern, `${file} contains banned generated runtime semantic mechanism ${pattern}`);
    }
  }
}

async function collectFiles(directory, predicate) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(absolutePath, predicate));
    } else if (entry.isFile() && predicate(entry.name)) {
      files.push(absolutePath);
    }
  }
  return files;
}
