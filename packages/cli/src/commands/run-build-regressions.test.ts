/**
 * Regression tests for `tsonic run` and build-time safety checks.
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
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

describe("CLI regressions (run/build)", function () {
  this.timeout(10 * 60 * 1000);

  it("propagates non-zero exit code when the program terminates abnormally", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-run-exitcode-"));
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
            rootNamespace: "RunExitCode.App",
            entryPoint: "src/index.ts",
            sourceRoot: "src",
            outputDirectory: "generated",
            outputName: "run-exitcode-app",
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
        `import { Exception } from "@tsonic/dotnet/System.js";\n` +
          `export function main(): void {\n` +
          `  throw new Exception("boom");\n` +
          `}\n`,
        "utf-8"
      );

      // Provide required standard bindings packages (no network).
      linkDir(join(repoRoot, "node_modules/@tsonic/dotnet"), join(dir, "node_modules/@tsonic/dotnet"));
      linkDir(join(repoRoot, "node_modules/@tsonic/core"), join(dir, "node_modules/@tsonic/core"));
      linkDir(join(repoRoot, "node_modules/@tsonic/globals"), join(dir, "node_modules/@tsonic/globals"));

      const cliPath = join(repoRoot, "packages/cli/dist/index.js");

      const run = spawnSync(
        "node",
        [cliPath, "run", "--project", "app", "--config", join(dir, "tsonic.workspace.json"), "--quiet"],
        { cwd: dir, encoding: "utf-8" }
      );

      expect(run.status, run.stderr || run.stdout).to.not.equal(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fails the build with a clear error when outputName conflicts with a referenced assembly name", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-assembly-name-conflict-"));
    const rid = detectRid();

    try {
      const localFeedDir = join(dir, "local-nuget");
      const localPkgDir = join(dir, "local-nuget-src");
      mkdirSync(localFeedDir, { recursive: true });
      mkdirSync(localPkgDir, { recursive: true });

      // Create a local NuGet package that produces `conflict.dll`, then reference it.
      // This makes the test deterministic without relying on network restore.
      writeFileSync(
        join(localPkgDir, "Conflict.csproj"),
        `<Project Sdk="Microsoft.NET.Sdk">\n` +
          `  <PropertyGroup>\n` +
          `    <TargetFramework>netstandard2.0</TargetFramework>\n` +
          `    <AssemblyName>conflict</AssemblyName>\n` +
          `    <PackageId>Conflict.Pkg</PackageId>\n` +
          `    <Version>1.0.0</Version>\n` +
          `    <Authors>Tsonic Tests</Authors>\n` +
          `    <Description>Test package for assembly name collision detection</Description>\n` +
          `  </PropertyGroup>\n` +
          `</Project>\n`,
        "utf-8"
      );
      writeFileSync(
        join(localPkgDir, "Class1.cs"),
        `namespace Conflict {\n` +
          `  public static class Marker { public static int Value => 1; }\n` +
          `}\n`,
        "utf-8"
      );

      const pack = spawnSync(
        "dotnet",
        ["pack", "Conflict.csproj", "-c", "Release", "-o", localFeedDir, "--nologo"],
        { cwd: localPkgDir, encoding: "utf-8" }
      );
      expect(pack.status, pack.stderr || pack.stdout).to.equal(0);

      mkdirSync(join(dir, "packages", "app", "src"), { recursive: true });
      mkdirSync(join(dir, "node_modules"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify({ name: "test", private: true, type: "module" }, null, 2) + "\n",
        "utf-8"
      );

      writeFileSync(
        join(dir, "nuget.config"),
        `<?xml version="1.0" encoding="utf-8"?>\n` +
          `<configuration>\n` +
          `  <packageSources>\n` +
          `    <clear />\n` +
          `    <add key="local" value="${localFeedDir}" />\n` +
          `    <add key="nuget.org" value="https://api.nuget.org/v3/index.json" />\n` +
          `  </packageSources>\n` +
          `</configuration>\n`,
        "utf-8"
      );

      writeFileSync(
        join(dir, "tsonic.workspace.json"),
        JSON.stringify(
          {
            $schema: "https://tsonic.org/schema/workspace/v1.json",
            dotnetVersion: "net10.0",
            rid,
            dotnet: {
              packageReferences: [{ id: "Conflict.Pkg", version: "1.0.0" }],
            },
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
            rootNamespace: "AssemblyNameConflict.App",
            entryPoint: "src/index.ts",
            sourceRoot: "src",
            outputDirectory: "generated",
            // Intentionally conflict with the referenced NuGet assembly `conflict.dll`.
            outputName: "conflict",
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

      const build = spawnSync(
        "node",
        [cliPath, "build", "--project", "app", "--config", join(dir, "tsonic.workspace.json"), "--quiet"],
        { cwd: dir, encoding: "utf-8" }
      );

      expect(build.status).to.not.equal(0);
      const combined = `${build.stdout ?? ""}\n${build.stderr ?? ""}`;
      expect(combined).to.include("outputName 'conflict' conflicts");
      expect(combined).to.include("Fix: rename `outputName`");
      expect(combined).to.include("suggested: 'conflict.App'");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
