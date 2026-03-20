import { describe, it } from "mocha";
import { expect } from "chai";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { linkDir, repoRoot, runProjectBuild } from "../test-helpers.js";

describe("library bindings first-party regressions", function () {
  this.timeout(10 * 60 * 1000);
  it("preserves contextual object typing for imported generic result helpers across source-package bindings", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-lib-bindings-contextual-result-")
    );

    try {
      const wsConfigPath = join(dir, "tsonic.workspace.json");
      mkdirSync(join(dir, "packages", "core", "src", "types"), {
        recursive: true,
      });
      mkdirSync(join(dir, "packages", "app", "src"), { recursive: true });
      mkdirSync(join(dir, "node_modules"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          {
            name: "test",
            private: true,
            type: "module",
            workspaces: ["packages/*"],
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
        join(dir, "packages", "core", "package.json"),
        JSON.stringify(
          {
            name: "@acme/core",
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
        join(dir, "packages", "app", "package.json"),
        JSON.stringify(
          {
            name: "@acme/app",
            private: true,
            type: "module",
            dependencies: {
              "@acme/core": "workspace:*",
            },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "core", "tsonic.json"),
        JSON.stringify(
          {
            $schema: "https://tsonic.org/schema/v1.json",
            rootNamespace: "Acme.Core",
            entryPoint: "src/index.ts",
            sourceRoot: "src",
            outputDirectory: "generated",
            outputName: "Acme.Core",
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
        join(dir, "packages", "app", "tsonic.json"),
        JSON.stringify(
          {
            $schema: "https://tsonic.org/schema/v1.json",
            rootNamespace: "Acme.App",
            entryPoint: "src/App.ts",
            sourceRoot: "src",
            references: {
              libraries: [
                "../core/generated/bin/Release/net10.0/Acme.Core.dll",
              ],
            },
            outputDirectory: "generated",
            outputName: "Acme.App",
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

      writeFileSync(
        join(dir, "packages", "core", "src", "types", "result.ts"),
        [
          `export type Ok<T> = { success: true; data: T };`,
          `export type Err<E> = { success: false; error: E };`,
          `export type Result<T, E> = Ok<T> | Err<E>;`,
          ``,
          `export function ok<T>(data: T): Ok<T> {`,
          `  return { success: true, data };`,
          `}`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "core", "src", "index.ts"),
        [
          `export { ok } from "./types/result.ts";`,
          `export type { Result } from "./types/result.ts";`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "app", "src", "App.ts"),
        [
          `import type { Result } from "@acme/core/Acme.Core.js";`,
          `import { ok } from "@acme/core/Acme.Core.js";`,
          ``,
          `interface Payload {`,
          `  foundAnchor: boolean;`,
          `  foundNewest: boolean;`,
          `  foundOldest: boolean;`,
          `}`,
          ``,
          `export async function run(anchor: string): Promise<Result<Payload, string>> {`,
          `  const foundAnchor = anchor !== "newest" && anchor !== "oldest";`,
          `  const foundNewest = anchor === "newest";`,
          `  const foundOldest = anchor === "oldest";`,
          `  return ok({ foundAnchor, foundNewest, foundOldest });`,
          `}`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      runProjectBuild(dir, wsConfigPath, "core");
      linkDir(
        join(dir, "packages", "core"),
        join(dir, "node_modules/@acme/core")
      );
      runProjectBuild(dir, wsConfigPath, "app");

      const generated = readFileSync(
        join(dir, "packages", "app", "generated", "App.cs"),
        "utf-8"
      );

      expect(generated).to.include("new Payload");
      expect(generated).to.not.include("__Anon");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
