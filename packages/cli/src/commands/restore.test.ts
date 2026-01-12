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

  it("ignores built-in runtime DLLs in dotnet.libraries (legacy config)", () => {
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
            $schema: "https://tsonic.dev/schema/v1.json",
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

      const result = restoreCommand(dir, { quiet: true });
      expect(result.ok).to.equal(true);

      // Should not generate bindings for the runtime DLL.
      expect(existsSync(join(dir, "node_modules", "tsonic-runtime-types"))).to.equal(
        false
      );

      // Should auto-migrate the config by removing built-in runtime DLLs from dotnet.libraries.
      const updated = JSON.parse(readFileSync(join(dir, "tsonic.json"), "utf-8")) as {
        dotnet?: { libraries?: unknown };
      };
      expect(updated.dotnet?.libraries).to.deep.equal([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

