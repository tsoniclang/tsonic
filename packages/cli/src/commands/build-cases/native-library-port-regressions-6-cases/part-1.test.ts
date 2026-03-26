import { describe, it } from "mocha";
import { buildTestTimeoutMs } from "../helpers.js";
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
import { resolveConfig } from "../../../config.js";
import { applyPackageManifestWorkspaceOverlay } from "../../../package-manifests/bindings.js";
import { buildCommand } from "../../build.js";

const repoRoot = resolve(
  join(dirname(fileURLToPath(import.meta.url)), "../../../../..")
);
const localJsPackageRoot = resolve(
  join(repoRoot, "..", "js", "versions", "10")
);
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
  const overlay = applyPackageManifestWorkspaceOverlay(
    workspaceRoot,
    workspaceConfig
  );
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

  it("builds installed source-package recursive aliases and structural local-class interface adaptation", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-build-expresslike-source-package-")
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

      const sourcePackageRoot = join(dir, "node_modules/@demo/expresslike");
      mkdirSync(join(sourcePackageRoot, "src"), { recursive: true });
      mkdirSync(join(sourcePackageRoot, "tsonic"), { recursive: true });
      writeFileSync(
        join(sourcePackageRoot, "package.json"),
        JSON.stringify(
          {
            name: "@demo/expresslike",
            version: "1.0.0",
            type: "module",
            types: "./src/index.ts",
            exports: {
              ".": "./src/index.ts",
              "./index.js": "./src/index.ts",
            },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(sourcePackageRoot, "tsonic.package.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            surfaces: ["@tsonic/js"],
            source: {
              exports: {
                ".": "./src/index.ts",
                "./index.js": "./src/index.ts",
              },
            },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(sourcePackageRoot, "src", "types.ts"),
        [
          'import type { Router } from "./router.js";',
          "",
          "export interface TransportRequest {",
          "  method: string;",
          "  path: string;",
          "  headers?: Record<string, string>;",
          "}",
          "",
          "export interface TransportResponse {",
          "  statusCode: number;",
          "  headersSent: boolean;",
          "  setHeader(name: string, value: string): void;",
          "  getHeader(name: string): string | undefined;",
          "  appendHeader(name: string, value: string): void;",
          "  sendText(text: string): Promise<void> | void;",
          "  sendBytes(bytes: Uint8Array): Promise<void> | void;",
          "}",
          "",
          "export interface TransportContext {",
          "  request: TransportRequest;",
          "  response: TransportResponse;",
          "}",
          "",
          "export type PathSpec = string | RegExp | readonly PathSpec[] | null | undefined;",
          'export type NextControl = "route" | "router" | string | null | undefined;',
          "export type NextFunction = (value?: NextControl) => void | Promise<void>;",
          "",
          "export class Request {",
          "  readonly path: string;",
          "  constructor(path: string) {",
          "    this.path = path;",
          "  }",
          "}",
          "",
          "export class Response {",
          "  readonly transport: TransportResponse;",
          "  constructor(transport: TransportResponse) {",
          "    this.transport = transport;",
          "  }",
          "  send(text: string): void {",
          "    void this.transport.sendText(text);",
          "  }",
          "}",
          "",
          "export interface RequestHandler {",
          "  (req: Request, res: Response, next: NextFunction): unknown | Promise<unknown>;",
          "}",
          "",
          "export type MiddlewareHandler = RequestHandler;",
          "export type MiddlewareParam = MiddlewareHandler | readonly MiddlewareParam[];",
          "export type MiddlewareLike = MiddlewareParam | Router | readonly MiddlewareLike[];",
          "",
          "export interface RouteLayer {",
          "  path: PathSpec;",
          "  handlers: MiddlewareHandler[];",
          "}",
        ].join("\n"),
        "utf-8"
      );
      writeFileSync(
        join(sourcePackageRoot, "src", "router.ts"),
        [
          'import { Request, Response } from "./types.js";',
          'import type { MiddlewareHandler, MiddlewareLike, MiddlewareParam, PathSpec, RequestHandler, RouteLayer, TransportContext } from "./types.js";',
          "",
          "export class Router {",
          "  readonly layers: RouteLayer[] = [];",
          "",
          "  get(path: PathSpec, ...handlers: RequestHandler[]): this {",
          "    this.layers.push({ path, handlers: [...handlers] });",
          "    return this;",
          "  }",
          "",
          "  use(...handlers: RequestHandler[]): this;",
          "  use(...handlers: MiddlewareParam[]): this;",
          "  use(...handlers: Router[]): this;",
          "  use(path: PathSpec, ...handlers: RequestHandler[]): this;",
          "  use(path: PathSpec, ...handlers: MiddlewareParam[]): this;",
          "  use(path: PathSpec, ...handlers: Router[]): this;",
          "  use(first: PathSpec | MiddlewareLike, ...rest: MiddlewareLike[]): this {",
          '    const mountedAt = isPathSpec(first) ? first : "/";',
          "    const candidates: readonly MiddlewareLike[] = isPathSpec(first) ? rest : [first, ...rest];",
          "    void mountedAt;",
          "    for (let index = 0; index < candidates.length; index += 1) {",
          "      const candidate = candidates[index]!;",
          "      if (Array.isArray(candidate)) {",
          "        continue;",
          "      }",
          "      if (candidate instanceof Router) {",
          "        continue;",
          "      }",
          "    }",
          "    return this;",
          "  }",
          "",
          "  async handle(context: TransportContext): Promise<void> {",
          "    const request = new Request(context.request.path);",
          "    const response = new Response(context.response);",
          "    for (let index = 0; index < this.layers.length; index += 1) {",
          "      const layer = this.layers[index]!;",
          "      for (let handlerIndex = 0; handlerIndex < layer.handlers.length; handlerIndex += 1) {",
          "        const handler = layer.handlers[handlerIndex]!;",
          "        await Promise.resolve(handler(request, response, async () => undefined));",
          "        if (response.transport.headersSent) {",
          "          return;",
          "        }",
          "      }",
          "    }",
          "  }",
          "}",
          "",
          "function isPathSpec(value: unknown): value is PathSpec {",
          '  if (value == null || typeof value === "string" || value instanceof RegExp) {',
          "    return true;",
          "  }",
          "  if (!Array.isArray(value)) {",
          "    return false;",
          "  }",
          "  const items = value as readonly unknown[];",
          "  for (let index = 0; index < items.length; index += 1) {",
          "    if (!isPathSpec(items[index])) {",
          "      return false;",
          "    }",
          "  }",
          "  return true;",
          "}",
        ].join("\n"),
        "utf-8"
      );
      writeFileSync(
        join(sourcePackageRoot, "src", "application.ts"),
        [
          'import { Router } from "./router.js";',
          'import type { MiddlewareLike, PathSpec, RequestHandler, TransportContext } from "./types.js";',
          "",
          "export class Application extends Router {",
          "  readonly settings: Record<string, unknown> = {};",
          "",
          "  get(name: string): unknown;",
          "  override get(path: PathSpec, ...handlers: RequestHandler[]): this;",
          "  override get(nameOrPath: string | PathSpec, ...handlers: RequestHandler[]): unknown {",
          '    if (handlers.length === 0 && typeof nameOrPath === "string") {',
          "      return this.settings[nameOrPath];",
          "    }",
          "    return super.get(nameOrPath as PathSpec, ...handlers);",
          "  }",
          "",
          "  override use(...handlers: RequestHandler[]): this;",
          "  override use(...handlers: MiddlewareLike[]): this;",
          "  override use(...handlers: Router[]): this;",
          "  override use(path: PathSpec, ...handlers: RequestHandler[]): this;",
          "  override use(path: PathSpec, ...handlers: MiddlewareLike[]): this;",
          "  override use(path: PathSpec, ...handlers: Router[]): this;",
          "  override use(first: PathSpec | MiddlewareLike, ...rest: MiddlewareLike[]): this {",
          "    const args = [first, ...rest] as unknown as [PathSpec, ...RequestHandler[]];",
          "    return super.use(...args);",
          "  }",
          "",
          "  async handle(context: TransportContext): Promise<void> {",
          "    await super.handle(context);",
          "  }",
          "}",
        ].join("\n"),
        "utf-8"
      );
      writeFileSync(
        join(sourcePackageRoot, "src", "index.ts"),
        [
          'import { Application } from "./application.js";',
          'import type { TransportContext } from "./types.js";',
          'export type { TransportContext, TransportResponse } from "./types.js";',
          "export const create = (): Application => new Application();",
          "export const dispatch = async (app: Application, context: TransportContext): Promise<void> => {",
          "  await app.handle(context);",
          "};",
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
          'import { create, dispatch } from "@demo/expresslike";',
          'import type { TransportContext, TransportResponse } from "@demo/expresslike";',
          "",
          "class MemoryResponse implements TransportResponse {",
          "  statusCode: number = 200;",
          "  headersSent: boolean = false;",
          "  headers: Record<string, string> = {};",
          "",
          "  appendHeader(name: string, value: string): void {",
          "    this.headers[name.toLowerCase()] = value;",
          "  }",
          "",
          "  getHeader(name: string): string | undefined {",
          "    return this.headers[name.toLowerCase()];",
          "  }",
          "",
          "  setHeader(name: string, value: string): void {",
          "    this.headers[name.toLowerCase()] = value;",
          "  }",
          "",
          "  sendBytes(_bytes: Uint8Array): void {",
          "    this.headersSent = true;",
          "  }",
          "",
          "  sendText(_text: string): void {",
          "    this.headersSent = true;",
          "  }",
          "}",
          "",
          "export async function main(): Promise<void> {",
          "  const app = create();",
          '  app.get("/items", async (_req, res, _next) => {',
          '    res.send("ok");',
          "  });",
          "  const response = new MemoryResponse();",
          "  const context: TransportContext = {",
          '    request: { method: "GET", path: "/items", headers: {} },',
          "    response,",
          "  };",
          "  await dispatch(app, context);",
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

      const tree = readGeneratedCSharpTree(join(projectRoot, "generated"));
      expect(tree).to.not.include(
        "global::Tsonic.Runtime.Union<global::Tsonic.Runtime.Union<global::Tsonic.Runtime.Union<object[]"
      );
      expect(tree).to.not.include("var items = value;");
      expect(tree).to.include("object?[] items = (object?[])value;");
      expect(tree).to.match(
        /class MemoryResponse\s*:\s*global::.*TransportResponse/
      );
      expect(tree).to.not.include(
        "global::App._._._.node_modules.demo.expresslike.src.types.App._._._.node_modules.demo.expresslike.src.types.TransportResponse"
      );
      expect(tree).to.match(
        /global::.*TransportResponse\.sendText\(string text\)/
      );
      expect(tree).to.match(
        /global::.*TransportResponse\.sendBytes\(global::js\.Uint8Array bytes\)/
      );
      expect(tree).to.include(
        "return global::System.Threading.Tasks.Task.CompletedTask;"
      );

      // Semantic alias preservation: the mountedAt ternary must preserve
      // PathSpec as a named alias in the Union carrier. The full-module
      // context (with typeAliasIndex/moduleMap) must NOT cause PathSpec
      // to be expanded into its runtime members.
      //
      // Correct shape:   Union<string, PathSpec>
      // Broken shape:    Union<object?[], object, string, RegExp>
      expect(tree).to.not.include("Union<object?[], object, string, RegExp>");
      // mountedAt must not trigger over-materialized Match(...) tree
      // from premature alias expansion.
      expect(tree).to.not.match(/mountedAt\.Match\(/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
