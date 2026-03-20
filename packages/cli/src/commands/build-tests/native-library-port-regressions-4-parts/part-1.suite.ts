import { describe, it } from "mocha";
import { buildTestTimeoutMs } from "../helpers.js";
import { expect } from "chai";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveConfig } from "../../../config.js";
import { applyAikyaWorkspaceOverlay } from "../../../aikya/bindings.js";
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

  it("builds recursive middleware handler surfaces in JS-surface source ports", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-build-recursive-middleware-")
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
          "interface Request { path: string; }",
          "interface Response { send(text: string): void; }",
          "interface RequestHandler {",
          "  (req: Request, res: Response, next: NextFunction): unknown | Promise<unknown>;",
          "}",
          "type MiddlewareParam = RequestHandler | readonly MiddlewareParam[];",
          "type MiddlewareLike = MiddlewareParam | Router | readonly MiddlewareLike[];",
          "class Router {",
          "  use(...handlers: readonly MiddlewareLike[]): this {",
          "    return this;",
          "  }",
          "}",
          "class Application extends Router {",
          "  mount(path: string, ...handlers: readonly MiddlewareLike[]): this {",
          "    const state = { path, handlers, owner: this };",
          "    this.use(handlers);",
          "    return state.owner;",
          "  }",
          "}",
          "",
          "export function main(): Application {",
          "  const app = new Application();",
          "  const handler: RequestHandler = async (_req, _res, next) => {",
          '    await next("route");',
          "  };",
          '  return app.mount("/", [handler]);',
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

  it("builds recursive middleware instanceof narrowing without placeholder casts", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-build-recursive-instanceof-")
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
          "type RequestHandler = (value: string) => void;",
          "type MiddlewareLike = RequestHandler | Router | readonly MiddlewareLike[];",
          "class Router {}",
          "",
          "function isMiddlewareHandler(value: MiddlewareLike): value is RequestHandler {",
          '  return typeof value === "function";',
          "}",
          "",
          "export function flatten(entries: readonly MiddlewareLike[]): readonly (RequestHandler | Router)[] {",
          "  const result: (RequestHandler | Router)[] = [];",
          "  const append = (handler: MiddlewareLike): void => {",
          "    if (Array.isArray(handler)) {",
          "      for (let index = 0; index < handler.length; index += 1) {",
          "        append(handler[index]!);",
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
          "  for (let index = 0; index < entries.length; index += 1) {",
          "    append(entries[index]!);",
          "  }",
          "  return result;",
          "}",
          "",
          "export function main(): number {",
          "  return flatten([new Router()]).length;",
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

      const generatedText = readFileSync(
        join(projectRoot, "generated", "index.cs"),
        "utf-8"
      );
      expect(generatedText).to.not.include("<castExpression>");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
