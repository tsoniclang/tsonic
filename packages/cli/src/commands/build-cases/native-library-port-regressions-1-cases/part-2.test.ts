import { before, describe, it } from "mocha";
import { buildTestTimeoutMs } from "../helpers.js";
import { expect } from "chai";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveConfig } from "../../../config.js";
import { applyPackageManifestWorkspaceOverlay } from "../../../package-manifests/bindings.js";
import { buildCommand } from "../../build.js";
import { skipIfNativeAotUnavailable } from "../../native-aot-test-support.js";

const repoRoot = resolve(
  join(dirname(fileURLToPath(import.meta.url)), "../../../../../..")
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

  before(function () {
    skipIfNativeAotUnavailable(this);
  });

  it("builds Array.isArray fallthrough narrowing for methods on the JS surface", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-build-array-method-fallthrough-")
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
          'import { overloads as O } from "@tsonic/core/lang.js";',
          "",
          "class Response {",
          '  #header = "";',
          "  append(field: string, value: string): void;",
          "  append(field: string, value: string[]): void;",
          "  append(_field: any, _value: any): any {",
          '    throw new Error("stub");',
          "  }",
          "  append_one(field: string, value: string): void {",
          "    this.#header = field + ':' + value;",
          "  }",
          "  append_many(field: string, value: string[]): void {",
          "    for (let index = 0; index < value.length; index += 1) {",
          "      this.append_one(field, value[index]!);",
          "    }",
          "  }",
          "}",
          "",
          "O<Response>().method(x => x.append_one).family(x => x.append);",
          "O<Response>().method(x => x.append_many).family(x => x.append);",
          "",
          "export function main(): void {",
          '  new Response().append("x", ["a", "b"]);',
          '  new Response().append("x", "c");',
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

  it("builds express-style TS overload families without emitting non-overrides as CLR overrides", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-build-express-overload-overrides-")
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
          'import { overloads as O } from "@tsonic/core/lang.js";',
          "",
          "type PathSpec = string | RegExp;",
          "type ParamHandler = (value: string) => void;",
          "",
          "class Router {",
          "  get(path: PathSpec, ...handlers: (() => void)[]): this {",
          "    void path;",
          "    void handlers;",
          "    return this;",
          "  }",
          "  param(name: string, callback: ParamHandler): this {",
          "    void name;",
          "    void callback;",
          "    return this;",
          "  }",
          "}",
          "",
          "class Application extends Router {",
          "  get(name: string): unknown;",
          "  override get(path: PathSpec, ...handlers: (() => void)[]): this;",
          "  override get(_nameOrPath: any, ..._handlers: any[]): any {",
          '    throw new Error("stub");',
          "  }",
          "  get_name(_name: string): unknown {",
          "      return undefined;",
          "  }",
          "  get_route(path: PathSpec, ...handlers: (() => void)[]): this {",
          "    return super.get(path, ...handlers);",
          "  }",
          "",
          "  override param(name: string, callback: ParamHandler): this;",
          "  param(name: string[], callback: ParamHandler): this;",
          "  override param(_name: any, _callback: any): any {",
          '    throw new Error("stub");',
          "  }",
          "  param_name(name: string, callback: ParamHandler): this {",
          "    return super.param(name, callback);",
          "  }",
          "  param_names(_name: string[], _callback: ParamHandler): this {",
          "    return this;",
          "  }",
          "}",
          "",
          "O<Application>().method(x => x.get_name).family(x => x.get);",
          "O<Application>().method(x => x.get_route).family(x => x.get);",
          "O<Application>().method(x => x.param_name).family(x => x.param);",
          "O<Application>().method(x => x.param_names).family(x => x.param);",
          "",
          "export function main(): void {",
          "  const app = new Application();",
          '  app.get("/items", () => {});',
          '  app.param("id", (_value) => {});',
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
});
