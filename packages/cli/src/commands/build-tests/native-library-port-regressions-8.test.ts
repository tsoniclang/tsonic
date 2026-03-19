import { describe, it } from "mocha";
import { buildTestTimeoutMs } from "./helpers.js";
import { expect } from "chai";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveConfig } from "../../config.js";
import { applyAikyaWorkspaceOverlay } from "../../aikya/bindings.js";
import { buildCommand } from "../build.js";

const repoRoot = resolve(
  join(dirname(fileURLToPath(import.meta.url)), "../../../../..")
);
const localJsPackageRoot = resolve(join(repoRoot, "..", "js", "versions", "10"));
const linkedJsPackageRoot = existsSync(localJsPackageRoot)
  ? localJsPackageRoot
  : join(repoRoot, "node_modules/@tsonic/js");

const linkDir = (target: string, linkPath: string): void => {
  mkdirSync(dirname(linkPath), { recursive: true });
  symlinkSync(target, linkPath, "dir");
};

const readGeneratedCSharpTree = (root: string): string => {
  const chunks: string[] = [];
  const visit = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const nextPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(nextPath);
        continue;
      }
      if (entry.isFile() && nextPath.endsWith(".cs")) {
        chunks.push(readFileSync(nextPath, "utf-8"));
      }
    }
  };

  if (existsSync(root) && statSync(root).isDirectory()) {
    visit(root);
  }
  return chunks.join("\n");
};

const resolveEffectiveConfig = (
  workspaceConfig: Parameters<typeof resolveConfig>[0],
  projectConfig: Parameters<typeof resolveConfig>[1],
  workspaceRoot: string,
  projectRoot: string,
  entryFile?: string
) => {
  const overlay = applyAikyaWorkspaceOverlay(workspaceRoot, workspaceConfig);
  expect(overlay.ok).to.equal(true);
  if (!overlay.ok) {
    throw new Error(overlay.error);
  }

  return resolveConfig(
    overlay.value.config,
    projectConfig,
    {},
    workspaceRoot,
    projectRoot,
    entryFile
  );
};

describe("build command (native library port regressions)", function () {
  this.timeout(buildTestTimeoutMs);

  it("builds source-package callback aliases with sibling alias closure intact", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-build-callback-alias-"));
    try {
      mkdirSync(join(dir, "node_modules"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          { name: "test-workspace", private: true, type: "module" },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      linkDir(linkedJsPackageRoot, join(dir, "node_modules/@tsonic/js"));
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );

      const sourcePackageRoot = join(dir, "node_modules/@demo/pkg");
      mkdirSync(join(sourcePackageRoot, "tsonic"), { recursive: true });
      mkdirSync(join(sourcePackageRoot, "src"), { recursive: true });
      writeFileSync(
        join(sourcePackageRoot, "package.json"),
        JSON.stringify(
          {
            name: "@demo/pkg",
            version: "1.0.0",
            type: "module",
            exports: {
              ".": "./src/index.ts",
            },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(sourcePackageRoot, "tsonic/package-manifest.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            surfaces: ["@tsonic/js"],
            source: {
              exports: {
                ".": "./src/index.ts",
              },
            },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(sourcePackageRoot, "src/index.ts"),
        [
          'export type NextControl = "route" | "router" | string | null | undefined;',
          "export type NextFunction = (value?: NextControl) => void | Promise<void>;",
          "export interface Request { path: string; }",
          "export interface Response { send(text: string): void; }",
          "export interface RequestHandler {",
          "  (req: Request, res: Response, next: NextFunction): unknown | Promise<unknown>;",
          "}",
          "export const useHandler = async (_handler: RequestHandler): Promise<void> => {};",
        ].join("\n"),
        "utf-8"
      );

      const workspaceConfig = {
        $schema: "https://tsonic.org/schema/workspace/v1.json",
        dotnetVersion: "net10.0",
        surface: "@tsonic/js",
        dotnet: {
          typeRoots: ["node_modules/@tsonic/js"],
          libraries: [],
          frameworkReferences: [],
          packageReferences: [],
        },
      };

      const projectRoot = join(dir, "packages", "app");
      mkdirSync(join(projectRoot, "src"), { recursive: true });
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify(
          {
            name: "@acme/app",
            version: "1.0.0",
            private: true,
            type: "module",
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "index.ts"),
        [
          'import { useHandler } from "@demo/pkg";',
          "",
          "export async function main(): Promise<void> {",
          "  await useHandler(async (_req, _res, next) => {",
          '    await next("route");',
          "  });",
          "}",
        ].join("\n"),
        "utf-8"
      );

      const projectConfig = {
        $schema: "https://tsonic.org/schema/v1.json",
        rootNamespace: "App",
        entryPoint: "src/index.ts",
        sourceRoot: "src",
        outputDirectory: "generated",
        outputName: "App",
      };

      const config = resolveEffectiveConfig(
        workspaceConfig,
        projectConfig,
        dir,
        projectRoot
      );

      const result = buildCommand(config);
      if (!result.ok) {
        throw new Error(result.error);
      }
      expect(result.ok).to.equal(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("builds private class members in JS-surface source packages", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-build-private-source-port-")
    );
    try {
      mkdirSync(join(dir, "node_modules"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          { name: "test-workspace", private: true, type: "module" },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      linkDir(linkedJsPackageRoot, join(dir, "node_modules/@tsonic/js"));
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );

      const sourcePackageRoot = join(dir, "node_modules/@demo/private-port");
      mkdirSync(join(sourcePackageRoot, "tsonic"), { recursive: true });
      mkdirSync(join(sourcePackageRoot, "src"), { recursive: true });
      writeFileSync(
        join(sourcePackageRoot, "package.json"),
        JSON.stringify(
          {
            name: "@demo/private-port",
            version: "1.0.0",
            type: "module",
            exports: {
              ".": "./src/index.ts",
            },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(sourcePackageRoot, "tsonic/package-manifest.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            surfaces: ["@tsonic/js"],
            source: {
              exports: {
                ".": "./src/index.ts",
              },
            },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(sourcePackageRoot, "src/index.ts"),
        [
          "export class Counter {",
          '  readonly #label: string = "ctr";',
          "  #count: number = 0;",
          "",
          "  get #prefix(): string {",
          "    return this.#label;",
          "  }",
          "",
          "  #increment(): string {",
          "    this.#count += 1;",
          "    return String(this.#count);",
          "  }",
          "",
          "  append(value: string): string;",
          "  append(value: string[]): string;",
          "  append(value: string | string[]): string {",
          "    if (Array.isArray(value)) {",
          "      for (let index = 0; index < value.length; index += 1) {",
          "        const item = value[index]!;",
          "        this.append(item);",
          "      }",
          "      return this.#prefix;",
          "    }",
          "",
          "    return `${this.#prefix}:${value}:${this.#increment()}`;",
          "  }",
          "",
          "  read(): string {",
          '    return this.append("value");',
          "  }",
          "}",
          "",
          "export const createCounter = (): Counter => new Counter();",
        ].join("\n"),
        "utf-8"
      );

      const workspaceConfig = {
        $schema: "https://tsonic.org/schema/workspace/v1.json",
        dotnetVersion: "net10.0",
        surface: "@tsonic/js",
        dotnet: {
          typeRoots: ["node_modules/@tsonic/js"],
          libraries: [],
          frameworkReferences: [],
          packageReferences: [],
        },
      };

      const projectRoot = join(dir, "packages", "app");
      mkdirSync(join(projectRoot, "src"), { recursive: true });
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify(
          {
            name: "@acme/app",
            version: "1.0.0",
            private: true,
            type: "module",
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "index.ts"),
        [
          'import { createCounter } from "@demo/private-port";',
          "",
          "export function main(): void {",
          "  const counter = createCounter();",
          '  if (counter.read() !== "ctr:value:1") throw new Error("private read failed");',
          '  if (counter.append(["a", "b"]) !== "ctr") throw new Error("private append failed");',
          "}",
        ].join("\n"),
        "utf-8"
      );

      const projectConfig = {
        $schema: "https://tsonic.org/schema/v1.json",
        rootNamespace: "App",
        entryPoint: "src/index.ts",
        sourceRoot: "src",
        outputDirectory: "generated",
        outputName: "App",
      };

      const config = resolveEffectiveConfig(
        workspaceConfig,
        projectConfig,
        dir,
        projectRoot
      );

      const result = buildCommand(config);
      if (!result.ok) {
        throw new Error(result.error);
      }
      expect(result.ok).to.equal(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("builds deterministic well-known symbol members in JS-surface source packages", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-build-symbol-source-port-"));
    try {
      mkdirSync(join(dir, "node_modules"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          { name: "test-workspace", private: true, type: "module" },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      linkDir(linkedJsPackageRoot, join(dir, "node_modules/@tsonic/js"));
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );

      const sourcePackageRoot = join(dir, "node_modules/@demo/symbol-port");
      mkdirSync(join(sourcePackageRoot, "tsonic"), { recursive: true });
      mkdirSync(join(sourcePackageRoot, "src"), { recursive: true });
      writeFileSync(
        join(sourcePackageRoot, "package.json"),
        JSON.stringify(
          {
            name: "@demo/symbol-port",
            version: "1.0.0",
            type: "module",
            exports: {
              ".": "./src/index.ts",
            },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(sourcePackageRoot, "tsonic/package-manifest.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            surfaces: ["@tsonic/js"],
            source: {
              exports: {
                ".": "./src/index.ts",
              },
            },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(sourcePackageRoot, "src/index.ts"),
        [
          "export class Params {",
          "  get [Symbol.toStringTag](): string {",
          '    return "Params";',
          "  }",
          "}",
          "",
          "export const readTag = (params: Params): string => params[Symbol.toStringTag];",
        ].join("\n"),
        "utf-8"
      );

      const workspaceConfig = {
        $schema: "https://tsonic.org/schema/workspace/v1.json",
        dotnetVersion: "net10.0",
        surface: "@tsonic/js",
        dotnet: {
          typeRoots: ["node_modules/@tsonic/js"],
          libraries: [],
          frameworkReferences: [],
          packageReferences: [],
        },
      };

      const projectRoot = join(dir, "packages", "app");
      mkdirSync(join(projectRoot, "src"), { recursive: true });
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify(
          {
            name: "@acme/app",
            version: "1.0.0",
            private: true,
            type: "module",
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "index.ts"),
        [
          'import { Params, readTag } from "@demo/symbol-port";',
          "",
          "export function main(): string {",
          "  return readTag(new Params());",
          "}",
        ].join("\n"),
        "utf-8"
      );

      const projectConfig = {
        $schema: "https://tsonic.org/schema/v1.json",
        rootNamespace: "App",
        entryPoint: "src/index.ts",
        sourceRoot: "src",
        outputDirectory: "generated",
        outputName: "App",
      };

      const config = resolveEffectiveConfig(
        workspaceConfig,
        projectConfig,
        dir,
        projectRoot
      );

      const result = buildCommand(config);
      if (!result.ok) {
        throw new Error(result.error);
      }
      expect(result.ok).to.equal(true);

      const generatedLibText = readGeneratedCSharpTree(
        join(projectRoot, "generated")
      );
      expect(generatedLibText).to.not.include("[computed]");
      expect(generatedLibText).to.include("__tsonic_symbol_toStringTag");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("builds imported callback types that use aliased local type imports", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-build-import-alias-callback-")
    );
    try {
      mkdirSync(join(dir, "node_modules"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          { name: "test-workspace", private: true, type: "module" },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      linkDir(linkedJsPackageRoot, join(dir, "node_modules/@tsonic/js"));
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );

      const projectRoot = join(dir, "packages", "app");
      mkdirSync(join(projectRoot, "src"), { recursive: true });
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify(
          {
            name: "@acme/app",
            version: "1.0.0",
            private: true,
            type: "module",
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "entities.ts"),
        [
          "export class Event {",
          "  Path?: string;",
          "  VisitorId?: string;",
          "}",
        ].join("\n"),
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "top-by-key.ts"),
        [
          'import type { Event as EventEntity } from "./entities.ts";',
          "",
          "export const topByKey = (",
          "  events: readonly EventEntity[],",
          "  getKey: (e: EventEntity) => string,",
          "  getVisitor: (e: EventEntity) => string | undefined",
          "): string[] => {",
          "  const out: string[] = [];",
          "  for (let i = 0; i < events.length; i++) {",
          "    const event = events[i];",
          "    const key = getKey(event);",
          "    const visitor = getVisitor(event);",
          "    out.push(visitor === undefined ? key : `${key}:${visitor}`);",
          "  }",
          "  return out;",
          "};",
        ].join("\n"),
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "index.ts"),
        [
          'import { topByKey } from "./top-by-key.ts";',
          'import { Event } from "./entities.ts";',
          "",
          "export function main(): void {",
          "  const item = new Event();",
          '  item.Path = "/x";',
          '  item.VisitorId = "v1";',
          "  const rows = topByKey([item], (e) => e.Path!, (e) => e.VisitorId);",
          '  if (rows[0] !== "/x:v1") throw new Error("bad callback typing");',
          "}",
        ].join("\n"),
        "utf-8"
      );

      const workspaceConfig = {
        $schema: "https://tsonic.org/schema/workspace/v1.json",
        dotnetVersion: "net10.0",
        surface: "@tsonic/js",
        dotnet: {
          typeRoots: ["node_modules/@tsonic/js"],
          libraries: [],
          frameworkReferences: [],
          packageReferences: [],
        },
      };

      const projectConfig = {
        $schema: "https://tsonic.org/schema/v1.json",
        rootNamespace: "App",
        entryPoint: "src/index.ts",
        sourceRoot: "src",
        outputDirectory: "generated",
        outputName: "App",
      };

      const config = resolveEffectiveConfig(
        workspaceConfig,
        projectConfig,
        dir,
        projectRoot
      );

      const result = buildCommand(config);
      if (!result.ok) {
        throw new Error(result.error);
      }
      expect(result.ok).to.equal(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("builds contextual callback parameters that flow from imported class-backed query surfaces", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-build-contextual-class-callback-")
    );
    try {
      mkdirSync(join(dir, "node_modules"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          { name: "test-workspace", private: true, type: "module" },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      linkDir(linkedJsPackageRoot, join(dir, "node_modules/@tsonic/js"));
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );

      const projectRoot = join(dir, "packages", "app");
      mkdirSync(join(projectRoot, "src"), { recursive: true });
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify(
          {
            name: "@acme/app",
            version: "1.0.0",
            private: true,
            type: "module",
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "entities.ts"),
        [
          "export class Event {",
          "  Path?: string;",
          "  VisitorId?: string;",
          "}",
        ].join("\n"),
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "query.ts"),
        [
          "export class Query<T> {",
          "  readonly items: readonly T[];",
          "",
          "  constructor(items: readonly T[]) {",
          "    this.items = items;",
          "  }",
          "",
          "  map<TResult>(project: (value: T) => TResult): TResult[] {",
          "    const out: TResult[] = [];",
          "    for (let i = 0; i < this.items.length; i++) {",
          "      out.push(project(this.items[i]!));",
          "    }",
          "    return out;",
          "  }",
          "}",
        ].join("\n"),
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "context.ts"),
        [
          'import { Event } from "./entities.ts";',
          'import type { Event as EventEntity } from "./entities.ts";',
          'import { Query } from "./query.ts";',
          "",
          "export class ClickmeterDbContext {",
          "  readonly items: readonly EventEntity[];",
          "",
          "  constructor(items: readonly EventEntity[]) {",
          "    this.items = items;",
          "  }",
          "",
          "  get Events(): Query<EventEntity> {",
          "    return new Query<EventEntity>(this.items);",
          "  }",
          "}",
          "",
          "export const createDb = (): ClickmeterDbContext => {",
          "  const event = new Event();",
          '  event.Path = "/x";',
          '  event.VisitorId = "v1";',
          "  return new ClickmeterDbContext([event]);",
          "};",
        ].join("\n"),
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "index.ts"),
        [
          'import { createDb } from "./context.ts";',
          "",
          "export function main(): void {",
          "  const db = createDb();",
          '  const rows = db.Events.map((e) => e.Path ?? "");',
          '  if (rows[0] !== "/x") throw new Error("bad contextual callback typing");',
          "}",
        ].join("\n"),
        "utf-8"
      );

      const workspaceConfig = {
        $schema: "https://tsonic.org/schema/workspace/v1.json",
        dotnetVersion: "net10.0",
        surface: "@tsonic/js",
        dotnet: {
          typeRoots: ["node_modules/@tsonic/js"],
          libraries: [],
          frameworkReferences: [],
          packageReferences: [],
        },
      };

      const projectConfig = {
        $schema: "https://tsonic.org/schema/v1.json",
        rootNamespace: "App",
        entryPoint: "src/index.ts",
        sourceRoot: "src",
        outputDirectory: "generated",
        outputName: "App",
      };

      const config = resolveEffectiveConfig(
        workspaceConfig,
        projectConfig,
        dir,
        projectRoot
      );

      const result = buildCommand(config);
      if (!result.ok) {
        throw new Error(result.error);
      }
      expect(result.ok).to.equal(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

});
