import { describe, it } from "mocha";
import { expect } from "chai";
import {
  chmodSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
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
const siblingRoot = resolve(join(repoRoot, ".."));

describe("test command", function () {
  this.timeout(2 * 60 * 1000);

  it("copies xunit.runner.json from the project root into the generated test output", async () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-test-runner-config-"));

    try {
      mkdirSync(join(dir, "packages", "app", "src"), { recursive: true });
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
            surface: "@tsonic/js",
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "app", "package.json"),
        JSON.stringify(
          { name: "app", private: true, type: "module" },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "app", "tsonic.json"),
        JSON.stringify(
          {
            $schema: "https://tsonic.org/schema/v1.json",
            rootNamespace: "Acme.App",
            sourceRoot: "src",
            entryPoint: "src/index.ts",
            outputDirectory: "generated",
            outputName: "Acme.App",
            tests: {
              entryPoint: "src/tests.ts",
              outputDirectory: ".tsonic/generated-tests",
              outputName: "Acme.App.Tests",
            },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "app", "src", "index.ts"),
        "export const answer = 42;\n",
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "app", "src", "tests.ts"),
        "export const smoke = 1;\n",
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "app", "xunit.runner.json"),
        JSON.stringify(
          { parallelizeTestCollections: false, maxParallelThreads: 1 },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      const install = spawnSync(
        "npm",
        [
          "install",
          join(siblingRoot, "core", "versions", "10"),
          join(siblingRoot, "dotnet", "versions", "10"),
          join(siblingRoot, "globals", "versions", "10"),
          join(siblingRoot, "js", "versions", "10"),
        ],
        { cwd: dir, encoding: "utf-8" }
      );
      expect(install.status).to.equal(
        0,
        install.stderr || install.stdout || "npm install failed"
      );

      const fakeBinDir = join(dir, ".fake-bin");
      mkdirSync(fakeBinDir, { recursive: true });
      const fakeDotnetLog = join(dir, "fake-dotnet.log");
      const fakeDotnetPath = join(fakeBinDir, "dotnet");
      writeFileSync(
        fakeDotnetPath,
        `#!/usr/bin/env bash
set -euo pipefail
if [ "\${1:-}" = "--version" ]; then
  echo "10.0.101"
  exit 0
fi
if [ ! -f "$PWD/xunit.runner.json" ]; then
  echo "missing xunit.runner.json in $PWD" >&2
  exit 99
fi
printf '%s\\t%s\\n' "$PWD" "$*" >> ${JSON.stringify(fakeDotnetLog)}
exit 0
`,
        "utf-8"
      );
      chmodSync(fakeDotnetPath, 0o755);

      const originalPath = process.env.PATH ?? "";
      process.env.PATH = `${fakeBinDir}:${originalPath}`;
      try {
        const exitCode = await runCli([
          "test",
          "--project",
          "app",
          "--test-progress",
          "-c",
          join(dir, "tsonic.workspace.json"),
        ]);
        expect(exitCode).to.equal(0);
      } finally {
        process.env.PATH = originalPath;
      }

      const log = readFileSync(fakeDotnetLog, "utf-8");
      expect(log).to.include("restore");
      expect(log).to.include("test");
      expect(log).to.include("--verbosity minimal");
      expect(log).to.include("--logger console;verbosity=detailed");
      expect(log).to.include(
        join(dir, "packages", "app", ".tsonic", "generated-tests")
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
