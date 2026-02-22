/**
 * Ensures that TS `export type ...` declarations in library source code
 * are importable by consumers via the published `dist/tsonic/bindings/*.d.ts`.
 *
 * This is important because non-structural aliases (e.g. `type Id = string`)
 * do not exist in CLR metadata and therefore cannot be discovered by tsbindgen.
 * We augment the generated namespace facades with TS-level type aliases and
 * entrypoint re-exports to preserve TypeScript semantics for consumers.
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(
  join(dirname(fileURLToPath(import.meta.url)), "../../../..")
);

const linkDir = (target: string, linkPath: string): void => {
  mkdirSync(dirname(linkPath), { recursive: true });
  symlinkSync(target, linkPath, "dir");
};

describe("build command (library bindings)", function () {
  this.timeout(10 * 60 * 1000);

  it("injects exported TS type aliases and entrypoint re-exports into generated .d.ts", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-lib-bindings-"));

    try {
      const wsConfigPath = join(dir, "tsonic.workspace.json");

      mkdirSync(join(dir, "packages", "lib", "src", "types"), {
        recursive: true,
      });
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
        join(dir, "packages", "lib", "src", "types", "result.ts"),
        [
          `export type Id = string;`,
          ``,
          `export type Ok<T> = { ok: true; value: T };`,
          `export type Err<E> = { ok: false; error: E };`,
          `export type Result<T, E = string> = Ok<T> | Err<E>;`,
          ``,
          `export function ok<T>(value: T): Ok<T> {`,
          `  return { ok: true, value };`,
          `}`,
          ``,
          `export function err<E>(error: E): Err<E> {`,
          `  return { ok: false, error };`,
          `}`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "lib", "src", "config", "server-config.ts"),
        [
          `export type ServerConfig = {`,
          `  readonly mode: "dev" | "prod";`,
          `};`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "lib", "src", "config", "load-config.ts"),
        [
          `import type { ServerConfig } from "./server-config.ts";`,
          ``,
          `export const loadConfig = (): ServerConfig => {`,
          `  return { mode: "dev" };`,
          `};`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      mkdirSync(join(dir, "packages", "lib", "src", "db"), { recursive: true });

      writeFileSync(
        join(dir, "packages", "lib", "src", "db", "wrappers.ts"),
        [
          `import type { int } from "@tsonic/core/types.js";`,
          `import type { IEnumerable } from "@tsonic/dotnet/System.Collections.Generic.js";`,
          `import type { ExtensionMethods as Linq } from "@tsonic/dotnet/System.Linq.js";`,
          `import type { ExtensionMethods as Tasks } from "@tsonic/dotnet/System.Threading.Tasks.js";`,
          ``,
          `export type Query<T> = Tasks<Linq<IEnumerable<T>>>;`,
          `export type Numbers = Query<int>;`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "lib", "src", "db", "query-holder.ts"),
        [
          `import type { int } from "@tsonic/core/types.js";`,
          `import { Enumerable } from "@tsonic/dotnet/System.Linq.js";`,
          `import type { Numbers } from "./wrappers.ts";`,
          `import { asinterface } from "@tsonic/core/lang.js";`,
          ``,
          `export class QueryHolder {`,
          `  get Numbers(): Numbers {`,
          `    return asinterface<Numbers>(Enumerable.Empty<int>());`,
          `  }`,
          `}`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "lib", "src", "index.ts"),
        [
          `export { ok, err } from "./types/result.ts";`,
          `export type { Id, Ok, Err, Result } from "./types/result.ts";`,
          ``,
          `export { loadConfig } from "./config/load-config.ts";`,
          `export type { ServerConfig } from "./config/server-config.ts";`,
          ``,
          `export { QueryHolder } from "./db/query-holder.ts";`,
          ``,
        ].join("\n"),
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

      expect(result.status, result.stderr || result.stdout).to.equal(0);

      const bindingsDir = join(
        dir,
        "packages",
        "lib",
        "dist",
        "tsonic",
        "bindings"
      );

      const dtsFiles = readdirSync(bindingsDir)
        .filter((n) => n.endsWith(".d.ts"))
        .map((n) => join(bindingsDir, n));
      expect(dtsFiles.length).to.be.greaterThan(0);

      const all = dtsFiles.map((p) => ({
        path: p,
        content: readFileSync(p, "utf-8"),
      }));
      const entryFacade = all.find((f) =>
        f.content.includes("Tsonic entrypoint re-exports (generated)")
      );
      const typesFacade = all.find((f) =>
        f.content.includes("// Namespace: Test.Lib.types")
      );
      const configFacade = all.find((f) =>
        f.content.includes("// Namespace: Test.Lib.config")
      );

      expect(
        entryFacade,
        `Expected an entry facade to include the entrypoint re-export marker. Found:\n` +
          dtsFiles.map((p) => `- ${p}`).join("\n")
      ).to.not.equal(undefined);
      expect(
        typesFacade,
        `Expected a types facade for namespace Test.Lib.types. Found:\n` +
          dtsFiles.map((p) => `- ${p}`).join("\n")
      ).to.not.equal(undefined);
      expect(
        configFacade,
        `Expected a config facade for namespace Test.Lib.config. Found:\n` +
          dtsFiles.map((p) => `- ${p}`).join("\n")
      ).to.not.equal(undefined);

      const rootContent = entryFacade?.content ?? "";
      const typesContent = typesFacade?.content ?? "";
      const configContent = configFacade?.content ?? "";

      const dbInternalIndex = join(
        bindingsDir,
        "Test.Lib.db",
        "internal",
        "index.d.ts"
      );
      const dbInternalContent = readFileSync(dbInternalIndex, "utf-8");
      expect(dbInternalContent).to.include(
        "Tsonic source member type imports (generated)"
      );
      expect(dbInternalContent).to.include(
        "ExtensionMethods as __TsonicExt_Linq"
      );
      expect(dbInternalContent).to.include(
        "ExtensionMethods as __TsonicExt_Tasks"
      );
      expect(dbInternalContent).to.match(
        /readonly\s+Numbers:\s+__TsonicExt_Tasks<__TsonicExt_Linq</
      );

      // Namespace facade for the "types" module must include TS-level aliases.
      expect(typesContent).to.include("Tsonic source type aliases (generated)");
      expect(typesContent).to.include("export type Id = string;");
      expect(typesContent).to.include(
        "export type Ok<T> = Internal.Ok__Alias_1<T>;"
      );
      expect(typesContent).to.include(
        "export type Err<E> = Internal.Err__Alias_1<E>;"
      );
      expect(typesContent).to.include(
        "export type Result<T, E = string> = Ok<T> | Err<E>;"
      );

      // Structural aliases in non-types modules are also surfaced.
      expect(configContent).to.include(
        "Tsonic source type aliases (generated)"
      );
      expect(configContent).to.include(
        "export type ServerConfig = Internal.ServerConfig__Alias;"
      );

      // Root namespace facade must re-export the entrypoint's type/value surface.
      expect(rootContent).to.include(
        "Tsonic entrypoint re-exports (generated)"
      );
      expect(rootContent).to.include("from './");
      expect(rootContent).to.include(".types.js';");
      expect(rootContent).to.include(".config.js';");
      expect(rootContent).to.include("export type {");
      expect(rootContent).to.include("Id");
      expect(rootContent).to.include("Ok");
      expect(rootContent).to.include("Err");
      expect(rootContent).to.include("Result");
      expect(rootContent).to.include("ServerConfig");
      expect(rootContent).to.include("export {");
      expect(rootContent).to.include("ok");
      expect(rootContent).to.include("err");
      expect(rootContent).to.include("loadConfig");

      // Runtime facade should include value re-exports (type re-exports are TS-only).
      const rootJsPath = (entryFacade?.path ?? "").replace(/\.d\.ts$/, ".js");
      expect(rootJsPath.endsWith(".js")).to.equal(true);
      const rootJs = readFileSync(rootJsPath, "utf-8");
      expect(rootJs).to.include(
        "Tsonic entrypoint value re-exports (generated)"
      );
      expect(rootJs).to.include("export {");
      expect(rootJs).to.include("ok");
      expect(rootJs).to.include("err");
      expect(rootJs).to.include("loadConfig");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
