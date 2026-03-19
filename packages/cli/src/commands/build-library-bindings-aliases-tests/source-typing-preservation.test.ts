import { describe, it } from "mocha";
import { expect } from "chai";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildTestTimeoutMs,
  linkDir,
  repoRoot,
} from "./helpers.js";

describe("build command (library bindings)", function () {
  this.timeout(buildTestTimeoutMs);

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
          `export class BuildRequest {`,
          `  destinationDir: string = "";`,
          `  buildDrafts: boolean = false;`,
          `}`,
          ``,
          `export class ServeRequest extends BuildRequest {`,
          `  host: string = "127.0.0.1";`,
          `}`,
          ``,
          `export interface ContractBase {`,
          `  requestId: string;`,
          `}`,
          ``,
          `export interface ContractDerived extends ContractBase {`,
          `  payload: string;`,
          `}`,
          ``,
          `export function getRequestId(contract: ContractDerived): string {`,
          `  return contract.requestId;`,
          `}`,
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
          `export { BuildRequest, ServeRequest, getRequestId, Entity, dispatch } from "./contracts.ts";`,
          `export type { ContractBase, ContractDerived, DomainEvent } from "./contracts.ts";`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "app", "src", "App.ts"),
        [
          `import type { int } from "@tsonic/core/types.js";`,
          `import { Entity, ServeRequest, getRequestId, dispatch, renderMarkdownDomain, err } from "@acme/core/Acme.Core.js";`,
          `import type { ContractDerived } from "@acme/core/Acme.Core.js";`,
          ``,
          `const entity = new Entity();`,
          `const maybe: int | undefined = undefined;`,
          `entity.Maybe = maybe;`,
          ``,
          `const serveReq = new ServeRequest();`,
          `serveReq.destinationDir = "out";`,
          `serveReq.buildDrafts = true;`,
          `serveReq.host = "localhost";`,
          ``,
          `const contract: ContractDerived = { requestId: "r-1", payload: "ok" };`,
          `const requestId = getRequestId(contract);`,
          `if (requestId.Length === 0) {`,
          `  err("missing request id");`,
          `}`,
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

      const rootBindingsPath = join(
        dir,
        "packages",
        "core",
        "dist",
        "tsonic",
        "bindings",
        "Acme.Core",
        "bindings.json"
      );
      expect(existsSync(rootBindingsPath)).to.equal(true);
      const rootBindings = JSON.parse(
        readFileSync(rootBindingsPath, "utf-8")
      ) as {
        producer?: { tool?: unknown; mode?: unknown };
        exports?: Record<string, unknown>;
        types?: Array<{ clrName?: unknown }>;
      };
      expect(rootBindings.producer?.tool).to.equal("tsonic");
      expect(rootBindings.producer?.mode).to.equal("aikya-firstparty");
      expect(Object.keys(rootBindings.exports ?? {})).to.include(
        "renderMarkdownDomain"
      );
      expect(Object.keys(rootBindings.exports ?? {})).to.include("dispatch");
      expect(
        (rootBindings.types ?? []).some((t) => t.clrName === "Acme.Core.Entity")
      ).to.equal(true);

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
        /(set Maybe\(value: [^)]+undefined\)\s*;|Maybe: [^;]+undefined\s*;)/
      );
      expect(coreEntitiesInternal).to.include("data: Record<string, unknown>");
      expect(coreEntitiesInternal).to.match(
        /interface\s+ServeRequest\$instance\s+extends\s+BuildRequest/
      );
      expect(coreEntitiesInternal).to.match(
        /interface\s+ContractDerived\$instance\s+extends\s+ContractBase/
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });


});
