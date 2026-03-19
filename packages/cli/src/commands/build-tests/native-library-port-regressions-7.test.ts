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

  it("builds source-package module objects with function-valued members", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-build-module-object-"));
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
          "export type Parsed = { base: string };",
          "export const basename = (value: string): string => value;",
          "export const parse = (value: string): Parsed => ({ base: value });",
          "const pathObject = {",
          '  sep: "/",',
          "  basename,",
          "  parse,",
          "};",
          "export { pathObject as path };",
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
          'import { path } from "@demo/pkg";',
          "export function main(): void {",
          '  const parsed = path.parse("file.txt");',
          '  if (path.basename(parsed.base) !== "file.txt") throw new Error(path.sep);',
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

  it("builds source-package array property length access without raw direct member access", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-build-array-length-"));
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
          "export class ProcessModule {",
          '  #argv: string[] = ["node", "app"];',
          "  public get argv(): string[] {",
          "    return this.#argv;",
          "  }",
          "  public set argv(value: string[] | undefined) {",
          "    this.#argv = value ?? [];",
          "  }",
          "}",
          "export const process = new ProcessModule();",
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
          'import { process } from "@demo/pkg";',
          "export function main(): void {",
          '  if (process.argv.length !== 2) throw new Error("bad argv length");',
          "  const original = process.argv;",
          "  process.argv = undefined;",
          '  if (process.argv.length !== 0) throw new Error("bad empty argv length");',
          "  process.argv = original;",
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

      const tree = readGeneratedCSharpTree(join(projectRoot, "generated"));
      expect(tree).to.include(
        "new global::Tsonic.JSRuntime.JSArray<string>(global::App._._._.node_modules.demo.pkg.index.process.argv).length"
      );
      expect(tree).to.not.include(
        "global::App._._._.node_modules.demo.pkg.index.process.argv.length"
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("builds specialized generic array element locals without out-of-scope casts", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-build-generic-array-element-local-")
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
      linkDir(
        join(repoRoot, "node_modules/@tsonic/dotnet"),
        join(dir, "node_modules/@tsonic/dotnet")
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
          'import { List } from "@tsonic/dotnet/System.Collections.Generic.js";',
          'import type { int } from "@tsonic/core/types.js";',
          "",
          "class Item {",
          "  readonly name: string;",
          "  constructor(name: string) {",
          "    this.name = name;",
          "  }",
          "}",
          "",
          "class GenericArrayValue<T> {",
          "  readonly value: List<T>;",
          "  constructor(value: List<T>) {",
          "    this.value = value;",
          "  }",
          "}",
          "",
          "class ItemArrayValue extends GenericArrayValue<Item> {}",
          "",
          "export const firstLength = (value: ItemArrayValue): int => {",
          "  const items = value.value.ToArray();",
          "  if (items.length === 0) return 0 as int;",
          "  const item = items[0]!;",
          "  return item.name.length;",
          "};",
          "",
          "export function main(): void {}",
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

      const tree = readGeneratedCSharpTree(join(projectRoot, "generated"));
      expect(tree).to.not.include("(T)items[0]");
      expect(tree).to.not.include("(T)items[i]");
      expect(tree).to.include("var item = items[0];");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects JavaScript function.length inspection in NativeAOT builds", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-build-function-length-"));
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
          "export function getArity(handler: unknown): number {",
          '  if (typeof handler !== "function") return 0;',
          "  const maybeFunction = handler as unknown as { readonly length?: number };",
          '  return typeof maybeFunction.length === "number" ? maybeFunction.length : 0;',
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
      expect(result.ok).to.equal(false);
      if (result.ok) {
        throw new Error("Expected build to fail with TSN5001");
      }
      expect(result.error).to.include("TSN5001");
      expect(result.error).to.include("function.length is not supported");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("builds native-port callable unions without storage re-adaptation drift", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-build-callable-unions-"));
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
          'type NextControl = "route" | "router" | string | null | undefined;',
          "type NextFunction = (value?: NextControl) => void | Promise<void>;",
          "interface Request { readonly path: string; }",
          "interface Response { send(text: string): void; }",
          "interface RequestHandler {",
          "  (req: Request, res: Response, next: NextFunction): unknown | Promise<unknown>;",
          "}",
          "interface ErrorRequestHandler {",
          "  (error: unknown, req: Request, res: Response, next: NextFunction): unknown | Promise<unknown>;",
          "}",
          "type MiddlewareHandler = RequestHandler | ErrorRequestHandler;",
          "type MiddlewareParam = MiddlewareHandler | readonly MiddlewareParam[];",
          "type MiddlewareLike = MiddlewareParam | Router | readonly MiddlewareLike[];",
          "interface RouteLayer {",
          "  readonly middleware: boolean;",
          "  readonly handlers: MiddlewareHandler[];",
          "}",
          "",
          "class Router {}",
          "class TestResponse implements Response {",
          "  send(_text: string): void {}",
          "}",
          "",
          "function flattenRouteHandlers(",
          "  handlers: readonly RequestHandler[]",
          "): RequestHandler[] {",
          "  return [...handlers];",
          "}",
          "",
          "function isMiddlewareHandler(handler: unknown): handler is MiddlewareHandler {",
          '  return typeof handler === "function";',
          "}",
          "",
          "function isErrorHandler(",
          "  handler: MiddlewareHandler,",
          "  treatAsError: boolean",
          "): handler is ErrorRequestHandler {",
          "  return treatAsError;",
          "}",
          "",
          "function flattenMiddlewareEntries(",
          "  handlers: readonly MiddlewareLike[]",
          "): Array<MiddlewareHandler | Router> {",
          "  const result: Array<MiddlewareHandler | Router> = [];",
          "  const append = (handler: MiddlewareLike): void => {",
          "    if (handler == null) return;",
          "    if (Array.isArray(handler)) {",
          "      const items = handler as readonly MiddlewareLike[];",
          "      for (let index = 0; index < items.length; index += 1) {",
          "        append(items[index]!);",
          "      }",
          "      return;",
          "    }",
          "    if (handler instanceof Router) {",
          "      result.push(handler);",
          "      return;",
          "    }",
          "    if (!isMiddlewareHandler(handler)) {",
          '      throw new Error("middleware handlers must be functions");',
          "    }",
          "    result.push(handler);",
          "  };",
          "  for (const handler of handlers) append(handler);",
          "  return result;",
          "}",
          "",
          "async function invokeHandlers(",
          "  handlers: unknown[],",
          "  request: Request,",
          "  response: Response,",
          "  currentError: unknown",
          "): Promise<NextControl> {",
          "  let error = currentError;",
          "  for (const handler of handlers) {",
          "    let nextCalled = false;",
          "    let control: NextControl = undefined;",
          "    const next = async (value?: NextControl): Promise<void> => {",
          "      nextCalled = true;",
          "      control = value;",
          "    };",
          "    if (!isMiddlewareHandler(handler)) {",
          "      continue;",
          "    }",
          "    if (error === undefined) {",
          "      if (isErrorHandler(handler, false)) {",
          "        continue;",
          "      }",
          "      await handler(request, response, next);",
          "    } else {",
          "      if (!isErrorHandler(handler, true)) {",
          "        continue;",
          "      }",
          "      await handler(error, request, response, next);",
          "    }",
          '    if (nextCalled && typeof control === "string" && control !== "") {',
          "      return control;",
          "    }",
          "  }",
          "  return undefined;",
          "}",
          "",
          "export function buildLayer(handlers: readonly RequestHandler[]): RouteLayer {",
          "  return {",
          "    middleware: false,",
          "    handlers: flattenRouteHandlers(handlers),",
          "  };",
          "}",
          "",
          "export async function main(): Promise<number> {",
          "  const handler: RequestHandler = async (_req, res, next) => {",
          '    res.send("ok");',
          '    await next("route");',
          "  };",
          "  const errorHandler: ErrorRequestHandler = async (_error, _req, res, next) => {",
          '    res.send("bad");',
          '    await next("router");',
          "  };",
          "  const layers = flattenMiddlewareEntries([[handler], [errorHandler]]);",
          "  const built = buildLayer([handler]);",
          '  const request: Request = { path: "/" };',
          "  const response = new TestResponse();",
          "  await invokeHandlers([handler], request, response, undefined);",
          '  await invokeHandlers([errorHandler], request, response, "boom");',
          "  return layers.length + built.handlers.length;",
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

      const tree = readGeneratedCSharpTree(join(projectRoot, "generated"));
      expect(tree).to.not.include("control.Match(");
      expect(tree).to.not.match(
        /Enumerable\.ToArray<global::Tsonic\.Runtime\.Union<.*>>\(global::System\.Linq\.Enumerable\.Select<global::System\.Func<.*>\(global::System\.Linq\.Enumerable\.ToArray<global::Tsonic\.Runtime\.Union/
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });


});
