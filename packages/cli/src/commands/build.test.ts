import { describe, it } from "mocha";
import { expect } from "chai";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { resolveConfig } from "../config.js";
import { applyAikyaWorkspaceOverlay } from "../aikya/bindings.js";
import { generateCommand } from "./generate.js";
import { buildCommand } from "./build.js";

const repoRoot = resolve(
  join(dirname(fileURLToPath(import.meta.url)), "../../../..")
);
const localJsPackageRoot = resolve(
  join(repoRoot, "..", "js", "versions", "10")
);
const linkedJsPackageRoot = existsSync(localJsPackageRoot)
  ? localJsPackageRoot
  : join(repoRoot, "node_modules/@tsonic/js");

const linkDir = (target: string, linkPath: string): void => {
  mkdirSync(dirname(linkPath), { recursive: true });
  symlinkSync(target, linkPath, "dir");
};

const run = (cwd: string, command: string, args: readonly string[]): void => {
  const result = spawnSync(command, args, { cwd, encoding: "utf-8" });
  if (result.status !== 0) {
    const msg = result.stderr || result.stdout || `Exit code ${result.status}`;
    throw new Error(`${command} ${args.join(" ")} failed:\n${msg}`);
  }
};

const readGeneratedCSharpTree = (root: string): string => {
  const chunks: string[] = [];
  const visit = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const nextPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(nextPath);
        continue;
      }
      if (entry.isFile() && nextPath.endsWith(".cs")) {
        chunks.push(readFileSync(nextPath, "utf-8"));
      }
    }
  };

  if (existsSync(root) && statSync(root).isDirectory()) {
    visit(root);
  }
  return chunks.join("\n");
};

const resolveEffectiveConfig = (
  workspaceConfig: Parameters<typeof resolveConfig>[0],
  projectConfig: Parameters<typeof resolveConfig>[1],
  workspaceRoot: string,
  projectRoot: string,
  entryFile?: string
) => {
  const overlay = applyAikyaWorkspaceOverlay(workspaceRoot, workspaceConfig);
  expect(overlay.ok).to.equal(true);
  if (!overlay.ok) {
    throw new Error(overlay.error);
  }

  return resolveConfig(
    overlay.value.config,
    projectConfig,
    {},
    workspaceRoot,
    projectRoot,
    entryFile
  );
};

describe("build command (library bindings ref dirs)", function () {
  this.timeout(10 * 60 * 1000);

  it("prefers local DLL references over duplicate NuGet package references in generated csproj", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-local-dll-wins-"));
    try {
      mkdirSync(join(dir, "node_modules"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          { name: "test-workspace", private: true, type: "module" },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      linkDir(
        join(repoRoot, "node_modules/@tsonic/globals"),
        join(dir, "node_modules/@tsonic/globals")
      );
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );
      linkDir(
        join(repoRoot, "node_modules/@tsonic/dotnet"),
        join(dir, "node_modules/@tsonic/dotnet")
      );

      const runtimeDll = join(
        repoRoot,
        "packages/cli/runtime/Tsonic.Runtime.dll"
      );
      expect(existsSync(runtimeDll)).to.equal(true);

      const workspaceConfig = {
        $schema: "https://tsonic.org/schema/workspace/v1.json",
        dotnetVersion: "net10.0",
        dotnet: {
          libraries: [runtimeDll],
          frameworkReferences: [],
          packageReferences: [{ id: "Tsonic.Runtime", version: "0.0.1" }],
        },
      };

      const projectRoot = join(dir, "packages", "app");
      mkdirSync(join(projectRoot, "src"), { recursive: true });
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify(
          {
            name: "@acme/app",
            version: "1.0.0",
            private: true,
            type: "module",
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "index.ts"),
        "export function main(): void {}\n",
        "utf-8"
      );

      const projectConfig = {
        $schema: "https://tsonic.org/schema/v1.json",
        rootNamespace: "App",
        entryPoint: "src/index.ts",
        sourceRoot: "src",
        outputDirectory: "generated",
        outputName: "App",
      };

      const config = resolveEffectiveConfig(
        workspaceConfig,
        projectConfig,
        dir,
        projectRoot
      );

      const gen = generateCommand(config);
      expect(gen.ok).to.equal(true);
      if (!gen.ok) return;

      const csprojText = readFileSync(
        join(projectRoot, "generated", "tsonic.csproj"),
        "utf-8"
      );

      expect(csprojText).to.include('<Reference Include="Tsonic.Runtime">');
      expect(csprojText).to.not.include(
        '<PackageReference Include="Tsonic.Runtime" Version="0.0.1" />'
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("writes installed source-package modules inside generated output", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-source-package-gen-"));
    try {
      mkdirSync(join(dir, "node_modules"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          { name: "test-workspace", private: true, type: "module" },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      linkDir(linkedJsPackageRoot, join(dir, "node_modules/@tsonic/js"));
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );

      const sourcePackageRoot = join(dir, "node_modules/@acme/math");
      mkdirSync(join(sourcePackageRoot, "tsonic"), { recursive: true });
      mkdirSync(join(sourcePackageRoot, "src"), { recursive: true });
      writeFileSync(
        join(sourcePackageRoot, "package.json"),
        JSON.stringify(
          {
            name: "@acme/math",
            version: "1.0.0",
            type: "module",
            types: "./src/index.ts",
            exports: {
              ".": "./src/index.ts",
            },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(sourcePackageRoot, "tsonic/package-manifest.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            surfaces: ["@tsonic/js"],
            source: {
              exports: {
                ".": "./src/index.ts",
              },
            },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(sourcePackageRoot, "src/index.ts"),
        "export function clamp(x: number, min: number, max: number): number { return x < min ? min : x > max ? max : x; }\n",
        "utf-8"
      );

      const workspaceConfig = {
        $schema: "https://tsonic.org/schema/workspace/v1.json",
        dotnetVersion: "net10.0",
        surface: "@tsonic/js",
        dotnet: {
          typeRoots: ["node_modules/@tsonic/js"],
          libraries: [],
          frameworkReferences: [],
          packageReferences: [],
        },
      };

      const projectRoot = join(dir, "packages", "app");
      mkdirSync(join(projectRoot, "src"), { recursive: true });
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify(
          {
            name: "@acme/app",
            version: "1.0.0",
            private: true,
            type: "module",
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "index.ts"),
        'import { clamp } from "@acme/math";\nexport function main(): void { console.log(clamp(10, 0, 5).toString()); }\n',
        "utf-8"
      );

      const projectConfig = {
        $schema: "https://tsonic.org/schema/v1.json",
        rootNamespace: "App",
        entryPoint: "src/index.ts",
        sourceRoot: "src",
        outputDirectory: "generated",
        outputName: "App",
      };

      const config = resolveEffectiveConfig(
        workspaceConfig,
        projectConfig,
        dir,
        projectRoot
      );

      const result = generateCommand(config);
      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const generatedTree = join(projectRoot, "generated");
      const generatedMathPaths = [
        join(
          generatedTree,
          "__external__",
          "node_modules",
          "@acme",
          "math",
          "src",
          "index.cs"
        ),
        join(generatedTree, "node_modules", "@acme", "math", "src", "index.cs"),
      ];

      expect(
        generatedMathPaths.some((filePath) => existsSync(filePath))
      ).to.equal(true);
      expect(
        existsSync(
          join(projectRoot, "node_modules", "@acme", "math", "src", "index.cs")
        )
      ).to.equal(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("generates bindings for libraries that reference other DLLs and Tsonic.Runtime without requiring copy-local", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-build-lib-"));
    try {
      mkdirSync(join(dir, "node_modules"), { recursive: true });
      mkdirSync(join(dir, "libs"), { recursive: true });

      // Workspace root package.json is required for createRequire-based resolution.
      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          { name: "test-workspace", private: true, type: "module" },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      // Provide required standard bindings packages (no network).
      linkDir(
        join(repoRoot, "node_modules/@tsonic/globals"),
        join(dir, "node_modules/@tsonic/globals")
      );
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );
      linkDir(
        join(repoRoot, "node_modules/@tsonic/dotnet"),
        join(dir, "node_modules/@tsonic/dotnet")
      );

      // Build a tiny external dependency DLL (Dep.dll) OUTSIDE the library output folder.
      const depDir = join(dir, "deps", "dep");
      mkdirSync(depDir, { recursive: true });
      writeFileSync(
        join(depDir, "Dep.csproj"),
        `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <ImplicitUsings>false</ImplicitUsings>
    <Nullable>enable</Nullable>
    <AssemblyName>Dep</AssemblyName>
  </PropertyGroup>
</Project>
`,
        "utf-8"
      );
      writeFileSync(
        join(depDir, "Foo.cs"),
        `namespace Dep;\npublic sealed class Foo { }\n`,
        "utf-8"
      );
      const depOut = join(dir, "deps", "out");
      mkdirSync(depOut, { recursive: true });
      run(depDir, "dotnet", [
        "build",
        "-c",
        "Release",
        "-o",
        depOut,
        "--nologo",
      ]);
      const depDll = join(depOut, "Dep.dll");
      expect(existsSync(depDll)).to.equal(true);

      // Minimal workspace config (no NuGet deps).
      const workspaceConfig = {
        $schema: "https://tsonic.org/schema/workspace/v1.json",
        dotnetVersion: "net10.0",
        dotnet: {
          typeRoots: ["node_modules/@tsonic/globals"],
          libraries: [],
          frameworkReferences: [],
          packageReferences: [],
        },
      };

      const projectRoot = join(dir, "packages", "app");
      mkdirSync(join(projectRoot, "src"), { recursive: true });
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify(
          {
            name: "@acme/app-lib",
            version: "1.2.3",
            private: true,
            type: "module",
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "index.ts"),
        `export function main(): void { }\n`,
        "utf-8"
      );

      const projectConfig = {
        $schema: "https://tsonic.org/schema/v1.json",
        rootNamespace: "App",
        entryPoint: "src/index.ts",
        sourceRoot: "src",
        outputDirectory: "generated",
        outputName: "App",
        output: { type: "library" as const },
        references: {
          libraries: [depDll],
        },
      };

      const config = resolveEffectiveConfig(
        workspaceConfig,
        projectConfig,
        dir,
        projectRoot
      );

      // 1) Generate C# once.
      const gen = generateCommand(config);
      expect(gen.ok).to.equal(true);

      // 2) Inject a C# file that uses Dep.Foo so the compiled DLL has an AssemblyRef.
      const generatedDir = join(projectRoot, "generated");
      writeFileSync(
        join(generatedDir, "Extra.cs"),
        `namespace App;\npublic static class Extra { public static Dep.Foo Echo(Dep.Foo x) => x; }\n`,
        "utf-8"
      );

      // 3) Build from the existing generated output directory and generate bindings.
      const build = buildCommand({ ...config, noGenerate: true });
      expect(build.ok).to.equal(true);

      // Sanity: bindings were emitted for the library.
      expect(
        existsSync(join(projectRoot, "dist", "tsonic", "bindings"))
      ).to.equal(true);
      const declarationPath = join(projectRoot, "dist", "index.d.ts");
      expect(existsSync(declarationPath)).to.equal(true);
      const declarationText = readFileSync(declarationPath, "utf-8");
      expect(declarationText).to.include(
        "export declare function main(): void;"
      );

      const aikyaManifestPath = join(
        projectRoot,
        "dist",
        "tsonic",
        "package-manifest.json"
      );
      expect(existsSync(aikyaManifestPath)).to.equal(true);
      const aikyaManifest = JSON.parse(
        readFileSync(aikyaManifestPath, "utf-8")
      ) as Record<string, unknown>;
      expect(aikyaManifest["schemaVersion"]).to.equal(1);
      expect(aikyaManifest["kind"]).to.equal("tsonic-library");
      expect(aikyaManifest["npmPackage"]).to.equal("@acme/app-lib");
      expect(aikyaManifest["npmVersion"]).to.equal("1.2.3");
      const runtime = aikyaManifest["runtime"] as
        | {
            nugetPackages: { id: string; version: string }[];
            assemblies: string[];
          }
        | undefined;
      expect(runtime?.nugetPackages?.some((x) => x.id === "App")).to.equal(
        true
      );
      expect(runtime?.assemblies).to.deep.equal(["App"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("build command (native library port regressions)", function () {
  this.timeout(10 * 60 * 1000);

  it("builds Array.isArray overload recursion without losing scalar narrowing", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-build-array-narrow-"));
    try {
      mkdirSync(join(dir, "node_modules"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          { name: "test-workspace", private: true, type: "module" },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      linkDir(linkedJsPackageRoot, join(dir, "node_modules/@tsonic/js"));
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );

      const workspaceConfig = {
        $schema: "https://tsonic.org/schema/workspace/v1.json",
        dotnetVersion: "net10.0",
        surface: "@tsonic/js",
        dotnet: {
          typeRoots: ["node_modules/@tsonic/js"],
          libraries: [],
          frameworkReferences: [],
          packageReferences: [],
        },
      };

      const projectRoot = join(dir, "packages", "app");
      mkdirSync(join(projectRoot, "src"), { recursive: true });
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify(
          {
            name: "@acme/app",
            version: "1.0.0",
            private: true,
            type: "module",
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "index.ts"),
        [
          "class A {",
          "  append(field: string, value: string): A;",
          "  append(field: string, value: readonly string[]): A;",
          "  append(field: string, value: string | readonly string[]): A {",
          "    if (Array.isArray(value)) {",
          "      const values = value as readonly string[];",
          "      for (let index = 0; index < values.length; index += 1) {",
          "        const item = values[index]!;",
          "        this.append(field, item);",
          "      }",
          "      return this;",
          "    }",
          "    return this;",
          "  }",
          "}",
          'export function main(): void { new A().append("x", ["a", "b"]); }',
        ].join("\n"),
        "utf-8"
      );

      const projectConfig = {
        $schema: "https://tsonic.org/schema/v1.json",
        rootNamespace: "App",
        entryPoint: "src/index.ts",
        sourceRoot: "src",
        outputDirectory: "generated",
        outputName: "App",
      };

      const config = resolveEffectiveConfig(
        workspaceConfig,
        projectConfig,
        dir,
        projectRoot
      );

      const result = buildCommand(config);
      if (!result.ok) {
        throw new Error(result.error);
      }
      expect(result.ok).to.equal(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("builds Array.isArray fallthrough narrowing for function declarations on the JS surface", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-build-array-fallthrough-"));
    try {
      mkdirSync(join(dir, "node_modules"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          { name: "test-workspace", private: true, type: "module" },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      linkDir(linkedJsPackageRoot, join(dir, "node_modules/@tsonic/js"));
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );

      const workspaceConfig = {
        $schema: "https://tsonic.org/schema/workspace/v1.json",
        dotnetVersion: "net10.0",
        surface: "@tsonic/js",
        dotnet: {
          typeRoots: ["node_modules/@tsonic/js"],
          libraries: [],
          frameworkReferences: [],
          packageReferences: [],
        },
      };

      const projectRoot = join(dir, "packages", "app");
      mkdirSync(join(projectRoot, "src"), { recursive: true });
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify(
          {
            name: "@acme/app",
            version: "1.0.0",
            private: true,
            type: "module",
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "index.ts"),
        [
          "export function appendHeader(value: string | string[]): string {",
          "  if (Array.isArray(value)) {",
          '    return value.join("|");',
          "  }",
          "  return value;",
          "}",
          "",
          "export function main(): void {",
          '  console.log(appendHeader(\"value\"));',
          '  console.log(appendHeader([\"a\", \"b\"]));',
          "}",
        ].join("\n"),
        "utf-8"
      );

      const projectConfig = {
        $schema: "https://tsonic.org/schema/v1.json",
        rootNamespace: "App",
        entryPoint: "src/index.ts",
        sourceRoot: "src",
        outputDirectory: "generated",
        outputName: "App",
      };

      const config = resolveEffectiveConfig(
        workspaceConfig,
        projectConfig,
        dir,
        projectRoot
      );

      const result = buildCommand(config);
      if (!result.ok) {
        throw new Error(result.error);
      }
      expect(result.ok).to.equal(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("builds Array.isArray fallthrough narrowing for methods on the JS surface", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-build-array-method-fallthrough-")
    );
    try {
      mkdirSync(join(dir, "node_modules"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          { name: "test-workspace", private: true, type: "module" },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      linkDir(linkedJsPackageRoot, join(dir, "node_modules/@tsonic/js"));
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );

      const workspaceConfig = {
        $schema: "https://tsonic.org/schema/workspace/v1.json",
        dotnetVersion: "net10.0",
        surface: "@tsonic/js",
        dotnet: {
          typeRoots: ["node_modules/@tsonic/js"],
          libraries: [],
          frameworkReferences: [],
          packageReferences: [],
        },
      };

      const projectRoot = join(dir, "packages", "app");
      mkdirSync(join(projectRoot, "src"), { recursive: true });
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify(
          {
            name: "@acme/app",
            version: "1.0.0",
            private: true,
            type: "module",
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "index.ts"),
        [
          "class Response {",
          '  private header = "";',
          "  append(field: string, value: string): void;",
          "  append(field: string, value: string[]): void;",
          "  append(field: string, value: string | string[]): void {",
          "    if (Array.isArray(value)) {",
          "      for (let index = 0; index < value.length; index += 1) {",
          "        this.append(field, value[index]!);",
          "      }",
          "      return;",
          "    }",
          "    this.header = field + ':' + value;",
          "    return;",
          "  }",
          "}",
          "",
          "export function main(): void {",
          '  new Response().append("x", ["a", "b"]);',
          '  new Response().append("x", "c");',
          "}",
        ].join("\n"),
        "utf-8"
      );

      const projectConfig = {
        $schema: "https://tsonic.org/schema/v1.json",
        rootNamespace: "App",
        entryPoint: "src/index.ts",
        sourceRoot: "src",
        outputDirectory: "generated",
        outputName: "App",
      };

      const config = resolveEffectiveConfig(
        workspaceConfig,
        projectConfig,
        dir,
        projectRoot
      );

      const result = buildCommand(config);
      if (!result.ok) {
        throw new Error(result.error);
      }
      expect(result.ok).to.equal(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("builds express-style TS overload families without emitting non-overrides as CLR overrides", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-build-express-overload-overrides-")
    );
    try {
      mkdirSync(join(dir, "node_modules"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          { name: "test-workspace", private: true, type: "module" },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      linkDir(linkedJsPackageRoot, join(dir, "node_modules/@tsonic/js"));
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );

      const workspaceConfig = {
        $schema: "https://tsonic.org/schema/workspace/v1.json",
        dotnetVersion: "net10.0",
        surface: "@tsonic/js",
        dotnet: {
          typeRoots: ["node_modules/@tsonic/js"],
          libraries: [],
          frameworkReferences: [],
          packageReferences: [],
        },
      };

      const projectRoot = join(dir, "packages", "app");
      mkdirSync(join(projectRoot, "src"), { recursive: true });
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify(
          {
            name: "@acme/app",
            version: "1.0.0",
            private: true,
            type: "module",
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "index.ts"),
        [
          "type PathSpec = string | RegExp;",
          "type ParamHandler = (value: string) => void;",
          "",
          "class Router {",
          "  get(path: PathSpec, ...handlers: (() => void)[]): this {",
          "    void path;",
          "    void handlers;",
          "    return this;",
          "  }",
          "  param(name: string, callback: ParamHandler): this {",
          "    void name;",
          "    void callback;",
          "    return this;",
          "  }",
          "}",
          "",
          "class Application extends Router {",
          "  get(name: string): unknown;",
          "  override get(path: PathSpec, ...handlers: (() => void)[]): this;",
          "  override get(nameOrPath: string | PathSpec, ...handlers: (() => void)[]): unknown {",
          '    if (handlers.length === 0 && typeof nameOrPath === "string") {',
          "      return undefined;",
          "    }",
          "    return super.get(nameOrPath as PathSpec, ...handlers);",
          "  }",
          "",
          "  override param(name: string, callback: ParamHandler): this;",
          "  param(name: string[], callback: ParamHandler): this;",
          "  override param(name: string | string[], callback: ParamHandler): this {",
          "    if (Array.isArray(name)) {",
          "      return this;",
          "    }",
          "    return super.param(name, callback);",
          "  }",
          "}",
          "",
          "export function main(): void {",
          "  const app = new Application();",
          '  app.get("/items", () => {});',
          '  app.param("id", (_value) => {});',
          "}",
        ].join("\n"),
        "utf-8"
      );

      const projectConfig = {
        $schema: "https://tsonic.org/schema/v1.json",
        rootNamespace: "App",
        entryPoint: "src/index.ts",
        sourceRoot: "src",
        outputDirectory: "generated",
        outputName: "App",
      };

      const config = resolveEffectiveConfig(
        workspaceConfig,
        projectConfig,
        dir,
        projectRoot
      );

      const result = buildCommand(config);
      if (!result.ok) {
        throw new Error(result.error);
      }
      expect(result.ok).to.equal(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("builds JS array-like interop results and deterministic union constructor arguments in native ports", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-build-js-array-like-interop-")
    );
    try {
      mkdirSync(join(dir, "node_modules"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          { name: "test-workspace", private: true, type: "module" },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      linkDir(linkedJsPackageRoot, join(dir, "node_modules/@tsonic/js"));
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );

      const workspaceConfig = {
        $schema: "https://tsonic.org/schema/workspace/v1.json",
        dotnetVersion: "net10.0",
        surface: "@tsonic/js",
        dotnet: {
          typeRoots: ["node_modules/@tsonic/js"],
          libraries: [],
          frameworkReferences: [],
          packageReferences: [],
        },
      };

      const projectRoot = join(dir, "packages", "app");
      mkdirSync(join(projectRoot, "src"), { recursive: true });
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify(
          {
            name: "@acme/app",
            version: "1.0.0",
            private: true,
            type: "module",
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "index.ts"),
        [
          "export function run(values: string[], stat: string, pattern: string, value: string): boolean {",
          "  const filtered = values.filter((item) => item.length > 0);",
          '  const parts = stat.split(" ");',
          "  const regex = new RegExp(pattern);",
          "  return filtered.length >= 0 && parts.length >= 0 && regex.test(value);",
          "}",
          "",
          "export function main(): void {",
          '  console.log(run(["a", ""], "dev 123", "abc", "abc"));',
          "}",
        ].join("\n"),
        "utf-8"
      );

      const projectConfig = {
        $schema: "https://tsonic.org/schema/v1.json",
        rootNamespace: "App",
        entryPoint: "src/index.ts",
        sourceRoot: "src",
        outputDirectory: "generated",
        outputName: "App",
      };

      const config = resolveEffectiveConfig(
        workspaceConfig,
        projectConfig,
        dir,
        projectRoot
      );

      const result = buildCommand(config);
      if (!result.ok) {
        throw new Error(result.error);
      }
      expect(result.ok).to.equal(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("hoists instance-bound property initializers into constructors for native ports", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-build-instance-init-"));
    try {
      mkdirSync(join(dir, "node_modules"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          { name: "test-workspace", private: true, type: "module" },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      linkDir(linkedJsPackageRoot, join(dir, "node_modules/@tsonic/js"));
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );

      const workspaceConfig = {
        $schema: "https://tsonic.org/schema/workspace/v1.json",
        dotnetVersion: "net10.0",
        surface: "@tsonic/js",
        dotnet: {
          typeRoots: ["node_modules/@tsonic/js"],
          libraries: [],
          frameworkReferences: [],
          packageReferences: [],
        },
      };

      const projectRoot = join(dir, "packages", "app");
      mkdirSync(join(projectRoot, "src"), { recursive: true });
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify(
          {
            name: "@acme/app",
            version: "1.0.0",
            private: true,
            type: "module",
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "index.ts"),
        [
          "class Application {",
          "  readonly router: Application = this;",
          "}",
          "",
          "export function main(): Application {",
          "  return new Application().router;",
          "}",
        ].join("\n"),
        "utf-8"
      );

      const projectConfig = {
        $schema: "https://tsonic.org/schema/v1.json",
        rootNamespace: "App",
        entryPoint: "src/index.ts",
        sourceRoot: "src",
        outputDirectory: "generated",
        outputName: "App",
      };

      const config = resolveEffectiveConfig(
        workspaceConfig,
        projectConfig,
        dir,
        projectRoot
      );

      const result = buildCommand(config);
      if (!result.ok) {
        throw new Error(result.error);
      }
      expect(result.ok).to.equal(true);

      const tree = readGeneratedCSharpTree(join(projectRoot, "generated"));
      expect(tree).to.include("public Application router { get; init; }");
      expect(tree).to.include("public Application()");
      expect(tree).to.include("this.router = this;");
      expect(tree).to.not.include("router { get; init; } = this;");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("canonicalizes runtime union ordering across overload helpers and base dispatch", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-build-union-order-"));
    try {
      mkdirSync(join(dir, "node_modules"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          { name: "test-workspace", private: true, type: "module" },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      linkDir(linkedJsPackageRoot, join(dir, "node_modules/@tsonic/js"));
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );

      const workspaceConfig = {
        $schema: "https://tsonic.org/schema/workspace/v1.json",
        dotnetVersion: "net10.0",
        surface: "@tsonic/js",
        dotnet: {
          typeRoots: ["node_modules/@tsonic/js"],
          libraries: [],
          frameworkReferences: [],
          packageReferences: [],
        },
      };

      const projectRoot = join(dir, "packages", "app");
      mkdirSync(join(projectRoot, "src"), { recursive: true });
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify(
          {
            name: "@acme/app",
            version: "1.0.0",
            private: true,
            type: "module",
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "index.ts"),
        [
          "type PathSpec = string | readonly string[] | RegExp;",
          "",
          "class Router {",
          "  get(path: PathSpec, ...handlers: (() => void)[]): this {",
          "    void path;",
          "    void handlers;",
          "    return this;",
          "  }",
          "}",
          "",
          "class Application extends Router {",
          "  get(name: string): unknown;",
          "  override get(path: PathSpec, ...handlers: (() => void)[]): this;",
          "  override get(nameOrPath: string | PathSpec, ...handlers: (() => void)[]): unknown {",
          '    if (handlers.length === 0 && typeof nameOrPath === "string") {',
          "      return undefined;",
          "    }",
          "    return super.get(nameOrPath as PathSpec, ...handlers);",
          "  }",
          "}",
          "",
          "export function main(): void {",
          "  const app = new Application();",
          '  app.get("/items", () => {});',
          "}",
        ].join("\n"),
        "utf-8"
      );

      const projectConfig = {
        $schema: "https://tsonic.org/schema/v1.json",
        rootNamespace: "App",
        entryPoint: "src/index.ts",
        sourceRoot: "src",
        outputDirectory: "generated",
        outputName: "App",
      };

      const config = resolveEffectiveConfig(
        workspaceConfig,
        projectConfig,
        dir,
        projectRoot
      );

      const result = buildCommand(config);
      if (!result.ok) {
        throw new Error(result.error);
      }
      expect(result.ok).to.equal(true);

      const tree = readGeneratedCSharpTree(join(projectRoot, "generated"));
      const unionMatches = Array.from(
        tree.matchAll(
          /global::Tsonic\.Runtime\.Union<[^>]*global::Tsonic\.JSRuntime\.RegExp[^>]*>/g
        ),
        (match) => match[0]
      );
      expect(unionMatches.length).to.be.greaterThan(0);
      expect(new Set(unionMatches).size).to.equal(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("builds JSArray push calls for tuple and object-literal element values", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-build-push-element-"));
    try {
      mkdirSync(join(dir, "node_modules"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          { name: "test-workspace", private: true, type: "module" },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      linkDir(linkedJsPackageRoot, join(dir, "node_modules/@tsonic/js"));
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );

      const workspaceConfig = {
        $schema: "https://tsonic.org/schema/workspace/v1.json",
        dotnetVersion: "net10.0",
        surface: "@tsonic/js",
        dotnet: {
          typeRoots: ["node_modules/@tsonic/js"],
          libraries: [],
          frameworkReferences: [],
          packageReferences: [],
        },
      };

      const projectRoot = join(dir, "packages", "app");
      mkdirSync(join(projectRoot, "src"), { recursive: true });
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify(
          {
            name: "@acme/app",
            version: "1.0.0",
            private: true,
            type: "module",
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "index.ts"),
        [
          "type RouteLayer = {",
          "  path: string;",
          "  method: string | undefined;",
          "  middleware: boolean;",
          "  handlers: string[];",
          "};",
          "",
          "class Params {",
          "  entries(): [string, string][] {",
          "    const result: [string, string][] = [];",
          '    const key = "name";',
          '    const value = "value";',
          "    result.push([key, value]);",
          "    return result;",
          "  }",
          "}",
          "",
          "class Router {",
          "  layers: RouteLayer[] = [];",
          "  add(path: string, method: string | undefined, handlers: string[]): void {",
          "    this.layers.push({ path, method, middleware: false, handlers });",
          "  }",
          "}",
          "",
          "export function main(): void {",
          "  new Params().entries();",
          '  new Router().add("/", "GET", []);',
          "}",
        ].join("\n"),
        "utf-8"
      );

      const projectConfig = {
        $schema: "https://tsonic.org/schema/v1.json",
        rootNamespace: "App",
        entryPoint: "src/index.ts",
        sourceRoot: "src",
        outputDirectory: "generated",
        outputName: "App",
      };

      const config = resolveEffectiveConfig(
        workspaceConfig,
        projectConfig,
        dir,
        projectRoot
      );

      const result = buildCommand(config);
      if (!result.ok) {
        throw new Error(result.error);
      }
      expect(result.ok).to.equal(true);

      const tree = readGeneratedCSharpTree(join(projectRoot, "generated"));
      expect(tree).to.not.include(
        "push(new global::System.ValueTuple<string, string>[]"
      );
      expect(tree).to.not.include("push(new global::App.RouteLayer[]");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("builds CLR enum toString calls and nullable-int nullish coalescing in JS-surface ports", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-build-native-port-"));
    try {
      mkdirSync(join(dir, "node_modules"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          { name: "test-workspace", private: true, type: "module" },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      linkDir(linkedJsPackageRoot, join(dir, "node_modules/@tsonic/js"));
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );
      linkDir(
        join(repoRoot, "node_modules/@tsonic/dotnet"),
        join(dir, "node_modules/@tsonic/dotnet")
      );

      const workspaceConfig = {
        $schema: "https://tsonic.org/schema/workspace/v1.json",
        dotnetVersion: "net10.0",
        surface: "@tsonic/js",
        dotnet: {
          typeRoots: ["node_modules/@tsonic/js"],
          libraries: [],
          frameworkReferences: [],
          packageReferences: [],
        },
      };

      const projectRoot = join(dir, "packages", "app");
      mkdirSync(join(projectRoot, "src"), { recursive: true });
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify(
          {
            name: "@acme/app",
            version: "1.0.0",
            private: true,
            type: "module",
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "index.ts"),
        [
          'import type { int } from "@tsonic/core/types.js";',
          'import { Environment } from "@tsonic/dotnet/System.js";',
          'import { RuntimeInformation } from "@tsonic/dotnet/System.Runtime.InteropServices.js";',
          "",
          "let currentExitCode: int | undefined = undefined;",
          "",
          "export function main(): void {",
          "  const arch = RuntimeInformation.ProcessArchitecture.toString();",
          "  const code: int | undefined = undefined;",
          "  const resolved = code ?? currentExitCode ?? (0 as int);",
          "  console.log(arch);",
          "  Environment.Exit(resolved);",
          "}",
        ].join("\n"),
        "utf-8"
      );

      const projectConfig = {
        $schema: "https://tsonic.org/schema/v1.json",
        rootNamespace: "App",
        entryPoint: "src/index.ts",
        sourceRoot: "src",
        outputDirectory: "generated",
        outputName: "App",
      };

      const config = resolveEffectiveConfig(
        workspaceConfig,
        projectConfig,
        dir,
        projectRoot
      );

      const result = buildCommand(config);
      if (!result.ok) {
        throw new Error(result.error);
      }
      expect(result.ok).to.equal(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("builds JS array callbacks and rest-only timer callbacks in JS-surface ports", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-build-js-array-callbacks-"));
    try {
      mkdirSync(join(dir, "node_modules"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          { name: "test-workspace", private: true, type: "module" },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      linkDir(linkedJsPackageRoot, join(dir, "node_modules/@tsonic/js"));
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );

      const workspaceConfig = {
        $schema: "https://tsonic.org/schema/workspace/v1.json",
        dotnetVersion: "net10.0",
        surface: "@tsonic/js",
        dotnet: {
          typeRoots: ["node_modules/@tsonic/js"],
          libraries: [],
          frameworkReferences: [],
          packageReferences: [],
        },
      };

      const projectRoot = join(dir, "packages", "app");
      mkdirSync(join(projectRoot, "src"), { recursive: true });
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify(
          {
            name: "@acme/app",
            version: "1.0.0",
            private: true,
            type: "module",
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "index.ts"),
        [
          "type Todo = { id: number; title: string; completed: boolean };",
          "const todos: Todo[] = [];",
          "",
          "export function getById(id: number): Todo | undefined {",
          "  return todos.find((t) => t.id === id);",
          "}",
          "",
          "export function remove(id: number): boolean {",
          "  const index = todos.findIndex((t) => t.id === id);",
          "  return index !== -1;",
          "}",
          "",
          "export function main(): void {",
          "  setInterval(() => {}, 1000);",
          "}",
        ].join("\n"),
        "utf-8"
      );

      const projectConfig = {
        $schema: "https://tsonic.org/schema/v1.json",
        rootNamespace: "App",
        entryPoint: "src/index.ts",
        sourceRoot: "src",
        outputDirectory: "generated",
        outputName: "App",
      };

      const config = resolveEffectiveConfig(
        workspaceConfig,
        projectConfig,
        dir,
        projectRoot
      );

      const result = buildCommand(config);
      if (!result.ok) {
        throw new Error(result.error);
      }
      expect(result.ok).to.equal(true);

      const tree = readGeneratedCSharpTree(join(projectRoot, "generated"));
      expect(tree).to.match(
        /new global::Tsonic\.JSRuntime\.JSArray<(?:global::App\.)?Todo(?:__Alias)?>\(todos\)\.find\(/
      );
      expect(tree).to.match(
        /new global::Tsonic\.JSRuntime\.JSArray<(?:global::App\.)?Todo(?:__Alias)?>\(todos\)\.findIndex\(/
      );
      expect(tree).to.include(
        "global::Tsonic.JSRuntime.Timers.setInterval(() =>"
      );
      expect(tree).to.not.include("__unused_args");
      expect(tree).to.not.include("todos.Find(");
      expect(tree).to.not.include("todos.FindIndex(");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("builds typeof-narrowed unknown entry assignments with concrete CLR casts", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-build-typeof-entry-casts-"));
    try {
      mkdirSync(join(dir, "node_modules"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          { name: "test-workspace", private: true, type: "module" },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      linkDir(linkedJsPackageRoot, join(dir, "node_modules/@tsonic/js"));
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );

      const workspaceConfig = {
        $schema: "https://tsonic.org/schema/workspace/v1.json",
        dotnetVersion: "net10.0",
        surface: "@tsonic/js",
        dotnet: {
          typeRoots: ["node_modules/@tsonic/js"],
          libraries: [],
          frameworkReferences: [],
          packageReferences: [],
        },
      };

      const projectRoot = join(dir, "packages", "app");
      mkdirSync(join(projectRoot, "src"), { recursive: true });
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify(
          {
            name: "@acme/app",
            version: "1.0.0",
            private: true,
            type: "module",
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "index.ts"),
        [
          "export function readFirst(root: Record<string, unknown>): string {",
          "  const first = Object.entries(root)[0];",
          '  let title = "";',
          "  let enabled = false;",
          "  let weight: number = 0;",
          "  if (first === undefined) return title;",
          "  const [key, value] = first;",
          '  if (typeof value === "string") {',
          "    title = value;",
          '  } else if (typeof value === "boolean") {',
          "    enabled = value;",
          '  } else if (typeof value === "number") {',
          "    weight = value;",
          "  }",
          "  return enabled ? `${key}:${title}:${weight}` : title;",
          "}",
          "",
          "export function main(): string {",
          '  return readFirst({ title: \"hello\" });',
          "}",
        ].join("\n"),
        "utf-8"
      );

      const projectConfig = {
        $schema: "https://tsonic.org/schema/v1.json",
        rootNamespace: "App",
        entryPoint: "src/index.ts",
        sourceRoot: "src",
        outputDirectory: "generated",
        outputName: "App",
      };

      const config = resolveEffectiveConfig(
        workspaceConfig,
        projectConfig,
        dir,
        projectRoot
      );

      const result = buildCommand(config);
      if (!result.ok) {
        throw new Error(result.error);
      }
      expect(result.ok).to.equal(true);

      const tree = readGeneratedCSharpTree(join(projectRoot, "generated"));
      expect(tree).to.include("title = (string)value;");
      expect(tree).to.include("enabled = (bool)value;");
      expect(tree).to.include("weight = (double)value;");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("keeps JS Object.entries object-based for JSON.parse<object> values narrowed by user guards", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-build-json-object-entries-")
    );
    try {
      mkdirSync(join(dir, "node_modules"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          { name: "test-workspace", private: true, type: "module" },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      linkDir(linkedJsPackageRoot, join(dir, "node_modules/@tsonic/js"));
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );

      const workspaceConfig = {
        $schema: "https://tsonic.org/schema/workspace/v1.json",
        dotnetVersion: "net10.0",
        surface: "@tsonic/js",
        dotnet: {
          typeRoots: ["node_modules/@tsonic/js"],
          libraries: [],
          frameworkReferences: [],
          packageReferences: [],
        },
      };

      const projectRoot = join(dir, "packages", "app");
      mkdirSync(join(projectRoot, "src"), { recursive: true });
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify(
          {
            name: "@acme/app",
            version: "1.0.0",
            private: true,
            type: "module",
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "index.ts"),
        [
          "const isObject = (value: unknown): value is Record<string, unknown> => {",
          '  return value !== null && typeof value === "object" && !Array.isArray(value);',
          "};",
          "",
          "export function main(): void {",
          '  const root = JSON.parse("{\\"title\\":\\"hello\\",\\"count\\":2}");',
          "  if (!isObject(root)) return;",
          "  const first = Object.entries(root)[0];",
          "  if (first === undefined) return;",
          "  const [key, value] = first;",
          '  if (typeof value === "number") {',
          "    console.log(key, value.toString());",
          '  } else if (typeof value === "string") {',
          "    console.log(key, value.toUpperCase());",
          "  }",
          "}",
        ].join("\n"),
        "utf-8"
      );

      const projectConfig = {
        $schema: "https://tsonic.org/schema/v1.json",
        rootNamespace: "App",
        entryPoint: "src/index.ts",
        sourceRoot: "src",
        outputDirectory: "generated",
        outputName: "App",
      };

      const config = resolveEffectiveConfig(
        workspaceConfig,
        projectConfig,
        dir,
        projectRoot
      );

      const result = buildCommand(config);
      if (!result.ok) {
        throw new Error(result.error);
      }
      expect(result.ok).to.equal(true);

      const tree = readGeneratedCSharpTree(join(projectRoot, "generated"));
      expect(tree).to.match(
        /global::Tsonic\.JSRuntime\.Object\.entries\([^\n]*root\)/
      );
      expect(tree).to.not.include(
        "(global::System.Collections.Generic.Dictionary<string, object?>)root"
      );
      expect(tree).to.not.include("global::System.Linq.Enumerable");
      expect(tree).to.include(
        "global::Tsonic.JSRuntime.Number.toString((double)value)"
      );
      expect(tree).to.include(
        "global::Tsonic.JSRuntime.String.toUpperCase((string)value)"
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("builds explicit generic ContinueWith state overloads with Task-returning local helpers", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-build-continuewith-"));
    try {
      mkdirSync(join(dir, "node_modules"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          { name: "test-workspace", private: true, type: "module" },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      linkDir(linkedJsPackageRoot, join(dir, "node_modules/@tsonic/js"));
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );
      linkDir(
        join(repoRoot, "node_modules/@tsonic/dotnet"),
        join(dir, "node_modules/@tsonic/dotnet")
      );

      const workspaceConfig = {
        $schema: "https://tsonic.org/schema/workspace/v1.json",
        dotnetVersion: "net10.0",
        surface: "@tsonic/js",
        dotnet: {
          typeRoots: ["node_modules/@tsonic/js"],
          libraries: [],
          frameworkReferences: [],
          packageReferences: [],
        },
      };

      const projectRoot = join(dir, "packages", "app");
      mkdirSync(join(projectRoot, "src"), { recursive: true });
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify(
          {
            name: "@acme/app",
            version: "1.0.0",
            private: true,
            type: "module",
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "index.ts"),
        [
          'import { Console } from "@tsonic/dotnet/System.js";',
          'import { Task, TaskExtensions } from "@tsonic/dotnet/System.Threading.Tasks.js";',
          "",
          "function writeTask(): Task {",
          '  Console.WriteLine("WRITE");',
          "  return Task.CompletedTask;",
          "}",
          "",
          "export function main(): void {",
          '  const t = Task.FromResult<string>("X").ContinueWith<Task>(',
          "    (task, _state) => {",
          "      Console.WriteLine(task.Result);",
          "      return writeTask();",
          "    },",
          "    undefined",
          "  );",
          "  TaskExtensions.Unwrap(t).Wait();",
          "}",
        ].join("\n"),
        "utf-8"
      );

      const projectConfig = {
        $schema: "https://tsonic.org/schema/v1.json",
        rootNamespace: "App",
        entryPoint: "src/index.ts",
        sourceRoot: "src",
        outputDirectory: "generated",
        outputName: "App",
      };

      const config = resolveEffectiveConfig(
        workspaceConfig,
        projectConfig,
        dir,
        projectRoot
      );

      const result = buildCommand(config);
      if (!result.ok) {
        throw new Error(result.error);
      }
      expect(result.ok).to.equal(true);

      const tree = readGeneratedCSharpTree(join(projectRoot, "generated"));
      expect(tree).to.include("return writeTask();");
      expect(tree).to.not.include("writeTask();\n                return;");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("builds generic discriminated unions with inline object members through helper calls", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-build-generic-result-"));
    try {
      mkdirSync(join(dir, "node_modules"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          { name: "test-workspace", private: true, type: "module" },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      linkDir(linkedJsPackageRoot, join(dir, "node_modules/@tsonic/js"));
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );

      const workspaceConfig = {
        $schema: "https://tsonic.org/schema/workspace/v1.json",
        dotnetVersion: "net10.0",
        surface: "@tsonic/js",
        dotnet: {
          typeRoots: ["node_modules/@tsonic/js"],
          libraries: [],
          frameworkReferences: [],
          packageReferences: [],
        },
      };

      const projectRoot = join(dir, "packages", "app");
      mkdirSync(join(projectRoot, "src"), { recursive: true });
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify(
          {
            name: "@acme/app",
            version: "1.0.0",
            private: true,
            type: "module",
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "index.ts"),
        [
          "type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };",
          "",
          "function ok<T, E>(value: T): Result<T, E> {",
          "  return { ok: true, value };",
          "}",
          "",
          "function err<T, E>(error: E): Result<T, E> {",
          "  return { ok: false, error };",
          "}",
          "",
          "export function divide(a: number, b: number): Result<number, string> {",
          "  if (b === 0) {",
          '    return err<number, string>("Division by zero");',
          "  }",
          "  return ok<number, string>(a / b);",
          "}",
          "",
          "export function main(): void {",
          "  divide(1, 0);",
          "  divide(4, 2);",
          "}",
        ].join("\n"),
        "utf-8"
      );

      const projectConfig = {
        $schema: "https://tsonic.org/schema/v1.json",
        rootNamespace: "App",
        entryPoint: "src/index.ts",
        sourceRoot: "src",
        outputDirectory: "generated",
        outputName: "App",
      };

      const config = resolveEffectiveConfig(
        workspaceConfig,
        projectConfig,
        dir,
        projectRoot
      );

      const result = buildCommand(config);
      if (!result.ok) {
        throw new Error(result.error);
      }
      expect(result.ok).to.equal(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("builds exact numeric widening through contextual generic lambdas", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-build-generic-long-"));
    try {
      mkdirSync(join(dir, "node_modules"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          { name: "test-workspace", private: true, type: "module" },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      linkDir(linkedJsPackageRoot, join(dir, "node_modules/@tsonic/js"));
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );

      const workspaceConfig = {
        $schema: "https://tsonic.org/schema/workspace/v1.json",
        dotnetVersion: "net10.0",
        surface: "@tsonic/js",
        dotnet: {
          typeRoots: ["node_modules/@tsonic/js"],
          libraries: [],
          frameworkReferences: [],
          packageReferences: [],
        },
      };

      const projectRoot = join(dir, "packages", "app");
      mkdirSync(join(projectRoot, "src"), { recursive: true });
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify(
          {
            name: "@acme/app",
            version: "1.0.0",
            private: true,
            type: "module",
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "index.ts"),
        [
          'import type { int, long } from "@tsonic/core/types.js";',
          "",
          "interface Box<T> {",
          "  value: T;",
          "}",
          "",
          "function wrap<T>(value: T): Box<T> {",
          "  return { value };",
          "}",
          "",
          "function mapBox<T, U>(box: Box<T>, fn: (value: T) => U): Box<U> {",
          "  return { value: fn(box.value) };",
          "}",
          "",
          "export function main(): long {",
          "  const input: Box<int> = wrap(25);",
          "  const output = mapBox<int, long>(input, (x) => (x as long) * 1000000);",
          "  return output.value;",
          "}",
        ].join("\n"),
        "utf-8"
      );

      const projectConfig = {
        $schema: "https://tsonic.org/schema/v1.json",
        rootNamespace: "App",
        entryPoint: "src/index.ts",
        sourceRoot: "src",
        outputDirectory: "generated",
        outputName: "App",
      };

      const config = resolveEffectiveConfig(
        workspaceConfig,
        projectConfig,
        dir,
        projectRoot
      );

      const result = buildCommand(config);
      if (!result.ok) {
        throw new Error(result.error);
      }
      expect(result.ok).to.equal(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("builds typeof fallthrough narrowing for class properties in JS-surface source ports", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-build-property-typeof-"));
    try {
      mkdirSync(join(dir, "node_modules"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          { name: "test-workspace", private: true, type: "module" },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      linkDir(linkedJsPackageRoot, join(dir, "node_modules/@tsonic/js"));
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );

      const workspaceConfig = {
        $schema: "https://tsonic.org/schema/workspace/v1.json",
        dotnetVersion: "net10.0",
        surface: "@tsonic/js",
        dotnet: {
          typeRoots: ["node_modules/@tsonic/js"],
          libraries: [],
          frameworkReferences: [],
          packageReferences: [],
        },
      };

      const projectRoot = join(dir, "packages", "app");
      mkdirSync(join(projectRoot, "src"), { recursive: true });
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify(
          {
            name: "@acme/app",
            version: "1.0.0",
            private: true,
            type: "module",
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "index.ts"),
        [
          "class Application {",
          '  mountpath: string | string[] = "/";',
          "  private acceptString(value: string): void {",
          "    console.log(value);",
          "  }",
          "  path(): string {",
          '    if (typeof this.mountpath === "string") {',
          "      return this.mountpath;",
          "    }",
          "    const item = this.mountpath[0]!;",
          "    this.acceptString(item);",
          "    return item;",
          "  }",
          "}",
          "",
          "export function main(): string {",
          "  return new Application().path();",
          "}",
        ].join("\n"),
        "utf-8"
      );

      const projectConfig = {
        $schema: "https://tsonic.org/schema/v1.json",
        rootNamespace: "App",
        entryPoint: "src/index.ts",
        sourceRoot: "src",
        outputDirectory: "generated",
        outputName: "App",
      };

      const config = resolveEffectiveConfig(
        workspaceConfig,
        projectConfig,
        dir,
        projectRoot
      );

      const result = buildCommand(config);
      if (!result.ok) {
        throw new Error(result.error);
      }
      expect(result.ok).to.equal(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("builds compound typeof fallthrough narrowing after early-return disjunction branches", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-build-typeof-disjunction-"));
    try {
      mkdirSync(join(dir, "node_modules"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          { name: "test-workspace", private: true, type: "module" },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      linkDir(linkedJsPackageRoot, join(dir, "node_modules/@tsonic/js"));
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );

      const workspaceConfig = {
        $schema: "https://tsonic.org/schema/workspace/v1.json",
        dotnetVersion: "net10.0",
        surface: "@tsonic/js",
        dotnet: {
          typeRoots: ["node_modules/@tsonic/js"],
          libraries: [],
          frameworkReferences: [],
          packageReferences: [],
        },
      };

      const projectRoot = join(dir, "packages", "app");
      mkdirSync(join(projectRoot, "src"), { recursive: true });
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify(
          {
            name: "@acme/app",
            version: "1.0.0",
            private: true,
            type: "module",
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "index.ts"),
        [
          "class Router {",
          "  combine(left: string | RegExp, right: string | RegExp): string | RegExp {",
          '    if (typeof left !== "string" || typeof right !== "string") {',
          "      return right;",
          "    }",
          "    return left + right;",
          "  }",
          "}",
          "",
          "export function main(): string | RegExp {",
          '  return new Router().combine("a", "b");',
          "}",
        ].join("\n"),
        "utf-8"
      );

      const projectConfig = {
        $schema: "https://tsonic.org/schema/v1.json",
        rootNamespace: "App",
        entryPoint: "src/index.ts",
        sourceRoot: "src",
        outputDirectory: "generated",
        outputName: "App",
      };

      const config = resolveEffectiveConfig(
        workspaceConfig,
        projectConfig,
        dir,
        projectRoot
      );

      const result = buildCommand(config);
      if (!result.ok) {
        throw new Error(result.error);
      }
      expect(result.ok).to.equal(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("builds Array.isArray fallthrough narrowing for class properties in JS-surface source ports", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-build-property-array-"));
    try {
      mkdirSync(join(dir, "node_modules"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          { name: "test-workspace", private: true, type: "module" },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      linkDir(linkedJsPackageRoot, join(dir, "node_modules/@tsonic/js"));
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );

      const workspaceConfig = {
        $schema: "https://tsonic.org/schema/workspace/v1.json",
        dotnetVersion: "net10.0",
        surface: "@tsonic/js",
        dotnet: {
          typeRoots: ["node_modules/@tsonic/js"],
          libraries: [],
          frameworkReferences: [],
          packageReferences: [],
        },
      };

      const projectRoot = join(dir, "packages", "app");
      mkdirSync(join(projectRoot, "src"), { recursive: true });
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify(
          {
            name: "@acme/app",
            version: "1.0.0",
            private: true,
            type: "module",
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "index.ts"),
        [
          "class Response {",
          '  value: string | readonly string[] = "";',
          "  private acceptString(value: string): void {",
          "    console.log(value);",
          "  }",
          "  append(): string {",
          "    if (Array.isArray(this.value)) {",
          '      return this.value.join("|");',
          "    }",
          "    this.acceptString(this.value);",
          "    return this.value;",
          "  }",
          "}",
          "",
          "export function main(): string {",
          "  return new Response().append();",
          "}",
        ].join("\n"),
        "utf-8"
      );

      const projectConfig = {
        $schema: "https://tsonic.org/schema/v1.json",
        rootNamespace: "App",
        entryPoint: "src/index.ts",
        sourceRoot: "src",
        outputDirectory: "generated",
        outputName: "App",
      };

      const config = resolveEffectiveConfig(
        workspaceConfig,
        projectConfig,
        dir,
        projectRoot
      );

      const result = buildCommand(config);
      if (!result.ok) {
        throw new Error(result.error);
      }
      expect(result.ok).to.equal(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("builds JS-surface string length indexing loops in source ports", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-build-string-indexing-"));
    try {
      mkdirSync(join(dir, "node_modules"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          { name: "test-workspace", private: true, type: "module" },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      linkDir(linkedJsPackageRoot, join(dir, "node_modules/@tsonic/js"));
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );

      const workspaceConfig = {
        $schema: "https://tsonic.org/schema/workspace/v1.json",
        dotnetVersion: "net10.0",
        surface: "@tsonic/js",
        dotnet: {
          typeRoots: ["node_modules/@tsonic/js"],
          libraries: [],
          frameworkReferences: [],
          packageReferences: [],
        },
      };

      const projectRoot = join(dir, "packages", "app");
      mkdirSync(join(projectRoot, "src"), { recursive: true });
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify(
          {
            name: "@acme/app",
            version: "1.0.0",
            private: true,
            type: "module",
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "index.ts"),
        [
          "class Router {",
          "  trimTrailingSlashes(value: string): string {",
          "    let end = value.length;",
          '    while (end > 1 && value[end - 1] === "/") {',
          "      end -= 1;",
          "    }",
          "    return value.slice(0, end);",
          "  }",
          "  lastChar(value: string): string {",
          "    return value[value.length - 1];",
          "  }",
          "}",
          "",
          "export function main(): string {",
          "  const router = new Router();",
          '  return router.trimTrailingSlashes("/users///") + router.lastChar("ok");',
          "}",
        ].join("\n"),
        "utf-8"
      );

      const projectConfig = {
        $schema: "https://tsonic.org/schema/v1.json",
        rootNamespace: "App",
        entryPoint: "src/index.ts",
        sourceRoot: "src",
        outputDirectory: "generated",
        outputName: "App",
      };

      const config = resolveEffectiveConfig(
        workspaceConfig,
        projectConfig,
        dir,
        projectRoot
      );

      const result = buildCommand(config);
      if (!result.ok) {
        throw new Error(result.error);
      }
      expect(result.ok).to.equal(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("builds recursive middleware handler surfaces in JS-surface source ports", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-build-recursive-middleware-")
    );
    try {
      mkdirSync(join(dir, "node_modules"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          { name: "test-workspace", private: true, type: "module" },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      linkDir(linkedJsPackageRoot, join(dir, "node_modules/@tsonic/js"));
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );

      const workspaceConfig = {
        $schema: "https://tsonic.org/schema/workspace/v1.json",
        dotnetVersion: "net10.0",
        surface: "@tsonic/js",
        dotnet: {
          typeRoots: ["node_modules/@tsonic/js"],
          libraries: [],
          frameworkReferences: [],
          packageReferences: [],
        },
      };

      const projectRoot = join(dir, "packages", "app");
      mkdirSync(join(projectRoot, "src"), { recursive: true });
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify(
          {
            name: "@acme/app",
            version: "1.0.0",
            private: true,
            type: "module",
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "index.ts"),
        [
          'type NextControl = "route" | "router" | string | null | undefined;',
          "type NextFunction = (value?: NextControl) => void | Promise<void>;",
          "interface Request { path: string; }",
          "interface Response { send(text: string): void; }",
          "interface RequestHandler {",
          "  (req: Request, res: Response, next: NextFunction): unknown | Promise<unknown>;",
          "}",
          "type MiddlewareParam = RequestHandler | readonly MiddlewareParam[];",
          "type MiddlewareLike = MiddlewareParam | Router | readonly MiddlewareLike[];",
          "class Router {",
          "  use(...handlers: readonly MiddlewareLike[]): this {",
          "    return this;",
          "  }",
          "}",
          "class Application extends Router {",
          "  mount(path: string, ...handlers: readonly MiddlewareLike[]): this {",
          "    const state = { path, handlers, owner: this };",
          "    this.use(handlers);",
          "    return state.owner;",
          "  }",
          "}",
          "",
          "export function main(): Application {",
          "  const app = new Application();",
          "  const handler: RequestHandler = async (_req, _res, next) => {",
          '    await next("route");',
          "  };",
          '  return app.mount("/", [handler]);',
          "}",
        ].join("\n"),
        "utf-8"
      );

      const projectConfig = {
        $schema: "https://tsonic.org/schema/v1.json",
        rootNamespace: "App",
        entryPoint: "src/index.ts",
        sourceRoot: "src",
        outputDirectory: "generated",
        outputName: "App",
      };

      const config = resolveEffectiveConfig(
        workspaceConfig,
        projectConfig,
        dir,
        projectRoot
      );

      const result = buildCommand(config);
      if (!result.ok) {
        throw new Error(result.error);
      }
      expect(result.ok).to.equal(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("builds recursive middleware instanceof narrowing without placeholder casts", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-build-recursive-instanceof-")
    );
    try {
      mkdirSync(join(dir, "node_modules"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          { name: "test-workspace", private: true, type: "module" },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      linkDir(linkedJsPackageRoot, join(dir, "node_modules/@tsonic/js"));
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );

      const workspaceConfig = {
        $schema: "https://tsonic.org/schema/workspace/v1.json",
        dotnetVersion: "net10.0",
        surface: "@tsonic/js",
        dotnet: {
          typeRoots: ["node_modules/@tsonic/js"],
          libraries: [],
          frameworkReferences: [],
          packageReferences: [],
        },
      };

      const projectRoot = join(dir, "packages", "app");
      mkdirSync(join(projectRoot, "src"), { recursive: true });
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify(
          {
            name: "@acme/app",
            version: "1.0.0",
            private: true,
            type: "module",
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "index.ts"),
        [
          "type RequestHandler = (value: string) => void;",
          "type MiddlewareLike = RequestHandler | Router | readonly MiddlewareLike[];",
          "class Router {}",
          "",
          "function isMiddlewareHandler(value: MiddlewareLike): value is RequestHandler {",
          '  return typeof value === "function";',
          "}",
          "",
          "export function flatten(entries: readonly MiddlewareLike[]): readonly (RequestHandler | Router)[] {",
          "  const result: (RequestHandler | Router)[] = [];",
          "  const append = (handler: MiddlewareLike): void => {",
          "    if (Array.isArray(handler)) {",
          "      for (let index = 0; index < handler.length; index += 1) {",
          "        append(handler[index]!);",
          "      }",
          "      return;",
          "    }",
          "    if (handler instanceof Router) {",
          "      result.push(handler);",
          "      return;",
          "    }",
          "    if (!isMiddlewareHandler(handler)) {",
          '      throw new Error("middleware handlers must be functions");',
          "    }",
          "    result.push(handler);",
          "  };",
          "  for (let index = 0; index < entries.length; index += 1) {",
          "    append(entries[index]!);",
          "  }",
          "  return result;",
          "}",
          "",
          "export function main(): number {",
          "  return flatten([new Router()]).length;",
          "}",
        ].join("\n"),
        "utf-8"
      );

      const projectConfig = {
        $schema: "https://tsonic.org/schema/v1.json",
        rootNamespace: "App",
        entryPoint: "src/index.ts",
        sourceRoot: "src",
        outputDirectory: "generated",
        outputName: "App",
      };

      const config = resolveEffectiveConfig(
        workspaceConfig,
        projectConfig,
        dir,
        projectRoot
      );

      const result = buildCommand(config);
      if (!result.ok) {
        throw new Error(result.error);
      }
      expect(result.ok).to.equal(true);

      const generatedText = readFileSync(
        join(projectRoot, "generated", "index.cs"),
        "utf-8"
      );
      expect(generatedText).to.not.include("<castExpression>");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("builds JS-surface array wrapper members in source ports without CLR bindings", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-build-js-array-wrapper-"));
    try {
      mkdirSync(join(dir, "node_modules"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          { name: "test-workspace", private: true, type: "module" },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      linkDir(linkedJsPackageRoot, join(dir, "node_modules/@tsonic/js"));
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );

      const workspaceConfig = {
        $schema: "https://tsonic.org/schema/workspace/v1.json",
        dotnetVersion: "net10.0",
        surface: "@tsonic/js",
        dotnet: {
          typeRoots: ["node_modules/@tsonic/js"],
          libraries: [],
          frameworkReferences: [],
          packageReferences: [],
        },
      };

      const projectRoot = join(dir, "packages", "app");
      mkdirSync(join(projectRoot, "src"), { recursive: true });
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify(
          {
            name: "@acme/app",
            version: "1.0.0",
            private: true,
            type: "module",
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "index.ts"),
        [
          "class Response {",
          "  private readonly emitted: string[] = [];",
          "  append(field: string, value: string | string[]): string {",
          "    const segments: string[] = [];",
          "    segments.push(field.toLowerCase());",
          '    segments.push("start");',
          "    if (Array.isArray(value)) {",
          "      const mapped = value.map((item) => item.toUpperCase());",
          '      segments.push(mapped.join("|"));',
          "    } else {",
          "      segments.push(value);",
          "    }",
          '    this.emitted.push(segments.join("="));',
          '    return this.emitted.join(",");',
          "  }",
          "  flatten(values: readonly string[]): string {",
          '    return values.map((value) => value.trim()).join("/");',
          "  }",
          "}",
          "",
          "export function main(): string {",
          "  const response = new Response();",
          '  const first = response.append("Set-Cookie", ["a", "b"]);',
          '  const second = response.flatten([" x ", " y "]);',
          '  return first + ":" + second;',
          "}",
        ].join("\n"),
        "utf-8"
      );

      const projectConfig = {
        $schema: "https://tsonic.org/schema/v1.json",
        rootNamespace: "App",
        entryPoint: "src/index.ts",
        sourceRoot: "src",
        outputDirectory: "generated",
        outputName: "App",
      };

      const config = resolveEffectiveConfig(
        workspaceConfig,
        projectConfig,
        dir,
        projectRoot
      );

      const result = buildCommand(config);
      if (!result.ok) {
        throw new Error(result.error);
      }
      expect(result.ok).to.equal(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("builds chained nullable-int nullish coalescing into required CLR int parameters", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-build-nullish-int-"));
    try {
      mkdirSync(join(dir, "node_modules"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          { name: "test-workspace", private: true, type: "module" },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      linkDir(linkedJsPackageRoot, join(dir, "node_modules/@tsonic/js"));
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );
      linkDir(
        join(repoRoot, "node_modules/@tsonic/dotnet"),
        join(dir, "node_modules/@tsonic/dotnet")
      );

      const workspaceConfig = {
        $schema: "https://tsonic.org/schema/workspace/v1.json",
        dotnetVersion: "net10.0",
        surface: "@tsonic/js",
        dotnet: {
          typeRoots: ["node_modules/@tsonic/js"],
          libraries: [],
          frameworkReferences: [],
          packageReferences: [],
        },
      };

      const projectRoot = join(dir, "packages", "app");
      mkdirSync(join(projectRoot, "src"), { recursive: true });
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify(
          {
            name: "@acme/app",
            version: "1.0.0",
            private: true,
            type: "module",
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "index.ts"),
        [
          'import type { int } from "@tsonic/core/types.js";',
          'import { Environment } from "@tsonic/dotnet/System.js";',
          "",
          "let currentExitCode: int | undefined = undefined;",
          "",
          "export function main(): void {",
          "  const code: int | undefined = undefined;",
          "  const resolved = code ?? currentExitCode ?? (0 as int);",
          "  Environment.Exit(resolved);",
          "}",
        ].join("\n"),
        "utf-8"
      );

      const projectConfig = {
        $schema: "https://tsonic.org/schema/v1.json",
        rootNamespace: "App",
        entryPoint: "src/index.ts",
        sourceRoot: "src",
        outputDirectory: "generated",
        outputName: "App",
      };

      const config = resolveEffectiveConfig(
        workspaceConfig,
        projectConfig,
        dir,
        projectRoot
      );

      const result = buildCommand(config);
      if (!result.ok) {
        throw new Error(result.error);
      }
      expect(result.ok).to.equal(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("builds optional-parameter exact-int nullish coalescing into required CLR int parameters", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-build-optional-param-int-"));
    try {
      mkdirSync(join(dir, "node_modules"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          { name: "test-workspace", private: true, type: "module" },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      linkDir(linkedJsPackageRoot, join(dir, "node_modules/@tsonic/js"));
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );
      linkDir(
        join(repoRoot, "node_modules/@tsonic/dotnet"),
        join(dir, "node_modules/@tsonic/dotnet")
      );

      const workspaceConfig = {
        $schema: "https://tsonic.org/schema/workspace/v1.json",
        dotnetVersion: "net10.0",
        surface: "@tsonic/js",
        dotnet: {
          typeRoots: ["node_modules/@tsonic/js"],
          libraries: [],
          frameworkReferences: [],
          packageReferences: [],
        },
      };

      const projectRoot = join(dir, "packages", "app");
      mkdirSync(join(projectRoot, "src"), { recursive: true });
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify(
          {
            name: "@acme/app",
            version: "1.0.0",
            private: true,
            type: "module",
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "index.ts"),
        [
          'import type { int } from "@tsonic/core/types.js";',
          'import { Environment } from "@tsonic/dotnet/System.js";',
          "",
          "let currentExitCode: int | undefined = undefined;",
          "",
          "export function exit(code?: int): void {",
          "  const resolved = code ?? currentExitCode ?? (0 as int);",
          "  Environment.Exit(resolved);",
          "}",
          "",
          "export function main(): void {}",
        ].join("\n"),
        "utf-8"
      );

      const projectConfig = {
        $schema: "https://tsonic.org/schema/v1.json",
        rootNamespace: "App",
        entryPoint: "src/index.ts",
        sourceRoot: "src",
        outputDirectory: "generated",
        outputName: "App",
      };

      const config = resolveEffectiveConfig(
        workspaceConfig,
        projectConfig,
        dir,
        projectRoot
      );

      const result = buildCommand(config);
      if (!result.ok) {
        throw new Error(result.error);
      }
      expect(result.ok).to.equal(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("builds exported const arrows with optional-parameter exact-int nullish coalescing", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-build-optional-arrow-int-"));
    try {
      mkdirSync(join(dir, "node_modules"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          { name: "test-workspace", private: true, type: "module" },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      linkDir(linkedJsPackageRoot, join(dir, "node_modules/@tsonic/js"));
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );
      linkDir(
        join(repoRoot, "node_modules/@tsonic/dotnet"),
        join(dir, "node_modules/@tsonic/dotnet")
      );

      const workspaceConfig = {
        $schema: "https://tsonic.org/schema/workspace/v1.json",
        dotnetVersion: "net10.0",
        surface: "@tsonic/js",
        dotnet: {
          typeRoots: ["node_modules/@tsonic/js"],
          libraries: [],
          frameworkReferences: [],
          packageReferences: [],
        },
      };

      const projectRoot = join(dir, "packages", "app");
      mkdirSync(join(projectRoot, "src"), { recursive: true });
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify(
          {
            name: "@acme/app",
            version: "1.0.0",
            private: true,
            type: "module",
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "index.ts"),
        [
          'import type { int } from "@tsonic/core/types.js";',
          'import { Environment } from "@tsonic/dotnet/System.js";',
          "",
          "let currentExitCode: int | undefined = undefined;",
          "",
          "export const exit = (code?: int): void => {",
          "  const resolved = code ?? currentExitCode ?? (0 as int);",
          "  Environment.Exit(resolved);",
          "};",
          "",
          "export function main(): void {}",
        ].join("\n"),
        "utf-8"
      );

      const projectConfig = {
        $schema: "https://tsonic.org/schema/v1.json",
        rootNamespace: "App",
        entryPoint: "src/index.ts",
        sourceRoot: "src",
        outputDirectory: "generated",
        outputName: "App",
      };

      const config = resolveEffectiveConfig(
        workspaceConfig,
        projectConfig,
        dir,
        projectRoot
      );

      const result = buildCommand(config);
      if (!result.ok) {
        throw new Error(result.error);
      }
      expect(result.ok).to.equal(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("prefers resolved global console bindings over polluted ambient identifier types", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-build-console-error-binding-")
    );
    try {
      mkdirSync(join(dir, "node_modules"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          { name: "test-workspace", private: true, type: "module" },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      linkDir(linkedJsPackageRoot, join(dir, "node_modules/@tsonic/js"));
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );

      const workspaceConfig = {
        $schema: "https://tsonic.org/schema/workspace/v1.json",
        dotnetVersion: "net10.0",
        surface: "@tsonic/js",
        dotnet: {
          typeRoots: ["node_modules/@tsonic/js"],
          libraries: [],
          frameworkReferences: [],
          packageReferences: [],
        },
      };

      const projectRoot = join(dir, "packages", "app");
      mkdirSync(join(projectRoot, "src"), { recursive: true });
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify(
          {
            name: "@acme/app",
            version: "1.0.0",
            private: true,
            type: "module",
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "index.ts"),
        [
          "declare class Console {",
          "  log(...data: unknown[]): void;",
          "  error(...data: unknown[]): void;",
          "}",
          "",
          "declare const console: Console;",
          "",
          "export function main(): void {",
          '  console.error(\"bad\");',
          '  console.log(\"ok\");',
          "}",
        ].join("\n"),
        "utf-8"
      );

      const projectConfig = {
        $schema: "https://tsonic.org/schema/v1.json",
        rootNamespace: "App",
        entryPoint: "src/index.ts",
        sourceRoot: "src",
        outputDirectory: "generated",
        outputName: "App",
      };

      const config = resolveEffectiveConfig(
        workspaceConfig,
        projectConfig,
        dir,
        projectRoot
      );

      const result = buildCommand(config);
      if (!result.ok) {
        throw new Error(result.error);
      }
      expect(result.ok).to.equal(true);

      const generatedText = readFileSync(
        join(projectRoot, "generated", "index.cs"),
        "utf-8"
      );
      expect(generatedText).to.include(
        'global::Tsonic.JSRuntime.console.error("bad")'
      );
      expect(generatedText).to.include(
        'global::Tsonic.JSRuntime.console.log("ok")'
      );
      expect(generatedText).to.not.include("global::System.Console.Error");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("keeps sibling narrowing branches lexically isolated for repeated local names and mixed property shapes", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-build-branch-scope-isolation-")
    );
    try {
      mkdirSync(join(dir, "node_modules"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          { name: "test-workspace", private: true, type: "module" },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      linkDir(linkedJsPackageRoot, join(dir, "node_modules/@tsonic/js"));
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );
      linkDir(
        join(repoRoot, "node_modules/@tsonic/dotnet"),
        join(dir, "node_modules/@tsonic/dotnet")
      );

      const workspaceConfig = {
        $schema: "https://tsonic.org/schema/workspace/v1.json",
        dotnetVersion: "net10.0",
        surface: "@tsonic/js",
        dotnet: {
          typeRoots: ["node_modules/@tsonic/js"],
          libraries: [],
          frameworkReferences: [],
          packageReferences: [],
        },
      };

      const projectRoot = join(dir, "packages", "app");
      mkdirSync(join(projectRoot, "src"), { recursive: true });
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify(
          {
            name: "@acme/app",
            version: "1.0.0",
            private: true,
            type: "module",
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "index.ts"),
        [
          'import { List } from "@tsonic/dotnet/System.Collections.Generic.js";',
          'import type { int } from "@tsonic/core/types.js";',
          "",
          "class StringValue {",
          "  readonly value: string;",
          "  constructor(value: string) {",
          "    this.value = value;",
          "  }",
          "}",
          "",
          "class PageArrayValue {",
          "  readonly value: string[];",
          "  constructor(value: string[]) {",
          "    this.value = value;",
          "  }",
          "}",
          "",
          "class AnyArrayValue {",
          "  readonly value: List<string>;",
          "  constructor(value: List<string>) {",
          "    this.value = value;",
          "  }",
          "}",
          "",
          "type Value = StringValue | PageArrayValue | AnyArrayValue;",
          "",
          "export const len = (value: Value): int => {",
          "  if (value instanceof StringValue) {",
          "    const l: int = value.value.length;",
          "    return l;",
          "  }",
          "  if (value instanceof PageArrayValue) {",
          "    const l: int = value.value.length;",
          "    return l;",
          "  }",
          "  if (value instanceof AnyArrayValue) {",
          "    const items = value.value.ToArray();",
          "    const l: int = items.length;",
          "    return l;",
          "  }",
          "  return 0 as int;",
          "};",
          "",
          "export function main(): void {}",
        ].join("\n"),
        "utf-8"
      );

      const projectConfig = {
        $schema: "https://tsonic.org/schema/v1.json",
        rootNamespace: "App",
        entryPoint: "src/index.ts",
        sourceRoot: "src",
        outputDirectory: "generated",
        outputName: "App",
      };

      const config = resolveEffectiveConfig(
        workspaceConfig,
        projectConfig,
        dir,
        projectRoot
      );

      const result = buildCommand(config);
      if (!result.ok) {
        throw new Error(result.error);
      }
      expect(result.ok).to.equal(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("keeps wrapper-member types isolated across sibling instanceof branches inside loop bodies", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-build-wrapper-member-isolation-")
    );
    try {
      mkdirSync(join(dir, "node_modules"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          { name: "test-workspace", private: true, type: "module" },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      linkDir(linkedJsPackageRoot, join(dir, "node_modules/@tsonic/js"));
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );

      const workspaceConfig = {
        $schema: "https://tsonic.org/schema/workspace/v1.json",
        dotnetVersion: "net10.0",
        surface: "@tsonic/js",
        dotnet: {
          typeRoots: ["node_modules/@tsonic/js"],
          libraries: [],
          frameworkReferences: [],
          packageReferences: [],
        },
      };

      const projectRoot = join(dir, "packages", "app");
      mkdirSync(join(projectRoot, "src"), { recursive: true });
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify(
          {
            name: "@acme/app",
            version: "1.0.0",
            private: true,
            type: "module",
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "index.ts"),
        [
          "function keepString(value: string): string {",
          "  return value;",
          "}",
          "",
          "class TemplateValue {}",
          "class NilValue extends TemplateValue {}",
          "",
          "class PageContext {",
          '  title = "";',
          "}",
          "",
          "class SiteContext {",
          '  baseURL = "";',
          "}",
          "",
          "class PageValue extends TemplateValue {",
          "  readonly value: PageContext;",
          "  constructor(value: PageContext) {",
          "    super();",
          "    this.value = value;",
          "  }",
          "}",
          "",
          "class SiteValue extends TemplateValue {",
          "  readonly value: SiteContext;",
          "  constructor(value: SiteContext) {",
          "    super();",
          "    this.value = value;",
          "  }",
          "}",
          "",
          "type Value = NilValue | PageValue | SiteValue;",
          "",
          "export const resolve = (value: Value, segments: string[]): void => {",
          "  let cur: Value = value;",
          "  for (let i = 0; i < segments.length; i++) {",
          "    const seg = segments[i]!;",
          "    if (cur instanceof NilValue) return;",
          "    if (cur instanceof PageValue) {",
          "      const page = cur.value;",
          '      if (seg === "title") keepString(page.title);',
          "      cur = new NilValue();",
          "      continue;",
          "    }",
          "    if (cur instanceof SiteValue) {",
          "      const site = cur.value;",
          '      if (seg === "baseurl") keepString(site.baseURL);',
          "      cur = new NilValue();",
          "      continue;",
          "    }",
          "  }",
          "};",
          "",
          "export function main(): void {}",
        ].join("\n"),
        "utf-8"
      );

      const projectConfig = {
        $schema: "https://tsonic.org/schema/v1.json",
        rootNamespace: "App",
        entryPoint: "src/index.ts",
        sourceRoot: "src",
        outputDirectory: "generated",
        outputName: "App",
      };

      const config = resolveEffectiveConfig(
        workspaceConfig,
        projectConfig,
        dir,
        projectRoot
      );

      const result = buildCommand(config);
      if (!result.ok) {
        throw new Error(result.error);
      }
      expect(result.ok).to.equal(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("keeps imported wrapper-member types isolated across sibling instanceof branches inside loop bodies", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-build-imported-wrapper-member-isolation-")
    );
    try {
      mkdirSync(join(dir, "node_modules"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          { name: "test-workspace", private: true, type: "module" },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      linkDir(linkedJsPackageRoot, join(dir, "node_modules/@tsonic/js"));
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );

      const workspaceConfig = {
        $schema: "https://tsonic.org/schema/workspace/v1.json",
        dotnetVersion: "net10.0",
        surface: "@tsonic/js",
        dotnet: {
          typeRoots: ["node_modules/@tsonic/js"],
          libraries: [],
          frameworkReferences: [],
          packageReferences: [],
        },
      };

      const projectRoot = join(dir, "packages", "app");
      mkdirSync(join(projectRoot, "src", "values"), { recursive: true });
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify(
          {
            name: "@acme/app",
            version: "1.0.0",
            private: true,
            type: "module",
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "models.ts"),
        [
          "export class PageContext {",
          '  title = "";',
          "}",
          "",
          "export class SiteContext {",
          '  baseURL = "";',
          "}",
        ].join("\n"),
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "values", "base.ts"),
        [
          "export class TemplateValue {}",
          "export class NilValue extends TemplateValue {}",
        ].join("\n"),
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "values", "page.ts"),
        [
          'import { PageContext } from "../models.ts";',
          'import { TemplateValue } from "./base.ts";',
          "",
          "export class PageValue extends TemplateValue {",
          "  readonly value: PageContext;",
          "  constructor(value: PageContext) {",
          "    super();",
          "    this.value = value;",
          "  }",
          "}",
        ].join("\n"),
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "values", "site.ts"),
        [
          'import { SiteContext } from "../models.ts";',
          'import { TemplateValue } from "./base.ts";',
          "",
          "export class SiteValue extends TemplateValue {",
          "  readonly value: SiteContext;",
          "  constructor(value: SiteContext) {",
          "    super();",
          "    this.value = value;",
          "  }",
          "}",
        ].join("\n"),
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "index.ts"),
        [
          'import { NilValue } from "./values/base.ts";',
          'import { PageValue } from "./values/page.ts";',
          'import { SiteValue } from "./values/site.ts";',
          "",
          "function keepString(value: string): string {",
          "  return value;",
          "}",
          "",
          "type Value = NilValue | PageValue | SiteValue;",
          "",
          "export const resolve = (value: Value, segments: string[]): void => {",
          "  let cur: Value = value;",
          "  for (let i = 0; i < segments.length; i++) {",
          "    const seg = segments[i]!;",
          "    if (cur instanceof NilValue) return;",
          "    if (cur instanceof PageValue) {",
          "      const page = cur.value;",
          '      if (seg === "title") keepString(page.title);',
          "      cur = new NilValue();",
          "      continue;",
          "    }",
          "    if (cur instanceof SiteValue) {",
          "      const site = cur.value;",
          '      if (seg === "baseurl") keepString(site.baseURL);',
          "      cur = new NilValue();",
          "      continue;",
          "    }",
          "  }",
          "};",
          "",
          "export function main(): void {}",
        ].join("\n"),
        "utf-8"
      );

      const projectConfig = {
        $schema: "https://tsonic.org/schema/v1.json",
        rootNamespace: "App",
        entryPoint: "src/index.ts",
        sourceRoot: "src",
        outputDirectory: "generated",
        outputName: "App",
      };

      const config = resolveEffectiveConfig(
        workspaceConfig,
        projectConfig,
        dir,
        projectRoot
      );

      const result = buildCommand(config);
      if (!result.ok) {
        throw new Error(result.error);
      }
      expect(result.ok).to.equal(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("builds imported nominal base-class wrapper members after instanceof narrowing", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-build-imported-base-wrapper-member-")
    );
    try {
      mkdirSync(join(dir, "node_modules"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          { name: "test-workspace", private: true, type: "module" },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      linkDir(linkedJsPackageRoot, join(dir, "node_modules/@tsonic/js"));
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );

      const workspaceConfig = {
        $schema: "https://tsonic.org/schema/workspace/v1.json",
        dotnetVersion: "net10.0",
        surface: "@tsonic/js",
        dotnet: {
          typeRoots: ["node_modules/@tsonic/js"],
          libraries: [],
          frameworkReferences: [],
          packageReferences: [],
        },
      };

      const projectRoot = join(dir, "packages", "app");
      mkdirSync(join(projectRoot, "src", "values"), { recursive: true });
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify(
          {
            name: "@acme/app",
            version: "1.0.0",
            private: true,
            type: "module",
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "models.ts"),
        [
          "export class PageContext {",
          '  title = "";',
          "}",
          "",
          "export class SiteContext {",
          '  baseURL = "";',
          "}",
        ].join("\n"),
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "values", "base.ts"),
        [
          "export class TemplateValue {}",
          "export class NilValue extends TemplateValue {}",
        ].join("\n"),
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "values", "page.ts"),
        [
          'import { PageContext } from "../models.ts";',
          'import { TemplateValue } from "./base.ts";',
          "",
          "export class PageValue extends TemplateValue {",
          "  readonly value: PageContext;",
          "  constructor(value: PageContext) {",
          "    super();",
          "    this.value = value;",
          "  }",
          "}",
        ].join("\n"),
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "values", "site.ts"),
        [
          'import { SiteContext } from "../models.ts";',
          'import { TemplateValue } from "./base.ts";',
          "",
          "export class SiteValue extends TemplateValue {",
          "  readonly value: SiteContext;",
          "  constructor(value: SiteContext) {",
          "    super();",
          "    this.value = value;",
          "  }",
          "}",
        ].join("\n"),
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "index.ts"),
        [
          "function keepString(value: string): string {",
          "  return value;",
          "}",
          "",
          'import { TemplateValue, NilValue } from "./values/base.ts";',
          'import { PageValue } from "./values/page.ts";',
          'import { SiteValue } from "./values/site.ts";',
          "",
          "export const resolve = (value: TemplateValue, segments: string[]): void => {",
          "  let cur: TemplateValue = value;",
          "  for (let i = 0; i < segments.length; i++) {",
          "    const seg = segments[i]!;",
          "    if (cur instanceof NilValue) return;",
          "    if (cur instanceof PageValue) {",
          "      const page = cur.value;",
          '      if (seg === "title") keepString(page.title);',
          "      cur = new NilValue();",
          "      continue;",
          "    }",
          "    if (cur instanceof SiteValue) {",
          "      const site = cur.value;",
          '      if (seg === "baseurl") keepString(site.baseURL);',
          "      cur = new NilValue();",
          "      continue;",
          "    }",
          "  }",
          "};",
          "",
          "export function main(): void {}",
        ].join("\n"),
        "utf-8"
      );

      const projectConfig = {
        $schema: "https://tsonic.org/schema/v1.json",
        rootNamespace: "App",
        entryPoint: "src/index.ts",
        sourceRoot: "src",
        outputDirectory: "generated",
        outputName: "App",
      };

      const config = resolveEffectiveConfig(
        workspaceConfig,
        projectConfig,
        dir,
        projectRoot
      );

      const result = buildCommand(config);
      if (!result.ok) {
        throw new Error(result.error);
      }
      expect(result.ok).to.equal(true);

      const generatedText = readFileSync(
        join(projectRoot, "generated", "index.cs"),
        "utf-8"
      );
      expect(generatedText).to.include("keepString(site.baseURL)");
      expect(generatedText).to.not.include("PageContext)site");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("keeps sibling catch scopes lexically isolated when catch variables are narrowed repeatedly", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-build-catch-scope-isolation-")
    );
    try {
      mkdirSync(join(dir, "node_modules"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          { name: "test-workspace", private: true, type: "module" },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      linkDir(linkedJsPackageRoot, join(dir, "node_modules/@tsonic/js"));
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );

      const workspaceConfig = {
        $schema: "https://tsonic.org/schema/workspace/v1.json",
        dotnetVersion: "net10.0",
        surface: "@tsonic/js",
        dotnet: {
          typeRoots: ["node_modules/@tsonic/js"],
          libraries: [],
          frameworkReferences: [],
          packageReferences: [],
        },
      };

      const projectRoot = join(dir, "packages", "app");
      mkdirSync(join(projectRoot, "src"), { recursive: true });
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify(
          {
            name: "@acme/app",
            version: "1.0.0",
            private: true,
            type: "module",
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "index.ts"),
        [
          "export const render = (flag: boolean): string => {",
          "  if (flag) {",
          '    try { throw new Error("first"); } catch (e) {',
          "      if (e instanceof Error) return e.message;",
          "      throw e;",
          "    }",
          "  }",
          '  try { throw new Error("second"); } catch (e) {',
          "    if (e instanceof Error) return e.message;",
          "    throw e;",
          "  }",
          "};",
          "",
          "export function main(): void {}",
        ].join("\n"),
        "utf-8"
      );

      const projectConfig = {
        $schema: "https://tsonic.org/schema/v1.json",
        rootNamespace: "App",
        entryPoint: "src/index.ts",
        sourceRoot: "src",
        outputDirectory: "generated",
        outputName: "App",
      };

      const config = resolveEffectiveConfig(
        workspaceConfig,
        projectConfig,
        dir,
        projectRoot
      );

      const result = buildCommand(config);
      if (!result.ok) {
        throw new Error(result.error);
      }
      expect(result.ok).to.equal(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("infers branch-local storage from narrowed member-access initializers for repeated locals", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-build-narrowed-local-storage-")
    );
    try {
      mkdirSync(join(dir, "node_modules"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          { name: "test-workspace", private: true, type: "module" },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      linkDir(linkedJsPackageRoot, join(dir, "node_modules/@tsonic/js"));
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );
      linkDir(
        join(repoRoot, "node_modules/@tsonic/dotnet"),
        join(dir, "node_modules/@tsonic/dotnet")
      );

      const workspaceConfig = {
        $schema: "https://tsonic.org/schema/workspace/v1.json",
        dotnetVersion: "net10.0",
        surface: "@tsonic/js",
        dotnet: {
          typeRoots: ["node_modules/@tsonic/js"],
          libraries: [],
          frameworkReferences: [],
          packageReferences: [],
        },
      };

      const projectRoot = join(dir, "packages", "app");
      mkdirSync(join(projectRoot, "src"), { recursive: true });
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify(
          {
            name: "@acme/app",
            version: "1.0.0",
            private: true,
            type: "module",
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "index.ts"),
        [
          'import { List } from "@tsonic/dotnet/System.Collections.Generic.js";',
          'import type { int } from "@tsonic/core/types.js";',
          "",
          "class Item {",
          "  readonly name: string;",
          "  constructor(name: string) {",
          "    this.name = name;",
          "  }",
          "}",
          "",
          "class PageArrayValue {",
          "  readonly value: Item[];",
          "  constructor(value: Item[]) {",
          "    this.value = value;",
          "  }",
          "}",
          "",
          "class AnyArrayValue {",
          "  readonly value: List<Item>;",
          "  constructor(value: List<Item>) {",
          "    this.value = value;",
          "  }",
          "}",
          "",
          "type Value = PageArrayValue | AnyArrayValue;",
          "",
          "export const len = (value: Value): int => {",
          "  if (value instanceof PageArrayValue) {",
          "    const items = value.value;",
          "    return items.length;",
          "  }",
          "  if (value instanceof AnyArrayValue) {",
          "    const items = value.value;",
          "    if (items.Count === 0) return 0 as int;",
          "    const arr = items.ToArray();",
          "    return arr.length;",
          "  }",
          "  return 0 as int;",
          "};",
          "",
          "export function main(): void {}",
        ].join("\n"),
        "utf-8"
      );

      const projectConfig = {
        $schema: "https://tsonic.org/schema/v1.json",
        rootNamespace: "App",
        entryPoint: "src/index.ts",
        sourceRoot: "src",
        outputDirectory: "generated",
        outputName: "App",
      };

      const config = resolveEffectiveConfig(
        workspaceConfig,
        projectConfig,
        dir,
        projectRoot
      );

      const result = buildCommand(config);
      if (!result.ok) {
        throw new Error(result.error);
      }
      expect(result.ok).to.equal(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("builds installed source-package recursive aliases and structural local-class interface adaptation", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-build-expresslike-source-package-")
    );
    try {
      mkdirSync(join(dir, "node_modules"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          { name: "test-workspace", private: true, type: "module" },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      linkDir(linkedJsPackageRoot, join(dir, "node_modules/@tsonic/js"));
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );

      const sourcePackageRoot = join(dir, "node_modules/@demo/expresslike");
      mkdirSync(join(sourcePackageRoot, "src"), { recursive: true });
      mkdirSync(join(sourcePackageRoot, "tsonic"), { recursive: true });
      writeFileSync(
        join(sourcePackageRoot, "package.json"),
        JSON.stringify(
          {
            name: "@demo/expresslike",
            version: "1.0.0",
            type: "module",
            types: "./src/index.ts",
            exports: {
              ".": "./src/index.ts",
              "./index.js": "./src/index.ts",
            },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(sourcePackageRoot, "tsonic", "package-manifest.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            surfaces: ["@tsonic/js"],
            source: {
              exports: {
                ".": "./src/index.ts",
                "./index.js": "./src/index.ts",
              },
            },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(sourcePackageRoot, "src", "types.ts"),
        [
          'import type { Router } from "./router.js";',
          "",
          "export interface TransportRequest {",
          "  method: string;",
          "  path: string;",
          "  headers?: Record<string, string>;",
          "}",
          "",
          "export interface TransportResponse {",
          "  statusCode: number;",
          "  headersSent: boolean;",
          "  setHeader(name: string, value: string): void;",
          "  getHeader(name: string): string | undefined;",
          "  appendHeader(name: string, value: string): void;",
          "  sendText(text: string): Promise<void> | void;",
          "  sendBytes(bytes: Uint8Array): Promise<void> | void;",
          "}",
          "",
          "export interface TransportContext {",
          "  request: TransportRequest;",
          "  response: TransportResponse;",
          "}",
          "",
          "export type PathSpec = string | RegExp | readonly PathSpec[] | null | undefined;",
          'export type NextControl = "route" | "router" | string | null | undefined;',
          "export type NextFunction = (value?: NextControl) => void | Promise<void>;",
          "",
          "export class Request {",
          "  readonly path: string;",
          "  constructor(path: string) {",
          "    this.path = path;",
          "  }",
          "}",
          "",
          "export class Response {",
          "  readonly transport: TransportResponse;",
          "  constructor(transport: TransportResponse) {",
          "    this.transport = transport;",
          "  }",
          "  send(text: string): void {",
          "    void this.transport.sendText(text);",
          "  }",
          "}",
          "",
          "export interface RequestHandler {",
          "  (req: Request, res: Response, next: NextFunction): unknown | Promise<unknown>;",
          "}",
          "",
          "export type MiddlewareHandler = RequestHandler;",
          "export type MiddlewareParam = MiddlewareHandler | readonly MiddlewareParam[];",
          "export type MiddlewareLike = MiddlewareParam | Router | readonly MiddlewareLike[];",
          "",
          "export interface RouteLayer {",
          "  path: PathSpec;",
          "  handlers: MiddlewareHandler[];",
          "}",
        ].join("\n"),
        "utf-8"
      );
      writeFileSync(
        join(sourcePackageRoot, "src", "router.ts"),
        [
          'import { Request, Response } from "./types.js";',
          'import type { MiddlewareHandler, MiddlewareLike, MiddlewareParam, PathSpec, RequestHandler, RouteLayer, TransportContext } from "./types.js";',
          "",
          "export class Router {",
          "  readonly layers: RouteLayer[] = [];",
          "",
          "  get(path: PathSpec, ...handlers: RequestHandler[]): this {",
          "    this.layers.push({ path, handlers: [...handlers] });",
          "    return this;",
          "  }",
          "",
          "  use(...handlers: RequestHandler[]): this;",
          "  use(...handlers: MiddlewareParam[]): this;",
          "  use(...handlers: Router[]): this;",
          "  use(path: PathSpec, ...handlers: RequestHandler[]): this;",
          "  use(path: PathSpec, ...handlers: MiddlewareParam[]): this;",
          "  use(path: PathSpec, ...handlers: Router[]): this;",
          "  use(first: PathSpec | MiddlewareLike, ...rest: MiddlewareLike[]): this {",
          '    const mountedAt = isPathSpec(first) ? first : "/";',
          "    const candidates: readonly MiddlewareLike[] = isPathSpec(first) ? rest : [first, ...rest];",
          "    void mountedAt;",
          "    for (let index = 0; index < candidates.length; index += 1) {",
          "      const candidate = candidates[index]!;",
          "      if (Array.isArray(candidate)) {",
          "        continue;",
          "      }",
          "      if (candidate instanceof Router) {",
          "        continue;",
          "      }",
          "    }",
          "    return this;",
          "  }",
          "",
          "  async handle(context: TransportContext): Promise<void> {",
          "    const request = new Request(context.request.path);",
          "    const response = new Response(context.response);",
          "    for (let index = 0; index < this.layers.length; index += 1) {",
          "      const layer = this.layers[index]!;",
          "      for (let handlerIndex = 0; handlerIndex < layer.handlers.length; handlerIndex += 1) {",
          "        const handler = layer.handlers[handlerIndex]!;",
          "        await Promise.resolve(handler(request, response, async () => undefined));",
          "        if (response.transport.headersSent) {",
          "          return;",
          "        }",
          "      }",
          "    }",
          "  }",
          "}",
          "",
          "function isPathSpec(value: unknown): value is PathSpec {",
          '  if (value == null || typeof value === "string" || value instanceof RegExp) {',
          "    return true;",
          "  }",
          "  if (!Array.isArray(value)) {",
          "    return false;",
          "  }",
          "  const items = value as readonly unknown[];",
          "  for (let index = 0; index < items.length; index += 1) {",
          "    if (!isPathSpec(items[index])) {",
          "      return false;",
          "    }",
          "  }",
          "  return true;",
          "}",
        ].join("\n"),
        "utf-8"
      );
      writeFileSync(
        join(sourcePackageRoot, "src", "application.ts"),
        [
          'import { Router } from "./router.js";',
          'import type { MiddlewareLike, PathSpec, RequestHandler, TransportContext } from "./types.js";',
          "",
          "export class Application extends Router {",
          "  readonly settings: Record<string, unknown> = {};",
          "",
          "  get(name: string): unknown;",
          "  override get(path: PathSpec, ...handlers: RequestHandler[]): this;",
          "  override get(nameOrPath: string | PathSpec, ...handlers: RequestHandler[]): unknown {",
          '    if (handlers.length === 0 && typeof nameOrPath === "string") {',
          "      return this.settings[nameOrPath];",
          "    }",
          "    return super.get(nameOrPath as PathSpec, ...handlers);",
          "  }",
          "",
          "  override use(...handlers: RequestHandler[]): this;",
          "  override use(...handlers: MiddlewareLike[]): this;",
          "  override use(...handlers: Router[]): this;",
          "  override use(path: PathSpec, ...handlers: RequestHandler[]): this;",
          "  override use(path: PathSpec, ...handlers: MiddlewareLike[]): this;",
          "  override use(path: PathSpec, ...handlers: Router[]): this;",
          "  override use(first: PathSpec | MiddlewareLike, ...rest: MiddlewareLike[]): this {",
          "    const args = [first, ...rest] as unknown as [PathSpec, ...RequestHandler[]];",
          "    return super.use(...args);",
          "  }",
          "",
          "  async handle(context: TransportContext): Promise<void> {",
          "    await super.handle(context);",
          "  }",
          "}",
        ].join("\n"),
        "utf-8"
      );
      writeFileSync(
        join(sourcePackageRoot, "src", "index.ts"),
        [
          'import { Application } from "./application.js";',
          'import type { TransportContext } from "./types.js";',
          'export type { TransportContext, TransportResponse } from "./types.js";',
          "export const create = (): Application => new Application();",
          "export const dispatch = async (app: Application, context: TransportContext): Promise<void> => {",
          "  await app.handle(context);",
          "};",
        ].join("\n"),
        "utf-8"
      );

      const workspaceConfig = {
        $schema: "https://tsonic.org/schema/workspace/v1.json",
        dotnetVersion: "net10.0",
        surface: "@tsonic/js",
        dotnet: {
          typeRoots: ["node_modules/@tsonic/js"],
          libraries: [],
          frameworkReferences: [],
          packageReferences: [],
        },
      };

      const projectRoot = join(dir, "packages", "app");
      mkdirSync(join(projectRoot, "src"), { recursive: true });
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify(
          {
            name: "@acme/app",
            version: "1.0.0",
            private: true,
            type: "module",
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "index.ts"),
        [
          'import { create, dispatch } from "@demo/expresslike";',
          'import type { TransportContext, TransportResponse } from "@demo/expresslike";',
          "",
          "class MemoryResponse implements TransportResponse {",
          "  statusCode: number = 200;",
          "  headersSent: boolean = false;",
          "  headers: Record<string, string> = {};",
          "",
          "  appendHeader(name: string, value: string): void {",
          "    this.headers[name.toLowerCase()] = value;",
          "  }",
          "",
          "  getHeader(name: string): string | undefined {",
          "    return this.headers[name.toLowerCase()];",
          "  }",
          "",
          "  setHeader(name: string, value: string): void {",
          "    this.headers[name.toLowerCase()] = value;",
          "  }",
          "",
          "  sendBytes(_bytes: Uint8Array): void {",
          "    this.headersSent = true;",
          "  }",
          "",
          "  sendText(_text: string): void {",
          "    this.headersSent = true;",
          "  }",
          "}",
          "",
          "export async function main(): Promise<void> {",
          "  const app = create();",
          '  app.get("/items", async (_req, res, _next) => {',
          '    res.send("ok");',
          "  });",
          "  const response = new MemoryResponse();",
          "  const context: TransportContext = {",
          '    request: { method: "GET", path: "/items", headers: {} },',
          "    response,",
          "  };",
          "  await dispatch(app, context);",
          "}",
        ].join("\n"),
        "utf-8"
      );

      const projectConfig = {
        $schema: "https://tsonic.org/schema/v1.json",
        rootNamespace: "App",
        entryPoint: "src/index.ts",
        sourceRoot: "src",
        outputDirectory: "generated",
        outputName: "App",
      };

      const config = resolveEffectiveConfig(
        workspaceConfig,
        projectConfig,
        dir,
        projectRoot
      );

      const result = buildCommand(config);
      if (!result.ok) {
        throw new Error(result.error);
      }
      expect(result.ok).to.equal(true);

      const tree = readGeneratedCSharpTree(join(projectRoot, "generated"));
      expect(tree).to.not.include(
        "global::Tsonic.Runtime.Union<global::Tsonic.Runtime.Union<global::Tsonic.Runtime.Union<object[]"
      );
      expect(tree).to.not.include("var items = value;");
      expect(tree).to.include("object?[] items = (object?[])(object?)value;");
      expect(tree).to.match(
        /class MemoryResponse\s*:\s*global::.*TransportResponse/
      );
      expect(tree).to.not.include(
        "global::App._._._.node_modules.demo.expresslike.src.types.App._._._.node_modules.demo.expresslike.src.types.TransportResponse"
      );
      expect(tree).to.match(
        /global::.*TransportResponse\.sendText\(string text\)/
      );
      expect(tree).to.match(
        /global::.*TransportResponse\.sendBytes\(global::Tsonic\.JSRuntime\.Uint8Array bytes\)/
      );
      expect(tree).to.include(
        "return global::System.Threading.Tasks.Task.CompletedTask;"
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("builds instanceof narrowing against JS constructor globals in source ports", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-build-js-instanceof-"));
    try {
      mkdirSync(join(dir, "node_modules"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          { name: "test-workspace", private: true, type: "module" },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      linkDir(linkedJsPackageRoot, join(dir, "node_modules/@tsonic/js"));
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );

      const workspaceConfig = {
        $schema: "https://tsonic.org/schema/workspace/v1.json",
        dotnetVersion: "net10.0",
        surface: "@tsonic/js",
        dotnet: {
          typeRoots: ["node_modules/@tsonic/js"],
          libraries: [],
          frameworkReferences: [],
          packageReferences: [],
        },
      };

      const projectRoot = join(dir, "packages", "app");
      mkdirSync(join(projectRoot, "src"), { recursive: true });
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify(
          {
            name: "@acme/app",
            version: "1.0.0",
            private: true,
            type: "module",
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "index.ts"),
        [
          "class TransportResponse {",
          "  sendText(_text: string): void {}",
          "  sendBytes(_bytes: Uint8Array): void {}",
          "}",
          "",
          "export function send(transport: TransportResponse, body: string | Uint8Array): number {",
          "  if (body instanceof Uint8Array) {",
          "    transport.sendBytes(body);",
          "    return body.length;",
          "  }",
          "  transport.sendText(body);",
          "  return body.length;",
          "}",
          "",
          "export function main(): number {",
          '  return send(new TransportResponse(), "ok");',
          "}",
        ].join("\n"),
        "utf-8"
      );

      const projectConfig = {
        $schema: "https://tsonic.org/schema/v1.json",
        rootNamespace: "App",
        entryPoint: "src/index.ts",
        sourceRoot: "src",
        outputDirectory: "generated",
        outputName: "App",
      };

      const config = resolveEffectiveConfig(
        workspaceConfig,
        projectConfig,
        dir,
        projectRoot
      );

      const result = buildCommand(config);
      if (!result.ok) {
        throw new Error(result.error);
      }
      expect(result.ok).to.equal(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("builds source-package callback-or-dictionary flows with contextual object literals", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-build-renderlike-"));
    try {
      mkdirSync(join(dir, "node_modules"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          { name: "test-workspace", private: true, type: "module" },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      linkDir(linkedJsPackageRoot, join(dir, "node_modules/@tsonic/js"));
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );

      const sourcePackageRoot = join(dir, "node_modules/@demo/renderlike");
      mkdirSync(join(sourcePackageRoot, "tsonic"), { recursive: true });
      mkdirSync(join(sourcePackageRoot, "src"), { recursive: true });
      writeFileSync(
        join(sourcePackageRoot, "package.json"),
        JSON.stringify(
          {
            name: "@demo/renderlike",
            version: "1.0.0",
            type: "module",
            exports: {
              ".": "./src/index.ts",
            },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(sourcePackageRoot, "tsonic/package-manifest.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            surfaces: ["@tsonic/js"],
            source: {
              exports: {
                ".": "./src/index.ts",
              },
            },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(sourcePackageRoot, "src/index.ts"),
        [
          "export type TemplateCallback = (error: unknown, html: string) => void;",
          "export type TemplateEngine = (view: string, locals: Record<string, unknown>, callback: TemplateCallback) => void;",
          "export type CookieOptions = { sameSite?: string | boolean };",
          "",
          "export function renderCookie(options?: CookieOptions): string[] {",
          "  const segments: string[] = [];",
          '  if (typeof options?.sameSite === "string" && options.sameSite.length > 0) {',
          "    segments.push(`SameSite=${options.sameSite}`);",
          "  } else if (options?.sameSite === true) {",
          '    segments.push("SameSite=Strict");',
          "  }",
          "  return segments;",
          "}",
          "",
          "export class App {",
          "  readonly locals: Record<string, unknown> = {};",
          "  readonly engines: Record<string, TemplateEngine> = {};",
          "",
          "  engine(name: string, fn: TemplateEngine): this {",
          "    this.engines[name] = fn;",
          "    return this;",
          "  }",
          "",
          "  resolveEngine(view: string): TemplateEngine | undefined {",
          '    const index = view.lastIndexOf(".");',
          '    const ext = index >= 0 ? view.slice(index + 1) : "";',
          "    return this.engines[ext];",
          "  }",
          "",
          "  render(",
          "    view: string,",
          "    localsOrCallback?: Record<string, unknown> | TemplateCallback,",
          "    maybeCallback?: TemplateCallback",
          "  ): void {",
          '    const locals = typeof localsOrCallback === "function" || localsOrCallback === undefined ? this.locals : localsOrCallback;',
          '    const callback = typeof localsOrCallback === "function" ? localsOrCallback : maybeCallback;',
          '    if (!callback) throw new Error(\"missing callback\");',
          "    const engine = this.resolveEngine(view);",
          "    if (!engine) {",
          "      callback(undefined, `<rendered:${view}>`);",
          "      return;",
          "    }",
          "    engine(view, locals, callback);",
          "  }",
          "}",
        ].join("\n"),
        "utf-8"
      );

      const workspaceConfig = {
        $schema: "https://tsonic.org/schema/workspace/v1.json",
        dotnetVersion: "net10.0",
        surface: "@tsonic/js",
        dotnet: {
          typeRoots: ["node_modules/@tsonic/js"],
          libraries: [],
          frameworkReferences: [],
          packageReferences: [],
        },
      };

      const projectRoot = join(dir, "packages", "app");
      mkdirSync(join(projectRoot, "src"), { recursive: true });
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify(
          {
            name: "@acme/app",
            version: "1.0.0",
            private: true,
            type: "module",
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "index.ts"),
        [
          'import { App, renderCookie } from "@demo/renderlike";',
          "",
          "export function main(): void {",
          "  const app = new App();",
          '  app.engine("tpl", (_view, locals, callback) => {',
          '    callback(undefined, "hello " + locals["name"]);',
          "  });",
          '  app.render("home.tpl", { name: "world" }, (_error, html) => {',
          '    if (html !== "hello world") throw new Error("bad render");',
          "  });",
          '  const cookie = renderCookie({ sameSite: "Lax" });',
          '  if (cookie[0] !== "SameSite=Lax") throw new Error("bad cookie");',
          "}",
        ].join("\n"),
        "utf-8"
      );

      const projectConfig = {
        $schema: "https://tsonic.org/schema/v1.json",
        rootNamespace: "App",
        entryPoint: "src/index.ts",
        sourceRoot: "src",
        outputDirectory: "generated",
        outputName: "App",
      };

      const config = resolveEffectiveConfig(
        workspaceConfig,
        projectConfig,
        dir,
        projectRoot
      );

      const result = buildCommand(config);
      if (!result.ok) {
        throw new Error(result.error);
      }

      const tree = readGeneratedCSharpTree(join(projectRoot, "generated"));
      expect(tree).to.include('["name"] = "world"');
      expect(tree).to.not.include('{ name = "world" }');
      expect(tree).to.not.include("localsOrCallback == null");
      expect(tree).to.not.include("callback.Match(");
      expect(tree).to.not.include("locals.Match(");
      expect(tree).to.include('push($"SameSite={(options?.sameSite.As2())}")');
      expect(tree).to.not.include('push($"SameSite={options?.sameSite}")');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("builds recursive middleware unions without degrading non-recursive handler arrays to object[]", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-build-middlewarelike-"));
    try {
      mkdirSync(join(dir, "node_modules"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          { name: "test-workspace", private: true, type: "module" },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      linkDir(linkedJsPackageRoot, join(dir, "node_modules/@tsonic/js"));
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );

      const workspaceConfig = {
        $schema: "https://tsonic.org/schema/workspace/v1.json",
        dotnetVersion: "net10.0",
        surface: "@tsonic/js",
        dotnet: {
          typeRoots: ["node_modules/@tsonic/js"],
          libraries: [],
          frameworkReferences: [],
          packageReferences: [],
        },
      };

      const projectRoot = join(dir, "packages", "app");
      mkdirSync(join(projectRoot, "src"), { recursive: true });
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify(
          {
            name: "@acme/app",
            version: "1.0.0",
            private: true,
            type: "module",
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "index.ts"),
        [
          "type RequestHandler = (value: string) => void;",
          "type MiddlewareParam = RequestHandler | readonly MiddlewareParam[];",
          "type MiddlewareLike = MiddlewareParam | Router | readonly MiddlewareLike[];",
          "",
          "class Router {}",
          "class Application extends Router {",
          '  mountpath: string | string[] = "/";',
          "}",
          "",
          "function flattenMiddlewareEntries(",
          "  handlers: readonly MiddlewareLike[]",
          "): Array<RequestHandler | Router> {",
          "  const result: Array<RequestHandler | Router> = [];",
          "  const append = (handler: MiddlewareLike): void => {",
          "    if (handler == null) return;",
          "    if (Array.isArray(handler)) {",
          "      const items = handler as readonly MiddlewareLike[];",
          "      for (let index = 0; index < items.length; index += 1) {",
          "        append(items[index]!);",
          "      }",
          "      return;",
          "    }",
          "    result.push(handler);",
          "  };",
          "  for (const handler of handlers) append(handler);",
          "  return result;",
          "}",
          "",
          "export function run(input: readonly MiddlewareLike[]): number {",
          "  const flattened = flattenMiddlewareEntries(input);",
          "  let applications = 0;",
          "  for (let index = 0; index < flattened.length; index += 1) {",
          "    const candidate = flattened[index]!;",
          "    if (candidate instanceof Application) {",
          '      candidate.mountpath = "/app";',
          "      applications += 1;",
          "    }",
          "  }",
          "  return applications;",
          "}",
          "",
          "export function main(): number {",
          "  const app = new Application();",
          "  return run([[(value: string) => { void value; }, [app]]]);",
          "}",
        ].join("\n"),
        "utf-8"
      );

      const projectConfig = {
        $schema: "https://tsonic.org/schema/v1.json",
        rootNamespace: "App",
        entryPoint: "src/index.ts",
        sourceRoot: "src",
        outputDirectory: "generated",
        outputName: "App",
      };

      const config = resolveEffectiveConfig(
        workspaceConfig,
        projectConfig,
        dir,
        projectRoot
      );

      const result = buildCommand(config);
      if (!result.ok) {
        throw new Error(result.error);
      }

      const tree = readGeneratedCSharpTree(join(projectRoot, "generated"));
      expect(tree).to.not.include("object[] result");
      expect(tree).to.not.include("handler == null");
      expect(tree).to.not.include("candidate is Application");
      expect(tree).to.include("Is2()");
      expect(tree).to.include(
        "Application candidate__is_1 = (Application)candidate.As2();"
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("builds source-package module objects with function-valued members", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-build-module-object-"));
    try {
      mkdirSync(join(dir, "node_modules"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          { name: "test-workspace", private: true, type: "module" },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      linkDir(linkedJsPackageRoot, join(dir, "node_modules/@tsonic/js"));
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );

      const sourcePackageRoot = join(dir, "node_modules/@demo/pkg");
      mkdirSync(join(sourcePackageRoot, "tsonic"), { recursive: true });
      mkdirSync(join(sourcePackageRoot, "src"), { recursive: true });
      writeFileSync(
        join(sourcePackageRoot, "package.json"),
        JSON.stringify(
          {
            name: "@demo/pkg",
            version: "1.0.0",
            type: "module",
            exports: {
              ".": "./src/index.ts",
            },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(sourcePackageRoot, "tsonic/package-manifest.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            surfaces: ["@tsonic/js"],
            source: {
              exports: {
                ".": "./src/index.ts",
              },
            },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(sourcePackageRoot, "src/index.ts"),
        [
          "export type Parsed = { base: string };",
          "export const basename = (value: string): string => value;",
          "export const parse = (value: string): Parsed => ({ base: value });",
          "const pathObject = {",
          '  sep: "/",',
          "  basename,",
          "  parse,",
          "};",
          "export { pathObject as path };",
        ].join("\n"),
        "utf-8"
      );

      const workspaceConfig = {
        $schema: "https://tsonic.org/schema/workspace/v1.json",
        dotnetVersion: "net10.0",
        surface: "@tsonic/js",
        dotnet: {
          typeRoots: ["node_modules/@tsonic/js"],
          libraries: [],
          frameworkReferences: [],
          packageReferences: [],
        },
      };

      const projectRoot = join(dir, "packages", "app");
      mkdirSync(join(projectRoot, "src"), { recursive: true });
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify(
          {
            name: "@acme/app",
            version: "1.0.0",
            private: true,
            type: "module",
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "index.ts"),
        [
          'import { path } from "@demo/pkg";',
          "export function main(): void {",
          '  const parsed = path.parse("file.txt");',
          '  if (path.basename(parsed.base) !== "file.txt") throw new Error(path.sep);',
          "}",
        ].join("\n"),
        "utf-8"
      );

      const projectConfig = {
        $schema: "https://tsonic.org/schema/v1.json",
        rootNamespace: "App",
        entryPoint: "src/index.ts",
        sourceRoot: "src",
        outputDirectory: "generated",
        outputName: "App",
      };

      const config = resolveEffectiveConfig(
        workspaceConfig,
        projectConfig,
        dir,
        projectRoot
      );

      const result = buildCommand(config);
      if (!result.ok) {
        throw new Error(result.error);
      }
      expect(result.ok).to.equal(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("builds source-package array property length access without raw direct member access", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-build-array-length-"));
    try {
      mkdirSync(join(dir, "node_modules"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          { name: "test-workspace", private: true, type: "module" },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      linkDir(linkedJsPackageRoot, join(dir, "node_modules/@tsonic/js"));
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );

      const sourcePackageRoot = join(dir, "node_modules/@demo/pkg");
      mkdirSync(join(sourcePackageRoot, "tsonic"), { recursive: true });
      mkdirSync(join(sourcePackageRoot, "src"), { recursive: true });
      writeFileSync(
        join(sourcePackageRoot, "package.json"),
        JSON.stringify(
          {
            name: "@demo/pkg",
            version: "1.0.0",
            type: "module",
            exports: {
              ".": "./src/index.ts",
            },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(sourcePackageRoot, "tsonic/package-manifest.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            surfaces: ["@tsonic/js"],
            source: {
              exports: {
                ".": "./src/index.ts",
              },
            },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(sourcePackageRoot, "src/index.ts"),
        [
          "export class ProcessModule {",
          '  #argv: string[] = ["node", "app"];',
          "  public get argv(): string[] {",
          "    return this.#argv;",
          "  }",
          "  public set argv(value: string[] | undefined) {",
          "    this.#argv = value ?? [];",
          "  }",
          "}",
          "export const process = new ProcessModule();",
        ].join("\n"),
        "utf-8"
      );

      const workspaceConfig = {
        $schema: "https://tsonic.org/schema/workspace/v1.json",
        dotnetVersion: "net10.0",
        surface: "@tsonic/js",
        dotnet: {
          typeRoots: ["node_modules/@tsonic/js"],
          libraries: [],
          frameworkReferences: [],
          packageReferences: [],
        },
      };

      const projectRoot = join(dir, "packages", "app");
      mkdirSync(join(projectRoot, "src"), { recursive: true });
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify(
          {
            name: "@acme/app",
            version: "1.0.0",
            private: true,
            type: "module",
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "index.ts"),
        [
          'import { process } from "@demo/pkg";',
          "export function main(): void {",
          '  if (process.argv.length !== 2) throw new Error("bad argv length");',
          "  const original = process.argv;",
          "  process.argv = undefined;",
          '  if (process.argv.length !== 0) throw new Error("bad empty argv length");',
          "  process.argv = original;",
          "}",
        ].join("\n"),
        "utf-8"
      );

      const projectConfig = {
        $schema: "https://tsonic.org/schema/v1.json",
        rootNamespace: "App",
        entryPoint: "src/index.ts",
        sourceRoot: "src",
        outputDirectory: "generated",
        outputName: "App",
      };

      const config = resolveEffectiveConfig(
        workspaceConfig,
        projectConfig,
        dir,
        projectRoot
      );

      const result = buildCommand(config);
      if (!result.ok) {
        throw new Error(result.error);
      }

      const tree = readGeneratedCSharpTree(join(projectRoot, "generated"));
      expect(tree).to.include(
        "new global::Tsonic.JSRuntime.JSArray<string>(global::App._._._.node_modules.demo.pkg.index.process.argv).length"
      );
      expect(tree).to.not.include(
        "global::App._._._.node_modules.demo.pkg.index.process.argv.length"
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("builds specialized generic array element locals without out-of-scope casts", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-build-generic-array-element-local-")
    );
    try {
      mkdirSync(join(dir, "node_modules"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          { name: "test-workspace", private: true, type: "module" },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      linkDir(linkedJsPackageRoot, join(dir, "node_modules/@tsonic/js"));
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );
      linkDir(
        join(repoRoot, "node_modules/@tsonic/dotnet"),
        join(dir, "node_modules/@tsonic/dotnet")
      );

      const workspaceConfig = {
        $schema: "https://tsonic.org/schema/workspace/v1.json",
        dotnetVersion: "net10.0",
        surface: "@tsonic/js",
        dotnet: {
          typeRoots: ["node_modules/@tsonic/js"],
          libraries: [],
          frameworkReferences: [],
          packageReferences: [],
        },
      };

      const projectRoot = join(dir, "packages", "app");
      mkdirSync(join(projectRoot, "src"), { recursive: true });
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify(
          {
            name: "@acme/app",
            version: "1.0.0",
            private: true,
            type: "module",
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "index.ts"),
        [
          'import { List } from "@tsonic/dotnet/System.Collections.Generic.js";',
          'import type { int } from "@tsonic/core/types.js";',
          "",
          "class Item {",
          "  readonly name: string;",
          "  constructor(name: string) {",
          "    this.name = name;",
          "  }",
          "}",
          "",
          "class GenericArrayValue<T> {",
          "  readonly value: List<T>;",
          "  constructor(value: List<T>) {",
          "    this.value = value;",
          "  }",
          "}",
          "",
          "class ItemArrayValue extends GenericArrayValue<Item> {}",
          "",
          "export const firstLength = (value: ItemArrayValue): int => {",
          "  const items = value.value.ToArray();",
          "  if (items.length === 0) return 0 as int;",
          "  const item = items[0]!;",
          "  return item.name.length;",
          "};",
          "",
          "export function main(): void {}",
        ].join("\n"),
        "utf-8"
      );

      const projectConfig = {
        $schema: "https://tsonic.org/schema/v1.json",
        rootNamespace: "App",
        entryPoint: "src/index.ts",
        sourceRoot: "src",
        outputDirectory: "generated",
        outputName: "App",
      };

      const config = resolveEffectiveConfig(
        workspaceConfig,
        projectConfig,
        dir,
        projectRoot
      );

      const result = buildCommand(config);
      if (!result.ok) {
        throw new Error(result.error);
      }

      const tree = readGeneratedCSharpTree(join(projectRoot, "generated"));
      expect(tree).to.not.include("(T)items[0]");
      expect(tree).to.not.include("(T)items[i]");
      expect(tree).to.include("var item = items[0];");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects JavaScript function.length inspection in NativeAOT builds", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-build-function-length-"));
    try {
      mkdirSync(join(dir, "node_modules"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          { name: "test-workspace", private: true, type: "module" },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      linkDir(linkedJsPackageRoot, join(dir, "node_modules/@tsonic/js"));
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );

      const workspaceConfig = {
        $schema: "https://tsonic.org/schema/workspace/v1.json",
        dotnetVersion: "net10.0",
        surface: "@tsonic/js",
        dotnet: {
          typeRoots: ["node_modules/@tsonic/js"],
          libraries: [],
          frameworkReferences: [],
          packageReferences: [],
        },
      };

      const projectRoot = join(dir, "packages", "app");
      mkdirSync(join(projectRoot, "src"), { recursive: true });
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify(
          {
            name: "@acme/app",
            version: "1.0.0",
            private: true,
            type: "module",
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "index.ts"),
        [
          "export function getArity(handler: unknown): number {",
          '  if (typeof handler !== "function") return 0;',
          "  const maybeFunction = handler as unknown as { readonly length?: number };",
          '  return typeof maybeFunction.length === "number" ? maybeFunction.length : 0;',
          "}",
        ].join("\n"),
        "utf-8"
      );

      const projectConfig = {
        $schema: "https://tsonic.org/schema/v1.json",
        rootNamespace: "App",
        entryPoint: "src/index.ts",
        sourceRoot: "src",
        outputDirectory: "generated",
        outputName: "App",
      };

      const config = resolveEffectiveConfig(
        workspaceConfig,
        projectConfig,
        dir,
        projectRoot
      );

      const result = buildCommand(config);
      expect(result.ok).to.equal(false);
      if (result.ok) {
        throw new Error("Expected build to fail with TSN5001");
      }
      expect(result.error).to.include("TSN5001");
      expect(result.error).to.include("function.length is not supported");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("builds native-port callable unions without storage re-adaptation drift", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-build-callable-unions-"));
    try {
      mkdirSync(join(dir, "node_modules"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          { name: "test-workspace", private: true, type: "module" },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      linkDir(linkedJsPackageRoot, join(dir, "node_modules/@tsonic/js"));
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );

      const workspaceConfig = {
        $schema: "https://tsonic.org/schema/workspace/v1.json",
        dotnetVersion: "net10.0",
        surface: "@tsonic/js",
        dotnet: {
          typeRoots: ["node_modules/@tsonic/js"],
          libraries: [],
          frameworkReferences: [],
          packageReferences: [],
        },
      };

      const projectRoot = join(dir, "packages", "app");
      mkdirSync(join(projectRoot, "src"), { recursive: true });
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify(
          {
            name: "@acme/app",
            version: "1.0.0",
            private: true,
            type: "module",
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "index.ts"),
        [
          'type NextControl = "route" | "router" | string | null | undefined;',
          "type NextFunction = (value?: NextControl) => void | Promise<void>;",
          "interface Request { readonly path: string; }",
          "interface Response { send(text: string): void; }",
          "interface RequestHandler {",
          "  (req: Request, res: Response, next: NextFunction): unknown | Promise<unknown>;",
          "}",
          "interface ErrorRequestHandler {",
          "  (error: unknown, req: Request, res: Response, next: NextFunction): unknown | Promise<unknown>;",
          "}",
          "type MiddlewareHandler = RequestHandler | ErrorRequestHandler;",
          "type MiddlewareParam = MiddlewareHandler | readonly MiddlewareParam[];",
          "type MiddlewareLike = MiddlewareParam | Router | readonly MiddlewareLike[];",
          "interface RouteLayer {",
          "  readonly middleware: boolean;",
          "  readonly handlers: MiddlewareHandler[];",
          "}",
          "",
          "class Router {}",
          "class TestResponse implements Response {",
          "  send(_text: string): void {}",
          "}",
          "",
          "function flattenRouteHandlers(",
          "  handlers: readonly RequestHandler[]",
          "): RequestHandler[] {",
          "  return [...handlers];",
          "}",
          "",
          "function isMiddlewareHandler(handler: unknown): handler is MiddlewareHandler {",
          '  return typeof handler === "function";',
          "}",
          "",
          "function isErrorHandler(",
          "  handler: MiddlewareHandler,",
          "  treatAsError: boolean",
          "): handler is ErrorRequestHandler {",
          "  return treatAsError;",
          "}",
          "",
          "function flattenMiddlewareEntries(",
          "  handlers: readonly MiddlewareLike[]",
          "): Array<MiddlewareHandler | Router> {",
          "  const result: Array<MiddlewareHandler | Router> = [];",
          "  const append = (handler: MiddlewareLike): void => {",
          "    if (handler == null) return;",
          "    if (Array.isArray(handler)) {",
          "      const items = handler as readonly MiddlewareLike[];",
          "      for (let index = 0; index < items.length; index += 1) {",
          "        append(items[index]!);",
          "      }",
          "      return;",
          "    }",
          "    if (handler instanceof Router) {",
          "      result.push(handler);",
          "      return;",
          "    }",
          "    if (!isMiddlewareHandler(handler)) {",
          '      throw new Error("middleware handlers must be functions");',
          "    }",
          "    result.push(handler);",
          "  };",
          "  for (const handler of handlers) append(handler);",
          "  return result;",
          "}",
          "",
          "async function invokeHandlers(",
          "  handlers: unknown[],",
          "  request: Request,",
          "  response: Response,",
          "  currentError: unknown",
          "): Promise<NextControl> {",
          "  let error = currentError;",
          "  for (const handler of handlers) {",
          "    let nextCalled = false;",
          "    let control: NextControl = undefined;",
          "    const next = async (value?: NextControl): Promise<void> => {",
          "      nextCalled = true;",
          "      control = value;",
          "    };",
          "    if (!isMiddlewareHandler(handler)) {",
          "      continue;",
          "    }",
          "    if (error === undefined) {",
          "      if (isErrorHandler(handler, false)) {",
          "        continue;",
          "      }",
          "      await handler(request, response, next);",
          "    } else {",
          "      if (!isErrorHandler(handler, true)) {",
          "        continue;",
          "      }",
          "      await handler(error, request, response, next);",
          "    }",
          '    if (nextCalled && typeof control === "string" && control !== "") {',
          "      return control;",
          "    }",
          "  }",
          "  return undefined;",
          "}",
          "",
          "export function buildLayer(handlers: readonly RequestHandler[]): RouteLayer {",
          "  return {",
          "    middleware: false,",
          "    handlers: flattenRouteHandlers(handlers),",
          "  };",
          "}",
          "",
          "export async function main(): Promise<number> {",
          "  const handler: RequestHandler = async (_req, res, next) => {",
          '    res.send("ok");',
          '    await next("route");',
          "  };",
          "  const errorHandler: ErrorRequestHandler = async (_error, _req, res, next) => {",
          '    res.send("bad");',
          '    await next("router");',
          "  };",
          "  const layers = flattenMiddlewareEntries([[handler], [errorHandler]]);",
          "  const built = buildLayer([handler]);",
          '  const request: Request = { path: "/" };',
          "  const response = new TestResponse();",
          "  await invokeHandlers([handler], request, response, undefined);",
          '  await invokeHandlers([errorHandler], request, response, "boom");',
          "  return layers.length + built.handlers.length;",
          "}",
        ].join("\n"),
        "utf-8"
      );

      const projectConfig = {
        $schema: "https://tsonic.org/schema/v1.json",
        rootNamespace: "App",
        entryPoint: "src/index.ts",
        sourceRoot: "src",
        outputDirectory: "generated",
        outputName: "App",
      };

      const config = resolveEffectiveConfig(
        workspaceConfig,
        projectConfig,
        dir,
        projectRoot
      );

      const result = buildCommand(config);
      if (!result.ok) {
        throw new Error(result.error);
      }

      const tree = readGeneratedCSharpTree(join(projectRoot, "generated"));
      expect(tree).to.not.include("control.Match(");
      expect(tree).to.not.match(
        /Enumerable\.ToArray<global::Tsonic\.Runtime\.Union<.*>\>\(global::System\.Linq\.Enumerable\.Select<global::System\.Func<.*>\(global::System\.Linq\.Enumerable\.ToArray<global::Tsonic\.Runtime\.Union/
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("builds source-package callback aliases with sibling alias closure intact", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-build-callback-alias-"));
    try {
      mkdirSync(join(dir, "node_modules"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          { name: "test-workspace", private: true, type: "module" },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      linkDir(linkedJsPackageRoot, join(dir, "node_modules/@tsonic/js"));
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );

      const sourcePackageRoot = join(dir, "node_modules/@demo/pkg");
      mkdirSync(join(sourcePackageRoot, "tsonic"), { recursive: true });
      mkdirSync(join(sourcePackageRoot, "src"), { recursive: true });
      writeFileSync(
        join(sourcePackageRoot, "package.json"),
        JSON.stringify(
          {
            name: "@demo/pkg",
            version: "1.0.0",
            type: "module",
            exports: {
              ".": "./src/index.ts",
            },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(sourcePackageRoot, "tsonic/package-manifest.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            surfaces: ["@tsonic/js"],
            source: {
              exports: {
                ".": "./src/index.ts",
              },
            },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(sourcePackageRoot, "src/index.ts"),
        [
          'export type NextControl = "route" | "router" | string | null | undefined;',
          "export type NextFunction = (value?: NextControl) => void | Promise<void>;",
          "export interface Request { path: string; }",
          "export interface Response { send(text: string): void; }",
          "export interface RequestHandler {",
          "  (req: Request, res: Response, next: NextFunction): unknown | Promise<unknown>;",
          "}",
          "export const useHandler = async (_handler: RequestHandler): Promise<void> => {};",
        ].join("\n"),
        "utf-8"
      );

      const workspaceConfig = {
        $schema: "https://tsonic.org/schema/workspace/v1.json",
        dotnetVersion: "net10.0",
        surface: "@tsonic/js",
        dotnet: {
          typeRoots: ["node_modules/@tsonic/js"],
          libraries: [],
          frameworkReferences: [],
          packageReferences: [],
        },
      };

      const projectRoot = join(dir, "packages", "app");
      mkdirSync(join(projectRoot, "src"), { recursive: true });
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify(
          {
            name: "@acme/app",
            version: "1.0.0",
            private: true,
            type: "module",
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "index.ts"),
        [
          'import { useHandler } from "@demo/pkg";',
          "",
          "export async function main(): Promise<void> {",
          "  await useHandler(async (_req, _res, next) => {",
          '    await next("route");',
          "  });",
          "}",
        ].join("\n"),
        "utf-8"
      );

      const projectConfig = {
        $schema: "https://tsonic.org/schema/v1.json",
        rootNamespace: "App",
        entryPoint: "src/index.ts",
        sourceRoot: "src",
        outputDirectory: "generated",
        outputName: "App",
      };

      const config = resolveEffectiveConfig(
        workspaceConfig,
        projectConfig,
        dir,
        projectRoot
      );

      const result = buildCommand(config);
      if (!result.ok) {
        throw new Error(result.error);
      }
      expect(result.ok).to.equal(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("builds private class members in JS-surface source packages", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-build-private-source-port-")
    );
    try {
      mkdirSync(join(dir, "node_modules"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          { name: "test-workspace", private: true, type: "module" },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      linkDir(linkedJsPackageRoot, join(dir, "node_modules/@tsonic/js"));
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );

      const sourcePackageRoot = join(dir, "node_modules/@demo/private-port");
      mkdirSync(join(sourcePackageRoot, "tsonic"), { recursive: true });
      mkdirSync(join(sourcePackageRoot, "src"), { recursive: true });
      writeFileSync(
        join(sourcePackageRoot, "package.json"),
        JSON.stringify(
          {
            name: "@demo/private-port",
            version: "1.0.0",
            type: "module",
            exports: {
              ".": "./src/index.ts",
            },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(sourcePackageRoot, "tsonic/package-manifest.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            surfaces: ["@tsonic/js"],
            source: {
              exports: {
                ".": "./src/index.ts",
              },
            },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(sourcePackageRoot, "src/index.ts"),
        [
          "export class Counter {",
          '  readonly #label: string = "ctr";',
          "  #count: number = 0;",
          "",
          "  get #prefix(): string {",
          "    return this.#label;",
          "  }",
          "",
          "  #increment(): string {",
          "    this.#count += 1;",
          "    return String(this.#count);",
          "  }",
          "",
          "  append(value: string): string;",
          "  append(value: string[]): string;",
          "  append(value: string | string[]): string {",
          "    if (Array.isArray(value)) {",
          "      for (let index = 0; index < value.length; index += 1) {",
          "        const item = value[index]!;",
          "        this.append(item);",
          "      }",
          "      return this.#prefix;",
          "    }",
          "",
          "    return `${this.#prefix}:${value}:${this.#increment()}`;",
          "  }",
          "",
          "  read(): string {",
          '    return this.append("value");',
          "  }",
          "}",
          "",
          "export const createCounter = (): Counter => new Counter();",
        ].join("\n"),
        "utf-8"
      );

      const workspaceConfig = {
        $schema: "https://tsonic.org/schema/workspace/v1.json",
        dotnetVersion: "net10.0",
        surface: "@tsonic/js",
        dotnet: {
          typeRoots: ["node_modules/@tsonic/js"],
          libraries: [],
          frameworkReferences: [],
          packageReferences: [],
        },
      };

      const projectRoot = join(dir, "packages", "app");
      mkdirSync(join(projectRoot, "src"), { recursive: true });
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify(
          {
            name: "@acme/app",
            version: "1.0.0",
            private: true,
            type: "module",
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "index.ts"),
        [
          'import { createCounter } from "@demo/private-port";',
          "",
          "export function main(): void {",
          "  const counter = createCounter();",
          '  if (counter.read() !== "ctr:value:1") throw new Error("private read failed");',
          '  if (counter.append(["a", "b"]) !== "ctr") throw new Error("private append failed");',
          "}",
        ].join("\n"),
        "utf-8"
      );

      const projectConfig = {
        $schema: "https://tsonic.org/schema/v1.json",
        rootNamespace: "App",
        entryPoint: "src/index.ts",
        sourceRoot: "src",
        outputDirectory: "generated",
        outputName: "App",
      };

      const config = resolveEffectiveConfig(
        workspaceConfig,
        projectConfig,
        dir,
        projectRoot
      );

      const result = buildCommand(config);
      if (!result.ok) {
        throw new Error(result.error);
      }
      expect(result.ok).to.equal(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("builds deterministic well-known symbol members in JS-surface source packages", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-build-symbol-source-port-"));
    try {
      mkdirSync(join(dir, "node_modules"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          { name: "test-workspace", private: true, type: "module" },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      linkDir(linkedJsPackageRoot, join(dir, "node_modules/@tsonic/js"));
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );

      const sourcePackageRoot = join(dir, "node_modules/@demo/symbol-port");
      mkdirSync(join(sourcePackageRoot, "tsonic"), { recursive: true });
      mkdirSync(join(sourcePackageRoot, "src"), { recursive: true });
      writeFileSync(
        join(sourcePackageRoot, "package.json"),
        JSON.stringify(
          {
            name: "@demo/symbol-port",
            version: "1.0.0",
            type: "module",
            exports: {
              ".": "./src/index.ts",
            },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(sourcePackageRoot, "tsonic/package-manifest.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            surfaces: ["@tsonic/js"],
            source: {
              exports: {
                ".": "./src/index.ts",
              },
            },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(sourcePackageRoot, "src/index.ts"),
        [
          "export class Params {",
          "  get [Symbol.toStringTag](): string {",
          '    return "Params";',
          "  }",
          "}",
          "",
          "export const readTag = (params: Params): string => params[Symbol.toStringTag];",
        ].join("\n"),
        "utf-8"
      );

      const workspaceConfig = {
        $schema: "https://tsonic.org/schema/workspace/v1.json",
        dotnetVersion: "net10.0",
        surface: "@tsonic/js",
        dotnet: {
          typeRoots: ["node_modules/@tsonic/js"],
          libraries: [],
          frameworkReferences: [],
          packageReferences: [],
        },
      };

      const projectRoot = join(dir, "packages", "app");
      mkdirSync(join(projectRoot, "src"), { recursive: true });
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify(
          {
            name: "@acme/app",
            version: "1.0.0",
            private: true,
            type: "module",
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "index.ts"),
        [
          'import { Params, readTag } from "@demo/symbol-port";',
          "",
          "export function main(): string {",
          "  return readTag(new Params());",
          "}",
        ].join("\n"),
        "utf-8"
      );

      const projectConfig = {
        $schema: "https://tsonic.org/schema/v1.json",
        rootNamespace: "App",
        entryPoint: "src/index.ts",
        sourceRoot: "src",
        outputDirectory: "generated",
        outputName: "App",
      };

      const config = resolveEffectiveConfig(
        workspaceConfig,
        projectConfig,
        dir,
        projectRoot
      );

      const result = buildCommand(config);
      if (!result.ok) {
        throw new Error(result.error);
      }
      expect(result.ok).to.equal(true);

      const generatedLibText = readGeneratedCSharpTree(
        join(projectRoot, "generated")
      );
      expect(generatedLibText).to.not.include("[computed]");
      expect(generatedLibText).to.include("__tsonic_symbol_toStringTag");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("builds imported callback types that use aliased local type imports", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-build-import-alias-callback-")
    );
    try {
      mkdirSync(join(dir, "node_modules"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          { name: "test-workspace", private: true, type: "module" },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      linkDir(linkedJsPackageRoot, join(dir, "node_modules/@tsonic/js"));
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );

      const projectRoot = join(dir, "packages", "app");
      mkdirSync(join(projectRoot, "src"), { recursive: true });
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify(
          {
            name: "@acme/app",
            version: "1.0.0",
            private: true,
            type: "module",
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "entities.ts"),
        [
          "export class Event {",
          "  Path?: string;",
          "  VisitorId?: string;",
          "}",
        ].join("\n"),
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "top-by-key.ts"),
        [
          'import type { Event as EventEntity } from "./entities.ts";',
          "",
          "export const topByKey = (",
          "  events: readonly EventEntity[],",
          "  getKey: (e: EventEntity) => string,",
          "  getVisitor: (e: EventEntity) => string | undefined",
          "): string[] => {",
          "  const out: string[] = [];",
          "  for (let i = 0; i < events.length; i++) {",
          "    const event = events[i];",
          "    const key = getKey(event);",
          "    const visitor = getVisitor(event);",
          "    out.push(visitor === undefined ? key : `${key}:${visitor}`);",
          "  }",
          "  return out;",
          "};",
        ].join("\n"),
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "index.ts"),
        [
          'import { topByKey } from "./top-by-key.ts";',
          'import { Event } from "./entities.ts";',
          "",
          "export function main(): void {",
          "  const item = new Event();",
          '  item.Path = "/x";',
          '  item.VisitorId = "v1";',
          "  const rows = topByKey([item], (e) => e.Path!, (e) => e.VisitorId);",
          '  if (rows[0] !== "/x:v1") throw new Error("bad callback typing");',
          "}",
        ].join("\n"),
        "utf-8"
      );

      const workspaceConfig = {
        $schema: "https://tsonic.org/schema/workspace/v1.json",
        dotnetVersion: "net10.0",
        surface: "@tsonic/js",
        dotnet: {
          typeRoots: ["node_modules/@tsonic/js"],
          libraries: [],
          frameworkReferences: [],
          packageReferences: [],
        },
      };

      const projectConfig = {
        $schema: "https://tsonic.org/schema/v1.json",
        rootNamespace: "App",
        entryPoint: "src/index.ts",
        sourceRoot: "src",
        outputDirectory: "generated",
        outputName: "App",
      };

      const config = resolveEffectiveConfig(
        workspaceConfig,
        projectConfig,
        dir,
        projectRoot
      );

      const result = buildCommand(config);
      if (!result.ok) {
        throw new Error(result.error);
      }
      expect(result.ok).to.equal(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("builds contextual callback parameters that flow from imported class-backed query surfaces", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-build-contextual-class-callback-")
    );
    try {
      mkdirSync(join(dir, "node_modules"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          { name: "test-workspace", private: true, type: "module" },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      linkDir(linkedJsPackageRoot, join(dir, "node_modules/@tsonic/js"));
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );

      const projectRoot = join(dir, "packages", "app");
      mkdirSync(join(projectRoot, "src"), { recursive: true });
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify(
          {
            name: "@acme/app",
            version: "1.0.0",
            private: true,
            type: "module",
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "entities.ts"),
        [
          "export class Event {",
          "  Path?: string;",
          "  VisitorId?: string;",
          "}",
        ].join("\n"),
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "query.ts"),
        [
          "export class Query<T> {",
          "  readonly items: readonly T[];",
          "",
          "  constructor(items: readonly T[]) {",
          "    this.items = items;",
          "  }",
          "",
          "  map<TResult>(project: (value: T) => TResult): TResult[] {",
          "    const out: TResult[] = [];",
          "    for (let i = 0; i < this.items.length; i++) {",
          "      out.push(project(this.items[i]!));",
          "    }",
          "    return out;",
          "  }",
          "}",
        ].join("\n"),
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "context.ts"),
        [
          'import { Event } from "./entities.ts";',
          'import type { Event as EventEntity } from "./entities.ts";',
          'import { Query } from "./query.ts";',
          "",
          "export class ClickmeterDbContext {",
          "  readonly items: readonly EventEntity[];",
          "",
          "  constructor(items: readonly EventEntity[]) {",
          "    this.items = items;",
          "  }",
          "",
          "  get Events(): Query<EventEntity> {",
          "    return new Query<EventEntity>(this.items);",
          "  }",
          "}",
          "",
          "export const createDb = (): ClickmeterDbContext => {",
          "  const event = new Event();",
          '  event.Path = "/x";',
          '  event.VisitorId = "v1";',
          "  return new ClickmeterDbContext([event]);",
          "};",
        ].join("\n"),
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "index.ts"),
        [
          'import { createDb } from "./context.ts";',
          "",
          "export function main(): void {",
          "  const db = createDb();",
          '  const rows = db.Events.map((e) => e.Path ?? "");',
          '  if (rows[0] !== "/x") throw new Error("bad contextual callback typing");',
          "}",
        ].join("\n"),
        "utf-8"
      );

      const workspaceConfig = {
        $schema: "https://tsonic.org/schema/workspace/v1.json",
        dotnetVersion: "net10.0",
        surface: "@tsonic/js",
        dotnet: {
          typeRoots: ["node_modules/@tsonic/js"],
          libraries: [],
          frameworkReferences: [],
          packageReferences: [],
        },
      };

      const projectConfig = {
        $schema: "https://tsonic.org/schema/v1.json",
        rootNamespace: "App",
        entryPoint: "src/index.ts",
        sourceRoot: "src",
        outputDirectory: "generated",
        outputName: "App",
      };

      const config = resolveEffectiveConfig(
        workspaceConfig,
        projectConfig,
        dir,
        projectRoot
      );

      const result = buildCommand(config);
      if (!result.ok) {
        throw new Error(result.error);
      }
      expect(result.ok).to.equal(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
