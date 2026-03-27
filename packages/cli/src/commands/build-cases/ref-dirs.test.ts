import { describe, it } from "mocha";
import { buildTestTimeoutMs } from "./helpers.js";
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
import { resolveConfig } from "../../config.js";
import { applyPackageManifestWorkspaceOverlay } from "../../package-manifests/bindings.js";
import { generateCommand } from "../generate.js";
import { buildCommand } from "../build.js";

const repoRoot = resolve(
  join(dirname(fileURLToPath(import.meta.url)), "../../../../..")
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

const resolveEffectiveConfig = (
  workspaceConfig: Parameters<typeof resolveConfig>[0],
  projectConfig: Parameters<typeof resolveConfig>[1],
  workspaceRoot: string,
  projectRoot: string,
  entryFile?: string
) => {
  const overlay = applyPackageManifestWorkspaceOverlay(
    workspaceRoot,
    workspaceConfig
  );
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

describe("build command (library ref dirs)", function () {
  this.timeout(buildTestTimeoutMs);

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
      mkdirSync(join(projectRoot, "tsonic"), { recursive: true });
      mkdirSync(join(projectRoot, "tsonic"), { recursive: true });
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
        join(sourcePackageRoot, "tsonic.package.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            surfaces: ["@tsonic/js"],
            source: {
              namespace: "Acme.Math",
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
      mkdirSync(join(projectRoot, "tsonic"), { recursive: true });
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

  it("builds source-package library artifacts for projects that reference other DLLs and Tsonic.Runtime without requiring copy-local", () => {
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
      mkdirSync(join(projectRoot, "tsonic"), { recursive: true });
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
        join(projectRoot, "tsonic.package.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            source: {
              namespace: "Acme.App",
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

      // 3) Build from the existing generated output directory and emit source-package artifacts.
      const build = buildCommand({ ...config, noGenerate: true });
      expect(build.ok).to.equal(true);

      expect(
        existsSync(join(projectRoot, "dist", "tsonic", "bindings"))
      ).to.equal(false);
      const declarationPath = join(projectRoot, "dist", "src", "index.d.ts");
      expect(existsSync(declarationPath)).to.equal(true);
      const declarationText = readFileSync(declarationPath, "utf-8");
      expect(declarationText).to.include(
        "export declare function main(): void;"
      );

      const packageManifestPath = join(
        projectRoot,
        "dist",
        "tsonic.package.json"
      );
      expect(existsSync(packageManifestPath)).to.equal(true);
      const packageManifest = JSON.parse(
        readFileSync(packageManifestPath, "utf-8")
      ) as Record<string, unknown>;
      expect(packageManifest["schemaVersion"]).to.equal(1);
      expect(packageManifest["kind"]).to.equal("tsonic-source-package");
      expect(existsSync(join(projectRoot, "dist", "package.json"))).to.equal(
        true
      );
      expect(existsSync(join(projectRoot, "dist", "src", "index.ts"))).to.equal(
        true
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("keeps library declaration emit out of imported source-package roots", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-lib-decls-source-pkg-"));
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
      linkDir(
        join(repoRoot, "node_modules/@tsonic/globals"),
        join(dir, "node_modules/@tsonic/globals")
      );

      const sourcePackageRoot = join(dir, "node_modules/@acme/runtime");
      mkdirSync(join(sourcePackageRoot, "tsonic"), { recursive: true });
      mkdirSync(join(sourcePackageRoot, "src"), { recursive: true });
      writeFileSync(
        join(sourcePackageRoot, "package.json"),
        JSON.stringify(
          {
            name: "@acme/runtime",
            version: "1.0.0",
            type: "module",
            exports: {
              "./client.js": "./src/client.ts",
            },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(sourcePackageRoot, "tsonic.package.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            surfaces: ["@tsonic/js"],
            source: {
              namespace: "Acme.Runtime",
              exports: {
                "./client.js": "./src/client.ts",
              },
            },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(sourcePackageRoot, "src/client.ts"),
        [
          "export interface ExternalOptions {",
          "  readonly name: string;",
          "}",
          "",
          "export const format = (value: ExternalOptions): string => value.name;",
          "",
        ].join("\n"),
        "utf-8"
      );
      const importedDeclarationPath = join(
        sourcePackageRoot,
        "src/client.d.ts"
      );
      const importedDeclarationText = [
        "export interface ExternalOptions {",
        "  readonly name: string;",
        "}",
        "",
        "export declare const format: (value: ExternalOptions) => string;",
        "",
      ].join("\n");
      writeFileSync(importedDeclarationPath, importedDeclarationText, "utf-8");

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
      mkdirSync(join(projectRoot, "tsonic"), { recursive: true });
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify(
          {
            name: "@acme/app-lib",
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
        join(projectRoot, "tsonic.package.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            surfaces: ["@tsonic/js"],
            source: {
              namespace: "Acme.App",
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
        join(projectRoot, "src", "index.ts"),
        [
          'import { format, type ExternalOptions } from "@acme/runtime/client.js";',
          "",
          "export function render(value: ExternalOptions): string {",
          "  return format(value);",
          "}",
          "",
        ].join("\n"),
        "utf-8"
      );

      const projectConfig = {
        $schema: "https://tsonic.org/schema/v1.json",
        rootNamespace: "Acme.App",
        entryPoint: "src/index.ts",
        sourceRoot: "src",
        outputDirectory: "generated",
        outputName: "Acme.App",
        output: { type: "library" as const },
      };

      const config = resolveEffectiveConfig(
        workspaceConfig,
        projectConfig,
        dir,
        projectRoot
      );

      const build = buildCommand(config);
      if (!build.ok) {
        throw new Error(build.error);
      }
      expect(build.ok).to.equal(true);

      const declarationPath = join(projectRoot, "dist", "src", "index.d.ts");
      expect(existsSync(declarationPath)).to.equal(true);
      expect(readFileSync(declarationPath, "utf-8")).to.include(
        'from "@acme/runtime/client.js"'
      );
      expect(readFileSync(importedDeclarationPath, "utf-8")).to.equal(
        importedDeclarationText
      );
      expect(
        existsSync(
          join(projectRoot, "dist", "node_modules", "@acme", "runtime")
        )
      ).to.equal(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
