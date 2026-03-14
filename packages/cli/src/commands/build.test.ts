import { describe, it } from "mocha";
import { expect } from "chai";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
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

      linkDir(
        join(repoRoot, "node_modules/@tsonic/js"),
        join(dir, "node_modules/@tsonic/js")
      );
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

      linkDir(
        join(repoRoot, "node_modules/@tsonic/js"),
        join(dir, "node_modules/@tsonic/js")
      );
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
          { name: "@acme/app", version: "1.0.0", private: true, type: "module" },
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

      linkDir(
        join(repoRoot, "node_modules/@tsonic/js"),
        join(dir, "node_modules/@tsonic/js")
      );
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
          { name: "@acme/app", version: "1.0.0", private: true, type: "module" },
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

  it("builds imported callback types that use aliased local type imports", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-build-import-alias-callback-"));
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
        join(repoRoot, "node_modules/@tsonic/js"),
        join(dir, "node_modules/@tsonic/js")
      );
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
          "  if (rows[0] !== \"/x:v1\") throw new Error(\"bad callback typing\");",
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
    const dir = mkdtempSync(join(tmpdir(), "tsonic-build-contextual-class-callback-"));
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
        join(repoRoot, "node_modules/@tsonic/js"),
        join(dir, "node_modules/@tsonic/js")
      );
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
