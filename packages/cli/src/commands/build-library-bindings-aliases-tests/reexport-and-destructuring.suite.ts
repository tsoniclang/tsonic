import { describe, it } from "mocha";
import { expect } from "chai";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getStableCliPath } from "../../test-cli-bin.js";
import {
  buildTestTimeoutMs,
  linkDir,
  readFirstPartyBindingsJson,
  repoRoot,
} from "./helpers.js";

describe("build command (library bindings)", function () {
  this.timeout(buildTestTimeoutMs);

  it("fails fast when a library source re-exports from a non-local module specifier", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-lib-bindings-reexport-"));

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
        [`export { Console } from "@tsonic/dotnet/System.js";`, ``].join("\n"),
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

      const cliPath = getStableCliPath(repoRoot);
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
      expect(combinedOutput).to.include("Unsupported re-export");
      expect(combinedOutput).to.include(
        "supports only relative re-exports from local source modules"
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fails fast when a library source exports destructuring declarators", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-lib-bindings-destructure-"));

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
        [
          `const source = { value: 1 };`,
          `export const { value } = source;`,
          ``,
        ].join("\n"),
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

      const cliPath = getStableCliPath(repoRoot);
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
      expect(combinedOutput).to.include(
        "Unsupported exported variable declarator"
      );
      expect(combinedOutput).to.include(
        "requires identifier-based exported variables"
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("resolves local re-export chains transitively for both types and values", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-lib-bindings-chain-"));

    try {
      const wsConfigPath = join(dir, "tsonic.workspace.json");
      mkdirSync(join(dir, "packages", "lib", "src", "config"), {
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
        join(dir, "packages", "lib", "src", "config", "loaded-config.ts"),
        [`export interface LoadedConfig {`, `  title: string;`, `}`, ``].join(
          "\n"
        ),
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "lib", "src", "config", "loader.ts"),
        [
          `import type { LoadedConfig } from "./loaded-config.ts";`,
          ``,
          `export function loadSiteConfig(): LoadedConfig {`,
          `  return { title: "site" };`,
          `}`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "lib", "src", "config", "index.ts"),
        [
          `export type { LoadedConfig } from "./loaded-config.ts";`,
          `export { loadSiteConfig } from "./loader.ts";`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "lib", "src", "config.ts"),
        [
          `import type { LoadedConfig as LoadedConfigLocal } from "./config/index.ts";`,
          `import { loadSiteConfig as loadSiteConfigLocal } from "./config/index.ts";`,
          ``,
          `export type { LoadedConfigLocal as LoadedConfig };`,
          `export { loadSiteConfigLocal as loadSiteConfig };`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "lib", "src", "index.ts"),
        [
          `export type { LoadedConfig } from "./config.ts";`,
          `export { loadSiteConfig } from "./config.ts";`,
          ``,
        ].join("\n"),
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

      const cliPath = getStableCliPath(repoRoot);
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

      expect(result.status).to.equal(0, result.stderr || result.stdout);

      const bindingsRoot = join(
        dir,
        "packages",
        "lib",
        "dist",
        "tsonic",
        "bindings"
      );
      const facade = readFileSync(join(bindingsRoot, "Test.Lib.d.ts"), "utf-8");
      const configFacade = readFileSync(
        join(bindingsRoot, "Test.Lib.config.d.ts"),
        "utf-8"
      );
      const internal = readFileSync(
        join(bindingsRoot, "Test.Lib", "internal", "index.d.ts"),
        "utf-8"
      );
      const rootBindings = readFirstPartyBindingsJson(
        join(bindingsRoot, "Test.Lib", "bindings.json")
      );

      expect(facade).to.include("export type { LoadedConfig }");
      expect(facade).to.include(
        "import type { LoadedConfig } from './Test.Lib.config.js';"
      );
      expect(facade).to.include(
        "export type { LoadedConfig } from './Test.Lib.config.js';"
      );
      expect(facade).to.include(
        "export { loadSiteConfig } from './Test.Lib.config.js';"
      );
      expect(configFacade).to.match(
        /export declare function loadSiteConfig\(\):\s*LoadedConfig/
      );
      expect(internal).to.not.match(/interface\s+LoadedConfig\$instance/);
      expect(rootBindings.dotnet?.exports?.loadSiteConfig).to.deep.include({
        kind: "method",
      });
      expect(
        rootBindings.semanticSurface?.exports?.loadSiteConfig
      ).to.deep.include({
        kind: "function",
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
