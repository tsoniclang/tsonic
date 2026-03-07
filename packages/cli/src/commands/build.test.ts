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

      const config = resolveConfig(
        workspaceConfig,
        projectConfig,
        {},
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

      const config = resolveConfig(
        workspaceConfig,
        projectConfig,
        {},
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

      const config = resolveConfig(
        workspaceConfig,
        projectConfig,
        {},
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
