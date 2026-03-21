import { describe, it } from "mocha";
import { expect } from "chai";
import {
  existsSync,
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
import { buildTestTimeoutMs, linkDir, repoRoot } from "./helpers.js";

describe("build command (library bindings)", function () {
  this.timeout(buildTestTimeoutMs);

  it("supports keyof/index/template-literal alias surfaces without unresolved any fallback", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-lib-bindings-unsupported-"));

    try {
      const wsConfigPath = join(dir, "tsonic.workspace.json");
      mkdirSync(join(dir, "packages", "lib", "src"), { recursive: true });
      mkdirSync(join(dir, "node_modules"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          {
            name: "test",
            private: true,
            type: "module",
          },
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
            name: "@acme/lib",
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
            rootNamespace: "Acme.Lib",
            entryPoint: "src/index.ts",
            sourceRoot: "src",
            outputDirectory: "generated",
            outputName: "Acme.Lib",
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
          `export type User = { name: string; age: number };`,
          `export type KeyOfUser = keyof User;`,
          `export type ValueOfUser = User[keyof User];`,
          `export type EventMap = { click: { x: number }; keyup: { key: string } };`,
          `export type EventName = keyof EventMap;`,
          `export type EventPayload<N extends EventName> = EventMap[N];`,
          `export type RoutePath<T extends string> = \`/api/\${T}\`;`,
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

      expect(result.status).to.equal(0);
      const output = `${result.stderr}\n${result.stdout}`;
      expect(output).to.not.include("resolved to 'any'");

      const facadePath = join(
        dir,
        "packages",
        "lib",
        "dist",
        "tsonic",
        "bindings",
        "Acme.Lib.d.ts"
      );
      expect(existsSync(facadePath)).to.equal(true);

      const facadeText = readFileSync(facadePath, "utf-8");
      expect(facadeText).to.include("export type KeyOfUser");
      expect(facadeText).to.include("export type ValueOfUser");
      expect(facadeText).to.include("export type EventName");
      expect(facadeText).to.include("export type EventPayload");
      expect(facadeText).to.include("export type RoutePath");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
