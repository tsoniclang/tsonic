/**
 * Regression tests for `tsonic restore`.
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import {
  copyFileSync,
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
import { restoreCommand } from "./restore.js";
import { spawnSync } from "node:child_process";

const repoRoot = resolve(
  join(dirname(fileURLToPath(import.meta.url)), "../../../..")
);

const linkDir = (target: string, linkPath: string): void => {
  mkdirSync(dirname(linkPath), { recursive: true });
  symlinkSync(target, linkPath, "dir");
};

describe("restore command", function () {
  this.timeout(10 * 60 * 1000);

  it("ignores built-in runtime DLLs in dotnet.libraries", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-restore-runtime-"));
    try {
      mkdirSync(join(dir, "src"), { recursive: true });
      mkdirSync(join(dir, "libs"), { recursive: true });
      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify({ name: "test", private: true, type: "module" }, null, 2) +
          "\n",
        "utf-8"
      );

      // Built-in runtime DLLs (JSRuntime / nodejs) should never trigger bindings generation.
      writeFileSync(
        join(dir, "tsonic.workspace.json"),
        JSON.stringify(
          {
            $schema: "https://tsonic.org/schema/workspace/v1.json",
            dotnetVersion: "net10.0",
            dotnet: {
              libraries: ["libs/Tsonic.JSRuntime.dll"],
              frameworkReferences: [],
              packageReferences: [],
            },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      // Provide the runtime DLL.
      copyFileSync(
        join(repoRoot, "packages/cli/runtime/Tsonic.JSRuntime.dll"),
        join(dir, "libs/Tsonic.JSRuntime.dll")
      );

      // Provide required standard bindings packages (no network).
      linkDir(
        join(repoRoot, "node_modules/@tsonic/dotnet"),
        join(dir, "node_modules/@tsonic/dotnet")
      );
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );

      const result = restoreCommand(join(dir, "tsonic.workspace.json"), { quiet: true });
      expect(result.ok).to.equal(true);

      // Should not generate bindings for the runtime DLL.
      expect(existsSync(join(dir, "node_modules", "tsonic-jsruntime-types"))).to.equal(
        false
      );

      // restore does not rewrite the config; it simply ignores runtime DLLs for bindings generation.
      const updated = JSON.parse(readFileSync(join(dir, "tsonic.workspace.json"), "utf-8")) as {
        dotnet?: { libraries?: unknown };
      };
      expect(updated.dotnet?.libraries).to.deep.equal(["libs/Tsonic.JSRuntime.dll"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("ignores DLL references outside libs/ (e.g., workspace outputs)", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-restore-workspace-dll-"));
    try {
      mkdirSync(join(dir, "src"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify({ name: "test", private: true, type: "module" }, null, 2) +
          "\n",
        "utf-8"
      );

      // Simulate a workspace-dependent project that references another project's output DLL.
      // This DLL may not exist until the dependency is built. `tsonic restore` must not fail
      // or attempt bindings generation for such paths (only ./libs/*.dll are eligible).
      writeFileSync(
        join(dir, "tsonic.workspace.json"),
        JSON.stringify(
          {
            $schema: "https://tsonic.org/schema/workspace/v1.json",
            dotnetVersion: "net10.0",
            dotnet: {
              libraries: ["../domain/dist/net10.0/Acme.Domain.dll"],
              frameworkReferences: [],
              packageReferences: [],
            },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      // Provide required standard bindings packages (no network).
      linkDir(
        join(repoRoot, "node_modules/@tsonic/dotnet"),
        join(dir, "node_modules/@tsonic/dotnet")
      );
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );

      const result = restoreCommand(join(dir, "tsonic.workspace.json"), { quiet: true });
      expect(result.ok).to.equal(true);

      // Should not generate bindings for workspace output DLL references.
      expect(
        existsSync(join(dir, "node_modules", "acme-domain-types"))
      ).to.equal(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("skips bindings generation for DLLs with an explicit 'types' mapping", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-restore-dll-types-"));
    try {
      mkdirSync(join(dir, "libs"), { recursive: true });
      mkdirSync(join(dir, "csharp"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify({ name: "test", private: true, type: "module" }, null, 2) +
          "\n",
        "utf-8"
      );

      // Build a tiny local DLL (no dependencies outside the framework).
      writeFileSync(
        join(dir, "csharp", "Acme.Test.csproj"),
        `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <ImplicitUsings>false</ImplicitUsings>
    <Nullable>enable</Nullable>
    <AssemblyName>Acme.Test</AssemblyName>
  </PropertyGroup>
</Project>
`,
        "utf-8"
      );
      writeFileSync(
        join(dir, "csharp", "Class1.cs"),
        `namespace Acme.Test;\npublic sealed class Demo { }\n`,
        "utf-8"
      );

      const build = spawnSync(
        "dotnet",
        ["build", join(dir, "csharp", "Acme.Test.csproj"), "-c", "Release", "-o", join(dir, "libs"), "--nologo"],
        { cwd: dir, encoding: "utf-8" }
      );
      expect(build.status, build.stderr || build.stdout).to.equal(0);

      // Provide required standard bindings packages (no network).
      linkDir(
        join(repoRoot, "node_modules/@tsonic/dotnet"),
        join(dir, "node_modules/@tsonic/dotnet")
      );
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );

      // Provide an external bindings package root.
      const typesPkg = join(dir, "node_modules/@acme/acme-test-types");
      mkdirSync(typesPkg, { recursive: true });
      writeFileSync(
        join(typesPkg, "package.json"),
        JSON.stringify({ name: "@acme/acme-test-types", version: "0.0.0", type: "module" }, null, 2) + "\n",
        "utf-8"
      );

      writeFileSync(
        join(dir, "tsonic.workspace.json"),
        JSON.stringify(
          {
            $schema: "https://tsonic.org/schema/workspace/v1.json",
            dotnetVersion: "net10.0",
            dotnet: {
              libraries: [{ path: "libs/Acme.Test.dll", types: "@acme/acme-test-types" }],
              frameworkReferences: [],
              packageReferences: [],
            },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      const result = restoreCommand(join(dir, "tsonic.workspace.json"), { quiet: true });
      expect(result.ok).to.equal(true);

      // Should not generate bindings for the DLL since it's mapped to an external types package.
      expect(existsSync(join(dir, "node_modules", "acme-test-types"))).to.equal(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fails fast when a DLL has a 'types' mapping but the package is missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-restore-dll-types-missing-"));
    try {
      mkdirSync(join(dir, "libs"), { recursive: true });
      mkdirSync(join(dir, "csharp"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify({ name: "test", private: true, type: "module" }, null, 2) +
          "\n",
        "utf-8"
      );

      writeFileSync(
        join(dir, "csharp", "Acme.Test.csproj"),
        `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <ImplicitUsings>false</ImplicitUsings>
    <Nullable>enable</Nullable>
    <AssemblyName>Acme.Test</AssemblyName>
  </PropertyGroup>
</Project>
`,
        "utf-8"
      );
      writeFileSync(
        join(dir, "csharp", "Class1.cs"),
        `namespace Acme.Test;\npublic sealed class Demo { }\n`,
        "utf-8"
      );

      const build = spawnSync(
        "dotnet",
        ["build", join(dir, "csharp", "Acme.Test.csproj"), "-c", "Release", "-o", join(dir, "libs"), "--nologo"],
        { cwd: dir, encoding: "utf-8" }
      );
      expect(build.status, build.stderr || build.stdout).to.equal(0);

      linkDir(
        join(repoRoot, "node_modules/@tsonic/dotnet"),
        join(dir, "node_modules/@tsonic/dotnet")
      );
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );

      writeFileSync(
        join(dir, "tsonic.workspace.json"),
        JSON.stringify(
          {
            $schema: "https://tsonic.org/schema/workspace/v1.json",
            dotnetVersion: "net10.0",
            dotnet: {
              libraries: [{ path: "libs/Acme.Test.dll", types: "@acme/acme-test-types" }],
              frameworkReferences: [],
              packageReferences: [],
            },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      const result = restoreCommand(join(dir, "tsonic.workspace.json"), { quiet: true });
      expect(result.ok).to.equal(false);
      if (!result.ok) {
        expect(result.error).to.include("Bindings package not found");
        expect(result.error).to.include("@acme/acme-test-types");
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
