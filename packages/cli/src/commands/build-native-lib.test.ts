/**
 * E2E-ish test for NativeAOT native library output (shared library).
 *
 * This validates that:
 * - `output.type = "library"` + `output.nativeAot = true` triggers `dotnet publish`
 * - publish output is copied to dist/<tfm>/<rid>/publish (dotnet-like layout)
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runCli } from "../cli.js";
import {
  detectNativeAotRid,
  probeNativeAotSupport,
} from "./native-aot-test-support.js";

const repoRoot = resolve(
  join(dirname(fileURLToPath(import.meta.url)), "../../../..")
);

const linkDir = (target: string, linkPath: string): void => {
  mkdirSync(dirname(linkPath), { recursive: true });
  symlinkSync(target, linkPath, "dir");
};

const nativeExt = (): string => {
  if (process.platform === "win32") return ".dll";
  if (process.platform === "darwin") return ".dylib";
  return ".so";
};

describe("build command (NativeAOT library)", function () {
  this.timeout(10 * 60 * 1000);

  it("builds a NativeAOT shared library and writes publish output under dist/", async function () {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-native-lib-"));
    const rid = detectNativeAotRid();

    try {
      const probe = probeNativeAotSupport();
      if (!probe.ok) this.skip();

      mkdirSync(join(dir, "packages", "native-lib", "src"), {
        recursive: true,
      });
      mkdirSync(join(dir, "node_modules"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          { name: "test", private: true, type: "module" },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      writeFileSync(
        join(dir, "tsonic.workspace.json"),
        JSON.stringify(
          {
            $schema: "https://tsonic.org/schema/workspace/v1.json",
            dotnetVersion: "net10.0",
            rid,
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "native-lib", "package.json"),
        JSON.stringify(
          { name: "native-lib", private: true, type: "module" },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "native-lib", "tsonic.json"),
        JSON.stringify(
          {
            $schema: "https://tsonic.org/schema/v1.json",
            rootNamespace: "Native.Lib",
            entryPoint: "src/index.ts",
            sourceRoot: "src",
            outputDirectory: "generated",
            outputName: "Native.Lib",
            output: {
              type: "library",
              targetFrameworks: ["net10.0"],
              nativeAot: true,
              nativeLib: "shared",
              generateDocumentation: false,
              includeSymbols: false,
              packable: false,
            },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      mkdirSync(join(dir, "packages", "native-lib", "tsonic"), {
        recursive: true,
      });
      writeFileSync(
        join(dir, "packages", "native-lib", "tsonic.package.json"),
        JSON.stringify(
          {
            kind: "tsonic-source-package",
            schemaVersion: 1,
            surfaces: ["@tsonic/js"],
            source: {
              namespace: "Native.Lib",
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
        join(dir, "packages", "native-lib", "src", "index.ts"),
        `export const add = (a: number, b: number): number => a + b;\n`,
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
      linkDir(
        join(repoRoot, "node_modules/@tsonic/globals"),
        join(dir, "node_modules/@tsonic/globals")
      );

      const exitCode = await runCli([
        "build",
        "--project",
        "native-lib",
        "--config",
        join(dir, "tsonic.workspace.json"),
        "--quiet",
      ]);
      expect(exitCode).to.equal(0);

      const managedDll = join(
        dir,
        "packages",
        "native-lib",
        "dist",
        "net10.0",
        "Native.Lib.dll"
      );
      expect(
        existsSync(managedDll),
        `Expected managed DLL at ${managedDll}`
      ).to.equal(true);

      const publishDir = join(
        dir,
        "packages",
        "native-lib",
        "dist",
        "net10.0",
        rid,
        "publish"
      );
      expect(
        existsSync(publishDir),
        `Expected publish dir at ${publishDir}`
      ).to.equal(true);

      const ext = nativeExt();
      const publishEntries = readdirSync(publishDir);
      expect(
        publishEntries.some((n) => n.trim().endsWith(ext)),
        `Expected at least one '${ext}' file in ${publishDir}`
      ).to.equal(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
