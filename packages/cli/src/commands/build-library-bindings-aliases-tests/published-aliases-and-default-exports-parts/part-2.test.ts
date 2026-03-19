import {
  describe,
  it
} from "mocha";
import {
  expect
} from "chai";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync
} from "node:fs";
import {
  spawnSync
} from "node:child_process";
import {
  tmpdir
} from "node:os";
import {
  join
} from "node:path";
import {
  buildTestTimeoutMs,
  linkDir,
  repoRoot
} from "../helpers.js";

describe("build command (library bindings)", function () {
  this.timeout(buildTestTimeoutMs);

  it("fails fast when a library source uses default exports (unsupported for first-party namespace facades)", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-lib-bindings-default-"));

    try {
      const wsConfigPath = join(dir, "tsonic.workspace.json");
      mkdirSync(join(dir, "packages", "lib", "src"), { recursive: true });
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
        wsConfigPath,
        JSON.stringify(
          {
            $schema: "https://tsonic.org/schema/workspace/v1.json",
            dotnetVersion: "net10.0",
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "lib", "package.json"),
        JSON.stringify(
          {
            name: "lib",
            private: true,
            type: "module",
            exports: {
              "./package.json": "./package.json",
              "./*.js": {
                types: "./dist/tsonic/bindings/*.d.ts",
                default: "./dist/tsonic/bindings/*.js",
              },
            },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "lib", "tsonic.json"),
        JSON.stringify(
          {
            $schema: "https://tsonic.org/schema/v1.json",
            rootNamespace: "Test.Lib",
            entryPoint: "src/index.ts",
            sourceRoot: "src",
            outputDirectory: "generated",
            outputName: "Test.Lib",
            output: {
              type: "library",
              targetFrameworks: ["net10.0"],
              nativeAot: false,
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
        join(dir, "packages", "lib", "src", "index.ts"),
        [`const value = 1;`, `export default value;`, ``].join("\n"),
        "utf-8"
      );

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

      const cliPath = join(repoRoot, "packages/cli/dist/index.js");
      const result = spawnSync(
        "node",
        [
          cliPath,
          "build",
          "--project",
          "lib",
          "--config",
          wsConfigPath,
          "--quiet",
        ],
        { cwd: dir, encoding: "utf-8" }
      );

      expect(result.status).to.not.equal(0);
      const combinedOutput = `${result.stderr}\n${result.stdout}`;
      expect(combinedOutput).to.include("Unsupported default export");
      expect(combinedOutput).to.include("First-party bindings generation");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });


});
