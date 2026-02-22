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
  readFileSync,
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
import { removeNugetCommand } from "./remove-nuget.js";
import { updateNugetCommand } from "./update-nuget.js";

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

const writeWorkspaceConfig = (
  dir: string,
  fileName = "tsonic.workspace.json"
): void => {
  writeFileSync(
    join(dir, fileName),
    JSON.stringify(
      {
        $schema: "https://tsonic.org/schema/workspace/v1.json",
        dotnetVersion: "net10.0",
        dotnet: {
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
  pkg: {
    id: string;
    version: string;
    deps?: readonly { id: string; version: string }[];
  }
): void => {
  const projDir = join(workDir, `${pkg.id}.${pkg.version}`);
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
  run(projDir, "dotnet", ["pack", "-c", "Release", "-o", feedDir, "--nologo"]);
};

describe("add commands - dependency closure bindings", function () {
  this.timeout(10 * 60 * 1000);

  it("add nuget generates bindings for transitive deps (A -> B -> C)", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-add-nuget-"));
    try {
      writeWorkspaceConfig(dir);

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

      const result = addNugetCommand(
        "Acme.A",
        "1.0.0",
        undefined,
        join(dir, "tsonic.workspace.json"),
        {
          verbose: false,
          quiet: true,
        }
      );
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

  it("update nuget updates pinned version and keeps bindings green", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-update-nuget-"));
    try {
      writeWorkspaceConfig(dir, "tsonic.custom.json");

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

      createNugetPackage(dir, feedDir, { id: "Acme.D", version: "1.0.0" });
      createNugetPackage(dir, feedDir, { id: "Acme.D", version: "1.0.1" });

      const configPath = join(dir, "tsonic.custom.json");
      const add = addNugetCommand("Acme.D", "1.0.0", undefined, configPath, {
        verbose: false,
        quiet: true,
      });
      expect(add.ok).to.equal(true);
      expect(existsSync(join(dir, "node_modules", "acme-d-types"))).to.equal(
        true
      );

      const update = updateNugetCommand(
        "Acme.D",
        "1.0.1",
        undefined,
        configPath,
        { verbose: false, quiet: true }
      );
      expect(update.ok).to.equal(true);

      const updated = JSON.parse(readFileSync(configPath, "utf-8")) as {
        dotnet?: { packageReferences?: Array<{ id: string; version: string }> };
      };
      const pr = updated.dotnet?.packageReferences?.find(
        (p) => p.id === "Acme.D"
      );
      expect(pr?.version).to.equal("1.0.1");
      expect(existsSync(join(dir, "node_modules", "acme-d-types"))).to.equal(
        true
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("remove nuget removes package reference from config", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-remove-nuget-"));
    try {
      writeWorkspaceConfig(dir);

      linkDir(
        join(repoRoot, "node_modules/@tsonic/dotnet"),
        join(dir, "node_modules/@tsonic/dotnet")
      );
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );

      const configPath = join(dir, "tsonic.workspace.json");
      const cfg = JSON.parse(readFileSync(configPath, "utf-8")) as {
        dotnet?: { packageReferences?: Array<{ id: string; version: string }> };
      };
      cfg.dotnet = cfg.dotnet ?? {};
      cfg.dotnet.packageReferences = [{ id: "Acme.A", version: "1.0.0" }];
      writeFileSync(configPath, JSON.stringify(cfg, null, 2) + "\n", "utf-8");

      const removed = removeNugetCommand("Acme.A", configPath, {
        verbose: false,
        quiet: true,
      });
      expect(removed.ok).to.equal(true);

      const updated = JSON.parse(readFileSync(configPath, "utf-8")) as {
        dotnet?: { packageReferences?: Array<{ id: string; version: string }> };
      };
      expect(updated.dotnet?.packageReferences).to.deep.equal([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("add package resolves netstandard-style dependencies under .NET 10", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-add-package-"));
    try {
      writeWorkspaceConfig(dir);

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

      const add = addPackageCommand(
        dll,
        undefined,
        join(dir, "tsonic.workspace.json"),
        {
          verbose: false,
          quiet: true,
        }
      );
      expect(add.ok).to.equal(true);

      // Should have generated a bindings package in node_modules.
      expect(
        existsSync(join(dir, "node_modules", "net-standard-lib-types"))
      ).to.equal(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("add package allows constructor constraint loss by default (use --strict to fail)", () => {
    const makeLib = (dir: string): string => {
      const libDir = join(dir, "ctor");
      run(dir, "dotnet", [
        "new",
        "classlib",
        "-n",
        "CtorConstraintInterfaceLib",
        "-f",
        "net10.0",
        "--no-restore",
        "--output",
        libDir,
      ]);

      writeFileSync(
        join(libDir, "Api.cs"),
        `namespace CtorConstraintInterfaceLib;\n\npublic interface IFactory<T> where T : new()\n{\n  T Make();\n}\n\npublic sealed class Factory<T> : IFactory<T> where T : new()\n{\n  public T Make() => new T();\n}\n`,
        "utf-8"
      );

      run(libDir, "dotnet", ["build", "-c", "Release", "--nologo"]);
      const dll = join(
        libDir,
        "bin",
        "Release",
        "net10.0",
        "CtorConstraintInterfaceLib.dll"
      );
      expect(existsSync(dll)).to.equal(true);
      return dll;
    };

    // Default: should succeed (we pass --allow-constructor-constraint-loss).
    const dir = mkdtempSync(join(tmpdir(), "tsonic-ctor-constraint-"));
    try {
      writeWorkspaceConfig(dir);

      linkDir(
        join(repoRoot, "node_modules/@tsonic/dotnet"),
        join(dir, "node_modules/@tsonic/dotnet")
      );
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );

      const dll = makeLib(dir);
      const add = addPackageCommand(
        dll,
        undefined,
        join(dir, "tsonic.workspace.json"),
        {
          verbose: false,
          quiet: true,
        }
      );
      expect(add.ok).to.equal(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }

    // Strict: should fail with TBG406.
    const dirStrict = mkdtempSync(
      join(tmpdir(), "tsonic-ctor-constraint-strict-")
    );
    try {
      writeWorkspaceConfig(dirStrict);

      linkDir(
        join(repoRoot, "node_modules/@tsonic/dotnet"),
        join(dirStrict, "node_modules/@tsonic/dotnet")
      );
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dirStrict, "node_modules/@tsonic/core")
      );

      const dll = makeLib(dirStrict);
      const add = addPackageCommand(
        dll,
        undefined,
        join(dirStrict, "tsonic.workspace.json"),
        {
          verbose: false,
          quiet: true,
          strict: true,
        }
      );
      expect(add.ok).to.equal(false);
      if (add.ok === false) {
        expect(add.error).to.include("TBG406");
      }
    } finally {
      rmSync(dirStrict, { recursive: true, force: true });
    }
  });
});
