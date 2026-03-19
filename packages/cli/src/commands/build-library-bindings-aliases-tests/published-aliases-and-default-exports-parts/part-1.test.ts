import {
  describe,
  it
} from "mocha";
import {
  expect
} from "chai";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
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
      mkdirSync(join(dir, "packages", "app", "src"), {
        recursive: true,
      });
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
        join(dir, "packages", "app", "package.json"),
        JSON.stringify(
          {
            name: "app",
            private: true,
            type: "module",
            dependencies: {
              lib: "workspace:*",
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
        join(dir, "packages", "app", "tsonic.json"),
        JSON.stringify(
          {
            $schema: "https://tsonic.org/schema/v1.json",
            rootNamespace: "Test.App",
            entryPoint: "src/App.ts",
            sourceRoot: "src",
            references: {
              libraries: ["../lib/generated/bin/Release/net10.0/Test.Lib.dll"],
            },
            outputDirectory: "generated",
            outputName: "Test.App",
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

      writeFileSync(
        join(dir, "packages", "app", "src", "App.ts"),
        [
          `import { QueryHolder } from "lib/Test.Lib.js";`,
          ``,
          `export function run(): QueryHolder {`,
          `  return new QueryHolder();`,
          `}`,
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
        f.content.includes("Tsonic cross-namespace re-exports (generated)")
      );
      const typesFacade = all.find((f) =>
        f.content.includes("// Namespace: Test.Lib.types")
      );
      const configFacade = all.find((f) =>
        f.content.includes("// Namespace: Test.Lib.config")
      );

      expect(
        entryFacade,
        `Expected an entry facade to include the cross-namespace re-export marker. Found:\n` +
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

      const rootBindingsPath = join(bindingsDir, "Test.Lib", "bindings.json");
      expect(existsSync(rootBindingsPath)).to.equal(true);
      const rootBindings = JSON.parse(
        readFileSync(rootBindingsPath, "utf-8")
      ) as {
        namespace?: unknown;
        producer?: { tool?: unknown; mode?: unknown };
        exports?: Record<string, unknown>;
        types?: Array<{ clrName?: unknown }>;
      };
      expect(rootBindings.namespace).to.equal("Test.Lib");
      expect(rootBindings.producer?.tool).to.equal("tsonic");
      expect(rootBindings.producer?.mode).to.equal("aikya-firstparty");
      expect(Object.keys(rootBindings.exports ?? {})).to.include("ok");
      expect(Object.keys(rootBindings.exports ?? {})).to.include("err");
      expect(Object.keys(rootBindings.exports ?? {})).to.include("loadConfig");
      expect(
        (rootBindings.types ?? []).some(
          (entry) => entry.clrName === "Test.Lib.db.QueryHolder"
        )
      ).to.equal(true);

      // Namespace facade for the "types" module must include TS-level aliases.
      expect(typesContent).to.include("Tsonic source type aliases (generated)");
      expect(typesContent).to.include("export type Id = string;");
      expect(typesContent).to.match(/export type Ok<\s*T\s*> = /);
      expect(typesContent).to.match(/export type Err<\s*E\s*> = /);
      expect(typesContent).to.include(
        "export type Result<T, E = string> = Ok<T> | Err<E>;"
      );

      // Structural aliases in non-types modules are also surfaced.
      expect(configContent).to.include(
        "Tsonic source type aliases (generated)"
      );
      expect(configContent).to.match(/export type ServerConfig = /);

      // Root namespace facade must re-export the entrypoint's type/value surface.
      expect(rootContent).to.include(
        "Tsonic cross-namespace re-exports (generated)"
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
        "Tsonic cross-namespace value re-exports (generated)"
      );
      expect(rootJs).to.include("export {");
      expect(rootJs).to.include("ok");
      expect(rootJs).to.include("err");
      expect(rootJs).to.include("loadConfig");

      linkDir(join(dir, "packages", "lib"), join(dir, "node_modules/lib"));

      const appResult = spawnSync(
        "node",
        [
          cliPath,
          "build",
          "--project",
          "app",
          "--config",
          wsConfigPath,
          "--quiet",
        ],
        { cwd: dir, encoding: "utf-8" }
      );

      expect(appResult.status, appResult.stderr || appResult.stdout).to.equal(
        0
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

});
