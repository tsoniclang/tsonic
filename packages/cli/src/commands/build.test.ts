import { describe, it } from "mocha";
import { expect } from "chai";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
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

  it("generates bindings for libraries that reference other DLLs and Tsonic.Runtime without requiring copy-local", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-build-lib-"));
    try {
      mkdirSync(join(dir, "node_modules"), { recursive: true });
      mkdirSync(join(dir, "libs"), { recursive: true });

      // Workspace root package.json is required for createRequire-based resolution.
      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify({ name: "test-workspace", private: true, type: "module" }, null, 2) +
          "\n",
        "utf-8"
      );

      // Provide required standard bindings packages and tsbindgen (no network).
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
      linkDir(
        join(repoRoot, "node_modules/@tsonic/tsbindgen"),
        join(dir, "node_modules/@tsonic/tsbindgen")
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
      run(depDir, "dotnet", ["build", "-c", "Release", "-o", depOut, "--nologo"]);
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
      expect(existsSync(join(projectRoot, "dist", "tsonic", "bindings"))).to.equal(
        true
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
