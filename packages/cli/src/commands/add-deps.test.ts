/**
 * Integration tests for dependency-aware bindings generation.
 *
 * These tests are intentionally end-to-end at the CLI command level:
 * - Use a local NuGet feed (no network)
 * - Verify transitive dependencies produce bindings packages automatically
 * - Verify netstandard-style dependencies resolve under .NET 10
 */

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
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { addNugetCommand } from "./add-nuget.js";
import { addPackageCommand } from "./add-package.js";

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

const writeTsonicJson = (dir: string): void => {
  mkdirSync(join(dir, "src"), { recursive: true });
  writeFileSync(
    join(dir, "tsonic.json"),
    JSON.stringify(
      {
        $schema: "https://tsonic.dev/schema/v1.json",
        rootNamespace: "Test",
        entryPoint: "src/App.ts",
        sourceRoot: "src",
        outputDirectory: "generated",
        outputName: "app",
        dotnetVersion: "net10.0",
        dotnet: {
          typeRoots: ["node_modules/@tsonic/globals"],
          libraries: [],
          frameworkReferences: [],
          packageReferences: [],
        },
      },
      null,
      2
    ) + "\n",
    "utf-8"
  );

  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ name: "test", private: true, type: "module" }, null, 2) +
      "\n",
    "utf-8"
  );
};

const writeNugetConfig = (projectRoot: string, feedDir: string): void => {
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <packageSources>
    <clear />
    <add key="local" value="${feedDir}" />
  </packageSources>
</configuration>
`;
  writeFileSync(join(projectRoot, "nuget.config"), xml, "utf-8");
};

const createNugetPackage = (
  workDir: string,
  feedDir: string,
  pkg: { id: string; version: string; deps?: readonly { id: string; version: string }[] }
): void => {
  const projDir = join(workDir, pkg.id);
  mkdirSync(projDir, { recursive: true });

  const deps =
    pkg.deps && pkg.deps.length > 0
      ? `<ItemGroup>\n${pkg.deps
          .map(
            (d) =>
              `  <PackageReference Include="${d.id}" Version="${d.version}" />`
          )
          .join("\n")}\n</ItemGroup>\n`
      : "";

  const csproj = `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <ImplicitUsings>false</ImplicitUsings>
    <Nullable>enable</Nullable>
    <PackageId>${pkg.id}</PackageId>
    <Version>${pkg.version}</Version>
  </PropertyGroup>
${deps}</Project>
`;
  writeFileSync(join(projDir, `${pkg.id}.csproj`), csproj, "utf-8");
  writeFileSync(
    join(projDir, "Class1.cs"),
    `namespace ${pkg.id.replace(/\./g, "_")};\npublic sealed class ${pkg.id
      .split(".")
      .pop()}Type { }\n`,
    "utf-8"
  );

  // Pack to local feed (uses nuget.config in parent dirs).
  run(projDir, "dotnet", [
    "pack",
    "-c",
    "Release",
    "-o",
    feedDir,
    "--nologo",
  ]);
};

describe("add commands - dependency closure bindings", function () {
  this.timeout(10 * 60 * 1000);

  it("add nuget generates bindings for transitive deps (A -> B -> C)", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-add-nuget-"));
    try {
      writeTsonicJson(dir);

      // Link required standard bindings packages into the temp project (no network).
      linkDir(
        join(repoRoot, "node_modules/@tsonic/dotnet"),
        join(dir, "node_modules/@tsonic/dotnet")
      );
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );

      const feedDir = join(dir, "feed");
      mkdirSync(feedDir, { recursive: true });
      writeNugetConfig(dir, feedDir);

      // Build local NuGet feed packages: Acme.C, Acme.B(depends on C), Acme.A(depends on B).
      createNugetPackage(dir, feedDir, { id: "Acme.C", version: "1.0.0" });
      createNugetPackage(dir, feedDir, {
        id: "Acme.B",
        version: "1.0.0",
        deps: [{ id: "Acme.C", version: "1.0.0" }],
      });
      createNugetPackage(dir, feedDir, {
        id: "Acme.A",
        version: "1.0.0",
        deps: [{ id: "Acme.B", version: "1.0.0" }],
      });

      const result = addNugetCommand("Acme.A", "1.0.0", undefined, dir, {
        verbose: false,
        quiet: true,
      });
      expect(result.ok).to.equal(true);

      // Airplane-grade requirement: deps bindings are generated automatically.
      expect(existsSync(join(dir, "node_modules", "acme-a-types"))).to.equal(
        true
      );
      expect(existsSync(join(dir, "node_modules", "acme-b-types"))).to.equal(
        true
      );
      expect(existsSync(join(dir, "node_modules", "acme-c-types"))).to.equal(
        true
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("add package resolves netstandard-style dependencies under .NET 10", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-add-package-"));
    try {
      writeTsonicJson(dir);

      linkDir(
        join(repoRoot, "node_modules/@tsonic/dotnet"),
        join(dir, "node_modules/@tsonic/dotnet")
      );
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );

      // Build a netstandard2.0 library (commonly references netstandard 2.0.0.0).
      const libDir = join(dir, "ns");
      run(dir, "dotnet", [
        "new",
        "classlib",
        "-n",
        "NetStandardLib",
        "-f",
        "netstandard2.0",
        "--no-restore",
        "--output",
        libDir,
      ]);
      run(libDir, "dotnet", ["build", "-c", "Release", "--nologo"]);

      const dll = join(
        libDir,
        "bin",
        "Release",
        "netstandard2.0",
        "NetStandardLib.dll"
      );
      expect(existsSync(dll)).to.equal(true);

      const add = addPackageCommand(dll, undefined, dir, {
        verbose: false,
        quiet: true,
      });
      expect(add.ok).to.equal(true);

      // Should have generated a bindings package in node_modules.
      expect(
        existsSync(join(dir, "node_modules", "net-standard-lib-types"))
      ).to.equal(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
