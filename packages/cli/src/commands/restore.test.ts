/**
 * Regression tests for `tsonic restore`.
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { restoreCommand } from "./restore.js";

const repoRoot = resolve(
  join(dirname(fileURLToPath(import.meta.url)), "../../../..")
);

const linkDir = (target: string, linkPath: string): void => {
  mkdirSync(dirname(linkPath), { recursive: true });
  symlinkSync(target, linkPath, "dir");
};

describe("restore command", function () {
  this.timeout(10 * 60 * 1000);

  const runDotnet = (cwd: string, args: readonly string[]): void => {
    const actualArgs =
      args[0] === "build"
        ? [...args, "-p:RestoreIgnoreFailedSources=true"]
        : [...args];
    const result = spawnSync("dotnet", actualArgs, { cwd, stdio: "pipe", encoding: "utf-8" });
    if (result.status !== 0) {
      const msg = result.stderr || result.stdout || "Unknown error";
      throw new Error(`dotnet ${actualArgs.join(" ")} failed:\n${msg}`);
    }
  };

  it("ignores runtime DLLs in dotnet.libraries (legacy config)", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-restore-runtime-"));
    try {
      mkdirSync(join(dir, "src"), { recursive: true });
      mkdirSync(join(dir, "lib"), { recursive: true });
      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify({ name: "test", private: true, type: "module" }, null, 2) +
          "\n",
        "utf-8"
      );

      // Simulate a legacy config that incorrectly listed runtime DLLs as external libraries.
      writeFileSync(
        join(dir, "tsonic.json"),
        JSON.stringify(
          {
            $schema: "https://tsonic.org/schema/v1.json",
            rootNamespace: "Test",
            entryPoint: "src/App.ts",
            sourceRoot: "src",
            outputDirectory: "generated",
            outputName: "app",
            dotnetVersion: "net10.0",
            dotnet: {
              typeRoots: ["node_modules/@tsonic/globals"],
              libraries: ["lib/Tsonic.Runtime.dll"],
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
        join(repoRoot, "packages/cli/runtime/Tsonic.Runtime.dll"),
        join(dir, "lib/Tsonic.Runtime.dll")
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

      const result = restoreCommand(join(dir, "tsonic.json"), { quiet: true });
      expect(result.ok).to.equal(true);

      // Should not generate bindings for the runtime DLL.
      expect(existsSync(join(dir, "node_modules", "tsonic-runtime-types"))).to.equal(
        false
      );

      // restore does not rewrite the config; it simply ignores runtime DLLs for bindings generation.
      const updated = JSON.parse(readFileSync(join(dir, "tsonic.json"), "utf-8")) as {
        dotnet?: { libraries?: unknown };
      };
      expect(updated.dotnet?.libraries).to.deep.equal(["lib/Tsonic.Runtime.dll"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("ignores non-vendored DLL references outside lib/ (workspace outputs)", () => {
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
      // or attempt bindings generation for such paths (only vendored ./lib/*.dll are eligible).
      writeFileSync(
        join(dir, "tsonic.json"),
        JSON.stringify(
          {
            $schema: "https://tsonic.org/schema/v1.json",
            rootNamespace: "Test",
            entryPoint: "src/App.ts",
            sourceRoot: "src",
            outputDirectory: "generated",
            outputName: "app",
            dotnetVersion: "net10.0",
            dotnet: {
              typeRoots: ["node_modules/@tsonic/globals"],
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

      const result = restoreCommand(join(dir, "tsonic.json"), { quiet: true });
      expect(result.ok).to.equal(true);

      // Should not generate bindings for workspace output DLL references.
      expect(
        existsSync(join(dir, "node_modules", "acme-domain-types"))
      ).to.equal(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("supports incremental DLL bindings regeneration (skip when unchanged, regen when changed)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-restore-incremental-"));
    try {
      mkdirSync(join(dir, "src"), { recursive: true });
      mkdirSync(join(dir, "lib"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify({ name: "test", private: true, type: "module" }, null, 2) + "\n",
        "utf-8"
      );

      // Build a real, valid DLL into ./lib so tsbindgen can generate bindings.
      const vendorDir = join(dir, "vendor");
      mkdirSync(vendorDir, { recursive: true });
      runDotnet(vendorDir, ["new", "classlib", "-n", "Acme.Widget", "--no-restore"]);
      const csproj = join(vendorDir, "Acme.Widget", "Acme.Widget.csproj");
      runDotnet(vendorDir, ["build", csproj, "-c", "Release", "-o", join(dir, "lib")]);

      writeFileSync(
        join(dir, "tsonic.json"),
        JSON.stringify(
          {
            $schema: "https://tsonic.org/schema/v1.json",
            rootNamespace: "Test",
            entryPoint: "src/App.ts",
            sourceRoot: "src",
            outputDirectory: "generated",
            outputName: "app",
            dotnetVersion: "net10.0",
            dotnet: {
              typeRoots: ["node_modules/@tsonic/globals"],
              libraries: ["lib/Acme.Widget.dll"],
              frameworkReferences: [],
              packageReferences: [],
            },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      // Provide required bindings packages (no network).
      linkDir(
        join(repoRoot, "node_modules/@tsonic/dotnet"),
        join(dir, "node_modules/@tsonic/dotnet")
      );
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );

      const first = restoreCommand(join(dir, "tsonic.json"), { quiet: true });
      expect(first.ok).to.equal(true);

      const pkgDir = join(dir, ".tsonic", "bindings", "dll", "acme-widget-types");
      const pkgJson = join(pkgDir, "package.json");
      expect(existsSync(pkgJson)).to.equal(true);

      const firstMtime = statSync(pkgJson).mtimeMs;

      // Ensure mtime resolution doesn't hide re-writes.
      await new Promise((r) => setTimeout(r, 1200));

      const second = restoreCommand(join(dir, "tsonic.json"), {
        quiet: true,
        incremental: true,
      });
      expect(second.ok).to.equal(true);

      const secondMtime = statSync(pkgJson).mtimeMs;
      expect(secondMtime).to.equal(firstMtime);

      // Modify the DLL (rebuild) and ensure incremental restore regenerates bindings.
      await new Promise((r) => setTimeout(r, 1200));
      const classFile = join(vendorDir, "Acme.Widget", "Class1.cs");
      writeFileSync(
        classFile,
        "namespace Acme.Widget;\n\npublic class Class1 { }\n\npublic class Extra { public static int X => 1; }\n",
        "utf-8"
      );
      runDotnet(vendorDir, ["build", csproj, "-c", "Release", "-o", join(dir, "lib")]);

      const third = restoreCommand(join(dir, "tsonic.json"), {
        quiet: true,
        incremental: true,
      });
      expect(third.ok).to.equal(true);

      const thirdMtime = statSync(pkgJson).mtimeMs;
      expect(thirdMtime).to.be.greaterThan(secondMtime);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("skips auto-generation for vendored DLLs when dotnet.libraries provides an external types package", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-restore-dll-types-"));
    try {
      mkdirSync(join(dir, "src"), { recursive: true });
      mkdirSync(join(dir, "lib"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify({ name: "test", private: true, type: "module" }, null, 2) + "\n",
        "utf-8"
      );

      // Create a minimal external types package in node_modules.
      mkdirSync(join(dir, "node_modules", "acme-widget-external-types"), { recursive: true });
      writeFileSync(
        join(dir, "node_modules", "acme-widget-external-types", "package.json"),
        JSON.stringify(
          { name: "acme-widget-external-types", version: "1.0.0", type: "module" },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      // Provide a valid DLL.
      const vendorDir = join(dir, "vendor");
      mkdirSync(vendorDir, { recursive: true });
      runDotnet(vendorDir, ["new", "classlib", "-n", "Acme.Widget", "--no-restore"]);
      const csproj = join(vendorDir, "Acme.Widget", "Acme.Widget.csproj");
      runDotnet(vendorDir, ["build", csproj, "-c", "Release", "-o", join(dir, "lib")]);

      writeFileSync(
        join(dir, "tsonic.json"),
        JSON.stringify(
          {
            $schema: "https://tsonic.org/schema/v1.json",
            rootNamespace: "Test",
            entryPoint: "src/App.ts",
            sourceRoot: "src",
            outputDirectory: "generated",
            outputName: "app",
            dotnetVersion: "net10.0",
            dotnet: {
              typeRoots: ["node_modules/@tsonic/globals"],
              libraries: [
                { path: "lib/Acme.Widget.dll", types: "acme-widget-external-types" },
              ],
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

      const result = restoreCommand(join(dir, "tsonic.json"), { quiet: true, incremental: true });
      expect(result.ok).to.equal(true);

      // No generated DLL bindings package should exist under .tsonic when external types are provided.
      expect(existsSync(join(dir, ".tsonic", "bindings", "dll", "acme-widget-types"))).to.equal(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
