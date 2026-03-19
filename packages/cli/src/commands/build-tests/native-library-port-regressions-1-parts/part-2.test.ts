import {
  describe,
  it
} from "mocha";
import {
  buildTestTimeoutMs
} from "../helpers.js";
import {
  expect
} from "chai";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import {
  tmpdir
} from "node:os";
import {
  dirname,
  join,
  resolve
} from "node:path";
import {
  fileURLToPath
} from "node:url";
import {
  resolveConfig
} from "../../../config.js";
import {
  applyAikyaWorkspaceOverlay
} from "../../../aikya/bindings.js";
import {
  buildCommand
} from "../../build.js";

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
          "class Response {",
          '  private header = "";',
          "  append(field: string, value: string): void;",
          "  append(field: string, value: string[]): void;",
          "  append(field: string, value: string | string[]): void {",
          "    if (Array.isArray(value)) {",
          "      for (let index = 0; index < value.length; index += 1) {",
          "        this.append(field, value[index]!);",
          "      }",
          "      return;",
          "    }",
          "    this.header = field + ':' + value;",
          "    return;",
          "  }",
          "}",
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
          "  override get(nameOrPath: string | PathSpec, ...handlers: (() => void)[]): unknown {",
          '    if (handlers.length === 0 && typeof nameOrPath === "string") {',
          "      return undefined;",
          "    }",
          "    return super.get(nameOrPath as PathSpec, ...handlers);",
          "  }",
          "",
          "  override param(name: string, callback: ParamHandler): this;",
          "  param(name: string[], callback: ParamHandler): this;",
          "  override param(name: string | string[], callback: ParamHandler): this {",
          "    if (Array.isArray(name)) {",
          "      return this;",
          "    }",
          "    return super.param(name, callback);",
          "  }",
          "}",
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
