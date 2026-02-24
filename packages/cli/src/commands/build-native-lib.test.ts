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
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runCli } from "../cli.js";

const repoRoot = resolve(
  join(dirname(fileURLToPath(import.meta.url)), "../../../..")
);

const linkDir = (target: string, linkPath: string): void => {
  mkdirSync(dirname(linkPath), { recursive: true });
  symlinkSync(target, linkPath, "dir");
};

const detectRid = (): string => {
  const platform = process.platform;
  const arch = process.arch;

  const ridMap: Record<string, string> = {
    "darwin-x64": "osx-x64",
    "darwin-arm64": "osx-arm64",
    "linux-x64": "linux-x64",
    "linux-arm64": "linux-arm64",
    "win32-x64": "win-x64",
    "win32-arm64": "win-arm64",
  };

  const key = `${platform}-${arch}`;
  return ridMap[key] || "linux-x64";
};

const nativeExt = (): string => {
  if (process.platform === "win32") return ".dll";
  if (process.platform === "darwin") return ".dylib";
  return ".so";
};

const probeNativeAotSupport = (rid: string): { readonly ok: boolean } => {
  const probeDir = mkdtempSync(join(tmpdir(), "tsonic-native-aot-probe-"));
  try {
    const projectName = "AotProbe";
    const projectDir = join(probeDir, projectName);
    const create = spawnSync(
      "dotnet",
      [
        "new",
        "classlib",
        "--framework",
        "net10.0",
        "--name",
        projectName,
        "--no-restore",
        "--force",
      ],
      {
        cwd: probeDir,
        encoding: "utf-8",
      }
    );
    if (create.status !== 0) return { ok: false };

    const publish = spawnSync(
      "dotnet",
      [
        "publish",
        `${projectName}.csproj`,
        "-c",
        "Release",
        "-r",
        rid,
        "--self-contained",
        "true",
        "/p:PublishAot=true",
        "/p:NativeLib=Shared",
        "--nologo",
      ],
      {
        cwd: projectDir,
        encoding: "utf-8",
      }
    );
    if (publish.status === 0) return { ok: true };

    const output = `${publish.stdout ?? ""}\n${publish.stderr ?? ""}`;
    if (
      output.includes("MSB4216") ||
      output.includes("MSB4027") ||
      output.includes("ComputeManagedAssemblies")
    ) {
      return { ok: false };
    }

    // Any publish failure means this machine/toolchain is not suitable for
    // NativeAOT in this test run. Skip rather than running assertions on a
    // partial/unsupported environment.
    return { ok: false };
  } finally {
    rmSync(probeDir, { recursive: true, force: true });
  }
};

describe("build command (NativeAOT library)", function () {
  this.timeout(10 * 60 * 1000);

  it("builds a NativeAOT shared library and writes publish output under dist/", async function () {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-native-lib-"));
    const rid = detectRid();

    try {
      const probe = probeNativeAotSupport(rid);
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
