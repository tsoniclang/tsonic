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

  it("canonicalizes runtime union ordering across overload helpers and base dispatch", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-build-union-order-"));
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
          "type PathSpec = string | readonly string[] | RegExp;",
          "",
          "class Router {",
          "  get(path: PathSpec, ...handlers: (() => void)[]): this {",
          "    void path;",
          "    void handlers;",
          "    return this;",
          "  }",
          "}",
          "",
          "class Application extends Router {",
          "  get(name: string): unknown;",
          "  override get(path: PathSpec, ...handlers: (() => void)[]): this;",
          "  override get(nameOrPath: string | PathSpec, ...handlers: (() => void)[]): unknown {",
          '    if (handlers.length === 0 && typeof nameOrPath === "string") {',
          "      return undefined;",
          "    }",
          "    return super.get(nameOrPath as PathSpec, ...handlers);",
          "  }",
          "}",
          "",
          "export function main(): void {",
          "  const app = new Application();",
          '  app.get("/items", () => {});',
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
      const unionMatches = Array.from(
        tree.matchAll(
          /global::Tsonic\.Runtime\.Union<[^>]*global::Tsonic\.JSRuntime\.RegExp[^>]*>/g
        ),
        (match) => match[0]
      );
      expect(unionMatches.length).to.be.greaterThan(0);
      expect(new Set(unionMatches).size).to.equal(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("builds JSArray push calls for tuple and object-literal element values", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-build-push-element-"));
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
          "type RouteLayer = {",
          "  path: string;",
          "  method: string | undefined;",
          "  middleware: boolean;",
          "  handlers: string[];",
          "};",
          "",
          "class Params {",
          "  entries(): [string, string][] {",
          "    const result: [string, string][] = [];",
          '    const key = "name";',
          '    const value = "value";',
          "    result.push([key, value]);",
          "    return result;",
          "  }",
          "}",
          "",
          "class Router {",
          "  layers: RouteLayer[] = [];",
          "  add(path: string, method: string | undefined, handlers: string[]): void {",
          "    this.layers.push({ path, method, middleware: false, handlers });",
          "  }",
          "}",
          "",
          "export function main(): void {",
          "  new Params().entries();",
          '  new Router().add("/", "GET", []);',
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
        "push(new global::System.ValueTuple<string, string>[]"
      );
      expect(tree).to.not.include("push(new global::App.RouteLayer[]");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
