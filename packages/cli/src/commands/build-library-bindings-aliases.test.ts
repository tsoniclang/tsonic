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

  it("preserves source-level optional/interface/discriminated typing across library bindings", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-lib-bindings-source-"));

    try {
      const wsConfigPath = join(dir, "tsonic.workspace.json");
      mkdirSync(join(dir, "packages", "core", "src"), { recursive: true });
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
              type: "executable",
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
        join(dir, "packages", "core", "src", "types.ts"),
        [
          `export type Ok<T> = { success: true; data: T };`,
          `export type Err<E> = { success: false; error: E };`,
          `export type Result<T, E = string> = Ok<T> | Err<E>;`,
          ``,
          `export function ok<T>(data: T): Ok<T> {`,
          `  return { success: true, data };`,
          `}`,
          ``,
          `export function err<E>(error: E): Err<E> {`,
          `  return { success: false, error };`,
          `}`,
          ``,
          `export function renderMarkdownDomain(content: string): Result<{ rendered: string }, string> {`,
          `  if (content.Length === 0) return err("empty");`,
          `  return ok({ rendered: content });`,
          `}`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "core", "src", "contracts.ts"),
        [
          `import type { int } from "@tsonic/core/types.js";`,
          ``,
          `export class Entity {`,
          `  Maybe?: int;`,
          `}`,
          ``,
          `export interface DomainEvent {`,
          `  type: string;`,
          `  data: Record<string, unknown>;`,
          `}`,
          ``,
          `export function dispatch(_event: DomainEvent): void {}`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "core", "src", "index.ts"),
        [
          `export type { Ok, Err, Result } from "./types.ts";`,
          `export { ok, err, renderMarkdownDomain } from "./types.ts";`,
          `export { Entity, dispatch } from "./contracts.ts";`,
          `export type { DomainEvent } from "./contracts.ts";`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "app", "src", "App.ts"),
        [
          `import type { int } from "@tsonic/core/types.js";`,
          `import { Entity, dispatch, renderMarkdownDomain, err } from "@acme/core/Acme.Core.js";`,
          ``,
          `const entity = new Entity();`,
          `const maybe: int | undefined = undefined;`,
          `entity.Maybe = maybe;`,
          ``,
          `const eventData: Record<string, unknown> = { id: "evt-1" };`,
          `dispatch({ type: "evt", data: eventData });`,
          ``,
          `const renderResult = renderMarkdownDomain("hello");`,
          `if (!renderResult.success) {`,
          `  err(renderResult.error);`,
          `} else {`,
          `  const rendered = renderResult.data.rendered;`,
          `  if (rendered.Length === 0) {`,
          `    err("invalid");`,
          `  }`,
          `}`,
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
      linkDir(
        join(dir, "packages", "core"),
        join(dir, "node_modules/@acme/core")
      );

      const cliPath = join(repoRoot, "packages/cli/dist/index.js");
      const buildCore = spawnSync(
        "node",
        [
          cliPath,
          "build",
          "--project",
          "core",
          "--config",
          wsConfigPath,
          "--quiet",
        ],
        { cwd: dir, encoding: "utf-8" }
      );
      expect(buildCore.status, buildCore.stderr || buildCore.stdout).to.equal(
        0
      );

      const buildApp = spawnSync(
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
      expect(buildApp.status, buildApp.stderr || buildApp.stdout).to.equal(0);

      const coreTypesFacade = readFileSync(
        join(
          dir,
          "packages",
          "core",
          "dist",
          "tsonic",
          "bindings",
          "Acme.Core.d.ts"
        ),
        "utf-8"
      );
      expect(coreTypesFacade).to.include(
        "export type Result<T, E = string> = Ok<T> | Err<E>;"
      );
      expect(coreTypesFacade).to.include("export type Ok<T> =");
      expect(coreTypesFacade).to.include("export type Err<E> =");

      const bindingsRoot = join(
        dir,
        "packages",
        "core",
        "dist",
        "tsonic",
        "bindings"
      );
      const namespaceDirs = readdirSync(bindingsRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);
      const entityInternalPath = namespaceDirs
        .map((name) => join(bindingsRoot, name, "internal", "index.d.ts"))
        .find((path) => {
          try {
            return readFileSync(path, "utf-8").includes(
              "interface Entity$instance"
            );
          } catch {
            return false;
          }
        });

      expect(entityInternalPath).to.not.equal(undefined);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const coreEntitiesInternal = readFileSync(entityInternalPath!, "utf-8");
      expect(coreEntitiesInternal).to.match(
        /set Maybe\(value: [^)]+undefined\)\s*;/
      );
      expect(coreEntitiesInternal).to.include("data: Record<string, unknown>");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("preserves Maximus lowered type/value surfaces across dependency bindings", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-lib-bindings-maximus-"));

    try {
      const wsConfigPath = join(dir, "tsonic.workspace.json");
      mkdirSync(join(dir, "packages", "core", "src"), { recursive: true });
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
              type: "executable",
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
        join(dir, "packages", "core", "src", "types.ts"),
        [
          `import type { int } from "@tsonic/core/types.js";`,
          ``,
          `export type User = { name: string; age: int };`,
          `export type UserFlags = { [K in keyof User]?: boolean };`,
          `export type UserReadonly = Readonly<User>;`,
          `export type UserPartial = Partial<User>;`,
          `export type UserRequired = Required<UserFlags>;`,
          `export type UserPick = Pick<User, "name">;`,
          `export type UserOmit = Omit<User, "age">;`,
          `export type Box<T> = { value: T };`,
          `export type BoxReadonly<T> = Readonly<Box<T>>;`,
          `export type BoxPartial<T> = Partial<Box<T>>;`,
          `export type BoxRequired<T> = Required<BoxPartial<T>>;`,
          `export type Mutable<T> = { -readonly [K in keyof T]: T[K] };`,
          `export type Head<T extends readonly unknown[]> = T extends readonly [infer H, ...unknown[]] ? H : never;`,
          `export type Tail<T extends readonly unknown[]> = T extends readonly [unknown, ...infer R] ? R : never;`,
          `export type Last<T extends readonly unknown[]> = T extends readonly [...unknown[], infer L] ? L : never;`,
          `export type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;`,
          `export type AsyncValue<T> = T extends Promise<infer U> ? U : T;`,
          `export type AwaitedScore = Awaited<Promise<int>>;`,
          `export type SuccessResult<T> = Extract<{ ok: true; value: T } | { ok: false; error: string }, { ok: true }>;`,
          `export type FailureResult = Exclude<{ ok: true; value: int } | { ok: false; error: string }, { ok: true; value: int }>;`,
          `export type NonNullName = NonNullable<string | null | undefined>;`,
          `export type ExtractStatus = Extract<"ok" | "err", "ok">;`,
          `export type ExcludeStatus = Exclude<"ok" | "err", "err">;`,
          `export type UserAndMeta = User & { id: string };`,
          `export type PrefixSuffix<T extends unknown[]> = [string, ...T, boolean];`,
          `export type UserTuple = [name: string, age: int];`,
          `export type UserTupleSpread<T extends unknown[]> = [User, ...T, boolean];`,
          `export type EventPayload = { kind: "click"; x: int; y: int } | { kind: "keyup"; key: string };`,
          `export type ClickPayload = Extract<EventPayload, { kind: "click" }>;`,
          `export type ApiUserRoute = "/api/users";`,
          `export type ApiPostRoute = "/api/posts";`,
          `export type RoutePair = [ApiUserRoute, ApiPostRoute];`,
          `export type PairJoin<A, B> = [A, B];`,
          `export type Mapper<T> = (value: T) => T;`,
          `export type MapperParams = Parameters<Mapper<User>>;`,
          `export type MapperResult = ReturnType<Mapper<User>>;`,
          `export type SymbolScores = Record<symbol, int>;`,
          ``,
          `export class UserRecord {`,
          `  constructor(public name: string, public age: int) {}`,
          `}`,
          ``,
          `export type UserRecordCtorArgs = ConstructorParameters<typeof UserRecord>;`,
          `export type UserRecordInstance = InstanceType<typeof UserRecord>;`,
          `export type ConstructorArgs = ConstructorParameters<typeof UserRecord>;`,
          `export type RecordInstance = InstanceType<typeof UserRecord>;`,
          ``,
          `export const id = <T>(value: T): T => value;`,
          ``,
          `export function projectFlags(user: User): UserFlags {`,
          `  return { name: user.name.Length > 0, age: user.age > 0 };`,
          `}`,
          ``,
          `export function lookupScore(scores: SymbolScores, key: symbol): int {`,
          `  return scores[key] ?? 0;`,
          `}`,
          ``,
          `export function invokeMapper<T>(value: T, mapper: Mapper<T>): T {`,
          `  return mapper(value);`,
          `}`,
          ``,
          `export function createBox<T>(value: T): Box<T> {`,
          `  return { value };`,
          `}`,
          ``,
          `export function toRoute(path: "users" | "posts"): ApiUserRoute | ApiPostRoute {`,
          `  return path === "users" ? "/api/users" : "/api/posts";`,
          `}`,
          ``,
          `export function projectEvent(payload: EventPayload): PairJoin<string, EventPayload> {`,
          `  return ["evt", payload];`,
          `}`,
          ``,
          `export function createUserTuple(user: User): UserTuple {`,
          `  return [user.name, user.age];`,
          `}`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "core", "src", "runtime.ts"),
        [
          `import type { int } from "@tsonic/core/types.js";`,
          ``,
          `export function chainScore(seed: Promise<int>): Promise<int> {`,
          `  return seed`,
          `    .then((value) => value + 1)`,
          `    .catch((_error) => 0)`,
          `    .finally(() => {});`,
          `}`,
          ``,
          `export async function loadSideEffects(): Promise<void> {`,
          `  await import("./side-effect.ts");`,
          `}`,
          ``,
          `export function* nextValues(start: int): Generator<int, int, int> {`,
          `  const next = (yield start) + 1;`,
          `  yield next;`,
          `  return next + 1;`,
          `}`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "core", "src", "side-effect.ts"),
        [`export const loaded = true;`, ``].join("\n"),
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "core", "src", "index.ts"),
        [
          `export type {`,
          `  User,`,
          `  UserFlags,`,
          `  UserReadonly,`,
          `  UserPartial,`,
          `  UserRequired,`,
          `  UserPick,`,
          `  UserOmit,`,
          `  UnwrapPromise,`,
          `  NonNullName,`,
          `  ExtractStatus,`,
          `  ExcludeStatus,`,
          `  UserAndMeta,`,
          `  PrefixSuffix,`,
          `  Box,`,
          `  BoxReadonly,`,
          `  Mutable,`,
          `  Head,`,
          `  Tail,`,
          `  Last,`,
          `  AsyncValue,`,
          `  AwaitedScore,`,
          `  SuccessResult,`,
          `  FailureResult,`,
          `  UserTuple,`,
          `  UserTupleSpread,`,
          `  EventPayload,`,
          `  ClickPayload,`,
          `  ApiUserRoute,`,
          `  ApiPostRoute,`,
          `  RoutePair,`,
          `  PairJoin,`,
          `  Mapper,`,
          `  MapperParams,`,
          `  MapperResult,`,
          `  SymbolScores,`,
          `  UserRecordCtorArgs,`,
          `  UserRecordInstance,`,
          `  ConstructorArgs,`,
          `  RecordInstance,`,
          `} from "./types.ts";`,
          `export {`,
          `  id,`,
          `  UserRecord,`,
          `  projectFlags,`,
          `  lookupScore,`,
          `  invokeMapper,`,
          `  createBox,`,
          `  toRoute,`,
          `  projectEvent,`,
          `  createUserTuple,`,
          `} from "./types.ts";`,
          `export { chainScore, loadSideEffects, nextValues } from "./runtime.ts";`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "app", "src", "App.ts"),
        [
          `import type { int } from "@tsonic/core/types.js";`,
          `import { Console } from "@tsonic/dotnet/System.js";`,
          `import type {`,
          `  User,`,
          `  UserFlags,`,
          `  UserReadonly,`,
          `  UserPartial,`,
          `  UserRequired,`,
          `  UserPick,`,
          `  UserOmit,`,
          `  UnwrapPromise,`,
          `  NonNullName,`,
          `  ExtractStatus,`,
          `  ExcludeStatus,`,
          `  UserAndMeta,`,
          `  PrefixSuffix,`,
          `  Mapper,`,
          `  Box,`,
          `  BoxReadonly,`,
          `  BoxPartial,`,
          `  BoxRequired,`,
          `  Mutable,`,
          `  Head,`,
          `  Tail,`,
          `  Last,`,
          `  AsyncValue,`,
          `  AwaitedScore,`,
          `  SuccessResult,`,
          `  FailureResult,`,
          `  UserTuple,`,
          `  UserTupleSpread,`,
          `  EventPayload,`,
          `  ClickPayload,`,
          `  ApiUserRoute,`,
          `  ApiPostRoute,`,
          `  RoutePair,`,
          `  PairJoin,`,
          `  UserRecordCtorArgs,`,
          `  UserRecordInstance,`,
          `  ConstructorArgs,`,
          `  RecordInstance,`,
          `} from "@acme/core/Acme.Core.js";`,
          `import {`,
          `  id,`,
          `  UserRecord,`,
          `  projectFlags,`,
          `  invokeMapper,`,
          `  createBox,`,
          `  toRoute,`,
          `  projectEvent,`,
          `  createUserTuple,`,
          `} from "@acme/core/Acme.Core.js";`,
          ``,
          `const copied = id<int>(7);`,
          `const copyAlias = id;`,
          `const copiedAgain = copyAlias<int>(copied);`,
          ``,
          `const ctorArgs: UserRecordCtorArgs = ["Ada", copiedAgain];`,
          `void ctorArgs;`,
          `const user: UserRecordInstance = new UserRecord("Ada", copiedAgain);`,
          `const userView: User = { name: user.name, age: user.age };`,
          `const flags = userView as unknown as UserFlags;`,
          `const score: int = copiedAgain;`,
          `const route = toRoute("users");`,
          `const tupleFromFn = createUserTuple(userView);`,
          `const boxUser = createBox(userView);`,
          ``,
          `type ProbeBox = Box<User>;`,
          `type ProbeBoxReadonly = BoxReadonly<User>;`,
          `type ProbeBoxPartial = BoxPartial<User>;`,
          `type ProbeBoxRequired = BoxRequired<User>;`,
          `type ProbeMutable = Mutable<UserReadonly>;`,
          `type ProbeHead = Head<[int, string]>;`,
          `type ProbeTail = Tail<[string, int, boolean]>;`,
          `type ProbeLast = Last<[string, int, boolean]>;`,
          `type ProbeAsync = AsyncValue<Promise<int>>;`,
          `type ProbeAwaited = AwaitedScore;`,
          `type ProbeSuccess = SuccessResult<int>;`,
          `type ProbeFailure = FailureResult;`,
          `type ProbeTuple = UserTuple;`,
          `type ProbeTupleSpread = UserTupleSpread<[int]>;`,
          `type ProbeEvent = EventPayload;`,
          `type ProbeClick = ClickPayload;`,
          `type ProbeRouteA = ApiUserRoute;`,
          `type ProbeRouteB = ApiPostRoute;`,
          `type ProbeRoutePair = RoutePair;`,
          `type ProbePairJoin = PairJoin<ApiUserRoute, EventPayload>;`,
          `type ProbeCtorArgs = ConstructorArgs;`,
          `type ProbeRecordInstance = RecordInstance;`,
          ``,
          `const mappedAgain: int = copiedAgain + 1;`,
          ``,
          `void user;`,
          `void flags;`,
          `void route;`,
          `void tupleFromFn;`,
          `void boxUser;`,
          `Console.WriteLine(mappedAgain + score);`,
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
      linkDir(
        join(dir, "packages", "core"),
        join(dir, "node_modules/@acme/core")
      );

      const cliPath = join(repoRoot, "packages/cli/dist/index.js");
      const buildCore = spawnSync(
        "node",
        [
          cliPath,
          "build",
          "--project",
          "core",
          "--config",
          wsConfigPath,
          "--quiet",
        ],
        { cwd: dir, encoding: "utf-8" }
      );
      expect(buildCore.status, buildCore.stderr || buildCore.stdout).to.equal(
        0
      );

      const buildApp = spawnSync(
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
      expect(buildApp.status, buildApp.stderr || buildApp.stdout).to.equal(0);

      const bindingsDir = join(
        dir,
        "packages",
        "core",
        "dist",
        "tsonic",
        "bindings"
      );
      const collectDts = (root: string): string[] => {
        const out: string[] = [];
        for (const entry of readdirSync(root, { withFileTypes: true })) {
          const entryPath = join(root, entry.name);
          if (entry.isDirectory()) {
            out.push(...collectDts(entryPath));
            continue;
          }
          if (entry.isFile() && entry.name.endsWith(".d.ts")) {
            out.push(entryPath);
          }
        }
        return out;
      };
      const allFacadeText = collectDts(bindingsDir)
        .map((path) => readFileSync(path, "utf-8"))
        .join("\n");

      const expectedTypeAliases = [
        "UserFlags",
        "UserReadonly",
        "UserPartial",
        "UserRequired",
        "UserPick",
        "UserOmit",
        "Box",
        "BoxReadonly",
        "BoxPartial",
        "BoxRequired",
        "Mutable",
        "Head",
        "Tail",
        "Last",
        "UnwrapPromise",
        "AsyncValue",
        "AwaitedScore",
        "SuccessResult",
        "FailureResult",
        "NonNullName",
        "ExtractStatus",
        "ExcludeStatus",
        "UserAndMeta",
        "PrefixSuffix",
        "UserTuple",
        "UserTupleSpread",
        "EventPayload",
        "ClickPayload",
        "ApiUserRoute",
        "ApiPostRoute",
        "RoutePair",
        "PairJoin",
        "Mapper",
        "MapperParams",
        "MapperResult",
        "SymbolScores",
        "UserRecordCtorArgs",
        "UserRecordInstance",
        "ConstructorArgs",
        "RecordInstance",
      ];
      for (const alias of expectedTypeAliases) {
        expect(
          allFacadeText,
          `expected generated bindings to contain alias '${alias}'`
        ).to.match(new RegExp(`\\bexport\\s+type\\s+${alias}\\b`));
      }

      const expectedValueExports = [
        "id",
        "UserRecord",
        "projectFlags",
        "lookupScore",
        "invokeMapper",
        "createBox",
        "toRoute",
        "projectEvent",
        "createUserTuple",
        "chainScore",
        "loadSideEffects",
        "nextValues",
      ];
      for (const value of expectedValueExports) {
        expect(
          allFacadeText,
          `expected generated bindings to contain value export '${value}'`
        ).to.match(new RegExp(`\\b${value}\\b`));
      }

    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fails deterministically for unresolved keyof/index/template-literal alias surfaces", () => {
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
      const output = `${result.stderr}\n${result.stdout}`;
      expect(output).to.include("type alias 'KeyOfUser'");
      expect(output).to.include("type alias 'ValueOfUser'");
      expect(output).to.include("type alias 'EventName'");
      expect(output).to.include("type alias 'EventPayload'");
      expect(output).to.include("type alias 'RoutePath'");
      expect(output).to.include("resolved to 'any'");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
