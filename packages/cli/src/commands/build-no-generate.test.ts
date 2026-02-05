/**
 * E2E-ish test: `tsonic build --no-generate` must not wipe the generated output dir.
 *
 * This is required for workflows where external tools generate additional C# sources
 * between `tsonic generate` and `tsonic build` (e.g., EF Core compiled models).
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
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(join(dirname(fileURLToPath(import.meta.url)), "../../../.."));

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

describe("build command (--no-generate)", function () {
  this.timeout(10 * 60 * 1000);

  it("preserves extra sources in outputDirectory", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-no-generate-"));
    const rid = detectRid();

    try {
      mkdirSync(join(dir, "packages", "app", "src"), { recursive: true });
      mkdirSync(join(dir, "node_modules"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify({ name: "test", private: true, type: "module" }, null, 2) + "\n",
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
        join(dir, "packages", "app", "package.json"),
        JSON.stringify({ name: "app", private: true, type: "module" }, null, 2) + "\n",
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "app", "tsonic.json"),
        JSON.stringify(
          {
            $schema: "https://tsonic.org/schema/v1.json",
            rootNamespace: "NoGenerate.App",
            entryPoint: "src/index.ts",
            sourceRoot: "src",
            outputDirectory: "generated",
            outputName: "no-generate-app",
            output: {
              nativeAot: false,
              singleFile: false,
              trimmed: false,
              selfContained: false,
            },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "app", "src", "index.ts"),
        `export function main(): void {}\n`,
        "utf-8"
      );

      // Provide required standard bindings packages (no network).
      linkDir(join(repoRoot, "node_modules/@tsonic/dotnet"), join(dir, "node_modules/@tsonic/dotnet"));
      linkDir(join(repoRoot, "node_modules/@tsonic/core"), join(dir, "node_modules/@tsonic/core"));
      linkDir(join(repoRoot, "node_modules/@tsonic/globals"), join(dir, "node_modules/@tsonic/globals"));

      const cliPath = join(repoRoot, "packages/cli/dist/index.js");

      // 1) Generate C#
      const gen = spawnSync(
        "node",
        [cliPath, "generate", "--project", "app", "--config", join(dir, "tsonic.workspace.json"), "--quiet"],
        { cwd: dir, encoding: "utf-8" }
      );
      expect(gen.status, gen.stderr || gen.stdout).to.equal(0);

      // 2) External tool writes additional C# sources into outputDirectory
      const extraDir = join(dir, "packages", "app", "generated", "ef-compiled-model");
      mkdirSync(extraDir, { recursive: true });
      const extraFile = join(extraDir, "Extra.cs");
      writeFileSync(
        extraFile,
        `namespace NoGenerate.App;\npublic static class Extra { public static int Value => 42; }\n`,
        "utf-8"
      );
      expect(existsSync(extraFile)).to.equal(true);

      // 3) Build without re-running generate (must not wipe outputDirectory)
      const build = spawnSync(
        "node",
        [cliPath, "build", "--no-generate", "--project", "app", "--config", join(dir, "tsonic.workspace.json"), "--quiet"],
        { cwd: dir, encoding: "utf-8" }
      );
      expect(build.status, build.stderr || build.stdout).to.equal(0);

      expect(existsSync(extraFile), "expected Extra.cs to survive --no-generate build").to.equal(true);

      const outBinary = join(dir, "packages", "app", "out", "no-generate-app");
      expect(existsSync(outBinary), `Expected output binary at ${outBinary}`).to.equal(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

