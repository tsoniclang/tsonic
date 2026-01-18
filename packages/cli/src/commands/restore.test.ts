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
});
